import { expect, it } from "vitest";
import { emptyPlanner, plannerSchema } from "../../shared/configuration";
import { cardId, moveSmartHomeCard, rowCardHeights, smartHomeCards } from "@/lib/smart-home-cards";
import { mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";

const home = mapHome({
  "vacuum.example": state("vacuum.example", "docked"),
  "sensor.example": state("sensor.example", "80", { device_class: "battery" }),
  "sensor.new": state("sensor.new", "10"),
  "image.map": state("image.map", "2030-01-01T00:00:00Z"),
}, { areas: [], devices: [{ id: "robot", name: "Example robot" }], entities: [
  { id: "robot-main", entity_id: "vacuum.example", device_id: "robot" },
  { id: "robot-battery", entity_id: "sensor.example", device_id: "robot", entity_category: "diagnostic" },
  { id: "robot-new", entity_id: "sensor.new", device_id: "robot" },
] }, "home");
const ids = home.entities.map(entity => entity.preferenceId);

it("makes one card per selected device, prioritizes the main control, and leaves new entities hidden", () => {
  const settings = { ...emptyPlanner().smartHome, knownEntities: ids.filter(id => !id.endsWith("robot-new")) };
  const cards = smartHomeCards(home.entities, settings);
  expect(cards).toHaveLength(2);
  expect(cards[0].main.domain).toBe("vacuum");
  expect(cards[0].entities.map(entity => entity.domain)).toEqual(["vacuum", "sensor"]);
  expect(smartHomeCards(home.entities, { ...settings, hiddenDevices: ["robot"] })).toHaveLength(1);
});

it("resolves selected primary and linked readings by stable ID without enabling other entities", () => {
  const settings = { ...emptyPlanner().smartHome, knownEntities: [ids[0], ids[1]], cards: {
    "device:robot": { mainEntity: ids[1], linkedEntities: [ids[3], ids[3], "missing"], group: "Cleaning" },
  } };
  const [card] = smartHomeCards(home.entities, settings);
  expect(card.id).toBe(cardId(home.entities[0]));
  expect(card.main.domain).toBe("sensor");
  expect(card.group).toBe("Cleaning");
  expect(card.entities).toHaveLength(3);
  expect(settings.knownEntities).toEqual([ids[0], ids[1]]);
  const [fallback] = smartHomeCards(home.entities, { ...settings, hiddenEntities: [ids[1]] });
  expect(fallback.main.domain).toBe("vacuum");
});

it("round-trips card configuration and rejects unbounded or unexpected settings", () => {
  const planner = emptyPlanner();
  planner.smartHome.cards["device:robot"] = { mainEntity: ids[0], linkedEntities: [ids[3]], group: "Cleaning" };
  expect(plannerSchema.parse(JSON.parse(JSON.stringify(planner)))).toEqual(planner);
  expect(plannerSchema.safeParse({ ...planner, smartHome: { ...planner.smartHome, cards: { x: { group: "a".repeat(81) } } } }).success).toBe(false);
  expect(plannerSchema.safeParse({ ...planner, smartHome: { ...planner.smartHome, cards: { x: { streamUrl: "https://example.invalid" } } } }).success).toBe(false);
});

it("equalizes strictly above half the tallest natural height in each row, never across rows", () => {
  expect(rowCardHeights([100, 150, 151, 300].map(height => ({ top: 0, height })))).toEqual([100, 150, 300, 300]);
  expect(rowCardHeights([{ top: 0, height: 400 }, { top: 0, height: 250 }, { top: 416, height: 210 }, { top: 416, height: 230 }])).toEqual([400, 400, 230, 230]);
  expect(rowCardHeights([{ top: 0, height: 400 }, { top: 416, height: 250 }])).toEqual([400, 250]);
  expect(rowCardHeights([100, 120].map(height => ({ top: 0, height })))).toEqual([120, 120]);
  expect(rowCardHeights([])).toEqual([]);
});

it("reorders and regroups atomically without changing entities, visibility, or card details", () => {
  const entities = home.entities.map(entity => ({ ...entity, device: undefined }));
  const settings = { ...emptyPlanner().smartHome, knownEntities: ids, cards: {
    [ids[0]]: { group: "Cleaning", linkedEntities: [ids[3]], mainEntity: ids[0] },
    [ids[1]]: { group: "Cleaning", linkedEntities: [] },
    [ids[2]]: { group: "Cleaning", linkedEntities: [] },
    [ids[3]]: { group: "Images", linkedEntities: [] },
  } };
  const reordered = moveSmartHomeCard(settings, entities, ids[2], "Cleaning", ids[0]);
  expect(smartHomeCards(entities, reordered).filter(card => card.group === "Cleaning").map(card => card.id)).toEqual([ids[2], ids[0], ids[1]]);
  const moved = moveSmartHomeCard(reordered, entities, ids[0], "Images", ids[3]);
  expect(smartHomeCards(entities, moved).filter(card => card.group === "Images").map(card => card.id)).toEqual([ids[0], ids[3]]);
  expect(moved.cards[ids[0]]).toMatchObject({ mainEntity: ids[0], linkedEntities: [ids[3]], group: "Images", order: 0 });
  expect(moved.knownEntities).toEqual(settings.knownEntities);
  expect(settings.cards[ids[0]].group).toBe("Cleaning");
  expect(moveSmartHomeCard(moved, entities, "missing", "Images")).toBe(moved);
  expect(moveSmartHomeCard(moved, entities, ids[0], "Images", "missing")).toBe(moved);
  expect(moveSmartHomeCard(moved, entities, ids[0], "Images", ids[0])).toBe(moved);
  const planner = { ...emptyPlanner(), smartHome: moved };
  expect(plannerSchema.parse(JSON.parse(JSON.stringify(planner)))).toEqual(planner);
  expect(plannerSchema.safeParse({ ...planner, smartHome: { ...moved, cards: { invalid: { order: -1 } } } }).success).toBe(false);
  expect(plannerSchema.safeParse({ ...planner, smartHome: { ...moved, cards: { invalid: { order: 1.5 } } } }).success).toBe(false);
});
