import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EnergySaver from "@/pages/EnergySaver";
import { mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
const mocks = vi.hoisted(() => ({ home: null, online: true, pins: [] as string[], setEnergyMeters: vi.fn(), history: vi.fn(), energySetup: vi.fn(async (): Promise<string> => "configured") }));
vi.mock("@/contexts/AppContext", () => ({ useApp: (select = app => app) => select({ currentHome: mocks.home, homeOnline: mocks.online, haUrl: "http://ha.example.test", entityHistory: mocks.history, energySetup: mocks.energySetup }) }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ language: "en", energyMeters: mocks.pins, setEnergyMeters: mocks.setEnergyMeters }) }));
vi.mock("@/components/HomePanels", () => ({ VehicleCard: () => <section aria-label="Example vehicle" /> }));
vi.mock("@/components/devices/DeviceReading", () => ({ DeviceReading: ({ entity }) => <p>{entity.name}: {entity.state} {entity.attributes.unit_of_measurement}</p> }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => ({ state: { loaded: true } }) }));
afterEach(() => { cleanup(); mocks.pins = []; mocks.online = true; mocks.energySetup.mockReset(); });
it("groups physical meters and never calls an unspecified energy reading a daily total", () => {
  mocks.home = mapHome({
    "sensor.example_power": state("sensor.example_power", "450", { friendly_name: "Example power", device_class: "power", unit_of_measurement: "W" }),
    "sensor.example_energy": state("sensor.example_energy", "123", { friendly_name: "Example energy", device_class: "energy", unit_of_measurement: "kWh" }),
  }, { areas: [], devices: [{ id: "meter", name: "Example meter" }], entities: [
    { id: "power", entity_id: "sensor.example_power", device_id: "meter" }, { id: "energy", entity_id: "sensor.example_energy", device_id: "meter" },
  ] }, "home");
  const { container } = render(<EnergySaver />);
  expect(within(screen.getByRole("region", { name: "Using power now" })).getByText("Example power")).toBeVisible();
  const counters = container.querySelector<HTMLDetailsElement>("details.energy-meters")!;
  expect(counters.open).toBe(false);
  fireEvent.click(within(counters).getByText("Meters"));
  const meter = within(screen.getByRole("region", { name: "Example meter" }));
  expect(meter.queryByText("Power now")).not.toBeInTheDocument();
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

const circuits = (readings: Record<string, [string, string?]>) => mapHome(Object.fromEntries(Object.entries(readings).map(([id, [value, unit = "W"]]) =>
  [`sensor.${id}`, state(`sensor.${id}`, value, { friendly_name: `Example ${id}`, device_class: "power", unit_of_measurement: unit })])), {
  areas: [{ area_id: "kitchen", name: "Example kitchen" }], devices: [], entities: [{ id: "oven", entity_id: "sensor.oven", area_id: "kitchen" }],
}, "home");

it("leads with the top five consumers, labels their sum as listed circuits and tucks the rest away", () => {
  mocks.home = circuits({ oven: ["2.1", "kW"], heater: ["800"], dryer: ["1.2", "kW"], tv: ["90"], fridge: ["60"], router: ["12"], lamp: ["6"], charger: ["4"], standby: ["0.5"] });
  render(<EnergySaver />);
  const now = within(screen.getByRole("region", { name: "Using power now" }));
  const [top] = now.getAllByRole("list");
  expect(within(top).getAllByRole("listitem").map(item => item.querySelector("strong")?.textContent))
    .toEqual(["Example oven", "Example dryer", "Example heater", "Example tv", "Example fridge"]);
  expect(within(top).getAllByRole("listitem")[0]).toHaveTextContent("Example ovenExample kitchen2.1 kW");
  // 2100 + 1200 + 800 + 90 + 60 W, never called a house total.
  expect(now.getByText("Total of listed circuits").parentElement).toHaveTextContent("Total of listed circuits4.25 kW");
  expect(now.queryByText(/house|whole/i)).not.toBeInTheDocument();
  expect(now.getByText("More in use (2)")).toBeVisible();
  expect(now.getByText("Example router")).not.toBeVisible();
  expect(now.getByText("Show idle (2)")).toBeVisible();
  expect(now.getByText("Example standby")).not.toBeVisible();
  fireEvent.click(now.getByText("Show idle (2)"));
  expect(now.getByText("Example standby")).toBeVisible();
  expect(now.getByText("Example charger")).toBeVisible();
  expect(screen.queryByText("Meters")).not.toBeInTheDocument();
});

it("says when nothing draws power and never lists stale readings while offline", () => {
  mocks.home = circuits({ router: ["3"], lamp: ["0"] });
  render(<EnergySaver />);
  const now = within(screen.getByRole("region", { name: "Using power now" }));
  expect(now.getByText("Nothing is drawing more than 5 W right now.")).toBeVisible();
  expect(now.queryByText("Total of listed circuits")).not.toBeInTheDocument();
  expect(now.getByText("Show idle (2)")).toBeVisible();
  cleanup();
  mocks.online = false;
  mocks.home = circuits({ oven: ["2000"] });
  render(<EnergySaver />);
  const offline = within(screen.getByRole("region", { name: "Using power now" }));
  expect(offline.getByText("Home Assistant is offline.")).toBeVisible();
  expect(offline.queryByText("Example oven")).not.toBeInTheDocument();
});

it("keeps pinned meters above power now and vehicle cards", () => {
  mocks.home = circuits({ oven: ["2000"], heater: ["700"] });
  mocks.pins = ["home|oven"];
  const { container } = render(<EnergySaver />);
  const regions = [...container.querySelectorAll("section[aria-label]")].map(region => region.getAttribute("aria-label"));
  expect(regions.slice(0, 3)).toEqual(["Pinned meters", "Using power now", "Example vehicle"]);
});

it("links to Home Assistant Energy when it is set up and to its setup page when it is not", async () => {
  mocks.home = circuits({ oven: ["2000"] });
  mocks.energySetup.mockResolvedValue("configured");
  render(<EnergySaver />);
  expect(await screen.findByRole("link", { name: "Open Home Assistant Energy" })).toHaveAttribute("href", "http://ha.example.test/energy");
  cleanup();
  mocks.energySetup.mockResolvedValue("missing");
  render(<EnergySaver />);
  expect(await screen.findByRole("link", { name: "Set up Energy in Home Assistant" })).toHaveAttribute("href", "http://ha.example.test/config/energy");
  expect(screen.getByText(/Energy is not set up in Home Assistant yet/)).toBeVisible();
  expect(screen.queryByRole("link", { name: "Open Home Assistant Energy" })).not.toBeInTheDocument();
  cleanup();
  mocks.energySetup.mockRejectedValue(new Error("Energy preferences unavailable"));
  render(<EnergySaver />);
  await waitFor(() => expect(mocks.energySetup).toHaveBeenCalled());
  expect(screen.getByRole("link", { name: "Open Home Assistant Energy" })).toHaveAttribute("href", "http://ha.example.test/energy");
  expect(screen.queryByText(/not set up/)).not.toBeInTheDocument();
});
