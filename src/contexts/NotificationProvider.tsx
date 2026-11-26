import { notificationTriggers } from "../../shared/notifications";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "./AppContext";
import { addDays, useFamily } from "./FamilyContext";
import { NotificationContext, NotificationDebugContext } from "./NotificationContext";
import { NotificationEngine, notificationEntity, type HomeNotification } from "@/lib/notifications";
import { available, calendarBoundary } from "@/lib/ha-model";
import { canSubscribeEvent } from "@/lib/ha-permissions";
import type { CalendarEvent } from "@/types/api";
import { useSharedConfiguration } from "./SharedConfigurationContext";

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentHome, connectionStatus, homeOnline, userIsAdmin, watchEvents, watchCalendarEvents } = useApp();
  const shared = useSharedConfiguration();
  const { notifications: settings, today } = useFamily();
  const [engine] = useState(() => new NotificationEngine());
  const [previewStartedAt, setPreviewStartedAt] = useState<number>();
  const [notifications, setNotifications] = useState<HomeNotification[]>([]);
  const [calendars, setCalendars] = useState<Record<string, CalendarEvent[] | null>>({});
  const [eventErrors, setEventErrors] = useState<string[]>([]);
  const [subscribed, setSubscribed] = useState<string[]>([]);
  const [evaluatedSettings, setEvaluatedSettings] = useState<typeof settings>();
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now);
  const rules = settings.enabled ? settings.rules : [];
  const currentRules = useRef(rules);
  currentRules.current = rules;
  const publish = useCallback((next: HomeNotification[]) => setNotifications(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next), []);
  const triggers = rules.filter(rule => rule.enabled).flatMap(notificationTriggers);
  // Event types Home Assistant only shares with administrators are never subscribed for another user (or before the user is
  // known); their rules are unavailable, not failing, so they show a calm note instead of an error with Retry.
  const allowed = (eventType: string) => canSubscribeEvent(eventType, userIsAdmin);
  const eventTypes = JSON.stringify([...new Set(triggers.flatMap(trigger => trigger.type === "ha-event" && allowed(trigger.eventType) ? [trigger.eventType] : []))].sort());
  const calendarIds = JSON.stringify([...new Set(triggers.flatMap(trigger => {
    if (trigger.type !== "calendar") return [];
    const entity = notificationEntity(currentHome.entities, trigger.entity);
    return entity?.domain === "calendar" ? [entity.entityId] : [];
  }))].sort());
  useEffect(() => {
    if (!settings.enabled || !settings.rules.length) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [settings.enabled, settings.rules.length]);
  useEffect(() => {
    publish(engine.update(settings.enabled ? settings.rules : [], currentHome.entities, calendars, homeOnline, Date.now(), currentHome.timeZone));
    setEvaluatedSettings(homeOnline ? settings : undefined);
  }, [engine, publish, settings, currentHome, calendars, homeOnline, now]);
  useEffect(() => {
    setEventErrors([]);
    setSubscribed([]);
    if (!homeOnline) return;
    const controller = new AbortController();
    for (const type of JSON.parse(eventTypes) as string[]) watchEvents(type, controller.signal, event => {
      if (controller.signal.aborted) return;
      if (!event) setEventErrors(previous => [...new Set([...previous, type])]);
      else publish(engine.receive(currentRules.current, event, Date.now()));
    }, () => { if (!controller.signal.aborted) setSubscribed(previous => [...previous, type]); });
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
  const errors = new Set<string>();
  const waitingRules = new Set<string>();
  const adminRules = new Set<string>();
  for (const rule of rules) {
    if (!rule.enabled) continue;
    for (const trigger of notificationTriggers(rule)) {
      if (trigger.type === "ha-event") {
        if (!allowed(trigger.eventType)) adminRules.add(rule.title);
        else if (eventErrors.includes(trigger.eventType)) errors.add(rule.title);
        continue;
      }
      const entity = notificationEntity(currentHome.entities, trigger.entity);
      if (!entity || entity.state === "missing") errors.add(rule.title);
      else if (trigger.type === "calendar") {
        if (entity.domain !== "calendar" || calendars[entity.entityId] === null) errors.add(rule.title);
      } else if (trigger.type === "state" && !trigger.attribute && trigger.operator === "eq" && ["unknown", "unavailable"].includes(trigger.value)) continue;
      else if (entity.state === "unknown") {
        if (trigger.type === "state") waitingRules.add(rule.title);
      } else if (!available(entity)) errors.add(rule.title);
      else if (trigger.type === "state" && trigger.attribute && entity.attributes[trigger.attribute] == null) waitingRules.add(rule.title);
    }
  }
  const awaitingSources = (JSON.parse(calendarIds) as string[]).some(id => !(id in calendars))
    || (JSON.parse(eventTypes) as string[]).some(type => !subscribed.includes(type));
  const statusMessage = shared && !shared.state.loaded ? shared.state.error ? "Notifications unavailable" : "Checking notifications…"
    : !settings.enabled ? "Notifications are turned off in settings."
    : !homeOnline ? ["connecting", "syncing"].includes(connectionStatus) ? "Checking notifications…" : "Notifications unavailable"
    : errors.size ? "Some notification sources are unavailable"
    : evaluatedSettings !== settings || awaitingSources ? "Checking notifications…" : waitingRules.size ? "Waiting for notification readings" : undefined;
  return <NotificationContext.Provider value={{ statusMessage, notifications: homeOnline && settings.enabled ? notifications : [], errors: homeOnline && settings.enabled ? [...errors] : [],
    waitingRules: homeOnline && settings.enabled ? [...waitingRules] : [], adminRules: homeOnline && settings.enabled ? [...adminRules] : [],
    dismiss: id => { engine.dismiss(id); publish(engine.list()); }, camera: (id, open) => { engine.camera(id, open); publish(engine.list()); }, retry: () => setRefresh(value => value + 1),
  }}>
    <NotificationDebugContext.Provider value={{ previewStartedAt, setPreviewStartedAt }}>{children}</NotificationDebugContext.Provider>
  </NotificationContext.Provider>;
}
