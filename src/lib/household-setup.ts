import { CalendarDays, ListChecks, Users, Wifi } from "lucide-react";
import type { useFamily } from "@/contexts/FamilyContext";
import type { Entity } from "@/types/api";

export const setupSteps = [
  { id: "connection", title: "Connect Home Assistant", icon: Wifi },
  { id: "people", title: "Choose people", icon: Users },
  { id: "calendars", title: "Choose calendars", icon: CalendarDays },
  { id: "lists", title: "Choose lists", icon: ListChecks },
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
