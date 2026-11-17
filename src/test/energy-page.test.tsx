import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EnergySaver from "@/pages/EnergySaver";
import { mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
const mocks = vi.hoisted(() => ({ home: null }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => ({ currentHome: mocks.home }) }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ language: "en" }) }));
vi.mock("@/components/HomePanels", () => ({ VehicleCard: () => null }));
vi.mock("@/components/devices/DeviceReading", () => ({ DeviceReading: ({ entity }) => <p>{entity.name}: {entity.state} {entity.attributes.unit_of_measurement}</p> }));
afterEach(cleanup);
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
