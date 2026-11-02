import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CameraSettings } from "@/components/CameraSettings";
import { CameraPersonSnapshot } from "@/components/CameraPersonSnapshot";
import { MediaSurface } from "@/components/devices/EntityMedia";
import { emptyConfiguration } from "../../shared/configuration";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { chooseEntity } from "./entity-picker-helpers";
import Cameras from "@/pages/Cameras";

const mocks = vi.hoisted(() => ({ app: null, shared: null, go2rtc: vi.fn(), ha: vi.fn(), save: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => mocks.shared }));
vi.mock("@/lib/go2rtc-stream", () => ({ playGo2rtcStream: (...args) => mocks.go2rtc(...args) }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.go2rtc.mockReset(); mocks.ha.mockReset();
  mocks.app = { currentHome: mapHome({
    "camera.example": state("camera.example", "idle", { friendly_name: "Example camera" }),
    "image.example_person": state("image.example_person", "2026-01-01T00:00:00Z", { friendly_name: "Example person image" }),
    "sensor.example_count": state("sensor.example_count", "1", { friendly_name: "Example count" }),
  }, emptyRegistries, "home"), homeOnline: true, watchCameraStream: mocks.ha };
  mocks.shared = { state: { config: emptyConfiguration(), loaded: true, error: "", saving: false }, store: { updateSettings: mocks.save } };
  mocks.save.mockImplementation(change => { mocks.shared.state.config.settings = change(mocks.shared.state.config.settings); });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const renderSettings = () => render(<MemoryRouter><CameraSettings /></MemoryRouter>);
const configure = () => {
  mocks.shared.state.config.settings.cameras = { go2rtcUrl: "http://go2rtc.example:1984", frigateUrl: "", sources: { "camera.example": { stream: "example", personSnapshot: { type: "home-assistant", entity: "image.example_person" } } } };
};

it("lists HA cameras without adding them and links watching, setup and notifications", () => {
  configure(); render(<MemoryRouter><Cameras /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Example camera" })).toBeVisible();
  expect(screen.getByText("Live video: go2rtc · example")).toBeVisible();
  expect(screen.getByRole("link", { name: "Configure camera" })).toHaveAttribute("href", "/settings/cameras?camera=camera.example");
  expect(screen.getByRole("link", { name: "Use in notification" })).toHaveAttribute("href", "/settings/notifications?camera=camera.example");
});

it("requires a stream for go2rtc, saves before watching and can switch back to HA", () => {
  const view = renderSettings();
  fireEvent.change(screen.getByLabelText("Video source"), { target: { value: "go2rtc" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and watch stream" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a stream name or RTSP address");
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("go2rtc server address"), { target: { value: "http://go2rtc.example:1984" } });
  fireEvent.change(screen.getByLabelText("Stream name or RTSP address"), { target: { value: "example" } });
  mocks.shared.state.saving = true;
  fireEvent.click(screen.getByRole("button", { name: "Save and watch stream" }));
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(mocks.go2rtc).not.toHaveBeenCalled();
  mocks.shared.state.saving = false;
  view.rerender(<MemoryRouter><CameraSettings /></MemoryRouter>);
  expect(mocks.go2rtc).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByLabelText("Video source"), { target: { value: "home-assistant" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and watch stream" }));
  expect(mocks.shared.state.config.settings.cameras.sources["camera.example"].stream).toBe("");
  expect(mocks.ha).toHaveBeenCalledOnce();
});

it("saves a normalized RTSP source and a person image using the existing entity picker", async () => {
  const view = renderSettings();
  fireEvent.change(screen.getByLabelText("Video source"), { target: { value: "go2rtc" } });
  fireEvent.change(screen.getByLabelText("go2rtc server address"), { target: { value: "http://go2rtc.example:1984" } });
  fireEvent.change(screen.getByLabelText("Stream name or RTSP address"), { target: { value: "rtsp://frigate.example:8554/example" } });
  fireEvent.change(screen.getByLabelText("Person snapshot source"), { target: { value: "home-assistant" } });
  await chooseEntity("Person image entity", "image.example_person");
  expect(screen.getByRole("button", { name: "Save and watch stream" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Save camera settings" }));
  expect(mocks.shared.state.config.settings.cameras.sources["camera.example"]).toEqual({ stream: "example", personSnapshot: { type: "home-assistant", entity: "image.example_person" } });
  view.rerender(<MemoryRouter><CameraSettings /></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Person image entity" })).toHaveTextContent("Example person image");
  fireEvent.click(screen.getByRole("button", { name: "Preview person snapshot" }));
  expect(screen.getByAltText("Latest person snapshot")).toHaveAttribute("src", expect.stringContaining("/api/cameras/camera.example/person.jpg"));
});

it("retains invalid drafts and refuses to overwrite edits from another screen", () => {
  configure(); const view = renderSettings();
  fireEvent.change(screen.getByLabelText("go2rtc server address"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Save camera settings" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter the go2rtc server address");
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.shared.state.config.settings.cameras.go2rtcUrl = "http://changed.example:1984";
  view.rerender(<MemoryRouter><CameraSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Save camera settings" }));
  expect(screen.getByRole("alert")).toHaveTextContent("changed on another screen");
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
  expect(screen.getByLabelText("go2rtc server address")).toHaveValue("http://changed.example:1984");
});

it.each(["live stream", "person snapshot"])("retries a failed %s preview without submitting settings", mode => {
  configure(); mocks.go2rtc.mockImplementation((_id, _video, _signal, failed) => failed());
  mocks.ha.mockImplementationOnce((_id, _video, _signal, failed) => failed());
  renderSettings();
  fireEvent.click(screen.getByRole("button", { name: mode === "live stream" ? "Watch live stream" : "Preview person snapshot" }));
  if (mode === "person snapshot") fireEvent.error(screen.getByRole("img"));
  const retry = screen.getByRole("button", { name: "Retry" });
  expect(retry).toHaveAttribute("type", "button");
  fireEvent.click(retry);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("uses go2rtc even when the HA camera is unavailable and stops it when suspended", async () => {
  configure(); mocks.app.homeOnline = false;
  const entity = { ...mocks.app.currentHome.entities[0], state: "unavailable" };
  const view = render(<MediaSurface entity={entity} expanded />);
  await waitFor(() => expect(mocks.go2rtc).toHaveBeenCalledOnce());
  expect(mocks.ha).not.toHaveBeenCalled();
  const signal = mocks.go2rtc.mock.calls[0][2];
  view.rerender(<MediaSurface entity={entity} expanded suspended />);
  expect(signal.aborted).toBe(true);
});

it("falls back to HA and reopens go2rtc when its saved source changes", () => {
  configure(); mocks.go2rtc.mockImplementation((_id, _video, _signal, failed) => failed());
  const entity = mocks.app.currentHome.entities[0];
  const view = render(<MediaSurface entity={entity} expanded />);
  expect(mocks.ha).toHaveBeenCalledOnce();
  expect(screen.getByRole("status")).toHaveTextContent("trying Home Assistant");
  mocks.shared.state.config.settings.cameras.sources[entity.entityId].stream = "example_sub";
  view.rerender(<MediaSurface entity={entity} expanded />);
  expect(mocks.go2rtc).toHaveBeenCalledTimes(2);
});

it("refreshes late person images, labels their age limit and clears polling on close", () => {
  vi.useFakeTimers(); configure();
  const view = render(<CameraPersonSnapshot entityId="camera.example" />);
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
