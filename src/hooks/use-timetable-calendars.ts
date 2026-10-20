import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { addDays } from "@/contexts/FamilyContext";
import { calendarBoundary } from "@/lib/ha-model";
import type { CalendarEvent } from "@/types/api";
import type { TimetableSource } from "@/lib/calendar-timetable";
import type { TimetableSettings } from "../../shared/configuration";

export function useTimetableCalendars(settings: TimetableSettings, start: string, today: string) {
  const { currentHome, homeOnline, haUrl, watchCalendarEvents } = useApp();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; events: Record<string, CalendarEvent[] | null> }>({ key: "", events: {} });
  const selected = Object.entries(settings.calendars).map(([id, role]) => ({ id, role,
    entity: currentHome.entities.find(entity => entity.domain === "calendar" && entity.preferenceId === id),
  }));
  const requests = JSON.stringify(selected.filter(source => source.entity).map(({ entity, role }) => ({
    id: entity.entityId,
    from: calendarBoundary(role === "message" ? today : start, currentHome.timeZone),
    // shortcut: search messages up to one year ahead; extend if integrations need longer gaps.
    to: calendarBoundary(role === "message" ? addDays(today, 366) : addDays(start, 5), currentHome.timeZone),
  })).sort((a, b) => a.id.localeCompare(b.id)));
  const key = `${haUrl}|${requests}`;
  useEffect(() => {
    if (!homeOnline) return;
    const controller = new AbortController();
    setResult({ key, events: {} });
    for (const { id, from, to } of JSON.parse(requests) as { id: string; from: string; to: string }[]) {
      watchCalendarEvents(id, from, to, controller.signal, events => {
        if (!controller.signal.aborted) setResult(previous => ({ key, events: { ...previous.events, [id]: events } }));
      });
    }
    return () => controller.abort();
  }, [homeOnline, key, requests, watchCalendarEvents, retry]);
  const events = homeOnline && result.key === key ? result.events : {};
  const closuresUnknown = selected.some(source => source.role === "closures" && (!source.entity || !events[source.entity.entityId]));
  const sources: TimetableSource[] = selected.flatMap(({ entity, role }) => entity && events[entity.entityId] && !(role === "hours" && closuresUnknown)
    ? [{ id: entity.entityId, name: entity.name, role, events: events[entity.entityId] }] : []);
  return { sources,
    loading: homeOnline && selected.some(({ entity }) => entity && events[entity.entityId] === undefined),
    errors: homeOnline ? selected.filter(({ entity }) => !entity || events[entity.entityId] === null).map(({ entity, id }) => entity?.name ?? id) : [],
    refresh: () => setRetry(value => value + 1),
  };
}
