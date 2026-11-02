import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CameraSettings } from "@/components/CameraSettings";
import { CameraConnections } from "@/components/CameraConnections";
import { Go2rtcSourcePicker } from "@/components/Go2rtcSourcePicker";
import { CameraPersonSnapshot } from "@/components/CameraPersonSnapshot";
import { MediaSurface } from "@/components/devices/EntityMedia";
import { emptyConfiguration, plannerSettings } from "../../shared/configuration";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { chooseEntity } from "./entity-picker-helpers";
import { cameraSettings } from "./camera-fixtures";
import Cameras from "@/pages/Cameras";

const mocks = vi.hoisted(() => ({ app: null, shared: null, go2rtc: vi.fn(), mse: vi.fn(), ha: vi.fn(), save: vi.fn(), fetch: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => mocks.shared }));
vi.mock("@/lib/go2rtc-stream", () => ({ playGo2rtcStream: (...args) => mocks.go2rtc(...args) }));
vi.mock("@/lib/go2rtc-mse", () => ({ playGo2rtcMse: (...args) => mocks.mse(...args) }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.go2rtc.mockReset(); mocks.mse.mockReset(); mocks.ha.mockReset(); mocks.fetch.mockReset();
  mocks.app = { currentHome: mapHome({
    "camera.example": state("camera.example", "idle", { friendly_name: "HA example camera" }),
    "image.example_person": state("image.example_person", "2026-01-01T00:00:00Z", { friendly_name: "Example person image" }),
    "sensor.example_count": state("sensor.example_count", "1", { friendly_name: "Example count" }),
  }, emptyRegistries, "home"), homeOnline: true, watchCameraStream: mocks.ha };
  mocks.shared = { state: { config: emptyConfiguration(), loaded: true, error: "", saving: false }, store: { updateSettings: mocks.save } };
  mocks.save.mockImplementation(change => { mocks.shared.state.config.settings = plannerSettings(change(mocks.shared.state.config.settings)); });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ["example", "example_sub"] }); vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const renderSettings = (url = "/settings/cameras") => render(<MemoryRouter initialEntries={[url]}><CameraSettings /></MemoryRouter>);
const configure = () => { mocks.shared.state.config.settings.cameras = cameraSettings(); };

it("does not add discovered HA cameras to the camera page or settings", () => {
  const view = render(<MemoryRouter><Cameras /></MemoryRouter>);
  expect(screen.getByText("No cameras added yet")).toBeVisible();
  expect(screen.queryByText("HA example camera")).not.toBeInTheDocument();
  expect(mocks.ha).not.toHaveBeenCalled();
  view.unmount(); renderSettings();
  expect(screen.getByRole("button", { name: "Add camera" })).toBeVisible();
  expect(screen.queryByLabelText("Home Assistant camera")).not.toBeInTheDocument();
});

it("creates a reusable connection, then a named standalone go2rtc camera with a discovered stream", async () => {
  const connections = render(<MemoryRouter><CameraConnections /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Add connection" }));
  fireEvent.change(screen.getByLabelText("Connection name"), { target: { value: "Example server" } });
  fireEvent.change(screen.getByLabelText("Server address"), { target: { value: "http://go2rtc.example:1984/" } });
  fireEvent.click(screen.getByRole("button", { name: "Save connection" }));
  const connection = mocks.shared.state.config.settings.cameras.connections[0];
  expect(connection.url).toBe("http://go2rtc.example:1984"); connections.unmount();
  mocks.app.currentHome = mapHome({}, emptyRegistries, "home");
  renderSettings("/settings/cameras?add");
  fireEvent.change(screen.getByLabelText("Camera name"), { target: { value: "My example camera" } });
  fireEvent.change(screen.getByLabelText("Connection"), { target: { value: connection.id } });
  await screen.findByRole("option", { name: "example_sub" });
  fireEvent.change(screen.getByLabelText("Stream"), { target: { value: "example_sub" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and test camera" }));
  const camera = mocks.shared.state.config.settings.cameras.items[0];
  expect(camera).toMatchObject({ name: "My example camera", connectionId: connection.id, source: "example_sub" });
  expect(mocks.go2rtc).toHaveBeenCalledWith(camera.id, expect.any(HTMLVideoElement), expect.any(AbortSignal), expect.any(Function));
  expect(mocks.ha).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Use in notification" })).toHaveAttribute("href", `/settings/notifications?camera=${camera.id}`);
});

it("adds a selected HA camera with a local name and optional person image", () => {
  renderSettings("/settings/cameras?add");
  fireEvent.change(screen.getByLabelText("Camera name"), { target: { value: "Selected camera" } });
  fireEvent.change(screen.getByLabelText("Connection"), { target: { value: "home-assistant" } });
  chooseEntity("Home Assistant camera", "camera.example");
  fireEvent.click(screen.getByText("Person image (optional)"));
  fireEvent.change(screen.getByLabelText("Person snapshot source"), { target: { value: "home-assistant" } });
  chooseEntity("Person image entity", "image.example_person");
  fireEvent.click(screen.getByRole("button", { name: "Save and test camera" }));
  expect(mocks.shared.state.config.settings.cameras.items[0]).toMatchObject({ name: "Selected camera", connectionId: "home-assistant", source: "camera.example", personSnapshot: { type: "home-assistant", entity: "image.example_person" } });
  expect(mocks.ha).toHaveBeenCalledWith("camera.example", expect.any(HTMLVideoElement), expect.any(AbortSignal), expect.any(Function));
  expect(mocks.go2rtc).not.toHaveBeenCalled();
});

it("retains invalid drafts and refuses to overwrite edits from another screen", () => {
  configure(); renderSettings("/settings/cameras?camera=example-camera");
  fireEvent.change(screen.getByLabelText("Camera name"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Save camera" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a camera name");
  expect(screen.getByLabelText("Camera name")).toHaveValue("");
  mocks.shared.state.config.settings.cameras.items[0].name = "Changed elsewhere";
  fireEvent.click(screen.getByRole("button", { name: "Save camera" }));
  expect(screen.getByRole("alert")).toHaveTextContent("changed on another screen");
  expect(mocks.shared.state.config.settings.cameras.items[0].name).toBe("Changed elsewhere");
});

it("prevents deleting connections used by live video or snapshots and confirms deleting unused ones", () => {
  configure();
  const settings = mocks.shared.state.config.settings.cameras;
  settings.connections.push({ id: "frigate", name: "Example Frigate", type: "frigate", url: "http://frigate.example:5000" }, { id: "unused", name: "Unused example", type: "go2rtc", url: "http://other.example:1984" });
  settings.items[0].personSnapshot = { type: "frigate", connectionId: "frigate", camera: "example" };
  render(<MemoryRouter><CameraConnections /></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Delete Example go2rtc" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Delete Example Frigate" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Delete Unused example" }));
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(mocks.shared.state.config.settings.cameras.connections.map(item => item.id)).toEqual(["example-go2rtc", "frigate"]);
});

it("plays configured go2rtc without HA, stops on suspension and retries without changing connectors", () => {
  configure(); mocks.app.homeOnline = false;
  const camera = mocks.shared.state.config.settings.cameras.items[0];
  const view = render(<MediaSurface camera={camera} expanded />);
  expect(mocks.go2rtc).toHaveBeenCalledOnce();
  const signal = mocks.go2rtc.mock.calls[0][2];
  view.rerender(<MediaSurface camera={camera} expanded suspended />);
  expect(signal.aborted).toBe(true);
  mocks.go2rtc.mockImplementation((_id, _video, _signal, failed) => failed());
  mocks.mse.mockImplementation((_id, _video, _signal, failed) => failed("Stream unavailable"));
  view.rerender(<MediaSurface camera={camera} expanded />);
  expect(mocks.mse).toHaveBeenCalledWith(camera.id, expect.any(HTMLVideoElement), expect.any(AbortSignal), expect.any(Function));
  expect(screen.getByRole("status")).toHaveTextContent("Stream unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(mocks.go2rtc).toHaveBeenCalledTimes(3);
  expect(mocks.ha).not.toHaveBeenCalled();
  view.rerender(<MediaSurface camera={{ ...camera, source: "example_sub" }} expanded />);
  expect(mocks.go2rtc).toHaveBeenCalledTimes(4);
});

it("ignores stream discovery from the previous connection and offers manual input after failure", async () => {
  let resolve: (value: unknown) => void;
  mocks.fetch.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockRejectedValueOnce(new Error());
  const connection = cameraSettings().connections[0];
  const view = render(<Go2rtcSourcePicker connection={connection} value="" onChange={vi.fn()} />);
  const firstSignal = mocks.fetch.mock.calls[0][1].signal;
  view.rerender(<Go2rtcSourcePicker connection={{ ...connection, id: "other" }} value="" onChange={vi.fn()} />);
  expect(firstSignal.aborted).toBe(true);
  await screen.findByText("Could not load streams. Check the connection, retry, or enter a stream name manually.");
  await act(async () => { resolve({ ok: true, json: async () => ["wrong-server"] }); });
  expect(screen.queryByRole("option", { name: "wrong-server" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Enter stream manually" }));
  expect(screen.getByLabelText("Stream name or go2rtc link")).toBeVisible();
});

it("accepts a pasted player link and blocks a link for another connection", async () => {
  configure(); renderSettings("/settings/cameras?camera=example-camera");
  await screen.findByRole("option", { name: "example_sub" });
  fireEvent.click(screen.getByRole("button", { name: "Enter stream manually" }));
  fireEvent.change(screen.getByLabelText("Stream name or go2rtc link"), { target: { value: "http://other.example:1984/stream.html?src=example_sub" } });
  fireEvent.click(screen.getByRole("button", { name: "Save camera" }));
  expect(mocks.shared.state.config.settings.cameras.items[0].source).toBe("example");
  expect(screen.queryByRole("link", { name: "Open in go2rtc (new tab)" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Stream name or go2rtc link"), { target: { value: "http://go2rtc.example:1984/webrtc.html?src=example_sub&media=video+audio" } });
  expect(screen.getByRole("link", { name: "Open in go2rtc (new tab)" })).toHaveAttribute("href", "http://go2rtc.example:1984/stream.html?src=example_sub");
  fireEvent.click(screen.getByRole("button", { name: "Save camera" }));
  expect(mocks.shared.state.config.settings.cameras.items[0].source).toBe("example_sub");
});

it("refreshes late person images, labels their age limit and clears polling on close", () => {
  vi.useFakeTimers(); configure();
  const view = render(<CameraPersonSnapshot cameraId="example-camera" />);
  const first = screen.getByRole("img").getAttribute("src");
  act(() => { vi.advanceTimersByTime(10000); });
  expect(screen.getByRole("img").getAttribute("src")).toBe(first);
  fireEvent.load(screen.getByRole("img"));
  expect(screen.getByText("Latest person snapshot · may predate this alert")).toBeVisible();
  act(() => { vi.advanceTimersByTime(5000); });
  expect(screen.getByRole("img").getAttribute("src")).not.toBe(first);
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("status")).toHaveTextContent("Person snapshot unavailable");
  view.unmount(); expect(vi.getTimerCount()).toBe(0);
});
