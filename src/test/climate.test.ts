import { describe, expect, it } from "vitest";
import { regulatesByPercent } from "@/lib/climate";
import { cardEntity, regulatorThermostatHome } from "./device-card-fixtures";

const check = (options: Parameters<typeof regulatorThermostatHome>[0] = {}) => {
  const home = regulatorThermostatHome(options);
  return regulatesByPercent(home.entities.find(entity => entity.entityId === "climate.example_thermostat")!, home.entities);
};

describe("regulatesByPercent", () => {
  it("recognizes regulator mode from the same device's mode select and display unit", () => {
    expect(check()).toBe(true);
    expect(check({ displayUnit: null })).toBe(true);
    expect(check({ mode: null })).toBe(true);
    expect(check({ mode: "Regulator", displayUnit: null })).toBe(true);
  });

  it("keeps degrees for thermostat mode, a temperature display unit and thermostats without such entities", () => {
    expect(check({ mode: "thermostat", displayUnit: "°C" })).toBe(false);
    expect(check({ mode: "thermostat", displayUnit: null })).toBe(false);
    expect(check({ mode: null, displayUnit: null })).toBe(false);
    // A reported display unit outranks the mode select.
    expect(check({ mode: "regulator", displayUnit: "°C" })).toBe(false);
  });

  it("falls back to the mode select when the display unit is unavailable", () => {
    expect(check({ displayUnit: "unavailable" })).toBe(true);
    expect(check({ mode: "thermostat", displayUnit: "unknown" })).toBe(false);
  });

  it("finds the display unit by translation key or unique ID", () => {
    expect(check({ mode: null, displayUnit: null, siblings: { "sensor.example_unit": { state: "%", translation_key: "display_unit" } } })).toBe(true);
    expect(check({ mode: null, displayUnit: null, siblings: { "sensor.example_unit": { state: "%", unique_id: "example:display-unit" } } })).toBe(true);
    // Other percentage sensors, such as humidity, say nothing about the setpoint.
    expect(check({ mode: null, displayUnit: null, siblings: { "sensor.example_humidity": { state: "%", translation_key: "relative_humidity" } } })).toBe(false);
  });

  it("ignores entities on other devices and climate entities without a device", () => {
    expect(check({ mode: null, displayUnit: null, siblings: { "select.example_other_mode": { state: "regulator", translation_key: "mode", device_id: "example-other-device" } } })).toBe(false);
    const loose = cardEntity("climate", "heat", { temperature: 50 });
    expect(regulatesByPercent(loose, [loose, ...regulatorThermostatHome().entities])).toBe(false);
    const home = regulatorThermostatHome();
    expect(regulatesByPercent(home.entities.find(entity => entity.domain === "sensor")!, home.entities)).toBe(false);
  });
});
