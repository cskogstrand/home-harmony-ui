import { expect, it } from "vitest";
import { todoDetailChanges, todoDueInput } from "@/lib/todo-items";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";

const entity = mapHome({ "todo.example": state("todo.example", "1", { supported_features: 127 }) }, emptyRegistries, "home").entities[0];
const zone = "Europe/Oslo";
it("converts timed deadlines in the home's zone and rejects nonexistent local times", () => {
  expect(todoDueInput("2026-10-28T23:30:00Z", zone)).toBe("2026-10-29T00:30:00");
  expect(todoDetailChanges({}, { due: "2026-10-29T09:30", description: "" }, entity, zone)).toEqual({ due_datetime: "2026-10-29T08:30:00.000Z" });
  expect(() => todoDetailChanges({}, { due: "2026-03-29T02:30", description: "" }, entity, zone)).toThrow("does not exist");
  for (const due of [null, undefined, "invalid", "2026-02-30", "2026-10-28Tinvalid"]) expect(todoDueInput(due, zone)).toBe("");
});
it("preserves the original instant through the repeated DST hour and clears the supported due field", () => {
  const original = { due: "2026-10-25T02:30:00+01:00", description: "Keep these notes" };
  expect(todoDetailChanges(original, { due: "2026-10-25T02:30:00", description: original.description }, entity, zone)).toEqual({});
  expect(todoDetailChanges(original, { due: "2026-10-25T02:30", description: original.description }, entity, zone)).toEqual({ due_datetime: "2026-10-25T01:30:00.000Z" });
  expect(todoDetailChanges(original, { due: "", description: "" }, entity, zone)).toEqual({ due_datetime: null, description: "" });
  expect(todoDetailChanges({ due: "2026-10-29" }, { due: "", description: "" }, entity, zone)).toEqual({ due_date: null });
});
