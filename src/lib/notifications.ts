import type { NotificationRule } from "../../shared/notifications";
import type { CalendarEvent, Entity } from "@/types/api";
import { available, calendarBoundary, calendarDateValue } from "./ha-model";

export interface HomeNotification {
  id: string;
  rule: NotificationRule;
  startedAt: number;
  expiresAt?: number;
  eventTitle?: string;
  eventStart?: number;
  popup: boolean;
  dismissed?: boolean;
}
export interface NotificationEvent { event_type: string; data: Record<string, unknown> }
export const notificationEntity = (entities: Entity[], id: string) => entities.find(entity => entity.preferenceId === id);

export function matchesState(rule: NotificationRule, entity?: Entity) {
  const trigger = rule.trigger;
  if (trigger.type !== "state" || !entity) return false;
  const value = trigger.attribute ? entity.attributes[trigger.attribute] : entity.state;
  if (!["string", "number", "boolean"].includes(typeof value)) return false;
  // An explicit unavailable/unknown condition is useful; other conditions need a real reading.
  if (!available(entity) && (trigger.attribute || trigger.operator !== "eq" || !["unavailable", "unknown"].includes(trigger.value))) return false;
  if (trigger.operator === "eq") return String(value) === trigger.value;
  if (trigger.operator === "neq") return String(value) !== trigger.value;
  if (typeof value === "boolean" || String(value).trim() === "" || !Number.isFinite(Number(value))) return false;
  return trigger.operator === "gt" ? Number(value) > Number(trigger.value) : Number(value) < Number(trigger.value);
}

export function matchesEvent(rule: NotificationRule, event: NotificationEvent) {
  const trigger = rule.trigger;
  return trigger.type === "ha-event" && event.event_type === trigger.eventType &&
    Object.entries(trigger.filters).every(([key, value]) => Object.prototype.hasOwnProperty.call(event.data, key) && event.data[key] === value);
}

type Observation = { signature: string; entity?: Entity; matched: boolean; calendarIds?: Set<string>; lastFired: number };

// Session-only state: never persist event payloads, camera images, or notification history.
export class NotificationEngine {
  private observations = new Map<string, Observation>();
  private entries = new Map<string, HomeNotification>();
  private sequence = 0;

  list = () => [...this.entries.values()].filter(entry => !entry.dismissed).sort((a, b) => a.startedAt - b.startedAt);
  dismiss(id: string) { const entry = this.entries.get(id); if (entry) this.entries.set(id, { ...entry, dismissed: true, popup: false }); }
  camera(id: string, popup: boolean) { const entry = this.entries.get(id); if (entry) this.entries.set(id, { ...entry, popup }); }
  clear() { this.observations.clear(); this.entries.clear(); }
  private removeRule(id: string) { for (const [key, entry] of this.entries) if (entry.rule.id === id) this.entries.delete(key); }
  private fire(rule: NotificationRule, now: number) {
    const observation = this.observations.get(rule.id);
    if (!observation || observation.signature !== JSON.stringify(rule) || now - observation.lastFired < rule.cooldownSeconds * 1000) return;
    observation.lastFired = now;
    this.removeRule(rule.id);
    const id = `${rule.id}:${++this.sequence}`;
    this.entries.set(id, { id, rule, startedAt: now, expiresAt: now + rule.durationSeconds * 1000, popup: rule.kind === "camera" });
  }
  receive(rules: NotificationRule[], event: NotificationEvent, now: number) {
    for (const rule of rules) if (rule.enabled && matchesEvent(rule, event)) this.fire(rule, now);
    return this.list();
  }
  update(rules: NotificationRule[], entities: Entity[], calendars: Record<string, CalendarEvent[] | null>, online: boolean, now: number, timeZone: string) {
    if (!online) { this.clear(); return this.list(); }
    const enabled = rules.filter(rule => rule.enabled);
    for (const [id, old] of this.observations) {
      if (!enabled.some(rule => rule.id === id && JSON.stringify(rule) === old.signature)) { this.observations.delete(id); this.removeRule(id); }
    }
    for (const [id, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(id);
    for (const rule of enabled) {
      const previous = this.observations.get(rule.id);
      const trigger = rule.trigger;
      const entity = "entity" in trigger ? notificationEntity(entities, trigger.entity) : undefined;
      const observation: Observation = { signature: JSON.stringify(rule), entity, matched: matchesState(rule, entity), lastFired: previous?.lastFired ?? -Infinity };
      this.observations.set(rule.id, observation);
      if (trigger.type === "state") {
        if (rule.kind !== "camera") {
          if (!observation.matched) this.removeRule(rule.id);
          else if (!previous?.matched) {
            const id = `${rule.id}:${++this.sequence}`;
            this.entries.set(id, { id, rule, startedAt: now, popup: false });
          }
        } else if (observation.matched && previous && !previous.matched && previous.entity && available(previous.entity)) this.fire(rule, now);
      } else if (trigger.type === "entity-event") {
        if (entity?.domain === "event" && available(entity) && Number.isFinite(Date.parse(entity.state)) && previous?.entity &&
          !["unavailable", "missing"].includes(previous.entity.state) && Date.parse(entity.state) > Date.parse(previous.entity.state === "unknown" ? previous.entity.lastUpdated : previous.entity.state) &&
          (!trigger.eventType || entity.attributes.event_type === trigger.eventType)) this.fire(rule, now);
      } else if (trigger.type === "calendar") {
        const events = entity?.domain === "calendar" && available(entity) ? calendars[entity.entityId] : undefined;
        observation.calendarIds = events ? new Set() : undefined;
        for (const event of events ?? []) {
          const from = calendarDateValue(event.start), to = calendarDateValue(event.end);
          const start = Date.parse(from.includes("T") ? from : calendarBoundary(from, timeZone));
          const end = Date.parse(to.includes("T") ? to : calendarBoundary(to, timeZone));
          if (!(now >= start - trigger.leadMinutes * 60000 && now < end)) continue;
          const id = JSON.stringify([rule.id, event.uid ?? event.summary, event.recurrence_id, from]);
          observation.calendarIds.add(id);
          if (rule.kind === "current") this.entries.set(id, { id, rule, startedAt: now, popup: false, ...this.entries.get(id), eventTitle: event.summary, eventStart: start });
        }
        for (const [id, entry] of this.entries) if (entry.rule.id === rule.id && !observation.calendarIds?.has(id)) this.entries.delete(id);
      }
    }
    return this.list();
  }
}
