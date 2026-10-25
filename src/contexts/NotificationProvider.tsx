import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "./AppContext";
import { addDays, useFamily } from "./FamilyContext";
import { NotificationContext } from "./NotificationContext";
import { NotificationEngine, notificationEntity, type HomeNotification } from "@/lib/notifications";
import { calendarBoundary } from "@/lib/ha-model";
import type { CalendarEvent } from "@/types/api";

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentHome, homeOnline, watchEvents, watchCalendarEvents } = useApp();
  const { notifications: settings, today } = useFamily();
  const [engine] = useState(() => new NotificationEngine());
  const [notifications, setNotifications] = useState<HomeNotification[]>([]);
  const [calendars, setCalendars] = useState<Record<string, CalendarEvent[] | null>>({});
  const [eventErrors, setEventErrors] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now);
  const rules = settings.enabled ? settings.rules : [];
  const currentRules = useRef(rules);
  currentRules.current = rules;
  const publish = useCallback((next: HomeNotification[]) => setNotifications(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next), []);
  const eventTypes = JSON.stringify([...new Set(rules.filter(rule => rule.enabled && rule.trigger.type === "ha-event").map(rule => rule.trigger.type === "ha-event" && rule.trigger.eventType))].sort());
  const calendarIds = JSON.stringify([...new Set(rules.flatMap(rule => {
    if (!rule.enabled || rule.trigger.type !== "calendar") return [];
    const entity = notificationEntity(currentHome.entities, rule.trigger.entity);
    return entity?.domain === "calendar" ? [entity.entityId] : [];
  }))].sort());
  useEffect(() => {
    if (!settings.enabled || !settings.rules.length) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [settings.enabled, settings.rules.length]);
  useEffect(() => {
    publish(engine.update(settings.enabled ? settings.rules : [], currentHome.entities, calendars, homeOnline, Date.now(), currentHome.timeZone));
  }, [engine, publish, settings, currentHome, calendars, homeOnline, now]);
  useEffect(() => {
    setEventErrors([]);
    if (!homeOnline) return;
    const controller = new AbortController();
    for (const type of JSON.parse(eventTypes) as string[]) watchEvents(type, controller.signal, event => {
      if (controller.signal.aborted) return;
      if (!event) setEventErrors(previous => [...new Set([...previous, type])]);
      else publish(engine.receive(currentRules.current, event, Date.now()));
    });
    return () => controller.abort();
  }, [homeOnline, eventTypes, watchEvents, engine, publish, refresh]);
  useEffect(() => {
    setCalendars({});
    if (!homeOnline) return;
    const controller = new AbortController();
    for (const id of JSON.parse(calendarIds) as string[]) watchCalendarEvents(id, calendarBoundary(today, currentHome.timeZone), calendarBoundary(addDays(today, 2), currentHome.timeZone), controller.signal, events => {
      if (!controller.signal.aborted) setCalendars(previous => ({ ...previous, [id]: events }));
    });
    return () => controller.abort();
  }, [homeOnline, calendarIds, today, currentHome.timeZone, watchCalendarEvents, refresh]);
  const errors = [...eventErrors, ...Object.keys(calendars).filter(id => calendars[id] === null)];
  return <NotificationContext.Provider value={{ notifications: homeOnline && settings.enabled ? notifications : [], errors: homeOnline && settings.enabled ? errors : [],
    dismiss: id => { engine.dismiss(id); publish(engine.list()); }, camera: (id, open) => { engine.camera(id, open); publish(engine.list()); }, retry: () => setRefresh(value => value + 1),
  }}>{children}</NotificationContext.Provider>;
}
