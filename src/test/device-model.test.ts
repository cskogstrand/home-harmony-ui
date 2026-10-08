import { expect, it } from "vitest";
import { deviceGroups, deviceName, deviceReadingsLabel, entityDetailPath, deviceSections, deviceType } from "@/lib/device-model";
import { mapHome } from "@/lib/ha-model";
import { registries, states } from "./ha-fixtures";

it("groups visible entities once by registry device, retaining empty devices and room overrides", () => {
  const home = mapHome(states, { ...registries, devices: [...registries.devices, { id: "empty", name: "Empty device" }], entities: [
    ...registries.entities,
    { id: "hidden", entity_id: "light.hidden", device_id: "physical-1", hidden_by: "user" },
    { id: "disabled", entity_id: "light.disabled", device_id: "physical-1", disabled_by: "integration" },
  ] }, "test");
  const groups = deviceGroups(home);
  expect(groups.map(({ device }) => device.id)).toEqual(["empty", "physical-1"]);
  expect(groups[0].entities).toEqual([]);
  expect(groups[1].entities.map(entity => [entity.entityId, entity.areaId])).toEqual([["light.living", "living"], ["sensor.power", "hall"]]);
  expect(groups[1].device.area_id).toBe("hall");
  expect(groups.flatMap(group => group.entities).some(entity => entity.entityId === "switch.charger")).toBe(false);
});

it("prefers device names and keeps raw IDs out of unnamed-device titles", () => {
  expect(deviceName({ id: "id", name_by_user: "My thermostat", name: "Original", model: "Model" })).toBe("My thermostat");
  expect(deviceName({ id: "id", name: "Original", model: "Model" })).toBe("Original");
  expect(deviceName({ id: "id", model: "Model" })).toBe("Model");
  expect(deviceName({ id: "id" })).toBe("Unnamed device");
});

it("distinguishes missing, partial and stale readings without claiming physical connectivity", () => {
  const home = mapHome(states, registries, "test");
  const { entities } = deviceGroups(home)[0];
  expect(deviceReadingsLabel(entities, true)).toBe("Some readings unavailable");
  expect(deviceReadingsLabel([entities[0]], true)).toBe("Readings available");
  expect(deviceReadingsLabel([entities[1]], true)).toBe("Readings unavailable");
  expect(deviceReadingsLabel([{ ...entities[0], state: "missing" }], true)).toBe("Readings unavailable");
  expect(deviceReadingsLabel([], true)).toBe("No controls or readings");
  expect(deviceReadingsLabel(entities, false)).toBe("Home Assistant offline");
});

it("links to parent-device controls and preserves a standalone fallback", () => {
  const home = mapHome(states, registries, "test");
  expect(entityDetailPath(home.entities[0])).toBe("/devices/physical-1#light.living");
  expect(entityDetailPath(home.entities.find(entity => entity.entityId === "switch.charger")!)).toBe("/entities/switch.charger");
  expect(entityDetailPath({ ...home.entities[0], device: { id: "a/b #" } })).toBe("/devices/a%2Fb%20%23#light.living");
});

it("infers device types from main functions, ignoring supporting sensors and maintenance controls", () => {
  const entity = mapHome(states, registries, "test").entities[0];
  const climate = { ...entity, domain: "climate" };
  const sensor = { ...entity, domain: "sensor" };
  expect(deviceType([climate, sensor, { ...sensor, attributes: { device_class: "battery" } }])).toBe("Climate");
  expect(deviceType([climate, { ...entity, domain: "water_heater" }])).toBe("Climate");
  expect(deviceType([entity, climate])).toBe("Multi-function");
  expect(deviceType([climate, entity])).toBe("Multi-function");
  expect(deviceType([{ ...entity, domain: "binary_sensor" }, sensor])).toBe("Sensors");
  expect(deviceType([sensor, { ...entity, domain: "switch", category: "config" }])).toBe("Sensors");
  expect(deviceType([{ ...entity, domain: "switch", category: "diagnostic" }])).toBe("Other");
  expect(deviceType([{ ...entity, domain: "unrecognized" }])).toBe("Other");
  expect(deviceType([])).toBe("Other");
});

it("preserves HA entity categories for type classification", () => {
  const home = mapHome(states, { ...registries, entities: registries.entities.map(entity => ({ ...entity, entity_category: "diagnostic" })) }, "test");
  const group = deviceGroups(home)[0];
  expect(group.entities.every(entity => entity.category === "diagnostic")).toBe(true);
  expect(deviceType(group.entities)).toBe("Other");
});

it("groups each device once by its own room or type, with fallback groups last", () => {
  const home = mapHome(states, { ...registries, devices: [
    ...registries.devices,
    { id: "no-room", name: "A device" },
    { id: "missing-room", area_id: "deleted-room", name: "B device" },
    { id: "living-device", area_id: "living", name: "C device" },
  ] }, "test");
  const devices = deviceGroups(home);
  const rooms = deviceSections(devices, home.areas, "room");
  expect(rooms.map(group => group.name)).toEqual(["Hall", "Living Room", "Unassigned"]);
  expect(rooms[0].devices.map(item => item.device.id)).toEqual(["physical-1"]);
  expect(rooms[1].devices.map(item => item.device.id)).toEqual(["living-device"]);
  expect(rooms[2].devices.map(item => item.device.id)).toEqual(["no-room", "missing-room"]);
  expect(rooms.flatMap(group => group.devices)).toHaveLength(home.devices.length);
  const types = deviceSections(devices, home.areas, "type");
  expect(types.map(group => group.name)).toEqual(["Lights", "Other"]);
  expect(types[0].devices.map(item => item.device.id)).toEqual(["physical-1"]);
  expect(types.flatMap(group => group.devices)).toHaveLength(home.devices.length);
  expect(deviceSections(devices, home.areas, "none")).toEqual([{ id: "all", name: "All devices", devices }]);
  expect(deviceSections([], home.areas, "room")).toEqual([]);
});
