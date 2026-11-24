import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EnergySettings } from "@/components/EnergySettings";
import { mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";

const mocks = vi.hoisted(() => ({ home: null, online: true, selected: "", choose: vi.fn(() => true) }));
vi.mock("@/contexts/AppContext", () => ({ useApp: (select = app => app) => select({ currentHome: mocks.home, homeOnline: mocks.online }) }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ electricityPriceEntity: mocks.selected, setElectricityPriceEntity: mocks.choose }) }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => ({ state: { loaded: true } }) }));
afterEach(() => { cleanup(); mocks.selected = ""; mocks.choose.mockClear(); });

const home = (states: ReturnType<typeof state>[]) => mapHome(Object.fromEntries(states.map(item => [item.entity_id, item])), { areas: [], devices: [], entities: [] }, "home");

it("offers sensors priced per kWh or monetary and saves the owner's choice", () => {
  mocks.home = home([
    state("sensor.example_electricity_price", "1.25", { friendly_name: "Example electricity price", unit_of_measurement: "XYZ/kWh" }),
    state("sensor.example_cost", "40", { friendly_name: "Example cost", device_class: "monetary", unit_of_measurement: "XYZ" }),
    state("sensor.example_power", "400", { friendly_name: "Example power", device_class: "power", unit_of_measurement: "W" }),
  ]);
  render(<EnergySettings />);
  fireEvent.click(screen.getByRole("button", { name: "Price sensor" }));
  expect(screen.getByRole("button", { name: "Example electricity price · sensor.example_electricity_price" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Example cost · sensor.example_cost" })).toBeVisible();
  expect(screen.queryByRole("button", { name: /sensor.example_power/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Example electricity price · sensor.example_electricity_price" }));
  expect(mocks.choose).toHaveBeenCalledWith("home|sensor.example_electricity_price");
});

it("explains how to add a price source when none is found", () => {
  mocks.home = home([state("sensor.example_power", "400", { device_class: "power", unit_of_measurement: "W" })]);
  render(<EnergySettings />);
  expect(screen.getByRole("status")).toHaveTextContent("No price sensors found.");
});
