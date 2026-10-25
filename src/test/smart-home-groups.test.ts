import { expect, it } from "vitest";
import { emptyPlanner, plannerSchema } from "../../shared/configuration";
import { moveSmartHomeCard, rowCardHeights, smartHomeCards } from "@/lib/smart-home-cards";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { configuredCard } from "./device-card-fixtures";

const home = mapHome({
  "vacuum.example": state("vacuum.example", "docked"),
  "sensor.battery": state("sensor.battery", "80", { device_class: "battery" }),
  "sensor.new": state("sensor.new", "10"),
  "image.map": state("image.map", "2030-01-01T00:00:00Z"),
}, emptyRegistries, "home");
const ids = home.entities.map(entity => entity.preferenceId);

it("renders only explicitly composed cards, including multiple cards from the same device", () => {
  const settings = { layout: [configuredCard(ids[0], "vacuum", { linkedEntities: [ids[1], ids[3]], group: "Cleaning" }), configuredCard(ids[1], "sensor")] };
  const cards = smartHomeCards(home.entities, settings);
  expect(cards).toHaveLength(2);
  expect(cards[0].main.domain).toBe("vacuum");
  expect(cards[0].entities.map(entity => entity.domain)).toEqual(["vacuum", "sensor", "image"]);
  expect(cards[1].main.domain).toBe("sensor");
  expect(smartHomeCards(home.entities, { layout: [] })).toEqual([]);
});

it("keeps missing or incompatible sources editable and resolves renamed entities by stable ID", () => {
  const settings = { layout: [configuredCard(ids[0], "vacuum", { linkedEntities: ["missing", ids[1]] }), configuredCard(ids[1], "light")] };
  const renamed = home.entities.map(entity => entity.preferenceId === ids[0] ? { ...entity, entityId: "vacuum.renamed" } : entity);
  expect(smartHomeCards(renamed, settings)[0].main.entityId).toBe("vacuum.renamed");
  const cards = smartHomeCards([], settings);
  expect(cards).toHaveLength(2);
  expect(cards[0].main).toBeUndefined();
  expect(cards[0].linkedEntities).toEqual(["missing", ids[1]]);
  expect(smartHomeCards(home.entities, settings)[1].main).toBeUndefined();
});

it("equalizes strictly above half the tallest natural height in each row, never across rows", () => {
  expect(rowCardHeights([100, 150, 151, 300].map(height => ({ top: 0, height })))).toEqual([100, 150, 300, 300]);
  expect(rowCardHeights([{ top: 0, height: 400 }, { top: 0, height: 250 }, { top: 416, height: 210 }, { top: 416, height: 230 }])).toEqual([400, 400, 230, 230]);
  expect(rowCardHeights([{ top: 0, height: 400 }, { top: 416, height: 250 }])).toEqual([400, 250]);
  expect(rowCardHeights([100, 120].map(height => ({ top: 0, height })))).toEqual([120, 120]);
  expect(rowCardHeights([])).toEqual([]);
});

it("reorders and regroups without changing filtered-out cards or card details", () => {
  const settings = { layout: ids.map((id, index) => configuredCard(id, index === 0 ? "vacuum" : index === 3 ? "image" : "sensor", { group: index === 3 ? "Images" : "Cleaning", linkedEntities: index === 0 ? [ids[3]] : [] })) };
  const reordered = moveSmartHomeCard(settings, ids[2], "Cleaning", ids[0]);
  expect(reordered.layout.map(card => card.id)).toEqual([ids[2], ids[0], ids[1], ids[3]]);
  const moved = moveSmartHomeCard(reordered, ids[0], "Images", ids[3]);
  expect(moved.layout.filter(card => card.group === "Images").map(card => card.id)).toEqual([ids[0], ids[3]]);
  expect(moved.layout.find(card => card.id === ids[0])).toMatchObject({ linkedEntities: [ids[3]], group: "Images" });
  expect(settings.layout[0].group).toBe("Cleaning");
  expect(moveSmartHomeCard(moved, "missing", "Images")).toBe(moved);
  expect(moveSmartHomeCard(moved, ids[0], "Images", "missing")).toBe(moved);
  expect(moveSmartHomeCard(moved, ids[0], "Images", ids[0])).toBe(moved);
  expect(moveSmartHomeCard(moved, ids[0], "Cleaning", ids[3])).toBe(moved);
  const planner = { ...emptyPlanner(), smartHome: moved };
  expect(plannerSchema.parse(JSON.parse(JSON.stringify(planner)))).toEqual(planner);
});
