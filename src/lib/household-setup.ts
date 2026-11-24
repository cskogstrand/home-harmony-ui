import type { useFamily } from "@/contexts/FamilyContext";
import type { Entity } from "@/types/api";

export const setupSteps = [
  { id: "connection", title: "Connection settings", to: "/settings/connection" },
  { id: "people", title: "Choose people", to: "/settings/people" },
  { id: "calendars", title: "Choose calendars", to: "/settings/calendars" },
  { id: "lists", title: "Choose lists", to: "/settings/lists" },
] as const;

export function householdSetup(online: boolean, entities: Entity[], { members, calendarMembers, todoLists }: Pick<ReturnType<typeof useFamily>, "members" | "calendarMembers" | "todoLists">) {
  const visible = new Set(members.map(member => member.id));
  return {
    connection: online,
    people: visible.size > 0,
    calendars: entities.some(entity => entity.domain === "calendar" && visible.has(calendarMembers[entity.preferenceId])),
    lists: entities.some(entity => {
      const list = entity.domain === "todo" && todoLists[entity.preferenceId];
      return list && (list.kind === "shopping" || visible.has(list.member));
    }),
  };
}
