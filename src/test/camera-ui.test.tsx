import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CameraSettings } from "@/components/CameraSettings";
import { CameraConnections } from "@/components/CameraConnections";
import { Go2rtcSourcePicker } from "@/components/Go2rtcSourcePicker";
import { EntityMedia, MediaSurface } from "@/components/devices/EntityMedia";
import { emptyConfiguration, plannerSettings } from "../../shared/configuration";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { chooseEntity } from "./entity-picker-helpers";
import { cameraSettings } from "./camera-fixtures";
import Cameras from "@/pages/Cameras";
import { PageActivityContext } from "@/contexts/PageActivityContext";
import { CameraPreviewImageContext } from "@/contexts/CameraPreviewImageContext";

const mocks = vi.hoisted(() => ({ app: null, shared: null, go2rtc: vi.fn(), mse: vi.fn(), ha: vi.fn(), save: vi.fn(), fetch: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => mocks.shared }));
vi.mock("@/contexts/CameraPersonImageContext", () => ({ useCameraPersonImage: (id: string) => ({ src: `/api/cameras/${id}/person.jpg`, failed: false, refresh: vi.fn() }) }));
vi.mock("@/lib/go2rtc-stream", () => ({ playGo2rtcStream: (...args) => mocks.go2rtc(...args) }));
vi.mock("@/lib/go2rtc-mse", () => ({ playGo2rtcMse: (...args) => mocks.mse(...args) }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.go2rtc.mockReset(); mocks.mse.mockReset(); mocks.ha.mockReset(); mocks.fetch.mockReset();
  mocks.app = { currentHome: mapHome({
    "camera.example": state("camera.example", "idle", { friendly_name: "HA example camera" }),
    "image.example_person": state("image.example_person", "2026-01-01T00:00:00Z", { friendly_name: "Example person image" }),
    "sensor.example_count": state("sensor.example_count", "1", { friendly_name: "Example count" }),
  }, { ...emptyRegistries, entities: [
    { id: "registered-camera", entity_id: "camera.example" },
    { id: "registered-person-image", entity_id: "image.example_person" },
  ] }, "home"), homeOnline: true, watchCameraStream: mocks.ha };
  mocks.shared = { state: { config: emptyConfiguration(), loaded: true, error: "", saving: false }, store: { updateSettings: mocks.save } };
  mocks.save.mockImplementation(change => { mocks.shared.state.config.settings = plannerSettings(change(mocks.shared.state.config.settings)); });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ["example", "example_sub"] }); vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const renderSettings = (url = "/settings/cameras") => render(<MemoryRouter initialEntries={[url]}><CameraSettings /></MemoryRouter>);
const configure = () => { mocks.shared.state.config.settings.cameras = cameraSettings(); };

it("saves the camera's person inset size, uses it in live previews and retains it when reopened", () => {
  configure(); mocks.fetch.mockReturnValue(new Promise(() => {}));
  renderSettings("/settings/cameras?camera=example-camera");
  const choices = within(screen.getByRole("group", { name: "Person inset size" }));
  expect(choices.getAllByRole("button")).toHaveLength(4);
  expect(choices.getByRole("button", { name: "Medium 24% of video width" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(choices.getByRole("button", { name: "Extra large 48% of video width" }));
  fireEvent.click(screen.getByRole("button", { name: "Save and test camera" }));
  expect(mocks.shared.state.config.settings.cameras.items[0].personPipSize).toBe("xlarge");
  expect(screen.getByRole("button", { name: "Latest person snapshot" })).toHaveAttribute("data-size", "xlarge");
  expect(screen.getByRole("button", { name: "Latest person snapshot" })).toHaveStyle({ width: "48%" });
  fireEvent.click(screen.getByRole("button", { name: "Edit Example camera" }));
  expect(screen.getByRole("button", { name: "Extra large 48% of video width" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.change(screen.getByLabelText("Person snapshot source"), { target: { value: "none" } });
  expect(screen.queryByRole("group", { name: "Person inset size" })).not.toBeInTheDocument();
});

it.each([
  [1920, 1080, 1066.6667, 600, 360, 202.5],
  [1440, 1080, 800, 600, 320, 240],
  [1080, 1920, 337.5, 600, 135, 240],
  [3840, 1080, 1600, 450, 360, 101.25],
])("sizes and positions the inset within a %i × %i video as its frame resizes", (videoWidth, videoHeight, desktopWidth, desktopHeight, phoneWidth, phoneHeight) => {
  configure(); mocks.fetch.mockReturnValue(new Promise(() => {}));
  let resize: (width: number, height: number) => void;
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resize = (width, height) => callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    observe() {} disconnect = disconnect;
  });
  const view = render(<MediaSurface camera={mocks.shared.state.config.settings.cameras.items[0]} expanded />);
  const video = view.container.querySelector("video");
  vi.spyOn(video, "videoWidth", "get").mockReturnValue(videoWidth);
  vi.spyOn(video, "videoHeight", "get").mockReturnValue(videoHeight);
  vi.spyOn(video, "readyState", "get").mockReturnValue(4);
  fireEvent.loadedMetadata(video); fireEvent.playing(video);
  const bounds = view.container.querySelector<HTMLElement>(".smart-camera-image-bounds");
  for (const [width, height, imageWidth, imageHeight] of [[1600, 600, desktopWidth, desktopHeight], [360, 240, phoneWidth, phoneHeight]]) {
    act(() => resize(width, height));
    expect(parseFloat(bounds.style.width)).toBeCloseTo(imageWidth);
    expect(parseFloat(bounds.style.height)).toBeCloseTo(imageHeight);
  }
  view.unmount(); expect(disconnect).toHaveBeenCalledOnce();
});

it("follows the displayed preview, live resolution and fallback without using the person image's dimensions", () => {
  vi.useFakeTimers(); configure();
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe() { this.callback([{ contentRect: { width: 1600, height: 900 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    disconnect() {}
  });
  const camera = mocks.shared.state.config.settings.cameras.items[0];
  const view = render(<CameraPreviewImageContext.Provider value={{ "/api/cameras/example-camera/snapshot.jpg": { src: "blob:preview", failed: false, refresh: vi.fn(), watch: () => () => {} } }}><MediaSurface camera={camera} expanded /></CameraPreviewImageContext.Provider>);
  const preview = screen.getByRole("img", { name: "Example camera" });
  Object.defineProperties(preview, { naturalWidth: { value: 1440 }, naturalHeight: { value: 1080 } });
  fireEvent.load(preview);
  const bounds = view.container.querySelector<HTMLElement>(".smart-camera-image-bounds");
  expect(bounds).toHaveStyle({ width: "1200px", height: "900px" });
  const video = view.container.querySelector("video");
  const width = vi.spyOn(video, "videoWidth", "get").mockReturnValue(1080);
  vi.spyOn(video, "videoHeight", "get").mockReturnValue(1920);
  vi.spyOn(video, "readyState", "get").mockReturnValue(4);
  vi.spyOn(video, "paused", "get").mockReturnValue(false);
  fireEvent.playing(video);
  expect(bounds).toHaveStyle({ width: "506.25px", height: "900px" });
  fireEvent.load(preview);
  const person = screen.getByRole("img", { name: "Latest person snapshot" });
  Object.defineProperties(person, { naturalWidth: { value: 400 }, naturalHeight: { value: 300 } });
  fireEvent.load(person);
  expect(bounds).toHaveStyle({ width: "506.25px", height: "900px" });
  width.mockReturnValue(1440); fireEvent(video, new Event("resize"));
  expect(bounds).toHaveStyle({ width: "675px", height: "900px" });
  act(() => vi.advanceTimersByTime(3000));
  expect(bounds).toHaveStyle({ width: "1200px", height: "900px" });
});

it("shows the last person in expanded live views, but not still previews or suspended feeds", () => {
  configure(); mocks.fetch.mockReturnValue(new Promise(() => {}));
  const camera = mocks.shared.state.config.settings.cameras.items[0];
  const view = render(<MediaSurface camera={camera} expanded />);
  expect(screen.getByRole("button", { name: "Latest person snapshot" })).toContainElement(screen.getByRole("img", { name: "Latest person snapshot" }));
  expect(view.container.querySelector("video")).not.toBeNull();
  view.rerender(<MediaSurface camera={camera} expanded snapshotOnly />);
  expect(screen.queryByRole("button", { name: "Latest person snapshot" })).not.toBeInTheDocument();
  view.rerender(<MediaSurface camera={camera} expanded suspended />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  view.rerender(<MediaSurface camera={{ ...camera, personSnapshot: { type: "none" } }} expanded />);
  expect(screen.queryByRole("button", { name: "Latest person snapshot" })).not.toBeInTheDocument();
});

it("uses a configured HA camera's person source when expanding its device image", () => {
  configure(); mocks.fetch.mockReturnValue(new Promise(() => {}));
  const camera = mocks.shared.state.config.settings.cameras.items[0];
  camera.connectionId = "home-assistant"; camera.source = "camera.example";
  render(<EntityMedia entity={mocks.app.currentHome.entities.find(item => item.entityId === camera.source)} />);
  expect(screen.queryByRole("button", { name: "Latest person snapshot" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Expand Example camera" }));
  const viewer = within(screen.getByRole("dialog"));
  expect(viewer.getByRole("button", { name: "Latest person snapshot" })).toBeVisible();
  fireEvent.click(viewer.getByRole("button", { name: "Person snapshot" }));
  expect(viewer.getByRole("img", { name: "Latest person snapshot" })).toBeVisible();
  expect(viewer.queryByRole("button", { name: "Latest person snapshot" })).not.toBeInTheDocument();
});

it.each([
  ["go2rtc", "Live video from go2rtc"],
  ["mse", "Live video from go2rtc · MSE"],
  ["ha", "Live camera"],
])("shows %s playback status as an icon with an accessible explanation", (transport, label) => {
  configure(); mocks.fetch.mockReturnValue(new Promise(() => {}));
  const camera = mocks.shared.state.config.settings.cameras.items[0];
  if (transport === "ha") { camera.connectionId = "home-assistant"; camera.source = "camera.example"; }
  if (transport === "mse") mocks.go2rtc.mockImplementation((_id, _video, _signal, failed) => failed());
  const view = render(<MediaSurface camera={camera} expanded />);
  expect(screen.getByRole("button", { name: "Snapshot preview · connecting video…" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Snapshot preview · connecting video…" }).querySelector("svg")).toHaveClass("motion-safe:animate-spin");
  expect(screen.queryByText("Snapshot preview · connecting video…")).not.toBeInTheDocument();
  const video = view.container.querySelector("video");
  vi.spyOn(video, "readyState", "get").mockReturnValue(4);
  fireEvent.playing(video);
  const status = screen.getByRole("button", { name: label });
  expect(status.querySelector("svg")).not.toHaveClass("motion-safe:animate-spin");
  expect(status.textContent).toBe("");
  expect(screen.queryByText(label)).not.toBeInTheDocument();
  fireEvent.click(status);
  expect(screen.getByRole("dialog", { name: label })).toHaveTextContent(label);
  fireEvent.keyDown(screen.getByRole("dialog", { name: label }), { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mocks[transport === "ha" ? "ha" : "go2rtc"]).toHaveBeenCalledOnce();
});

it("stops video and snapshot requests while a retained main page is inactive", () => {
  configure(); mocks.fetch.mockReturnValue(new Promise(() => {}));
  const camera = mocks.shared.state.config.settings.cameras.items[0];
  const content = (active: boolean) => <PageActivityContext.Provider value={active}><MediaSurface camera={camera} expanded /></PageActivityContext.Provider>;
  const view = render(content(false));
  expect(mocks.go2rtc).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
  view.rerender(content(true));
  expect(mocks.go2rtc).toHaveBeenCalledOnce();
  expect(mocks.fetch).toHaveBeenCalledOnce();
  const signal = mocks.go2rtc.mock.calls[0][2];
  const previewSignal = mocks.fetch.mock.calls[0][1].signal;
  view.rerender(content(false));
  expect(signal.aborted).toBe(true);
  expect(previewSignal.aborted).toBe(true);
  view.rerender(content(true));
  expect(mocks.go2rtc).toHaveBeenCalledTimes(2);
});

it("does not add discovered HA cameras to the camera page or settings", () => {
  const view = render(<MemoryRouter><Cameras /></MemoryRouter>);
  expect(screen.getByText("No cameras added yet")).toBeVisible();
  expect(screen.queryByText("HA example camera")).not.toBeInTheDocument();
  expect(mocks.ha).not.toHaveBeenCalled();
  view.unmount(); renderSettings();
  expect(screen.getByRole("button", { name: "Add camera" })).toBeVisible();
  expect(screen.queryByLabelText("Home Assistant camera")).not.toBeInTheDocument();
});

it.each(["go2rtc", "home-assistant", "frigate"])("switches each camera page preview between video, its %s still and the configured person image", async source => {
  configure(); mocks.fetch.mockReturnValue(new Promise(() => {}));
  const cameras = mocks.shared.state.config.settings.cameras.items;
  const camera = cameras[0];
  if (source === "home-assistant") { camera.connectionId = "home-assistant"; camera.source = "camera.example"; }
  if (source === "frigate") camera.frigatePreview = { connectionId: "frigate", camera: "example_entry" };
  cameras.push({ ...camera, id: "other-camera", name: "Other example camera", personSnapshot: { type: "none" } });
  render(<MemoryRouter><Cameras /></MemoryRouter>);
  const first = within(screen.getByRole("region", { name: camera.name }));
  const other = within(screen.getByRole("region", { name: "Other example camera" }));
  expect(other.queryByRole("button", { name: "Person snapshot" })).not.toBeInTheDocument();
  const stream = (source === "home-assistant" ? mocks.ha : mocks.go2rtc).mock.calls[0][2];
  const videoPreview = mocks.fetch.mock.calls[0][1].signal;
  fireEvent.click(first.getByRole("button", { name: "Still image" }));
  expect(stream.aborted).toBe(true); expect(videoPreview.aborted).toBe(true);
  expect(first.getByRole("button", { name: "Still image" })).toHaveAttribute("aria-pressed", "true");
  expect(mocks.fetch).toHaveBeenLastCalledWith(source === "home-assistant" ? "/api/camera_proxy/camera.example" : "/api/cameras/example-camera/snapshot.jpg", expect.anything());
  expect(screen.getByRole("region", { name: camera.name }).querySelector("video")).toBeNull();
  expect(other.getByRole("button", { name: "Live camera" })).toHaveAttribute("aria-pressed", "true");
  const still = mocks.fetch.mock.lastCall[1].signal;
  fireEvent.click(first.getByRole("button", { name: "Person snapshot" }));
  expect(still.aborted).toBe(true);
  expect(first.getByRole("img", { name: "Latest person snapshot" })).toBeVisible();
  fireEvent.click(first.getByRole("button", { name: `Expand ${camera.name}` }));
  const dialog = within(screen.getByRole("dialog", { name: camera.name }));
  expect(dialog.getByRole("button", { name: "Person snapshot" })).toHaveAttribute("aria-pressed", "true");
  expect(dialog.getByRole("img", { name: "Latest person snapshot" })).toBeVisible();
  fireEvent.click(dialog.getByRole("button", { name: "Still image" }));
  expect(screen.getByRole("dialog").querySelector("video")).toBeNull();
  fireEvent.click(dialog.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(first.getByRole("button", { name: `Expand ${camera.name}` })).toHaveFocus());
  expect(first.getByRole("button", { name: "Still image" })).toHaveAttribute("aria-pressed", "true");
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
  expect(screen.queryByRole("link", { name: "Use in notification" })).not.toBeInTheDocument();
});

it.each(["go2rtc", "home-assistant", "frigate"])("previews the %s startup image separately from video and person images", source => {
  configure(); mocks.fetch.mockReturnValue(new Promise(() => {}));
  const camera = mocks.shared.state.config.settings.cameras.items[0];
  if (source === "home-assistant") { camera.connectionId = "home-assistant"; camera.source = "camera.example"; }
  if (source === "frigate") camera.frigatePreview = { connectionId: "frigate", camera: "example_entry" };
  const view = renderSettings();
  const previews = within(screen.getByRole("group", { name: `Camera previews for ${camera.name}` }));
  expect(previews.getAllByRole("button")).toHaveLength(3);
  expect(previews.queryByRole("button", { name: `Edit ${camera.name}` })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: `Edit ${camera.name}` })).toBeVisible();
  expect(screen.getByRole("button", { name: `Delete ${camera.name}` })).toBeVisible();
  fireEvent.click(previews.getByRole("button", { name: "Preview startup image" }));
  expect(mocks.fetch).toHaveBeenLastCalledWith(source === "home-assistant" ? "/api/camera_proxy/camera.example" : "/api/cameras/example-camera/snapshot.jpg", expect.anything());
  expect(mocks.go2rtc).not.toHaveBeenCalled(); expect(mocks.ha).not.toHaveBeenCalled();
  expect(view.container.querySelector("video")).toBeNull();
  expect(screen.getByText("This image is shown while the live stream connects.")).toBeVisible();
  fireEvent.click(previews.getByRole("button", { name: "Watch live stream" }));
  expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(view.container.querySelector("video")).not.toBeNull();
  fireEvent.click(previews.getByRole("button", { name: "Preview person snapshot" }));
  expect(view.container.querySelector("video")).toBeNull();
  expect(screen.getByRole("img")).toHaveAttribute("src", expect.stringContaining("/person.jpg"));
  fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it.each(["image.example_person", "camera.example"])("adds a selected HA camera with %s as its person image", entity => {
  renderSettings("/settings/cameras?add");
  fireEvent.change(screen.getByLabelText("Camera name"), { target: { value: "Selected camera" } });
  fireEvent.change(screen.getByLabelText("Connection"), { target: { value: "home-assistant" } });
  chooseEntity("Home Assistant camera", "camera.example");
  fireEvent.click(screen.getByText("Person image (optional)"));
  fireEvent.change(screen.getByLabelText("Person snapshot source"), { target: { value: "home-assistant" } });
  chooseEntity("Person image entity", entity);
  expect(screen.getByRole("button", { name: "Home Assistant camera" })).toHaveTextContent("HA example camera");
  expect(screen.getByRole("button", { name: "Person image entity" })).toHaveTextContent(entity.startsWith("image.") ? "Example person image" : "HA example camera");
  fireEvent.click(screen.getByRole("button", { name: "Save and test camera" }));
  expect(mocks.shared.state.config.settings.cameras.items[0]).toMatchObject({ name: "Selected camera", connectionId: "home-assistant", source: "camera.example", personSnapshot: { type: "home-assistant", entity } });
  expect(mocks.ha).toHaveBeenCalledWith("camera.example", expect.any(HTMLVideoElement), expect.any(AbortSignal), expect.any(Function));
  expect(mocks.go2rtc).not.toHaveBeenCalled();
});

it("keeps registered camera and person image selections visible when reopening saved settings", () => {
  configure();
  const camera = mocks.shared.state.config.settings.cameras.items[0];
  camera.connectionId = "home-assistant"; camera.source = "camera.example";
  renderSettings("/settings/cameras?camera=example-camera");
  expect(screen.getByRole("button", { name: "Home Assistant camera" })).toHaveTextContent("HA example camera");
  expect(screen.getByRole("button", { name: "Person image entity" })).toHaveTextContent("Example person image");
  fireEvent.click(screen.getByRole("button", { name: "Save camera" }));
  expect(mocks.shared.state.config.settings.cameras.items[0]).toEqual(camera);
});

it("retains saved camera and person image IDs when their entities are unavailable", () => {
  configure(); mocks.app.currentHome = mapHome({}, emptyRegistries, "home");
  const camera = mocks.shared.state.config.settings.cameras.items[0];
  camera.connectionId = "home-assistant"; camera.source = "camera.example";
  renderSettings("/settings/cameras?camera=example-camera");
  expect(screen.getByRole("button", { name: "Home Assistant camera" })).toHaveTextContent("Entity unavailable · camera.example");
  expect(screen.getByRole("button", { name: "Person image entity" })).toHaveTextContent("Entity unavailable · image.example_person");
  fireEvent.click(screen.getByRole("button", { name: "Save camera" }));
  expect(mocks.shared.state.config.settings.cameras.items[0]).toEqual(camera);
});

it("still saves unregistered Home Assistant camera and person image entities", () => {
  mocks.app.currentHome = mapHome({
    "camera.example": state("camera.example", "idle"),
    "image.example_person": state("image.example_person", "2026-01-01T00:00:00Z"),
  }, emptyRegistries, "home");
  renderSettings("/settings/cameras?add");
  fireEvent.change(screen.getByLabelText("Camera name"), { target: { value: "Example camera" } });
  fireEvent.change(screen.getByLabelText("Connection"), { target: { value: "home-assistant" } });
  chooseEntity("Home Assistant camera", "camera.example");
  fireEvent.click(screen.getByText("Person image (optional)"));
  fireEvent.change(screen.getByLabelText("Person snapshot source"), { target: { value: "home-assistant" } });
  chooseEntity("Person image entity", "image.example_person");
  fireEvent.click(screen.getByRole("button", { name: "Save camera" }));
  expect(mocks.shared.state.config.settings.cameras.items[0]).toMatchObject({ source: "camera.example", personSnapshot: { type: "home-assistant", entity: "image.example_person" } });
});

it.each(["sensor.example_picture", "binary_sensor.example_picture"])("filters person-image choices to supported sources and saves %s", entityId => {
  configure();
  const states = {
    "camera.example": state("camera.example", "idle"),
    "image.example_person": state("image.example_person", "2026-01-01T00:00:00Z"),
    "sensor.example_picture": state("sensor.example_picture", "1", { entity_picture: "/api/image_proxy/image.example_person?token=fixture" }),
    "binary_sensor.example_picture": state("binary_sensor.example_picture", "on", { entity_picture: "/api/camera_proxy/camera.example" }),
    "sensor.example_count": state("sensor.example_count", "1"),
    "binary_sensor.example_occupancy": state("binary_sensor.example_occupancy", "on"),
    "sensor.example_external": state("sensor.example_external", "1", { entity_picture: "https://example.test/person.jpg" }),
    "light.example": state("light.example", "on", { entity_picture: "/api/image_proxy/image.example_person" }),
  };
  mocks.app.currentHome = mapHome(states, { ...emptyRegistries, entities: Object.keys(states).map((entity_id, index) => ({ entity_id, id: `registered-${index}` })) }, "home");
  renderSettings("/settings/cameras?camera=example-camera");
  fireEvent.click(screen.getByRole("button", { name: "Person image entity" }));
  const picker = within(screen.getByRole("dialog", { name: "Person image entity" }));
  for (const id of ["camera.example", "image.example_person", "sensor.example_picture", "binary_sensor.example_picture"])
    expect(picker.getByRole("button", { name: name => name.endsWith(` · ${id}`) })).toBeEnabled();
  for (const id of ["sensor.example_count", "binary_sensor.example_occupancy", "sensor.example_external", "light.example"])
    expect(picker.queryByRole("button", { name: name => name.endsWith(` · ${id}`) })).not.toBeInTheDocument();
  fireEvent.change(picker.getByRole("searchbox"), { target: { value: "example_count" } });
  expect(picker.getByText("No matching entities. Change or clear the filters.")).toBeVisible();
  fireEvent.change(picker.getByRole("searchbox"), { target: { value: entityId } });
  fireEvent.click(picker.getByRole("button", { name: name => name.endsWith(` · ${entityId}`) }));
  fireEvent.click(screen.getByRole("button", { name: "Save camera" }));
  expect(mocks.shared.state.config.settings.cameras.items[0].personSnapshot).toEqual({ type: "home-assistant", entity: entityId });
});

it("keeps an unsupported saved person-image reference visible for replacement", () => {
  configure();
  mocks.shared.state.config.settings.cameras.items[0].personSnapshot = { type: "home-assistant", entity: "sensor.example_count" };
  mocks.app.currentHome.entities.find(entity => entity.entityId === "sensor.example_count").preferenceId = "home|registered-count";
  renderSettings("/settings/cameras?camera=example-camera");
  expect(screen.getByRole("button", { name: "Person image entity" })).toHaveTextContent("Entity unavailable · sensor.example_count");
  fireEvent.click(screen.getByRole("button", { name: "Person image entity" }));
  expect(screen.getByRole("button", { name: "Entity unavailable · sensor.example_count" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "HA example camera · camera.example" }));
  fireEvent.click(screen.getByRole("button", { name: "Save camera" }));
  expect(mocks.shared.state.config.settings.cameras.items[0].personSnapshot).toEqual({ type: "home-assistant", entity: "camera.example" });
});

it.each(["Save camera", "Save and test camera"])("saves a camera.* person image on an existing go2rtc camera using %s", action => {
  configure();
  const settings = mocks.shared.state.config.settings.cameras;
  settings.connections.push({ id: "frigate", name: "Example Frigate", type: "frigate", url: "http://frigate.example:5000" });
  settings.items[0].frigatePreview = { connectionId: "frigate", camera: "example_entry" };
  renderSettings("/settings/cameras?camera=example-camera");
  chooseEntity("Person image entity", "camera.example");
  fireEvent.click(screen.getByRole("button", { name: action }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(mocks.shared.state.config.settings.cameras.items[0]).toMatchObject({ connectionId: "example-go2rtc", source: "example", frigatePreview: { connectionId: "frigate", camera: "example_entry" }, personSnapshot: { type: "home-assistant", entity: "camera.example" } });
});

it.each([
  [[["Camera name", ""]], "Enter a camera name (1–100 characters)."],
  [[["Connection", ""]], "Choose Home Assistant or a saved go2rtc connection for live video."],
  [[["Connection", "home-assistant"]], "Choose a camera.* entity under Home Assistant camera."],
  [[["Stream", ""]], "Choose a go2rtc stream or enter its name, for example example_camera. URLs must not contain passwords or tokens."],
  [[["Preview while video connects", "frigate"]], "Choose a Frigate connection for the startup preview, or select Use the video connection."],
  [[["Preview while video connects", "frigate"], ["Frigate preview connection", "frigate"]], "Enter the Frigate camera name for the startup preview (1–128 characters), for example example_camera."],
  [[["Person snapshot source", "none"], ["Person snapshot source", "home-assistant"]], "Choose a person image entity: image.*, camera.*, or a sensor with a supported picture."],
  [[["Person snapshot source", "frigate"]], "Choose a Frigate connection for the person image, or select No person snapshot."],
  [[["Person snapshot source", "frigate"], ["Frigate connection", "frigate"]], "Enter the Frigate camera name for the person image (1–128 characters), for example example_camera."],
] as const)("identifies the invalid camera field after %j and preserves the draft", async (changes, message) => {
  configure();
  mocks.shared.state.config.settings.cameras.connections.push({ id: "frigate", name: "Example Frigate", type: "frigate", url: "http://frigate.example:5000" });
  const original = JSON.stringify(mocks.shared.state.config.settings.cameras);
  renderSettings("/settings/cameras?camera=example-camera");
  await screen.findByRole("option", { name: "example_sub" });
  for (const [label, value] of changes) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Save camera" }));
  expect(screen.getByRole("alert")).toHaveTextContent(message);
  expect(screen.getByRole("heading", { name: "Edit camera" })).toBeVisible();
  expect(JSON.stringify(mocks.shared.state.config.settings.cameras)).toBe(original);
});

it("explains an incomplete preview in Norwegian without blaming the selected camera.* person image", async () => {
  configure(); mocks.shared.state.config.settings.language = "nb";
  renderSettings("/settings/cameras?camera=example-camera");
  await screen.findByRole("option", { name: "example_sub" });
  fireEvent.click(screen.getByRole("button", { name: "Bildeentitet for person" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Bildeentitet for person" })).getByRole("button", { name: "HA example camera · camera.example" }));
  fireEvent.change(screen.getByLabelText("Forhåndsvisning mens video kobler til"), { target: { value: "frigate" } });
  fireEvent.click(screen.getByRole("button", { name: "Lagre kamera" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Velg en Frigate-tilkobling for forhåndsvisningen, eller velg Bruk videotilkoblingen.");
  fireEvent.change(screen.getByLabelText("Forhåndsvisning mens video kobler til"), { target: { value: "video" } });
  fireEvent.click(screen.getByRole("button", { name: "Lagre kamera" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(mocks.shared.state.config.settings.cameras.items[0].personSnapshot).toEqual({ type: "home-assistant", entity: "camera.example" });
});

it("configures a Frigate preview without changing the video or person image and protects its connection", async () => {
  configure();
  const settings = mocks.shared.state.config.settings.cameras;
  settings.connections.push({ id: "frigate", name: "Example Frigate", type: "frigate", url: "http://frigate.example:5000" });
  const view = renderSettings("/settings/cameras?camera=example-camera");
  await screen.findByRole("option", { name: "example" });
  fireEvent.change(screen.getByLabelText("Preview while video connects"), { target: { value: "frigate" } });
  fireEvent.change(screen.getByLabelText("Frigate preview connection"), { target: { value: "frigate" } });
  fireEvent.change(screen.getByLabelText("Frigate preview camera"), { target: { value: "example_entry" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and test camera" }));
  expect(mocks.shared.state.config.settings.cameras.items[0]).toMatchObject({ source: "example", connectionId: "example-go2rtc",
    frigatePreview: { connectionId: "frigate", camera: "example_entry" }, personSnapshot: { type: "home-assistant", entity: "image.example_person" } });
  expect(mocks.go2rtc).toHaveBeenCalledWith("example-camera", expect.any(HTMLVideoElement), expect.any(AbortSignal), expect.any(Function));
  expect(mocks.fetch).toHaveBeenLastCalledWith("/api/cameras/example-camera/snapshot.jpg", expect.anything());
  view.unmount();
  render(<MemoryRouter><CameraConnections /></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Delete Example Frigate" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Edit Example Frigate" }));
  expect(screen.getByLabelText("Connection type")).toBeDisabled();
});

it("uses a configured Frigate preview with HA video and cancels it when its source changes", () => {
  configure(); mocks.fetch.mockReturnValue(new Promise(() => {}));
  const camera = { ...mocks.shared.state.config.settings.cameras.items[0], connectionId: "home-assistant", source: "camera.example", frigatePreview: { connectionId: "frigate", camera: "example_entry" } };
  const view = render(<MediaSurface camera={camera} expanded />);
  expect(mocks.ha).toHaveBeenCalledWith("camera.example", expect.any(HTMLVideoElement), expect.any(AbortSignal), expect.any(Function));
  expect(mocks.fetch).toHaveBeenLastCalledWith("/api/cameras/example-camera/snapshot.jpg", expect.anything());
  view.rerender(<MediaSurface camera={{ ...camera, frigatePreview: undefined }} expanded />);
  expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(mocks.fetch).toHaveBeenLastCalledWith("/api/camera_proxy/camera.example", expect.anything());
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

it("loads snapshots alongside video, stops them on playback and resumes only in visible viewers", () => {
  vi.useFakeTimers(); configure(); mocks.fetch.mockReturnValue(new Promise(() => {}));
  const camera = mocks.shared.state.config.settings.cameras.items[0];
  const view = render(<MediaSurface camera={camera} expanded />);
  expect(mocks.go2rtc).toHaveBeenCalledOnce();
  expect(mocks.fetch).toHaveBeenLastCalledWith(`/api/cameras/${camera.id}/snapshot.jpg`, expect.objectContaining({ cache: "no-store" }));
  const video = view.container.querySelector("video");
  vi.spyOn(video, "readyState", "get").mockReturnValue(4);
  vi.spyOn(video, "paused", "get").mockReturnValue(false);
  fireEvent.playing(video);
  expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(screen.getByRole("button", { name: "Live video from go2rtc" })).toBeVisible();
  expect(screen.queryByText("Live video from go2rtc")).not.toBeInTheDocument();
  fireEvent.waiting(video);
  act(() => { vi.advanceTimersByTime(3000); });
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(mocks.go2rtc).toHaveBeenCalledOnce();
  expect(mocks.go2rtc.mock.calls[0][2].aborted).toBe(false);
  expect(view.container.querySelector("video")).toBe(video);
  act(() => { mocks.go2rtc.mock.calls[0][3]("WebRTC failed"); });
  expect(mocks.mse).toHaveBeenCalledOnce();
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(mocks.fetch.mock.calls[1][1].signal.aborted).toBe(false);
  view.rerender(<MediaSurface camera={camera} expanded suspended />);
  expect(mocks.fetch.mock.calls[1][1].signal.aborted).toBe(true);
  view.rerender(<MediaSurface camera={camera} expanded />);
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(mocks.fetch.mock.calls[2][1].signal.aborted).toBe(true);
  hidden.mockRestore();
  view.unmount();
  render(<MediaSurface camera={{ ...camera, connectionId: "home-assistant", source: "camera.example" }} expanded />);
  expect(mocks.fetch).toHaveBeenLastCalledWith("/api/camera_proxy/camera.example", expect.objectContaining({ cache: "no-store" }));
});

it.each([true, false])("holds streaming video through waiting signals and falls back only after progress stops (frame callbacks: %s)", frameCallbacks => {
  vi.useFakeTimers(); configure(); mocks.fetch.mockReturnValue(new Promise(() => {}));
  const prototype = HTMLVideoElement.prototype;
  const originalFrame = Object.getOwnPropertyDescriptor(prototype, "requestVideoFrameCallback");
  const originalCancel = Object.getOwnPropertyDescriptor(prototype, "cancelVideoFrameCallback");
  let nextFrame: VideoFrameRequestCallback;
  const requestFrame = vi.fn(callback => { nextFrame = callback; return 1; });
  const cancelFrame = vi.fn();
  Object.defineProperty(prototype, "requestVideoFrameCallback", { configurable: true, value: frameCallbacks ? requestFrame : undefined });
  Object.defineProperty(prototype, "cancelVideoFrameCallback", { configurable: true, value: cancelFrame });
  try {
    const camera = mocks.shared.state.config.settings.cameras.items[0];
    const view = render(<MediaSurface camera={camera} expanded />);
    const video = view.container.querySelector("video");
    vi.spyOn(video, "readyState", "get").mockReturnValue(4);
    const paused = vi.spyOn(video, "paused", "get").mockReturnValue(false);
    const present = () => act(() => {
      video.currentTime += .5;
      if (frameCallbacks) nextFrame(performance.now(), {} as VideoFrameCallbackMetadata);
      else fireEvent.timeUpdate(video);
    });
    fireEvent.playing(video); present();
    const player = video.closest(".smart-camera-player");
    expect(player).toHaveClass("is-playing");
    for (let i = 0; i < 8; i++) {
      fireEvent.waiting(video);
      act(() => { vi.advanceTimersByTime(500); }); present();
      expect(player).toHaveClass("is-playing");
      expect(mocks.fetch).toHaveBeenCalledOnce();
    }
    act(() => { vi.advanceTimersByTime(2999); });
    expect(player).toHaveClass("is-playing");
    act(() => { vi.advanceTimersByTime(1); });
    expect(player).not.toHaveClass("is-playing");
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(view.container.querySelector("video")).toBe(video);
    expect(mocks.go2rtc).toHaveBeenCalledOnce();
    expect(mocks.go2rtc.mock.calls[0][2].aborted).toBe(false);
    present();
    expect(player).toHaveClass("is-playing");
    expect(mocks.fetch.mock.calls[1][1].signal.aborted).toBe(true);
    paused.mockReturnValue(true); fireEvent.pause(video);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(player).toHaveClass("is-playing");
    view.unmount();
    if (frameCallbacks) {
      expect(cancelFrame).toHaveBeenCalledWith(1);
      const calls = requestFrame.mock.calls.length;
      present(); expect(requestFrame).toHaveBeenCalledTimes(calls);
    }
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    if (originalFrame) Object.defineProperty(prototype, "requestVideoFrameCallback", originalFrame); else delete prototype.requestVideoFrameCallback;
    if (originalCancel) Object.defineProperty(prototype, "cancelVideoFrameCallback", originalCancel); else delete prototype.cancelVideoFrameCallback;
  }
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
