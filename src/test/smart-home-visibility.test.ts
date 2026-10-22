import { expect, it } from "vitest";
import { mapHome } from "@/lib/ha-model";
import { setEntitiesVisible, visibilityGroupings, visibilityTree } from "@/lib/smart-home-visibility";
import { smartHomeEntities } from "@/lib/device-model";
import { state } from "./ha-fixtures";

const home = mapHome({
  "light.example": state("light.example", "on"),
  "sensor.example": state("sensor.example", "12"),
  "scene.example": state("scene.example", "unknown"),
}, {
  areas: [{ area_id: "example-room", name: "Example room" }],
  devices: [{ id: "example-device", name: "Example device", area_id: "example-room" }],
  entities: [
    { id: "example-light", entity_id: "light.example", device_id: "example-device", platform: "mqtt" },
    { id: "example-sensor", entity_id: "sensor.example", device_id: "example-device", platform: "mqtt", area_id: "unassigned" },
  ],
}, "test");

it("hides newly discovered entities, including those on enabled devices, until explicitly selected", () => {
  const settings = { hiddenDevices: [], hiddenEntities: [], knownEntities: ["test|example-light", "missing-entity"] };
  expect(smartHomeEntities(home.entities, settings).map(entity => entity.entityId)).toEqual(["light.example"]);
  const shown = setEntitiesVisible(settings, home.entities, ["test|example-sensor"], true);
  expect(shown.knownEntities).toEqual(["test|example-light", "missing-entity", "test|example-sensor"]);
  expect(smartHomeEntities(home.entities, shown).map(entity => entity.entityId)).toEqual(["light.example", "sensor.example"]);
  expect(smartHomeEntities(home.entities, { ...settings, knownEntities: [] })).toEqual([]);
  expect(settings.knownEntities).toEqual(["test|example-light", "missing-entity"]);
});

it("preserves registry integration metadata and defaults to domain, integration, device, entity", () => {
  expect(home.entities.map(entity => entity.integration)).toEqual(["mqtt", "mqtt", undefined]);
  const tree = visibilityTree(home.entities, visibilityGroupings.domain, home.areas, "en");
  expect(tree.map(group => group.id)).toEqual(["light", "scene", "sensor"]);
  expect(tree[0].children[0].name).toBe("mqtt");
  expect(tree[0].children[0].children[0]).toMatchObject({ deviceId: "example-device", entities: [home.entities[0]], children: [] });
  expect(tree[1].children[0].name).toBe("Unknown integration");
  expect(tree[1].children[0].children[0].name).toBe("Entities without a device");
  const norwegian = visibilityTree(home.entities, visibilityGroupings.domain, home.areas, "nb");
  expect(norwegian.find(group => group.id === "light").name).toBe("Lys");
  expect(norwegian.find(group => group.id === "scene").children[0].name).toBe("Ukjent integrasjon");
});

it("offers integration, room and device views without duplicating or dropping entities", () => {
  for (const grouping of ["integration", "room", "device"] as const) {
    const tree = visibilityTree(home.entities, visibilityGroupings[grouping], home.areas, "en");
    expect(tree.flatMap(group => group.entities).map(entity => entity.preferenceId).sort()).toEqual(home.entities.map(entity => entity.preferenceId).sort());
  }
  const rooms = visibilityTree(home.entities, visibilityGroupings.room, home.areas, "en");
  expect(rooms.map(group => group.name)).toEqual(["Example room", "Unassigned"]);
  expect(rooms[1].entities.map(entity => entity.entityId)).toEqual(["sensor.example", "scene.example"]);
  expect(visibilityTree([], visibilityGroupings.domain, [], "en")).toEqual([]);
  expect(visibilityTree(home.entities, visibilityGroupings.none, home.areas, "en")).toEqual([]);
});

it("changes only selected entity preferences and retains missing preferences", () => {
  const settings = { hiddenDevices: ["missing-device"], hiddenEntities: ["missing-entity"] };
  const hidden = setEntitiesVisible(settings, home.entities, ["test|example-light", "test|example-light"], false);
  expect(hidden).toEqual({ hiddenDevices: ["missing-device"], hiddenEntities: ["missing-entity", "test|example-light"] });
  expect(smartHomeEntities(home.entities, hidden).map(entity => entity.entityId)).toEqual(["sensor.example", "scene.example"]);
  expect(setEntitiesVisible(hidden, home.entities, ["test|example-light"], true)).toEqual(settings);
  expect(settings.hiddenEntities).toEqual(["missing-entity"]);
});

it("reveals a branch of a hidden device without exposing its other entities", () => {
  const settings = { hiddenDevices: ["example-device", "missing-device"], hiddenEntities: ["missing-entity"] };
  const shown = setEntitiesVisible(settings, home.entities, ["test|example-light"], true);
  expect(shown).toEqual({ hiddenDevices: ["missing-device"], hiddenEntities: ["missing-entity", "test|example-sensor"] });
  expect(smartHomeEntities(home.entities, shown).map(entity => entity.entityId)).toEqual(["light.example", "scene.example"]);
  expect(setEntitiesVisible(settings, home.entities, home.entities.map(entity => entity.preferenceId), true)).toEqual({ hiddenDevices: ["missing-device"], hiddenEntities: ["missing-entity"] });
});
