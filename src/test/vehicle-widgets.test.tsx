import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VehicleWidgets } from "@/components/VehicleWidgets";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { createI18n } from "@/lib/i18n";
import { state } from "./ha-fixtures";

const data = vi.hoisted(() => ({
  app: { currentHome: null, homeOnline: true, command: vi.fn(), services: {} },
  vehicles: [] as { id: string; name: string }[],
  now: new Date("2030-04-09T07:00:00Z"),
}));
vi.mock("@/contexts/AppContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/AppContext")>(), useApp: () => data.app }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/FamilyContext")>(), useFamily: () => data }));
vi.mock("@/hooks/use-i18n", () => ({ useI18n: () => createI18n("en") }));

// Two fictional cars: the second has less charge left and is the one the phone chip leads with.
const battery = { unit_of_measurement: "%", device_class: "battery" };
const home = (levels: Record<string, string>) => mapHome(Object.fromEntries(Object.entries(levels).map(([car, level]) =>
  [`sensor.${car}_battery`, state(`sensor.${car}_battery`, level, battery)])), {
  ...emptyRegistries,
  devices: [{ id: "car-one", name: "Example One", model: "Model 3" }, { id: "car-two", name: "Example Two", model: "Model Y" }],
  entities: Object.keys(levels).map(car => ({ id: car, entity_id: `sensor.${car}_battery`, device_id: `car-${car}`, platform: "tesla_fleet" })),
}, "home");
const width = window.innerWidth;
const resize = (value: number) => Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value });

beforeEach(() => {
  data.app.currentHome = home({ one: "64", two: "35" });
  data.app.homeOnline = true;
  data.vehicles = [{ id: "car-one", name: "Example One" }, { id: "car-two", name: "Example Two" }];
});
afterEach(() => { cleanup(); resize(width); });

it("keeps one button per vehicle on wider screens", () => {
  resize(1024);
  render(<VehicleWidgets />);
  const strip = screen.getByRole("region", { name: "Electric vehicles" });
  expect(within(strip).getAllByRole("button", { name: /^Open status for/ })).toHaveLength(2);
  expect(strip).not.toHaveClass("vehicle-chip-strip");
});

it("collapses several vehicles into one phone chip led by the lowest battery that opens each vehicle's detail", async () => {
  resize(390);
  render(<VehicleWidgets />);
  const strip = screen.getByRole("region", { name: "Electric vehicles" });
  expect(strip).toHaveClass("vehicle-chip-strip");
  expect(within(strip).queryByRole("button", { name: /^Open status for/ })).toBeNull();
  const chip = within(strip).getByRole("button", { name: "Electric vehicles · lowest battery: Example Two, 35%" });
  expect(chip).toHaveTextContent("35%");
  fireEvent.keyDown(chip, { key: "Enter" });
  const items = screen.getAllByRole("menuitem");
  expect(items.map(item => item.textContent)).toEqual(["Example Two35%", "Example One64%"]);
  fireEvent.click(items[1]);
  const dialog = await screen.findByRole("dialog", { name: "Example One" });
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(chip).toHaveFocus());
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("opens a single vehicle's detail straight from its phone chip", async () => {
  resize(390);
  data.vehicles = [{ id: "car-one", name: "Example One" }];
  data.app.currentHome = home({ one: "64" });
  render(<VehicleWidgets />);
  const chip = screen.getByRole("button", { name: /^Open status for Example One\. Battery 64%/ });
  expect(chip).toHaveClass("vehicle-chip");
  fireEvent.click(chip);
  expect(await screen.findByRole("dialog", { name: "Example One" })).toBeVisible();
});
