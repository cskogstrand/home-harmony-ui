import { expect, it } from "vitest";
import { homeReadingState, homeStatusGroup } from "@/lib/home-status";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";

it.each([
  ["binary_sensor", "moisture", "on", "water", "alert"],
  ["binary_sensor", "smoke", "off", "fire", "reported"],
  ["binary_sensor", "occupancy", "on", "security", "reported"],
  ["binary_sensor", "connectivity", "off", "maintenance", "alert"],
  ["cover", "garage", "open", "access", "alert"],
  ["cover", "blind", "open", "access", "reported"],
  ["sensor", "humidity", "unavailable", "climate", "unavailable"],
  ["sensor", "energy", "0", "energy", "reported"],
  ["sensor", "power", "invalid", "energy", "unavailable"],
  ["light", "", "on", "lighting", "reported"],
  ["vacuum", "", "error", "appliances", "alert"],
  ["weather", "", "rainy", "outdoors", "reported"],
  ["update", "", "on", "maintenance", "reported"],
])("classifies %s %s reporting %s", (domain, deviceClass, value, group, reading) => {
  const id = domain + ".sample";
  const entity = mapHome({ [id]: state(id, value, { device_class: deviceClass }) }, emptyRegistries, "home").entities[0];
  expect(homeStatusGroup(entity)).toBe(group);
  expect(homeReadingState(entity)).toBe(reading);
});
