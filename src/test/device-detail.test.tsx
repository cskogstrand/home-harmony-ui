import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppContext } from "@/contexts/AppContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import DeviceDetail from "@/pages/DeviceDetail";
import { cardEntity, cardServices, mediaEntity } from "./device-card-fixtures";
import type { Entity } from "@/types/api";

const device = { id: "example", name: "Example device", area_id: "example-room", manufacturer: "Example maker", model: "T100", sw_version: "1.2" };
const command = vi.fn().mockResolvedValue(undefined);
const history = vi.fn().mockResolvedValue([]);
const open = (entities: Entity[], hash = "", online = true) => render(<AppContext.Provider value={{
  currentHome: { devices: [device], entities: entities.map(entity => ({ ...entity, device })), areas: [{ id: "example-room", name: "Example room", entities: [] }], temperatureUnit: "°C", timeZone: "UTC" },
  homeOnline: online, services: cardServices, commands: {}, command, entityHistory: history,
  connectionStatus: "connected", metadataWarnings: [], haUrl: "", watchCameraStream: vi.fn(),
} as unknown as React.ContextType<typeof AppContext>}><MemoryRouter initialEntries={[`/devices/example${hash}`]}><TooltipProvider><Routes><Route path="/devices/:deviceId" element={<DeviceDetail />} /></Routes></TooltipProvider></MemoryRouter></AppContext.Provider>);
beforeEach(() => {
  command.mockClear(); history.mockClear();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("leads with the thermostat controls, keeps readings separate and defers maintenance", () => {
  open([
    cardEntity("sensor", "46", { friendly_name: "Humidity", unit_of_measurement: "%", device_class: "humidity" }),
    cardEntity("climate", "heat", { friendly_name: "Thermostat", supported_features: 1, temperature: 21, current_temperature: 20, min_temp: 7, max_temp: 30, target_temp_step: .5, hvac_modes: ["heat", "off"] }),
    { ...cardEntity("select", "Auto", { options: ["Auto", "Always on"] }), category: "config" },
    { ...cardEntity("button", "unknown"), category: "diagnostic" },
  ]);
  const controls = screen.getByRole("region", { name: "Device controls" });
  expect(within(controls).getByRole("article", { name: "Thermostat" })).toHaveAttribute("data-card-kind", "climate");
  expect(within(controls).queryByRole("link")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Increase temperature for Thermostat" }));
  expect(command).toHaveBeenCalledExactlyOnceWith("climate.example", "temperature", 21.5);
  expect(screen.getByRole("region", { name: "Readings and status" })).toHaveTextContent("46 %");
  expect(screen.queryByRole("tab", { name: "Diagnostics" })).not.toBeInTheDocument();
  expect(screen.queryByText("Device configuration")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Device settings" })).toHaveAttribute("aria-expanded", "false");
  expect(history).not.toHaveBeenCalled();
});

it.each(["config", "diagnostic"])("opens and focuses a deep-linked %s entity", async category => {
  const entity = { ...cardEntity("select", "Auto", { options: ["Auto", "Manual"] }), category };
  open([entity], `#${entity.entityId}`);
  const article = await screen.findByRole("article", { name: entity.name });
  await waitFor(() => expect(article).toHaveFocus());
  expect(screen.getByRole("tab", { name: category === "config" ? "Settings" : "Diagnostics" })).toHaveAttribute("aria-selected", "true");
  expect(within(article).getByRole("combobox")).toBeEnabled();
});

it("gives sensor-only devices visible readings without fetching history on arrival", () => {
  open([cardEntity("sensor", "21.4", { unit_of_measurement: "°C" }), cardEntity("binary_sensor", "off", { device_class: "moisture" })]);
  expect(screen.queryByRole("region", { name: "Device controls" })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Readings and status" })).toHaveTextContent("21.4 °C");
  expect(screen.getByRole("region", { name: "Readings and status" })).toHaveTextContent("Dry");
  expect(history).not.toHaveBeenCalled();
});

it("opens reading history and technical details from named icons and preserves deep links", async () => {
  const entity = cardEntity("sensor", "21.4", { friendly_name: "Temperature", unit_of_measurement: "°C" });
  open([entity], `#${entity.entityId}`);
  const reading = screen.getByRole("article", { name: "Temperature" });
  expect(reading).toHaveFocus();
  expect(history).not.toHaveBeenCalled();
  fireEvent.click(within(reading).getByLabelText("History for Temperature"));
  await waitFor(() => expect(history).toHaveBeenCalledWith(entity.entityId, 1, expect.any(AbortSignal)));
  await screen.findByText("No numeric history available.");
  fireEvent.change(screen.getByRole("combobox", { name: "History period" }), { target: { value: "7" } });
  await waitFor(() => expect(history).toHaveBeenLastCalledWith(entity.entityId, 7, expect.any(AbortSignal)));
  expect(within(reading).getByText("Entity ID")).not.toBeVisible();
  fireEvent.click(within(reading).getByLabelText("Technical details for Temperature"));
  expect(within(reading).getByText("Entity ID")).toBeVisible();
});

it.each([
  ["84", "%", true, true], ["0", "%", true, true], ["100", "%", true, true],
  ["101", "%", true, false], ["-1", "%", true, false], ["3.2", "V", true, false],
  ["unknown", "%", true, false], ["84", "%", false, false],
])("shows a battery indicator only for reported percentages (%s %s, online: %s)", (state, unit, online, indicator) => {
  open([cardEntity("sensor", state, { device_class: "battery", unit_of_measurement: unit })], "", online);
  const reading = screen.getByRole("article", { name: "Example sensor" });
  expect(!!reading.querySelector(".device-reading-battery")).toBe(indicator);
  if (indicator) expect(reading.querySelector(".device-reading-battery > span")).toHaveStyle({ width: `${state}%` });
});

it.each([
  ["moisture", "on", true, "attention", "Leak detected"],
  ["moisture", "off", true, "reported", "Dry"],
  ["door", "on", true, "reported", "Open"],
  ["moisture", "unavailable", true, "unavailable", "Unavailable"],
  ["moisture", "on", false, "unavailable", "Offline"],
])("distinguishes reported alerts from ordinary or unavailable status (%s %s, online: %s)", (deviceClass, state, online, tone, label) => {
  open([cardEntity("binary_sensor", state, { device_class: deviceClass })], "", online);
  const reading = screen.getByRole("article", { name: "Example binary_sensor" });
  expect(reading).toHaveAttribute("data-state", tone);
  expect(reading.querySelector(".device-reading-value")).toHaveTextContent(label);
  expect(within(reading).queryByLabelText(/History for/)).not.toBeInTheDocument();
});

it("uses vacuum controls and the reported map without duplicating entities", () => {
  open([cardEntity("vacuum", "docked", { supported_features: 8192 + 16 + 32, battery_level: 84 }), cardEntity("image", "2026-01-01T00:00:00Z")]);
  expect(screen.getAllByRole("article")).toHaveLength(2);
  expect(screen.getByRole("article", { name: "Example vacuum" })).toHaveAttribute("data-card-kind", "vacuum");
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(command).toHaveBeenCalledExactlyOnceWith("vacuum.example", "start", undefined);
  expect(screen.getByRole("img", { name: "Example image" })).toHaveAttribute("src", expect.stringContaining("/api/image_proxy/image.example"));
});

it("keeps media transport and unavailable readings honest while offline", () => {
  open([mediaEntity(), cardEntity("sensor", "25", { unit_of_measurement: "W" })], "", false);
  expect(screen.getByRole("button", { name: "Start playback" })).toBeDisabled();
  expect(screen.getByText("Home Assistant offline")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Readings and status" })).not.toHaveTextContent("25");
  fireEvent.click(screen.getByRole("button", { name: "Start playback" }));
  expect(command).not.toHaveBeenCalled();
});

it("retains unfamiliar controls and devices with only configuration entities", () => {
  open([{ ...cardEntity("future_domain", "idle"), category: "config" }]);
  fireEvent.click(screen.getByRole("button", { name: "Device settings" }));
  expect(screen.getByRole("article", { name: "Example future_domain" })).toHaveTextContent("Idle");
  expect(screen.queryByText(/no visible controls/)).not.toBeInTheDocument();
});

it("uses named settings, bounded numeric controls and maintenance actions in the gear menu", () => {
  open([
    { ...cardEntity("select", "Auto", { friendly_name: "Display mode", options: ["Auto", "Always on"] }), category: "config" },
    { ...cardEntity("number", "0", { friendly_name: "Temperature offset", min: -2, max: 2, step: .5, unit_of_measurement: "°C" }), category: "config" },
    { ...cardEntity("button", "unknown", { friendly_name: "Identify device" }), category: "diagnostic" },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Device settings" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Display mode" }), { target: { value: "Always on" } });
  expect(command).toHaveBeenLastCalledWith("select.example", "select_option", "Always on");
  const slider = screen.getByRole("slider", { name: "Temperature offset" });
  expect(slider).toHaveAttribute("aria-valuemin", "-2");
  expect(slider).toHaveAttribute("aria-valuemax", "2");
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(command).toHaveBeenLastCalledWith("number.example", "set_value", .5);
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Diagnostics" }), { button: 0, ctrlKey: false });
  fireEvent.click(screen.getByRole("button", { name: "Identify device" }));
  expect(command).toHaveBeenLastCalledWith("button.example", "press", undefined);
  expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
});

it("shows reported diagnostics and a device-specific About summary", () => {
  open([{ ...cardEntity("sensor", "-61", { friendly_name: "Signal strength", device_class: "signal_strength", unit_of_measurement: "dBm" }), category: "diagnostic", integration: "example_integration" }]);
  fireEvent.click(screen.getByRole("button", { name: "Device settings" }));
  const about = screen.getByRole("tabpanel", { name: "About" });
  for (const value of ["Example maker", "T100", "1.2", "Example room", "example_integration"]) expect(about).toHaveTextContent(value);
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Diagnostics" }), { button: 0, ctrlKey: false });
  const signal = screen.getByRole("article", { name: "Signal strength" });
  expect(signal).toHaveTextContent("-61 dBm");
  expect(signal).toHaveTextContent("Last updated");
  expect(within(signal).getByText("Entity ID")).not.toBeVisible();
  fireEvent.click(within(signal).getByLabelText("Technical details for Signal strength"));
  expect(within(signal).getByText("Entity ID")).toBeVisible();
});

it("disables settings and avoids stale diagnostic values while offline", () => {
  open([
    { ...cardEntity("select", "Auto", { options: ["Auto", "Manual"] }), category: "config" },
    { ...cardEntity("sensor", "-61", { unit_of_measurement: "dBm" }), category: "diagnostic" },
  ], "", false);
  fireEvent.click(screen.getByRole("button", { name: "Device settings" }));
  expect(screen.getByRole("combobox")).toBeDisabled();
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Offline");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Diagnostics" }), { button: 0, ctrlKey: false });
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Home Assistant offline");
  expect(screen.queryByText("-61 dBm")).not.toBeInTheDocument();
  expect(command).not.toHaveBeenCalled();
});
