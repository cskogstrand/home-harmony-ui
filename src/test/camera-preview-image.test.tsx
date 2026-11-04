import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CameraPreviewImageProvider } from "@/contexts/CameraPreviewImageProvider";
import { CameraStreamPreview } from "@/components/CameraStreamPreview";
import { emptyConfiguration } from "../../shared/configuration";
import { cameraPreviewPath } from "../../shared/cameras";
import { cameraSettings } from "./camera-fixtures";

const mocks = vi.hoisted(() => ({ app: null, shared: null }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => mocks.shared }));
const fetchImage = vi.fn(), decode = vi.fn(), create = vi.fn(), revoke = vi.fn();
const response = () => new Response(new Blob(["fictional-image"], { type: "image/jpeg" }), { headers: { "Content-Type": "image/jpeg" } });
const content = (viewers = 0, active = true) => <CameraPreviewImageProvider>{Array.from({ length: viewers }, (_, index) =>
  <CameraStreamPreview key={index} src={cameraPreviewPath(mocks.shared.state.config.settings.cameras.items[0])} name="Example camera" status="Loading image…" active={active} />)}</CameraPreviewImageProvider>;
const advance = async (time = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(time); }); };
beforeEach(() => {
  vi.useFakeTimers();
  const config = emptyConfiguration(); config.settings.cameras = cameraSettings();
  mocks.shared = { state: { config, loaded: true, dirty: false, saving: false, error: "" } };
  mocks.app = { haUrl: "http://home-assistant.example", connectionStatus: "connected" };
  fetchImage.mockReset().mockImplementation(async () => response()); decode.mockReset().mockResolvedValue(undefined);
  let index = 0; create.mockReset().mockImplementation(() => `blob:frame-${++index}`); revoke.mockReset();
  vi.stubGlobal("fetch", fetchImage);
  vi.stubGlobal("Image", class { src = ""; decode = decode; });
  vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it.each(["go2rtc", "home-assistant", "frigate"])("prefetches %s stills before opening viewers and shares them across reopening and video playback", async source => {
  const settings = mocks.shared.state.config.settings.cameras;
  if (source === "home-assistant") Object.assign(settings.items[0], { connectionId: "home-assistant", source: "camera.example" });
  if (source === "frigate") {
    settings.connections.push({ id: "frigate", name: "Example Frigate", type: "frigate", url: "http://frigate.example" });
    settings.items[0].frigatePreview = { connectionId: "frigate", camera: "example" };
  }
  const view = render(content());
  expect(fetchImage).toHaveBeenCalledExactlyOnceWith(source === "home-assistant" ? "/api/camera_proxy/camera.example" : "/api/cameras/example-camera/snapshot.jpg",
    { signal: expect.any(AbortSignal), cache: "no-store" });
  await advance();
  view.rerender(content(2));
  expect(screen.getAllByRole("img").map(image => image.getAttribute("src"))).toEqual(["blob:frame-1", "blob:frame-1"]);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  view.rerender(content()); view.rerender(content(1, false));
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-1");
  await advance(4999); expect(fetchImage).toHaveBeenCalledOnce();
  await advance(1); expect(fetchImage).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-2");
  view.unmount();
  expect(revoke.mock.calls.flat()).toEqual(["blob:frame-1", "blob:frame-2"]); expect(vi.getTimerCount()).toBe(0);
});

it("keeps the last decoded still through slow and failed refreshes without overlapping downloads", async () => {
  let finishDecode: () => void;
  const view = render(content(2)); await advance();
  decode.mockReturnValueOnce(new Promise<void>(resolve => { finishDecode = resolve; }));
  await advance(10000); expect(fetchImage).toHaveBeenCalledTimes(2);
  expect(screen.getAllByRole("img").every(image => image.getAttribute("src") === "blob:frame-1")).toBe(true);
  expect(revoke).not.toHaveBeenCalled();
  await act(async () => { finishDecode(); });
  expect(screen.getAllByRole("img").every(image => image.getAttribute("src") === "blob:frame-2")).toBe(true);
  fetchImage.mockRejectedValueOnce(new Error());
  await advance(5000);
  view.rerender(content()); view.rerender(content(1));
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-2");
  await advance(5000); expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-3");
});

it("pauses polling in hidden tabs and refreshes on return, including with no viewers", async () => {
  render(content()); await advance();
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  await advance(10000); expect(fetchImage).toHaveBeenCalledOnce();
  hidden.mockReturnValue(false); fireEvent(document, new Event("visibilitychange")); await advance();
  expect(fetchImage).toHaveBeenCalledTimes(2);
  await advance(5000); expect(fetchImage).toHaveBeenCalledTimes(3);
});

it("waits for saved settings, retains stills during saves, and prevents viewer requests after auth errors", async () => {
  mocks.shared.state.loaded = false;
  const view = render(content(1)); expect(fetchImage).not.toHaveBeenCalled();
  mocks.shared.state.loaded = true; mocks.shared.state.dirty = true;
  view.rerender(content(1)); await advance(5000); expect(fetchImage).not.toHaveBeenCalled();
  mocks.shared.state.dirty = false; view.rerender(content(1)); await advance();
  mocks.shared.state.saving = true; view.rerender(content(1)); await advance(5000);
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-1"); expect(fetchImage).toHaveBeenCalledOnce();
  mocks.shared.state.saving = false; mocks.app.connectionStatus = "auth-error"; view.rerender(content(1));
  await advance(10000);
  expect(screen.queryByRole("img")).not.toBeInTheDocument(); expect(revoke).toHaveBeenCalledWith("blob:frame-1");
  expect(fetchImage).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  mocks.app.connectionStatus = "connected"; view.rerender(content(1)); await advance();
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-2");
});

it.each(["stream", "connection", "preview", "home-assistant"])("invalidates stills on %s changes, ignores late decodes, and releases removed cameras", async change => {
  const settings = mocks.shared.state.config.settings.cameras;
  if (change === "home-assistant") Object.assign(settings.items[0], { connectionId: "home-assistant", source: "camera.example" });
  const view = render(content(1)); await advance();
  let finishDecode: () => void;
  decode.mockReturnValueOnce(new Promise<void>(resolve => { finishDecode = resolve; }));
  await advance(5000);
  if (change === "stream") settings.items[0].source = "second";
  if (change === "connection") settings.connections[0].url = "http://second.example";
  if (change === "preview") settings.items[0].frigatePreview = { connectionId: "frigate", camera: "example" };
  if (change === "home-assistant") mocks.app.haUrl = "http://second.example";
  view.rerender(content(1));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(fetchImage.mock.calls[1][1].signal.aborted).toBe(true);
  await act(async () => { finishDecode(); }); await advance();
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:frame-3");
  settings.items = []; view.rerender(content());
  expect(revoke.mock.calls.flat().sort()).toEqual(["blob:frame-1", "blob:frame-2", "blob:frame-3"]);
  expect(vi.getTimerCount()).toBe(0);
});

it("shares one refresh when configured cameras reference the same HA image source", async () => {
  const settings = mocks.shared.state.config.settings.cameras;
  Object.assign(settings.items[0], { connectionId: "home-assistant", source: "camera.example" });
  settings.items.push({ ...settings.items[0], id: "second-camera" });
  render(content(2)); await advance(); expect(fetchImage).toHaveBeenCalledOnce();
  await advance(5000); expect(fetchImage).toHaveBeenCalledTimes(2);
});
