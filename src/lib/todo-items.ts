import { isPlannerDate } from "../../shared/configuration";
import { calendarBoundary, calendarTimeInput, calendarTimeValue, feature } from "./ha-model";
import type { Entity, TodoItem } from "@/types/api";

export const itemName = (name: string) => name.trim().toLocaleLowerCase();

export function matchingTodoItem(items: TodoItem[], name: string) {
  const matches = items.filter(item => itemName(item.summary) === itemName(name));
  return matches.find(item => item.status !== "completed") ?? matches[0];
}

export type TodoDetails = { due: string; description: string };

export function urgentShoppingCount(list: Entity | undefined, entities: Entity[]) {
  if (list?.integration !== "bring" || !list.device || list.domain !== "todo") return 0;
  const sensor = entities.find(entity => entity.device?.id === list.device.id && entity.integration === "bring"
    && entity.domain === "sensor" && entity.registryName === "urgent");
  return sensor && /^\d+$/.test(sensor.state) ? Number(sensor.state) : 0;
}

export function todoDueInput(due: TodoItem["due"], timeZone: string) {
  if (!due) return "";
  if (!due.includes("T")) return isPlannerDate(due) ? due : "";
  return Number.isFinite(Date.parse(due)) ? calendarTimeInput(due, timeZone) : "";
}

export function todoDueTimestamp(due: TodoItem["due"], timeZone: string) {
  const input = todoDueInput(due, timeZone);
  if (!input) return Infinity;
  // Compare instants so deadlines remain ordered during the repeated DST hour.
  return Date.parse(input.includes("T") ? due : calendarBoundary(input, timeZone));
}

export function todoDetailChanges(item: Partial<TodoItem>, draft: TodoDetails, entity: Entity, timeZone: string) {
  const changes: { due_date?: string | null; due_datetime?: string | null; description?: string } = {};
  if (draft.due !== todoDueInput(item.due, timeZone)) {
    const timed = draft.due ? draft.due.includes("T") : item.due?.includes("T") && feature(entity, 32) || !feature(entity, 16);
    changes[timed ? "due_datetime" : "due_date"] = draft.due ? calendarTimeValue(item.due ?? "", draft.due, timeZone) : null;
  }
  if (draft.description !== (item.description ?? "")) changes.description = draft.description;
  return changes;
}
