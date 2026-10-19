import { useEffect, useState } from "react";
import { useI18n } from "./use-i18n";
import { useApp } from "@/contexts/AppContext";
import { useFamily, sortEvents } from "@/contexts/FamilyContext";
import { calendarBoundary } from "@/lib/ha-model";
import { calendarPlans } from "@/lib/family-calendar";
import type { CalendarEvent } from "@/types/api";

// Calendar events stay in memory; settings storage never contains HA data.
export function useCalendarPlans(start: string, end: string) {
  const { t } = useI18n();
  const { currentHome, homeOnline, haUrl, watchCalendarEvents } = useApp();
  const { events, calendarMembers, members, compareMembers, isMemberVisible } = useFamily();
  const localEvents = events.filter(event => isMemberVisible(event.member));
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; events: { event: CalendarEvent; calendar: string }[]; errors: string[]; loading: boolean }>({ key: "", events: [], errors: [], loading: false });
  const calendars = currentHome.entities.filter(e => e.domain === "calendar");
  const selected = calendars.filter(e => calendarMembers[e.preferenceId] === "everyone" || members.some(m => m.id === calendarMembers[e.preferenceId]));
  const calendarIds = selected.map(e => e.entityId).sort().join(",");
  const requestKey = `${haUrl}|${calendarIds}|${start}|${end}|${currentHome.timeZone}`;
  useEffect(() => {
    if (!homeOnline || !calendarIds) {
      setResult(previous => previous.key ? { key: "", events: [], errors: [], loading: false } : previous);
      return;
    }
    const controller = new AbortController();
    setResult({ key: requestKey, events: [], errors: [], loading: true });
    const from = calendarBoundary(start, currentHome.timeZone);
    const to = calendarBoundary(end, currentHome.timeZone);
    const results = new Map<string, CalendarEvent[] | null>();
    const ids = calendarIds.split(",");
    for (const id of ids) watchCalendarEvents(id, from, to, controller.signal, events => {
      if (controller.signal.aborted) return;
      results.set(id, events);
      setResult({ key: requestKey, loading: results.size < ids.length,
        events: [...results].flatMap(([calendar, plans]) => (plans ?? []).map(event => ({ event, calendar }))),
        errors: [...results].flatMap(([calendar, plans]) => plans === null ? [calendar] : []),
      });
    });
    return () => controller.abort();
  }, [homeOnline, calendarIds, requestKey, start, end, currentHome.timeZone, watchCalendarEvents, refresh]);
  const remote = homeOnline && result.key === requestKey ? result.events.flatMap(({ event, calendar }, index) => {
    const entity = selected.find(e => e.entityId === calendar);
    return entity ? calendarPlans(event, calendar, calendarMembers[entity.preferenceId], start, end, currentHome.timeZone, index) : [];
  }) : [];
  // Local plans remain reachable when their HA person is removed or has not loaded yet.
  const people = [...members, ...[...new Set(localEvents.map(e => e.member))]
    .filter(id => id !== "everyone" && !members.some(m => m.id === id))
    .map(id => ({ id, name: t("Person unavailable"), initials: "?", color: "#c4d5a3" }))].sort((a, b) => compareMembers(a.id, b.id));
  people.unshift({ id: "everyone", name: t("Everyone"), initials: t("All"), color: "#c4d5a3" });
  return { events: sortEvents([...localEvents, ...remote]), people,
    loading: homeOnline && !!calendarIds && (result.key !== requestKey || result.loading),
    errors: homeOnline && result.key === requestKey ? result.errors.map(calendar => t("Could not read {value1}. Check the calendar integration, permissions, connection and HA CORS configuration.", { value1: calendar })) : [],
    refresh: () => setRefresh(n => n + 1), selectedCount: selected.length,
  };
}
