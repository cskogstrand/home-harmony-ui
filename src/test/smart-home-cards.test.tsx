import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SmartHomeCard } from "@/components/devices/SmartHomeCard";
import { SmartHomeSettings } from "@/components/SmartHomeSettings";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cardDesigns, cardDesignFor } from "@/components/devices/card-designs";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { emptyConfiguration, emptyPlanner } from "../../shared/configuration";
import { services, state } from "./ha-fixtures";
import { cardEntity, cardServices, mediaEntity } from "./device-card-fixtures";

const mocks = vi.hoisted(() => ({ app: null, family: null, shared: null, command: vi.fn(), density: vi.fn(), visible: vi.fn(), card: vi.fn(), forecast: vi.fn(), history: vi.fn(), camera: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => mocks.family }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => mocks.shared }));
const climate = () => mapHome({ "climate.example": state("climate.example", "heat", {
  friendly_name: "Example thermostat", supported_features: 1, min_temp: 7, max_temp: 30, temperature: 21.5,
  current_temperature: 20, target_temp_step: .5, hvac_modes: ["heat", "off"],
}) }, emptyRegistries, "example").entities[0];
const open = (entity = climate()) => render(<MemoryRouter><TooltipProvider><SmartHomeCard entity={entity} /></TooltipProvider></MemoryRouter>);

beforeEach(() => {
  mocks.card.mockReset(); mocks.forecast.mockReset(); mocks.history.mockReset().mockResolvedValue([]);
  mocks.camera.mockReset().mockImplementation((_id, _video, _signal, onError) => onError());
  mocks.command.mockReset().mockResolvedValue(undefined); mocks.density.mockReset(); mocks.visible.mockReset();
  mocks.app = { watchCameraStream: mocks.camera, watchForecast: mocks.forecast, entityHistory: mocks.history, homeOnline: true, services, commands: {}, command: mocks.command, currentHome: { entities: [climate()], areas: [], temperatureUnit: "°C" } };
  mocks.family = { smartHome: { ...emptyPlanner().smartHome, knownEntities: [climate().preferenceId] }, setSmartHomeCard: mocks.card, setSmartHomeCardDensity: mocks.density, setSmartHomeEntityVisible: mocks.visible };
  mocks.shared = { state: { loaded: true, config: emptyConfiguration() } };
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("automatically selects the climate design, defaults to supercompact, and sends the reported temperature step", async () => {
  open();
  expect(screen.getByRole("article")).toHaveAttribute("data-card-kind", "climate");
  expect(screen.getByRole("article")).toHaveAttribute("data-variant", "Super compact");
  expect(screen.getByRole("link", { name: "Example thermostat details" })).toHaveAttribute("href", "/entities/climate.example");
  fireEvent.click(screen.getByRole("button", { name: "Increase temperature for Example thermostat" }));
  expect(mocks.command).toHaveBeenCalledExactlyOnceWith("climate.example", "temperature", 22);
  expect(screen.getByText("21.5")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "More controls" }));
  expect(screen.getByRole("dialog", { name: "Example thermostat controls" })).toBeVisible();
  fireEvent.change(screen.getByRole("combobox", { name: "Example thermostat mode" }), { target: { value: "off" } });
  expect(screen.getByRole("alertdialog")).toBeVisible();
  expect(mocks.command).toHaveBeenCalledTimes(1);
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(mocks.command).toHaveBeenLastCalledWith("climate.example", "hvac_mode", "off"));
});

it("keeps bounds, unsupported capabilities, offline state and failed commands honest", () => {
  const entity = climate();
  const view = open({ ...entity, attributes: { ...entity.attributes, temperature: 30 } });
  expect(screen.getByRole("button", { name: "Increase temperature for Example thermostat" })).toBeDisabled();
  mocks.app.homeOnline = false;
  view.rerender(<MemoryRouter><TooltipProvider><SmartHomeCard entity={entity} /></TooltipProvider></MemoryRouter>);
  expect(screen.getByText("Offline")).toBeVisible();
  expect(screen.getByRole("button", { name: "Decrease temperature for Example thermostat" })).toBeDisabled();
  mocks.app.homeOnline = true;
  mocks.app.commands = { [entity.entityId]: { pending: true } };
  view.rerender(<MemoryRouter><TooltipProvider><SmartHomeCard entity={entity} /></TooltipProvider></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Decrease temperature for Example thermostat" })).toBeDisabled();
  mocks.app.commands = { [entity.entityId]: { error: "Command failed" } };
  view.rerender(<MemoryRouter><TooltipProvider><SmartHomeCard entity={{ ...entity, attributes: { temperature: 21.5 } }} /></TooltipProvider></MemoryRouter>);
  expect(screen.getByRole("alert")).toHaveTextContent("Command failed");
  expect(screen.queryByRole("button", { name: /temperature for/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "More controls" })).not.toBeInTheDocument();
  expect(mocks.command).not.toHaveBeenCalled();
});

it("uses each entity's stable preference ID for independent sizes and keeps hidden cards configurable", () => {
  mocks.family.smartHome.cardDensities = { [climate().preferenceId]: "compact" };
  const view = open();
  expect(screen.getByRole("article")).toHaveAttribute("data-variant", "Compact");
  mocks.family.smartHome.cardDensities[climate().preferenceId] = "original";
  view.rerender(<MemoryRouter><TooltipProvider><SmartHomeCard entity={climate()} /></TooltipProvider></MemoryRouter>);
  expect(screen.getByRole("article")).toHaveAttribute("data-variant", "Original");
  view.unmount();
  mocks.family.smartHome.hiddenEntities = [climate().preferenceId];
  render(<MemoryRouter><SmartHomeSettings /></MemoryRouter>);
  fireEvent.change(screen.getByRole("combobox", { name: "Group by" }), { target: { value: "none" } });
  const size = screen.getByRole("combobox", { name: "Card size for Example thermostat" });
  expect(size).toHaveValue("original");
  fireEvent.change(size, { target: { value: "supercompact" } });
  expect(mocks.density).toHaveBeenCalledExactlyOnceWith(climate().preferenceId, "supercompact");
  expect(mocks.visible).not.toHaveBeenCalled();
});

it("maps library aliases consistently and keeps unknown domains usable", () => {
  const domains = cardDesigns.flatMap(design => design.domains);
  expect(new Set(domains).size).toBe(domains.length);
  for (const design of cardDesigns) for (const domain of design.domains) expect(cardDesignFor(domain)).toBe(design);
  open({ ...climate(), domain: "future_domain", entityId: "future_domain.example", state: "idle", attributes: {} });
  expect(screen.getByRole("article")).toHaveAttribute("data-card-kind", "future_domain");
  expect(screen.getByText("Idle")).toBeVisible();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("renders the shared media transport, committed volume and extra controls in every card size", () => {
  mocks.app.services = cardServices;
  const media = mediaEntity();
  for (const density of ["supercompact", "compact", "original"] as const) {
    mocks.family.smartHome.cardDensities = { [media.preferenceId]: density };
    const view = open(media);
    expect(screen.getByRole("article")).toHaveAttribute("data-card-kind", "media_player");
    fireEvent.click(screen.getByRole("button", { name: "Start playback" }));
    expect(mocks.command).toHaveBeenLastCalledWith(media.entityId, "media_play", undefined);
    fireEvent.click(screen.getByRole("button", { name: "Previous track" }));
    expect(mocks.command).toHaveBeenLastCalledWith(media.entityId, "media_previous_track", undefined);
    fireEvent.click(screen.getByRole("button", { name: "Next track" }));
    expect(mocks.command).toHaveBeenLastCalledWith(media.entityId, "media_next_track", undefined);
    mocks.command.mockClear();
    fireEvent.keyDown(screen.getByRole("slider", { name: "Volume" }), { key: "End" });
    expect(mocks.command).toHaveBeenCalledExactlyOnceWith(media.entityId, "volume_set", 1);
    // A sent request is not a confirmed state change.
    expect(screen.getByRole("slider", { name: "Volume" })).toHaveAttribute("aria-valuenow", "35");
    if (density === "supercompact") fireEvent.click(screen.getByRole("button", { name: "More controls" }));
    else fireEvent.click(screen.getByText(density === "compact" ? "Adjust" : "More controls"));
    fireEvent.click(screen.getByRole("switch", { name: "Mute" }));
    expect(mocks.command).toHaveBeenLastCalledWith(media.entityId, "volume_mute", true);
    fireEvent.change(screen.getByRole("combobox", { name: "Media source" }), { target: { value: "Radio" } });
    expect(mocks.command).toHaveBeenLastCalledWith(media.entityId, "select_source", "Radio");
    fireEvent.change(screen.getByRole("combobox", { name: "Repeat" }), { target: { value: "all" } });
    expect(mocks.command).toHaveBeenLastCalledWith(media.entityId, "repeat_set", "all");
    fireEvent.keyDown(screen.getByRole("slider", { name: "Playback position" }), { key: "Home" });
    expect(mocks.command).toHaveBeenLastCalledWith(media.entityId, "media_seek", 0);
    view.unmount();
  }
});

it("uses reported playback state and disables media controls across offline, unavailable and pending states", () => {
  mocks.app.services = cardServices;
  const media = { ...mediaEntity(), state: "playing" };
  const view = open(media);
  fireEvent.click(screen.getByRole("button", { name: "Pause playback" }));
  expect(mocks.command).toHaveBeenCalledExactlyOnceWith(media.entityId, "media_pause", undefined);
  mocks.command.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "More controls" }));
  for (const state of ["offline", "pending", "unavailable"]) {
    mocks.app.homeOnline = state !== "offline";
    mocks.app.commands = state === "pending" ? { [media.entityId]: { pending: true } } : {};
    view.rerender(<MemoryRouter><TooltipProvider><SmartHomeCard entity={{ ...media, state: state === "unavailable" ? "unavailable" : "playing" }} /></TooltipProvider></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Next track" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Volume" })).toHaveAttribute("data-disabled");
    expect(screen.getByRole("combobox", { name: "Media source" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Mute" })).toBeDisabled();
  }
  expect(mocks.command).not.toHaveBeenCalled();
});

it("hides unsupported media controls and keeps a failed command recoverable", () => {
  mocks.app.services = cardServices;
  const media = { ...mediaEntity(), attributes: { supported_features: 16384, media_title: "Example track" } };
  mocks.app.commands = { [media.entityId]: { error: "Command failed" } };
  open(media);
  expect(screen.getByRole("alert")).toHaveTextContent("Command failed");
  expect(screen.getByRole("button", { name: "Start playback" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "More controls" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Next track" })).not.toBeInTheDocument();
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
});

it("restores climate presets, fan modes, swing and cover tilt in the top-right controls", () => {
  mocks.app.services = cardServices;
  const thermostat = { ...climate(), attributes: { ...climate().attributes, supported_features: 57, fan_mode: "auto", fan_modes: ["auto", "low"], preset_mode: "eco", preset_modes: ["eco", "comfort"], swing_mode: "off", swing_modes: ["off", "both"] } };
  const view = open(thermostat);
  fireEvent.click(screen.getByRole("button", { name: "More controls" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Fan mode" }), { target: { value: "low" } });
  expect(mocks.command).toHaveBeenLastCalledWith(thermostat.entityId, "set_fan_mode", "low");
  fireEvent.change(screen.getByRole("combobox", { name: "Preset" }), { target: { value: "comfort" } });
  expect(mocks.command).toHaveBeenLastCalledWith(thermostat.entityId, "set_preset_mode", "comfort");
  fireEvent.change(screen.getByRole("combobox", { name: "Swing" }), { target: { value: "both" } });
  expect(mocks.command).toHaveBeenLastCalledWith(thermostat.entityId, "set_swing_mode", "both");
  view.unmount();
  const cover = cardEntity("cover", "open", { supported_features: 143, current_position: 50, current_tilt_position: 20 });
  open(cover);
  fireEvent.click(screen.getByRole("button", { name: "More controls" }));
  fireEvent.keyDown(screen.getByRole("slider", { name: "Slat tilt" }), { key: "End" });
  expect(mocks.command).toHaveBeenLastCalledWith(cover.entityId, "tilt_position", 100);
});

it("restores actionable fan, humidity, water heater, robot and helper cards", () => {
  mocks.app.services = cardServices;
  const cases = [
    { entity: cardEntity("fan", "on", { supported_features: 63, percentage: 40, percentage_step: 20, preset_modes: ["sleep"] }), slider: "Fan speed", action: "set_percentage", value: 100 },
    { entity: cardEntity("humidifier", "on", { supported_features: 1, current_humidity: 42, humidity: 50, min_humidity: 30, max_humidity: 80, available_modes: ["auto"] }), slider: "Target humidity", action: "set_humidity", value: 80 },
    { entity: cardEntity("water_heater", "eco", { supported_features: 7, temperature: 60, min_temp: 40, max_temp: 80, operation_list: ["eco"] }), slider: "Water temperature", action: "temperature", value: 80 },
    { entity: cardEntity("input_number", "2.5", { min: -5, max: 5, step: .5 }), slider: "Value", action: "set_value", value: 5 },
  ];
  for (const { entity, slider, action, value } of cases) {
    const view = open(entity);
    fireEvent.keyDown(screen.getByRole("slider", { name: slider }), { key: "End" });
    expect(mocks.command).toHaveBeenLastCalledWith(entity.entityId, action, value);
    view.unmount();
  }
  for (const [domain, state, features, label, action] of [["vacuum", "docked", 8192 + 16, "Start", "start"], ["lawn_mower", "mowing", 7, "Pause", "pause"], ["counter", "3", 0, "Increase counter", "increment"], ["input_button", "2030-01-01T10:00:00Z", 0, "Press button", "press"]] as const) {
    const entity = cardEntity(domain, state, { supported_features: features });
    const view = open(entity);
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(mocks.command).toHaveBeenLastCalledWith(entity.entityId, action, undefined);
    view.unmount();
  }
});

it("stages siren settings and confirms physical activation; valve movement also requires confirmation", async () => {
  mocks.app.services = cardServices;
  const siren = cardEntity("siren", "off", { supported_features: 15, available_tones: { "1": "Chime", "2": "Alarm" } });
  const view = open(siren);
  fireEvent.click(screen.getByRole("button", { name: "More controls" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Tone" }), { target: { value: "1" } });
  fireEvent.keyDown(screen.getByRole("slider", { name: "Siren volume" }), { key: "End" });
  expect(mocks.command).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close controls" }));
  fireEvent.click(screen.getByRole("button", { name: "Start siren" }));
  expect(mocks.command).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(mocks.command).toHaveBeenLastCalledWith(siren.entityId, "turn_on", { tone: "1", volume_level: 1 }));
  view.unmount(); mocks.command.mockClear();
  const valve = cardEntity("valve", "closed", { supported_features: 15, current_position: 0 });
  open(valve);
  fireEvent.click(screen.getByRole("button", { name: "Open valve" }));
  expect(mocks.command).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
  expect(mocks.command).not.toHaveBeenCalled();
});

it("keeps alarm arming behind the existing code confirmation", async () => {
  const alarm = cardEntity("alarm_control_panel", "disarmed", { supported_features: 3, code_format: "number", code_arm_required: true });
  open(alarm);
  fireEvent.change(screen.getByRole("combobox", { name: "Arm mode" }), { target: { value: "alarm_arm_away" } });
  fireEvent.click(screen.getByRole("button", { name: "Arm alarm" }));
  expect(mocks.command).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Code"), { target: { value: "1234" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(mocks.command).toHaveBeenCalledExactlyOnceWith(alarm.entityId, "alarm_arm_away", undefined, "1234"));
});

it("counts down timers from the reported finish time and stops when offline", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2030-01-01T10:00:00Z"));
  mocks.app.services = cardServices;
  const timer = cardEntity("timer", "active", { finishes_at: "2030-01-01T10:01:00Z", duration: "0:01:00" });
  const view = open(timer);
  expect(screen.getByText("00:01:00")).toBeVisible();
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByText("00:00:55")).toBeVisible();
  mocks.app.homeOnline = false;
  view.rerender(<MemoryRouter><TooltipProvider><SmartHomeCard entity={timer} /></TooltipProvider></MemoryRouter>);
  expect(screen.queryByText("00:00:55")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  expect(mocks.command).not.toHaveBeenCalled();
});


it("shows selected supporting readings and map once inside the device card", () => {
  const robot = cardEntity("vacuum", "docked", { supported_features: 8192 });
  const battery = { ...cardEntity("sensor", "84", { unit_of_measurement: "%" }), name: "Example battery" };
  const map = { ...cardEntity("image", "2030-01-01"), name: "Example map" };
  render(<MemoryRouter><TooltipProvider><SmartHomeCard entity={robot} entities={[robot, battery, map]} /></TooltipProvider></MemoryRouter>);
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByText("Example battery")).toBeVisible();
  expect(screen.getByText("84 %")).toBeVisible();
  expect(screen.getByRole("img", { name: "Example map" })).toHaveAttribute("src", expect.stringContaining("/api/image_proxy/image.example"));
});

it("falls back from camera video to MJPEG and snapshots and permits retry after an image failure", () => {
  open(cardEntity("camera", "idle"));
  const stream = screen.getByRole("img");
  expect(stream).toHaveAttribute("src", expect.stringContaining("/api/camera_proxy_stream/camera.example"));
  fireEvent.error(stream);
  const snapshot = screen.getByRole("img");
  expect(snapshot).toHaveAttribute("src", expect.stringContaining("/api/camera_proxy/camera.example"));
  fireEvent.load(snapshot);
  expect(screen.getByText("Snapshot · live stream unavailable")).toBeVisible();
  fireEvent.error(snapshot);
  expect(screen.getByText("Image unavailable")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(mocks.camera).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("img")).toHaveAttribute("src", expect.stringContaining("/api/camera_proxy_stream/"));
});

it("plays camera video without restarting on state updates and releases the preview when expanded", async () => {
  mocks.camera.mockImplementation(() => {});
  const entity = cardEntity("camera", "idle", { entity_picture: "https://example.invalid/private?token=fixture" });
  const view = open(entity);
  const video = screen.getByLabelText(entity.name, { selector: "video" });
  expect(video.tagName).toBe("VIDEO");
  expect(video).toHaveAttribute("autoplay"); expect(video).toHaveAttribute("playsinline");
  expect((video as HTMLVideoElement).muted).toBe(true);
  expect(video).toHaveAttribute("poster", "/api/camera_proxy/camera.example");
  fireEvent.playing(video); expect(screen.getByText("Live camera")).toBeVisible();
  view.rerender(<MemoryRouter><TooltipProvider><SmartHomeCard entity={{ ...entity, state: "streaming" }} /></TooltipProvider></MemoryRouter>);
  expect(mocks.camera).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: `Expand ${entity.name}` }));
  expect(mocks.camera.mock.calls[0][2].aborted).toBe(true);
  expect(document.querySelectorAll("video")).toHaveLength(1);
  expect(within(screen.getByRole("dialog")).getByLabelText(entity.name)).toHaveAttribute("controls");
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(mocks.camera).toHaveBeenCalledTimes(3));
  expect(mocks.camera.mock.calls[1][2].aborted).toBe(true);
  view.unmount(); expect(mocks.camera.mock.calls[2][2].aborted).toBe(true);
});

it("suspends camera video while the page is hidden and restarts it when visible", () => {
  mocks.camera.mockImplementation(() => {});
  open(cardEntity("camera", "idle"));
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(mocks.camera.mock.calls[0][2].aborted).toBe(true);
  expect(document.querySelector("video")).toBeNull();
  hidden.mockReturnValue(false); fireEvent(document, new Event("visibilitychange"));
  expect(mocks.camera).toHaveBeenCalledTimes(2);
  hidden.mockRestore();
});

it("starts camera video only near the viewport and stops it when scrolled away", () => {
  const observers: IntersectionObserverCallback[] = [];
  vi.stubGlobal("IntersectionObserver", class { constructor(callback: IntersectionObserverCallback) { observers.push(callback); } observe() {} disconnect() {} });
  mocks.camera.mockImplementation(() => {});
  open(cardEntity("camera", "idle"));
  expect(mocks.camera).not.toHaveBeenCalled();
  act(() => observers[0]([{ isIntersecting: true }] as IntersectionObserverEntry[], null));
  expect(mocks.camera).toHaveBeenCalledOnce();
  act(() => observers[0]([{ isIntersecting: false }] as IntersectionObserverEntry[], null));
  expect(mocks.camera.mock.calls[0][2].aborted).toBe(true);
  expect(document.querySelector("video")).toBeNull();
});

it("stops camera loading while offline and does not use entity-supplied URLs or tokens", () => {
  mocks.app.homeOnline = false;
  open(cardEntity("camera", "idle", { entity_picture: "https://example.invalid/private?token=fixture" }));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByText("Offline")).toBeVisible();
});

it.each(["camera", "image"])("expands %s into an accessible wide viewer and restores the preview on close", async domain => {
  const entity = cardEntity(domain, domain === "camera" ? "idle" : "2030-01-01T12:00:00Z");
  open(entity);
  const trigger = screen.getByRole("button", { name: `Expand ${entity.name}` });
  trigger.focus(); fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: entity.name });
  expect(dialog).toHaveClass("smart-media-dialog");
  expect(within(dialog).getByRole("img")).toHaveAttribute("src", expect.stringContaining(domain === "camera" ? "/api/camera_proxy_stream/" : "/api/image_proxy/"));
  expect(document.querySelectorAll("img")).toHaveLength(1);
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
  expect(screen.getByRole("img")).toBeInTheDocument();
});

it("renders reported weather and forecast, switches supported periods and cleans up subscriptions", () => {
  mocks.forecast.mockImplementation((_id, _type, _signal, receive) => receive([{ datetime: "2030-01-01T12:00:00Z", temperature: 18, templow: 10, condition: "cloudy", precipitation_probability: 30 }]));
  const view = open(cardEntity("weather", "rainy", { temperature: 19, temperature_unit: "°C", wind_speed: 3, wind_speed_unit: "m/s", humidity: 48, supported_features: 3 }));
  expect(screen.getByText("19")).toBeVisible();
  expect(screen.getByText("48%")).toBeVisible();
  expect(screen.getByText("18°C")).toBeVisible();
  const signal = mocks.forecast.mock.calls[0][2];
  fireEvent.change(screen.getByRole("combobox", { name: "Forecast" }), { target: { value: "daily" } });
  expect(signal.aborted).toBe(true);
  expect(mocks.forecast.mock.calls[1][1]).toBe("daily");
  view.unmount();
  expect(mocks.forecast.mock.calls[1][2].aborted).toBe(true);
});

it("reads numeric history only when opened and keeps failed history retryable", async () => {
  mocks.history.mockRejectedValueOnce(new Error("Unavailable"));
  open(cardEntity("sensor", "12", { unit_of_measurement: "W" }));
  expect(mocks.history).not.toHaveBeenCalled();
  const details = screen.getByText("History").closest("details");
  details.open = true; fireEvent(details, new Event("toggle"));
  await screen.findByText("History unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("No numeric history available.");
  expect(mocks.history).toHaveBeenCalledTimes(2);
});

it("shows firmware versions and protects password helper values", () => {
  const view = open(cardEntity("update", "on", { installed_version: "1.0", latest_version: "1.1" }));
  expect(screen.getByText("Update available")).toBeVisible();
  fireEvent.click(screen.getByText("Details"));
  expect(screen.getByText("1.0")).toBeVisible();
  expect(screen.getByText("1.1")).toBeVisible();
  view.unmount();
  open(cardEntity("input_text", "fixture-secret-value", { mode: "password" }));
  expect(screen.queryByText("fixture-secret-value")).not.toBeInTheDocument();
});

it("configures the main entity, group and linked reading without toggling sibling visibility", () => {
  const main = climate(), reading = { ...cardEntity("sensor", "55"), name: "Example maintenance" };
  mocks.app.currentHome.entities = [main, reading];
  render(<MemoryRouter><SmartHomeSettings /></MemoryRouter>);
  fireEvent.change(screen.getByRole("combobox", { name: "Main entity for Example thermostat" }), { target: { value: main.preferenceId } });
  expect(mocks.card).toHaveBeenLastCalledWith(main.preferenceId, { mainEntity: main.preferenceId });
  const group = screen.getByRole("combobox", { name: "Card group for Example thermostat" });
  fireEvent.change(group, { target: { value: "Comfort" } }); fireEvent.blur(group);
  expect(mocks.card).toHaveBeenLastCalledWith(main.preferenceId, { group: "Comfort" });
  const panel = group.closest(".smart-card-settings");
  fireEvent.click(within(panel as HTMLElement).getByText("Link entities from other devices"));
  fireEvent.change(within(panel as HTMLElement).getByRole("combobox", { name: "Add linked entity" }), { target: { value: reading.preferenceId } });
  expect(mocks.card).toHaveBeenLastCalledWith(main.preferenceId, { linkedEntities: [reading.preferenceId] });
  expect(mocks.visible).not.toHaveBeenCalled();
});
