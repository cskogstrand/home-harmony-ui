import { useEffect, useMemo, useState } from "react";
import { useI18n } from "./use-i18n";
import { useApp } from "@/contexts/AppContext";
import { useFamily, sortEvents, type FamilyEvent } from "@/contexts/FamilyContext";
import { calendarBoundary } from "@/lib/ha-model";
import { calendarPlans, wasteCalendarPlans } from "@/lib/family-calendar";
import type { CalendarEvent } from "@/types/api";
import { useCalendarTodos } from "./use-calendar-todos";

const noLocalEvents: FamilyEvent[] = [];

// Calendar events stay in memory; settings storage never contains HA data.
export function useCalendarPlans(start: string, end: string) {
  const { t } = useI18n();
  const { currentHome, homeOnline, haUrl, watchCalendarEvents } = useApp();
  const { events, calendarMembers, members, compareMembers, isMemberVisible, wasteCalendarEntity } = useFamily();
  const localEvents = events.length ? events.filter(event => isMemberVisible(event.member)) : noLocalEvents;
  const [refresh, setRefresh] = useState(0);
  const todos = useCalendarTodos(start, end, refresh);
  const [result, setResult] = useState<{ key: string; events: { event: CalendarEvent; calendar: string }[]; errors: string[]; loading: boolean }>({ key: "", events: [], errors: [], loading: false });
  const calendars = currentHome.entities.filter(e => e.domain === "calendar");
  const selected = calendars.filter(e => members.some(m => m.id === calendarMembers[e.preferenceId]));
  const calendarIds = selected.map(e => e.entityId).sort().join(",");
  const requestKey = `${haUrl}|${calendarIds}|${start}|${end}|${currentHome.timeZone}`;
  useEffect(() => {
    if (!calendarIds) {
      setResult(previous => previous.key ? { key: "", events: [], errors: [], loading: false } : previous);
      return;
    }
    if (!homeOnline) return;
    const controller = new AbortController();
    setResult(previous => previous.key === requestKey ? previous : { key: requestKey, events: [], errors: [], loading: true });
    const from = calendarBoundary(start, currentHome.timeZone);
    const to = calendarBoundary(end, currentHome.timeZone);
    const results = new Map<string, CalendarEvent[] | null>();
    const ids = calendarIds.split(",");
    for (const id of ids) watchCalendarEvents(id, from, to, controller.signal, events => {
      if (controller.signal.aborted) return;
      results.set(id, events);
      setResult(previous => ({ key: requestKey, loading: previous.loading && results.size < ids.length,
        events: ids.flatMap(calendar => {
          const plans = results.get(calendar);
          return plans == null ? previous.events.filter(item => item.calendar === calendar) : plans.map(event => ({ event, calendar }));
        }),
        errors: events === null ? [...new Set([...previous.errors, id])] : previous.errors.filter(calendar => calendar !== id),
      }));
    });
    return () => controller.abort();
  }, [homeOnline, calendarIds, requestKey, start, end, currentHome.timeZone, watchCalendarEvents, refresh]);
  // mapHome recreates entity objects on sensor updates, so key the selection by its assignments.
  const assignmentKey = JSON.stringify(Object.fromEntries(selected.map(({ entityId, preferenceId }) =>
    [entityId, { member: calendarMembers[preferenceId], waste: preferenceId === wasteCalendarEntity }])));
  const remote = useMemo(() => {
    if (result.key !== requestKey) return [];
    const assignments: Record<string, { member: string; waste: boolean }> = JSON.parse(assignmentKey);
    return result.events.flatMap(({ event, calendar }, index) => {
      const assignment = assignments[calendar];
      if (!assignment) return [];
      const expand = assignment.waste ? wasteCalendarPlans : calendarPlans;
      return expand(event, calendar, assignment.member, start, end, currentHome.timeZone, index);
    });
  }, [result, requestKey, assignmentKey, start, end, currentHome.timeZone]);
  const plans = useMemo(() => sortEvents([...localEvents, ...remote, ...todos.events]), [localEvents, remote, todos.events]);
  // Local plans remain reachable when their HA person is removed or has not loaded yet.
  const people = [...members, ...[...new Set(localEvents.map(e => e.member))]
    .filter(id => id !== "everyone" && !members.some(m => m.id === id))
    .map(id => ({ id, name: t("Person unavailable"), initials: "?", color: "#c4d5a3" }))].sort((a, b) => compareMembers(a.id, b.id));
  return { events: plans, people,
    loading: todos.loading || homeOnline && !!calendarIds && (result.key !== requestKey || result.loading),
    errors: [...todos.errors, ...(homeOnline && result.key === requestKey ? result.errors.map(calendar => t("Could not read {value1}. Check the calendar integration, permissions, connection and HA CORS configuration.", { value1: calendar })) : [])],
    refresh: () => setRefresh(n => n + 1),
  };
}
