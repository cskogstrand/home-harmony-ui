import { describe, expect, it } from "vitest";
import { available, calendarBoundary, entityStateLabel, entityCommand, mapHome, needsCode, normalizeHaUrl, supportsAction } from "@/lib/ha-model";
import { config, registries, services, states, state } from "./ha-fixtures";
const entity = (id: string) => mapHome(states, registries, "http://ha.local:8123", config).entities.find(e => e.entityId === id)!;

describe("HA mapping", () => {
  it("separates physical devices from entities and resolves entity, device, then Unassigned areas", () => {
    const home = mapHome(states, registries, "http://ha.local:8123", config);
    expect(home.devices).toHaveLength(1);
    expect(home.areas.find(area => area.id === "living").entities.map(entity => entity.entityId)).toEqual(["light.living"]);
    expect(entity("light.living").areaId).toBe("living");
    expect(entity("sensor.power").areaId).toBe("hall");
    expect(entity("switch.charger").areaId).toBe("unassigned");
    expect(entity("sensor.power").device).toEqual(entity("light.living").device);
    expect(entity("switch.charger").device).toBeUndefined();
    expect(entity("sensor.power").name).toBe("Power");
    expect(entity("light.living").preferenceId).toBe("http://ha.local:8123|stable-light");
    const renamed = mapHome({ "light.renamed": state("light.renamed", "off") }, { ...registries, entities: [{ ...registries.entities[0], entity_id: "light.renamed" }] }, "http://ha.local:8123");
    expect(renamed.entities[0].preferenceId).toBe(entity("light.living").preferenceId);
  });
  it("retains unknown, unavailable, missing, units and null values without inventing metadata", () => {
    expect(entity("sensor.power")).toMatchObject({ state: "unknown", attributes: { unit_of_measurement: "W" } });
    expect(entity("binary_sensor.smoke").state).toBe("unavailable");
    expect(entity("sensor.removed").state).toBe("missing");
    expect(entity("climate.living").attributes.current_temperature).toBeNull();
    for (const id of ["sensor.power", "binary_sensor.smoke", "sensor.removed"]) expect(available(entity(id))).toBe(false);
    // Scenes have a last-activation timestamp, not an on/off state. An unused scene is still actionable.
    expect(available(entity("scene.evening"))).toBe(true);
  });
});

describe("HA commands", () => {
  it("uses to-do item IDs and gates edits by supported features and valid input", () => {
    const todo = mapHome({ "todo.family": state("todo.family", "2", { supported_features: 7 }) }, registries, "test").entities.find(e => e.entityId === "todo.family")!;
    const todoServices = { todo: { add_item: { fields: {} }, update_item: { fields: {} }, remove_item: { fields: {} } } };
    expect(entityCommand(todo, "add_item", todoServices, { item: " Milk " })).toEqual({ domain: "todo", service: "add_item", data: { item: "Milk" }, target: { entity_id: "todo.family" } });
    expect(entityCommand(todo, "update_item", todoServices, { item: "unique-id", status: "completed" }).data).toEqual({ item: "unique-id", status: "completed" });
    expect(entityCommand(todo, "remove_item", todoServices, { item: "unique-id" }).data).toEqual({ item: "unique-id" });
    expect(() => entityCommand(todo, "add_item", todoServices, { item: " " })).toThrow("Enter");
    expect(() => entityCommand(todo, "update_item", todoServices, { item: "unique-id", status: "other" })).toThrow("status");
    expect(() => entityCommand(todo, "add_item", todoServices, { item: "a".repeat(121) })).toThrow("120");
    expect(supportsAction({ ...todo, attributes: { supported_features: 1 } }, "update_item", todoServices)).toBe(false);
    expect(supportsAction(todo, "add_item", {})).toBe(false);
    expect(() => entityCommand({ ...todo, state: "unavailable" }, "update_item", todoServices, { item: "unique-id", status: "completed" })).toThrow("available");
  });
  it("targets entity IDs and converts only supported control values", () => {
    expect(entityCommand(entity("light.living"), "brightness", services, 50)).toEqual({ domain: "light", service: "turn_on", data: { brightness: 128 }, target: { entity_id: "light.living" } });
    expect(entityCommand(entity("climate.living"), "temperature", services, 22.5).data).toEqual({ temperature: 22.5 });
    expect(entityCommand(entity("climate.living"), "hvac_mode", services, "off").data).toEqual({ hvac_mode: "off" });
    expect(entityCommand(entity("cover.blind"), "position", services, 30)).toMatchObject({ service: "set_cover_position", data: { position: 30 } });
    expect(entityCommand(entity("automation.sunset"), "turn_off", services)).toMatchObject({ domain: "automation", service: "turn_off", target: { entity_id: "automation.sunset" } });
    expect(entityCommand(entity("scene.evening"), "turn_on", services)).toMatchObject({ domain: "scene", service: "turn_on" });
    expect(entityCommand(entity("lock.front"), "unlock", services, undefined, "a-guest-code").data).toEqual({ code: "a-guest-code" });
  });
  it("rejects unsupported capabilities, invalid inputs, missing services and unavailable entities", () => {
    expect(() => entityCommand(entity("light.living"), "brightness", services, 101)).toThrow("range");
    expect(() => entityCommand(entity("climate.living"), "temperature", services, NaN)).toThrow("range");
    expect(() => entityCommand(entity("climate.living"), "hvac_mode", services, "cool")).toThrow("Unsupported");
    expect(supportsAction({ ...entity("light.living"), attributes: { supported_color_modes: ["onoff"] } }, "brightness", services)).toBe(false);
    expect(supportsAction({ ...entity("cover.blind"), attributes: { supported_features: 1 } }, "position", services)).toBe(false);
    expect(supportsAction(entity("light.living"), "turn_on", {})).toBe(false);
    expect(() => entityCommand({ ...entity("light.living"), state: "unavailable" }, "turn_on", services)).toThrow("available");
  });
  it("preserves alarm modes and passes arbitrary codes to HA without demo validation", () => {
    const alarm = entity("alarm_control_panel.house");
    expect(needsCode(alarm, "alarm_disarm")).toBe(true);
    expect(() => entityCommand(alarm, "alarm_disarm", services)).toThrow("code");
    expect(entityCommand(alarm, "alarm_disarm", services, undefined, "987654321")).toMatchObject({ service: "alarm_disarm", data: { code: "987654321" }, target: { entity_id: alarm.entityId } });
    expect(supportsAction(alarm, "alarm_arm_vacation", services)).toBe(false);
    const noArmCode = { ...alarm, attributes: { ...alarm.attributes, code_arm_required: false } };
    expect(needsCode(noArmCode, "alarm_arm_away")).toBe(false);
    expect(needsCode(noArmCode, "alarm_disarm")).toBe(true);
    expect(entityCommand(noArmCode, "alarm_arm_away", services).data).toEqual({});
    for (const value of ["arming", "disarming", "pending", "triggered", "armed_custom_bypass", "armed_vacation"]) {
      expect(mapHome({ [alarm.entityId]: state(alarm.entityId, value) }, registries, "test").entities.find(e => e.entityId === alarm.entityId).state).toBe(value);
    }
  });
});

it("validates origins and protocol pairing without accepting tokens in a URL", () => {
  expect(normalizeHaUrl("http://homeassistant.local:8123/", "http:")).toBe("http://homeassistant.local:8123");
  expect(normalizeHaUrl("https://ha.local", "https:")).toBe("https://ha.local");
  for (const url of ["ws://ha.local", "http://user:secret@ha.local", "http://ha.local?token=secret", "http://ha.local/api"]) expect(() => normalizeHaUrl(url, "http:")).toThrow();
  expect(() => normalizeHaUrl("http://ha.local", "https:")).toThrow("HTTPS dashboard");
});
it("uses HA-local midnight including the Oslo DST transition for calendar requests", () => {
  expect(calendarBoundary("2026-10-25", "Europe/Oslo")).toBe("2026-10-24T22:00:00.000Z");
  expect(calendarBoundary("2026-10-26", "Europe/Oslo")).toBe("2026-10-25T23:00:00.000Z");
});


it("uses useful sensor labels without hiding missing readings or exposing scene timestamps", () => {
  const smoke = entity("binary_sensor.smoke");
  expect(entityStateLabel({ ...smoke, state: "on" })).toBe("Smoke detected");
  expect(entityStateLabel({ ...smoke, state: "off" })).toBe("Clear");
  expect(entityStateLabel(smoke)).toBe("Unavailable");
  expect(entityStateLabel({ ...smoke, state: "unknown" })).toBe("No reading");
  expect(entityStateLabel({ ...smoke, state: "off", attributes: { device_class: "door" } })).toBe("Closed");
  expect(entityStateLabel({ ...entity("scene.evening"), state: "2026-10-07T10:00:00Z" })).toBe("Scene");
});
