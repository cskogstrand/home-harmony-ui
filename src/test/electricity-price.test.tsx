import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ElectricityPrice } from "@/components/ElectricityPrice";
import { cheapestWindow, currentSlot, isPriceSensor, mergeSlots, nordPoolSlots, priceCurrency, slotsOnDate, type PriceSlot } from "@/lib/electricity-price";
import { mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";

// Fictional market data: area codes, currency and prices are made up.
const zone = "Europe/Berlin";
const quarter = 900000;
/** Quarter-hour slots for one local day starting at `midnight` (UTC ISO), `hours` long, priced per MWh by local quarter index. */
const day = (midnight: string, hours: number, price: (index: number) => number) => Array.from({ length: hours * 4 }, (_, index) => {
  const start = Date.parse(midnight) + index * quarter;
  return { start: new Date(start).toISOString(), end: new Date(start + quarter).toISOString(), price: price(index) };
});
// 02:00–05:00 local is cheap (quarters 8–19), the evening is dear.
const shape = (index: number) => index >= 8 && index < 20 ? 300 : index >= 68 && index < 80 ? 2400 : 1200;
const winterDay = day("2026-11-23T23:00:00Z", 24, shape);
const slots = (list: ReturnType<typeof day>) => nordPoolSlots({ XX1: list });

it("offers price sensors by unit or monetary class and reads the currency from the unit", () => {
  const home = mapHome({
    "sensor.example_electricity_price": state("sensor.example_electricity_price", "1.2", { unit_of_measurement: "XYZ/kWh" }),
    "sensor.example_spend": state("sensor.example_spend", "40", { device_class: "monetary", unit_of_measurement: "XYZ" }),
    "sensor.example_power": state("sensor.example_power", "40", { device_class: "power", unit_of_measurement: "W" }),
  }, { areas: [], devices: [], entities: [] }, "home");
  expect(home.entities.filter(isPriceSensor).map(entity => entity.entityId).sort()).toEqual(["sensor.example_electricity_price", "sensor.example_spend"]);
  expect(priceCurrency("XYZ/kWh")).toBe("XYZ");
});

it("reads the sensor's price area from a Nord Pool answer and converts MWh prices to kWh", () => {
  const response = { XX1: [{ start: "2026-11-23T23:00:00Z", end: "2026-11-23T23:15:00Z", price: 1234.5 }], XX2: [{ start: "2026-11-23T23:00:00Z", end: "2026-11-23T23:15:00Z", price: 99 }] };
  expect(nordPoolSlots(response, "XX1-current_price")).toEqual([{ start: Date.parse("2026-11-23T23:00:00Z"), end: Date.parse("2026-11-23T23:15:00Z"), price: 1.2345 }]);
  expect(nordPoolSlots(response, "peak-XX2-block_average")[0].price).toBe(0.099);
  // Two areas and no hint: no guessing.
  expect(nordPoolSlots(response, "")).toEqual([]);
  expect(nordPoolSlots({ XX1: [{ start: "bad", end: "2026-11-23T23:15:00Z", price: 1 }, { start: "2026-11-23T23:00:00Z", end: "2026-11-23T23:15:00Z", price: "1" }] })).toEqual([]);
  expect(nordPoolSlots(null)).toEqual([]);
});

it("keeps 23 and 25 hour days on daylight-saving changes", () => {
  const spring = slots(day("2026-03-28T23:00:00Z", 23, () => 1000));
  const autumn = slots(day("2026-10-24T22:00:00Z", 25, () => 1000));
  expect(slotsOnDate(spring, "2026-03-29", zone)).toHaveLength(92);
  expect(slotsOnDate(autumn, "2026-10-25", zone)).toHaveLength(100);
  // The cheapest window is three real hours, even across the repeated hour.
  const window = cheapestWindow(autumn.map((slot, index) => index >= 8 && index < 20 ? { ...slot, price: 0.1 } : slot), Date.parse("2026-10-24T22:00:00Z"));
  expect(window).toEqual({ start: Date.parse("2026-10-24T22:00:00Z") + 8 * quarter, end: Date.parse("2026-10-24T22:00:00Z") + 20 * quarter, average: 0.1 });
});

it("finds the cheapest unbroken three hours in the next day, across midnight when tomorrow is known", () => {
  const today = slots(winterDay);
  const now = Date.parse("2026-11-24T10:05:00Z");
  // Without tomorrow only today's evening remains: the cheapest three hours start at the current slot or later.
  const withoutTomorrow = cheapestWindow(today, now)!;
  expect(withoutTomorrow.start).toBeGreaterThanOrEqual(currentSlot(today, now)!.start);
  expect(withoutTomorrow.average).toBe(1.2);
  const tomorrow = slots(day("2026-11-24T23:00:00Z", 24, shape));
  const both = mergeSlots(today, tomorrow, today);
  expect(both).toHaveLength(192);
  expect(cheapestWindow(both, now)).toEqual({ start: Date.parse("2026-11-25T01:00:00Z"), end: Date.parse("2026-11-25T04:00:00Z"), average: 0.3 });
  // A gap in the series never counts as a cheap window.
  const gap = today.filter((_, index) => index !== 12);
  expect(cheapestWindow(gap, Date.parse("2026-11-23T23:00:00Z"))!.start).not.toBe(Date.parse("2026-11-24T01:00:00Z"));
  expect(cheapestWindow([], now)).toBeUndefined();
});

const mocks = vi.hoisted(() => ({ home: null, online: true, selected: "", now: new Date(), priceSeries: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: (select = app => app) => select({ currentHome: mocks.home, homeOnline: mocks.online, priceSeries: mocks.priceSeries }) }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ electricityPriceEntity: mocks.selected, now: mocks.now }) }));
afterEach(() => { cleanup(); mocks.selected = ""; mocks.online = true; mocks.priceSeries.mockReset(); });

const priceHome = () => ({ ...mapHome({ "sensor.example_electricity_price": state("sensor.example_electricity_price", "1.75", { friendly_name: "Example electricity price", unit_of_measurement: "XYZ/kWh" }) },
  { areas: [], devices: [], entities: [] }, "home"), timeZone: zone });
const show = () => render(<MemoryRouter><ElectricityPrice /></MemoryRouter>);

it("explains how to choose a price sensor in Settings when none is chosen", () => {
  mocks.home = priceHome();
  show();
  const panel = within(screen.getByRole("region", { name: "Electricity price" }));
  expect(panel.getByText(/Choose your electricity price sensor in Settings/)).toBeVisible();
  expect(panel.getByRole("link", { name: "Choose a price sensor" })).toHaveAttribute("href", "/settings/electricity-price");
  expect(mocks.priceSeries).not.toHaveBeenCalled();
});

it("shows the current price, the cheapest window in words and today's strip with a table, and says when tomorrow is not out", async () => {
  mocks.home = priceHome();
  mocks.selected = "home|sensor.example_electricity_price";
  mocks.now = new Date("2026-11-23T23:20:00Z"); // 00:20 local
  mocks.priceSeries.mockImplementation(async (_id: string, date: string) => {
    if (date === "2026-11-24") return slots(winterDay);
    throw new Error("Prices unavailable");
  });
  const { container } = show();
  const panel = within(screen.getByRole("region", { name: "Electricity price" }));
  expect(await panel.findByText("1.20 XYZ/kWh", { selector: "strong" })).toBeVisible();
  expect(mocks.priceSeries).toHaveBeenCalledWith("sensor.example_electricity_price", "2026-11-24", expect.any(AbortSignal));
  expect(mocks.priceSeries).toHaveBeenCalledWith("sensor.example_electricity_price", "2026-11-25", expect.any(AbortSignal));
  expect(panel.getByText("Cheapest from 02:00 to 05:00")).toBeVisible();
  expect(panel.getByText("Average 0.30 XYZ/kWh")).toBeVisible();
  expect(panel.getByText("Today")).toBeVisible();
  expect(panel.queryByText("Tomorrow")).not.toBeInTheDocument();
  expect(panel.getByText("Tomorrow’s prices are usually published in the early afternoon.")).toBeVisible();
  expect(container.querySelectorAll(".price-bar")).toHaveLength(96);
  expect(container.querySelectorAll(".price-bar[data-cheapest]")).toHaveLength(12);
  expect(container.querySelector(".price-strip")).toHaveAttribute("aria-hidden", "true");
  const table = panel.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(97);
  expect(table.querySelector("tr[aria-current='time']")).toHaveTextContent("00:15–00:30 (Now)1.20 XYZ/kWh");
});

it("adds tomorrow once published and points the window to the next cheap night", async () => {
  mocks.home = priceHome();
  mocks.selected = "home|sensor.example_electricity_price";
  mocks.now = new Date("2026-11-24T13:00:00Z");
  mocks.priceSeries.mockImplementation(async (_id: string, date: string) => slots(date === "2026-11-24" ? winterDay : day("2026-11-24T23:00:00Z", 24, shape)));
  const { container } = show();
  const panel = within(screen.getByRole("region", { name: "Electricity price" }));
  expect(await panel.findByText("Tomorrow")).toBeVisible();
  expect(panel.getByText("Cheapest from 02:00 to 05:00")).toBeVisible();
  expect(container.querySelectorAll(".price-strip")).toHaveLength(2);
  expect(panel.queryByText(/usually published/)).not.toBeInTheDocument();
});

it("shows only the current reading for a sensor without a price series, and nothing stale offline", async () => {
  mocks.home = priceHome();
  mocks.selected = "home|sensor.example_electricity_price";
  mocks.priceSeries.mockResolvedValue(null);
  show();
  const panel = within(screen.getByRole("region", { name: "Electricity price" }));
  expect(await panel.findByText(/does not provide prices for the rest of the day/)).toBeVisible();
  expect(panel.getByText("1.75 XYZ/kWh")).toBeVisible();
  expect(panel.queryByRole("table")).not.toBeInTheDocument();
  cleanup();
  mocks.online = false;
  show();
  expect(screen.getByText("Home Assistant is offline.")).toBeVisible();
  expect(screen.queryByText("1.75 XYZ/kWh")).not.toBeInTheDocument();
  await waitFor(() => expect(mocks.priceSeries).toHaveBeenCalledTimes(2));
});
