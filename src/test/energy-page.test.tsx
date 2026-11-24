import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EnergySaver from "@/pages/EnergySaver";
import { mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
const mocks = vi.hoisted(() => ({ home: null, pins: [] as string[], setEnergyMeters: vi.fn(), history: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: (select = app => app) => select({ currentHome: mocks.home, homeOnline: true, entityHistory: mocks.history }) }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ language: "en", energyMeters: mocks.pins, setEnergyMeters: mocks.setEnergyMeters }) }));
vi.mock("@/components/HomePanels", () => ({ VehicleCard: () => null }));
vi.mock("@/components/devices/DeviceReading", () => ({ DeviceReading: ({ entity }) => <p>{entity.name}: {entity.state} {entity.attributes.unit_of_measurement}</p> }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => ({ state: { loaded: true } }) }));
afterEach(() => { cleanup(); mocks.pins = []; });
it("groups physical meters and never calls an unspecified energy reading a daily total", () => {
  mocks.home = mapHome({
    "sensor.example_power": state("sensor.example_power", "450", { friendly_name: "Example power", device_class: "power", unit_of_measurement: "W" }),
    "sensor.example_energy": state("sensor.example_energy", "123", { friendly_name: "Example energy", device_class: "energy", unit_of_measurement: "kWh" }),
  }, { areas: [], devices: [{ id: "meter", name: "Example meter" }], entities: [
    { id: "power", entity_id: "sensor.example_power", device_id: "meter" }, { id: "energy", entity_id: "sensor.example_energy", device_id: "meter" },
  ] }, "home");
  render(<EnergySaver />);
  const meter = within(screen.getByRole("region", { name: "Example meter" }));
  expect(meter.getByText("Power now")).toBeVisible();
  expect(meter.getByText("Example energy: 123 kWh")).toBeVisible();
  expect(meter.getByText("Reporting period not provided by Home Assistant.")).toBeVisible();
  expect(screen.queryByText(/daily total/i)).not.toBeInTheDocument();
});

it("loads recorded history for pinned meters and lets users remove a missing meter at the limit", async () => {
  mocks.home = mapHome(Object.fromEntries(["a", "b", "c"].map(name => [`sensor.${name}`, state(`sensor.${name}`, "10", { friendly_name: name, device_class: "power", unit_of_measurement: "W" })])),
    { areas: [], entities: [], devices: [] }, "home");
  mocks.pins = ["home|sensor.a", "home|sensor.b", "home|sensor.missing"];
  mocks.history.mockResolvedValue([{ lu: 100, s: "9" }]);
  render(<EnergySaver />);
  const pins = within(screen.getByRole("region", { name: "Pinned meters" }));
  expect(await pins.findByRole("img", { name: "Recorded history for a" })).toBeVisible();
  expect(pins.getByRole("img", { name: "Recorded history for a" }).querySelector('path[stroke-linecap="round"]')).not.toBeNull();
  expect(pins.getByText("Meter unavailable")).toBeVisible();
  fireEvent.click(pins.getByRole("button", { name: "Choose up to three meters" }));
  expect(screen.getByRole("checkbox", { name: "c" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /missing/ }));
  expect(mocks.setEnergyMeters).toHaveBeenCalledWith(["home|sensor.a", "home|sensor.b"]);
});
