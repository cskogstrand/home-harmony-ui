import { expect, it } from "vitest";
import { idleWatts, powerNow, splitIdle, wattsReading } from "@/lib/energy";
import { mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";

const power = (id: string, value: string, unit = "W", extra: Record<string, unknown> = {}) =>
  [`sensor.${id}`, state(`sensor.${id}`, value, { friendly_name: id, device_class: "power", unit_of_measurement: unit, ...extra })] as const;
const home = (entries: (readonly [string, ReturnType<typeof state>])[], hidden: string[] = []) => mapHome(Object.fromEntries(entries), {
  areas: [], devices: [], entities: hidden.map(entity_id => ({ id: entity_id, entity_id, hidden_by: "user" })),
}, "home");

it("normalises W and kW to watts and sorts the largest draw first", () => {
  const readings = powerNow(home([power("kettle", "1.8", "kW"), power("fridge", "85"), power("heater", "1200"), power("router", "0.009", "kW")]).entities);
  expect(readings.map(({ entity, watts }) => [entity.name, watts])).toEqual([["kettle", 1800], ["heater", 1200], ["fridge", 85], ["router", 9]]);
});

it("keeps only reported power sensors in a known unit and skips entities hidden in Home Assistant", () => {
  const readings = powerNow(home([
    power("shown", "40"), power("hidden", "900"), power("offline", "unavailable"), power("waiting", "unknown"), power("garbled", "n/a"),
    power("odd_unit", "40", "BTU/h"), ["sensor.energy", state("sensor.energy", "12", { device_class: "energy", unit_of_measurement: "kWh" })],
    ["switch.power", state("switch.power", "on", { device_class: "power" })],
  ], ["sensor.hidden"]).entities);
  expect(readings.map(reading => reading.entity.name)).toEqual(["shown"]);
});

it("treats readings below 5 W as idle", () => {
  const readings = powerNow(home([power("standby", "4.9"), power("lamp", "5"), power("export", "-300"), power("tv", "120")]).entities);
  const { active, idle } = splitIdle(readings);
  expect(idleWatts).toBe(5);
  expect(active.map(reading => reading.entity.name)).toEqual(["tv", "lamp"]);
  expect(idle.map(reading => reading.entity.name)).toEqual(["standby", "export"]);
});

it("shows sums below 1 kW in W and larger sums in kW", () => {
  expect(wattsReading(950)).toEqual({ value: 950, unit: "W" });
  expect(wattsReading(2450)).toEqual({ value: 2.45, unit: "kW" });
});
