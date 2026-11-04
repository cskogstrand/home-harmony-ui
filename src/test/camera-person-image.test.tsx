import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CameraPersonImageProvider } from "@/contexts/CameraPersonImageProvider";
import { CameraPersonSnapshot } from "@/components/CameraPersonSnapshot";
import { emptyConfiguration } from "../../shared/configuration";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { cameraSettings } from "./camera-fixtures";

const mocks = vi.hoisted(() => ({ app: null, shared: null }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => mocks.shared }));
const fetchImage = vi.fn(), decode = vi.fn(), create = vi.fn(), revoke = vi.fn();
const response = () => new Response(new Blob(["fictional-image"], { type: "image/jpeg" }), { headers: { "Content-Type": "image/jpeg" } });
const content = (viewers = 0) => <CameraPersonImageProvider>{Array.from({ length: viewers }, (_, index) => <CameraPersonSnapshot key={index} cameraId="example-camera" />)}</CameraPersonImageProvider>;
const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };
const updateEntity = (id = "image.example_person") => { mocks.app.currentHome.entities.find(entity => entity.entityId === id).lastUpdated += "-updated"; };
beforeEach(() => {
  vi.useFakeTimers();
  const config = emptyConfiguration(); config.settings.cameras = cameraSettings();
  mocks.shared = { state: { config, loaded: true, dirty: false, saving: false, error: "" } };
  mocks.app = { haUrl: "http://home-assistant.example", connectionStatus: "connected", currentHome: mapHome({
    "image.example_person": state("image.example_person", "2026-01-01T00:00:00Z"),
    "sensor.example_picture": state("sensor.example_picture", "1", { entity_picture: "/api/image_proxy/image.example_person?token=fixture" }),
    "sensor.example_other": state("sensor.example_other", "1"),
  }, emptyRegistries, "home") };
  fetchImage.mockReset().mockImplementation(async () => response()); decode.mockReset().mockResolvedValue(undefined);
  let index = 0; create.mockReset().mockImplementation(() => `blob:frame-${++index}`); revoke.mockReset();
  vi.stubGlobal("fetch", fetchImage);
  vi.stubGlobal("Image", class { src = ""; decode = decode; });
  vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("prefetches on page load and immediately reuses the decoded image across viewers and reopening", async () => {
  const view = render(content());
  expect(fetchImage).toHaveBeenCalledExactlyOnceWith("/api/cameras/example-camera/person.jpg", { signal: expect.any(AbortSignal), cache: "no-store" });
  await flush();
  expect(decode).toHaveBeenCalledOnce(); expect(screen.queryByRole("img")).not.toBeInTheDocument();
  view.rerender(content(2));
  expect(screen.getAllByRole("img").map(image => image.getAttribute("src"))).toEqual(["blob:frame-1", "blob:frame-1"]);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(view.container.querySelector("video")).toBeNull();
  view.rerender(content()); view.rerender(content(1));
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-1");
  expect(fetchImage).toHaveBeenCalledOnce();
  view.unmount(); expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:frame-1"); expect(vi.getTimerCount()).toBe(0);
});

it("keeps the person-image explanation in the corner status popover instead of a caption row", async () => {
  render(content(1)); await flush();
  const label = "Latest person snapshot · may predate this alert";
  expect(screen.getByRole("img", { name: "Latest person snapshot" })).toBeVisible();
  expect(screen.queryByText(label)).not.toBeInTheDocument();
  const status = screen.getByRole("button", { name: label });
  expect(status.textContent).toBe("");
  fireEvent.click(status);
  expect(screen.getByRole("dialog", { name: label })).toHaveTextContent(label);
  fireEvent.keyDown(screen.getByRole("dialog", { name: label }), { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("refreshes the cache from HA updates with no viewer and retains the previous frame until decoding finishes", async () => {
  const view = render(content()); await flush();
  updateEntity("sensor.example_other"); view.rerender(content()); await flush();
  expect(fetchImage).toHaveBeenCalledOnce();
  let finishDecode: () => void;
  decode.mockReturnValueOnce(new Promise<void>(resolve => { finishDecode = resolve; }));
  updateEntity(); view.rerender(content()); await flush();
  expect(fetchImage).toHaveBeenCalledTimes(2);
  view.rerender(content(1)); expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-1");
  expect(revoke).not.toHaveBeenCalled();
  await act(async () => { finishDecode(); });
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-2"); expect(revoke).toHaveBeenCalledWith("blob:frame-1");
  view.rerender(content());
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(fetchImage).toHaveBeenCalledTimes(2);
});

it("follows updates to the image referenced by a picture sensor", async () => {
  mocks.shared.state.config.settings.cameras.items[0].personSnapshot = { type: "home-assistant", entity: "sensor.example_picture" };
  const view = render(content()); await flush();
  updateEntity(); view.rerender(content()); await flush();
  expect(fetchImage).toHaveBeenCalledTimes(2);
});

it("coalesces HA updates during a slow request without starving or overlapping downloads", async () => {
  let finish: (response: Response) => void;
  fetchImage.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = render(content(2));
  for (let index = 0; index < 3; index++) { updateEntity(); view.rerender(content(2)); }
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(fetchImage).toHaveBeenCalledOnce(); expect(fetchImage.mock.calls[0][1].signal.aborted).toBe(false);
  await act(async () => { finish(response()); }); await flush();
  expect(fetchImage).toHaveBeenCalledTimes(2);
  expect(screen.getAllByRole("img").every(image => image.getAttribute("src") === "blob:frame-2")).toBe(true);
});

it("keeps a cached image on failure, exposes retry, and retries initial failures without a viewer", async () => {
  fetchImage.mockRejectedValueOnce(new Error());
  const view = render(content()); await flush();
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  view.rerender(content(1)); expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-1");
  fetchImage.mockResolvedValueOnce(new Response("not an image", { headers: { "Content-Type": "text/html" } }));
  updateEntity(); view.rerender(content(1)); await flush();
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-1");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Could not update the person snapshot. Showing the previous image." }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Showing the previous image");
  fireEvent.click(screen.getByRole("button", { name: "Retry" })); await flush();
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-2");
  expect(screen.getByRole("dialog")).toHaveTextContent("may predate this alert");
  expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
});

it("shares the overlay image with full viewers and offers status and retry without replacing video", async () => {
  const overlay = () => <CameraPersonImageProvider><CameraPersonSnapshot cameraId="example-camera" /><CameraPersonSnapshot cameraId="example-camera" overlay /></CameraPersonImageProvider>;
  const view = render(overlay()); await flush();
  expect(fetchImage).toHaveBeenCalledOnce();
  expect(screen.getAllByRole("img").map(image => image.getAttribute("src"))).toEqual(["blob:frame-1", "blob:frame-1"]);
  fireEvent.click(screen.getByRole("button", { name: "Latest person snapshot" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("may predate this alert");
  fetchImage.mockRejectedValueOnce(new Error());
  updateEntity(); view.rerender(overlay()); await flush();
  expect(screen.getByRole("dialog")).toHaveTextContent("Showing the previous image");
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Retry" })); await flush();
  expect(screen.getAllByRole("img").every(image => image.getAttribute("src") === "blob:frame-2")).toBe(true);
});

it("resizes every inset for a camera without discarding or reloading its cached image", async () => {
  const overlay = () => <CameraPersonImageProvider><CameraPersonSnapshot cameraId="example-camera" overlay /><CameraPersonSnapshot cameraId="example-camera" overlay /></CameraPersonImageProvider>;
  const view = render(overlay()); await flush();
  expect(screen.getAllByRole("button", { name: "Latest person snapshot" }).every(button => button.dataset.size === "medium")).toBe(true);
  for (const [size, width] of [["small", "16%"], ["medium", "24%"], ["large", "36%"], ["xlarge", "48%"]]) {
    mocks.shared.state.config.settings.cameras.items[0].personPipSize = size;
    view.rerender(overlay()); await flush();
    expect(screen.getAllByRole("button", { name: "Latest person snapshot" }).every(button => button.dataset.size === size)).toBe(true);
    for (const button of screen.getAllByRole("button", { name: "Latest person snapshot" })) expect(button).toHaveStyle({ width });
    expect(screen.getAllByRole("img").every(image => image.getAttribute("src") === "blob:frame-1")).toBe(true);
  }
  expect(fetchImage).toHaveBeenCalledOnce(); expect(revoke).not.toHaveBeenCalled();
});

it("keeps each camera's decoded dimensions with its cached person image", async () => {
  const settings = mocks.shared.state.config.settings.cameras;
  settings.items.push({ ...settings.items[0], id: "second-camera", personSnapshot: { type: "home-assistant", entity: "image.second_person" } });
  vi.stubGlobal("Image", class {
    src = ""; decode = decode;
    get naturalWidth() { return this.src === "blob:frame-1" ? 1920 : 1080; }
    get naturalHeight() { return this.src === "blob:frame-1" ? 1080 : 1920; }
  });
  const overlay = () => <CameraPersonImageProvider><CameraPersonSnapshot cameraId="example-camera" overlay /><CameraPersonSnapshot cameraId="second-camera" overlay /></CameraPersonImageProvider>;
  const view = render(overlay()); await flush();
  const sizes = () => screen.getAllByRole("img").map(image => [image.getAttribute("width"), image.getAttribute("height")]);
  expect(sizes()).toEqual([["1920", "1080"], ["1080", "1920"]]);
  view.rerender(<CameraPersonImageProvider>{null}</CameraPersonImageProvider>); view.rerender(overlay());
  expect(sizes()).toEqual([["1920", "1080"], ["1080", "1920"]]);
  expect(fetchImage).toHaveBeenCalledTimes(2);
});

it("changes the inset format only when the replacement image is decoded and retains it on failure", async () => {
  vi.stubGlobal("Image", class {
    src = ""; decode = decode;
    get naturalWidth() { return this.src === "blob:frame-1" ? 1920 : 1440; }
    naturalHeight = 1080;
  });
  const overlay = () => <CameraPersonImageProvider><CameraPersonSnapshot cameraId="example-camera" overlay /></CameraPersonImageProvider>;
  const view = render(overlay()); await flush();
  expect(screen.getByRole("img")).toHaveAttribute("width", "1920");
  expect(screen.getByRole("img")).toHaveAttribute("height", "1080");
  let finishDecode: () => void;
  decode.mockReturnValueOnce(new Promise<void>(resolve => { finishDecode = resolve; }));
  updateEntity(); view.rerender(overlay()); await flush();
  expect(screen.getByRole("img")).toHaveAttribute("width", "1920");
  await act(async () => finishDecode());
  expect(screen.getByRole("img")).toHaveAttribute("width", "1440");
  expect(screen.getByRole("img")).toHaveAttribute("height", "1080");
  fetchImage.mockRejectedValueOnce(new Error()); updateEntity(); view.rerender(overlay()); await flush();
  expect(screen.getByRole("img")).toHaveAttribute("width", "1440");
  expect(screen.getByRole("button", { name: "Latest person snapshot" })).toHaveStyle({ width: "24%" });
  expect(fetchImage).toHaveBeenCalledTimes(3);
});

it("discards old sources and late decodes, releases removed images, and refreshes changed server connections", async () => {
  let finishDecode: () => void;
  decode.mockReturnValueOnce(new Promise<void>(resolve => { finishDecode = resolve; }));
  const view = render(content(1)); await flush();
  const settings = mocks.shared.state.config.settings.cameras;
  settings.connections.push({ id: "frigate", name: "Example Frigate", type: "frigate", url: "http://frigate.example" });
  settings.items[0].personSnapshot = { type: "frigate", connectionId: "frigate", camera: "example" };
  view.rerender(content(1)); await flush();
  expect(fetchImage.mock.calls[0][1].signal.aborted).toBe(true); expect(revoke).toHaveBeenCalledWith("blob:frame-1");
  await act(async () => { finishDecode(); });
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-2");
  settings.connections[1].url = "http://second.example"; view.rerender(content(1)); await flush();
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-3");
  settings.items = []; view.rerender(content());
  expect(revoke.mock.calls.flat()).toEqual(["blob:frame-1", "blob:frame-2", "blob:frame-3"]);
  expect(vi.getTimerCount()).toBe(0);
});

it("polls direct Frigate caches without a viewer, pauses background polling and refreshes on return", async () => {
  mocks.shared.state.config.settings.cameras.items[0].personSnapshot = { type: "frigate", connectionId: "frigate", camera: "example" };
  render(content()); await flush();
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(fetchImage).toHaveBeenCalledTimes(2);
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); }); expect(fetchImage).toHaveBeenCalledTimes(2);
  hidden.mockReturnValue(false); fireEvent(document, new Event("visibilitychange")); await flush();
  expect(fetchImage).toHaveBeenCalledTimes(3);
});

it("shares visible HA polling between viewers and stops it when both close", async () => {
  const view = render(content(2)); await flush();
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(fetchImage).toHaveBeenCalledTimes(2);
  view.rerender(content());
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); }); expect(fetchImage).toHaveBeenCalledTimes(2);
});

it("waits for saved configuration, retains the cache during saves, and clears it on an authentication error", async () => {
  mocks.shared.state.loaded = false;
  const view = render(content()); expect(fetchImage).not.toHaveBeenCalled();
  mocks.shared.state.loaded = true; mocks.shared.state.saving = true;
  view.rerender(content()); expect(fetchImage).not.toHaveBeenCalled();
  mocks.shared.state.saving = false; view.rerender(content()); await flush();
  mocks.shared.state.saving = true; view.rerender(content(1));
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-1"); expect(revoke).not.toHaveBeenCalled();
  mocks.app.connectionStatus = "auth-error"; view.rerender(content(1));
  expect(screen.queryByRole("img")).not.toBeInTheDocument(); expect(revoke).toHaveBeenCalledWith("blob:frame-1");
});

it("bounds a stalled decode and retries after the timeout", async () => {
  decode.mockReturnValueOnce(new Promise(() => {}));
  render(content(1)); await flush();
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(fetchImage.mock.calls[0][1].signal.aborted).toBe(true); expect(revoke).toHaveBeenCalledWith("blob:frame-1");
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(screen.getByRole("img")).not.toHaveAttribute("src", "blob:frame-1");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
