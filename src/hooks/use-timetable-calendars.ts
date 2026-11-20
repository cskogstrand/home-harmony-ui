import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { addDays } from "@/contexts/FamilyContext";
import { calendarBoundary } from "@/lib/ha-model";
import type { CalendarEvent } from "@/types/api";
import type { TimetableSource } from "@/lib/calendar-timetable";
import type { TimetableSettings } from "../../shared/configuration";

const noEvents: Record<string, CalendarEvent[] | null> = {};

export function useTimetableCalendars(settings: TimetableSettings, start: string, today: string) {
  const { currentHome, homeOnline, haUrl, watchCalendarEvents } = useApp();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; events: Record<string, CalendarEvent[] | null> }>({ key: "", events: {} });
  const selection = Object.entries(settings.calendars).map(([id, roles]) => {
    const entity = currentHome.entities.find(entity => entity.domain === "calendar" && entity.preferenceId === id);
    return { id, roles, entity: entity && { entityId: entity.entityId, name: entity.name } };
  });
  const selectionKey = JSON.stringify(selection);
  const selected = useMemo((): typeof selection => JSON.parse(selectionKey), [selectionKey]);
  const requests = useMemo(() => JSON.stringify(selected.filter(source => source.entity).map(({ entity, roles }) => ({
    id: entity.entityId,
    from: calendarBoundary(today < start || (roles.includes("message") && roles.length === 1) ? today : start, currentHome.timeZone),
    // shortcut: search messages up to one year ahead; extend if integrations need longer gaps.
    to: calendarBoundary(roles.includes("message") ? addDays(today, 366) : addDays(start, 5), currentHome.timeZone),
  })).sort((a, b) => a.id.localeCompare(b.id))), [selected, start, today, currentHome.timeZone]);
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
  const events = homeOnline && result.key === key ? result.events : noEvents;
  const closuresUnknown = selected.some(source => source.roles.includes("closures") && (!source.entity || !events[source.entity.entityId]));
  const popupClosuresUnknown = selected.some(source => source.roles.includes("popupClosures") && (!source.entity || !events[source.entity.entityId]));
  const meetingSources = selected.filter(source => source.roles.includes("popupMeetings"));
  const sources = useMemo((): TimetableSource[] => selected.flatMap(({ entity, roles }) => entity && events[entity.entityId]
    ? [{ id: entity.entityId, name: entity.name, roles, events: events[entity.entityId] }] : []), [selected, events]);
  return { sources, closuresUnknown, popupClosuresUnknown,
    popupMeetingsLoading: homeOnline && meetingSources.some(({ entity }) => entity && events[entity.entityId] === undefined),
    popupMeetingsUnavailable: homeOnline && meetingSources.some(({ entity }) => !entity || events[entity.entityId] === null),
    loading: homeOnline && selected.some(({ entity }) => entity && events[entity.entityId] === undefined),
    errors: homeOnline ? selected.filter(({ entity }) => !entity || events[entity.entityId] === null).map(({ entity, id }) => entity?.name ?? id) : [],
    refresh: () => setRetry(value => value + 1),
  };
}
