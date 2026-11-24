import type { ZodIssue } from "zod";
import { notificationTriggers, type NotificationRule, type NotificationTrigger, type NotificationProgress, type NotificationProgressSource, type NotificationEntityDisplay, type NotificationWidget } from "../../shared/notifications";
import type { CalendarEvent, Entity } from "@/types/api";
import { available, calendarBoundary, calendarDateValue } from "./ha-model";

export const notificationStyleLabels = { banner: "Banner", section: "Section", activity: "Activity cards", "activity-compact": "Compact activity card" } as const;

export interface HomeNotification {
  id: string;
  rule: NotificationRule;
  startedAt: number;
  expiresAt?: number;
  calendarEntity?: string;
  eventTitle?: string;
  eventStart?: number;
  eventAllDay?: boolean;
  popup: boolean;
  dismissed?: boolean;
}
export interface NotificationEvent { event_type: string; data: Record<string, unknown> }
export const notificationEntity = (entities: Entity[], id: string) => entities.find(entity => entity.preferenceId === id);

export function previewNotificationEvent(rule: NotificationRule, startedAt: number, eventTitle: string) {
  const triggers = notificationTriggers(rule);
  const calendar = triggers.find(trigger => trigger.type === "calendar");
  if (calendar) return { eventTitle, eventStart: startedAt + calendar.leadMinutes * 60_000 };
  if (triggers.some(trigger => trigger.type === "ha-event" || trigger.type === "entity-event")) {
    return { expiresAt: startedAt + rule.durationSeconds * 1000 };
  }
  return {};
}

export function showsLiveActivityPreview(rule: NotificationRule) {
  return rule.kind === "ongoing" && !!rule.cameraEntity && rule.cameraMedia !== "person" && rule.livePreviewBelowTitle !== false;
}

export function notificationWidgetMedia(rule: NotificationRule): NonNullable<NotificationWidget["media"]> {
  if (rule.widget?.media) return rule.widget.media;
  if (rule.kind === "camera" || showsLiveActivityPreview(rule) || (rule.kind === "ongoing" && rule.cameraEntity && rule.cameraMedia === "person")) {
    return { type: rule.cameraMedia ?? "live", cameraId: rule.cameraEntity };
  }
  return rule.imageEntity ? { type: "image", entity: rule.imageEntity } : { type: "none" };
}

export function notificationUsesCamera(rule: NotificationRule, id: string) {
  const media = rule.widget?.media;
  return (rule.kind !== "current" && rule.cameraEntity === id) || (!!media && "cameraId" in media && media.cameraId === id);
}

const remainingTimeName = /remaining|time[ _]left|tid[ _]igjen|gjenstående|end[ _]time|finish(?:es|[ _]time)?\b|estimated[ _]completion|ferdigtid|sluttid/i;
const minutesPerUnit = new Map([["ms", 1 / 60000], ["s", 1 / 60], ["min", 1], ["h", 60], ["d", 1440]]);
export function isNotificationTimeSource(entity: Entity) {
  return entity.domain === "sensor" && entity.attributes.mode !== "password" && (entity.attributes.device_class === "timestamp" || minutesPerUnit.has(String(entity.attributes.unit_of_measurement)));
}

export function notificationMinutesLeft(rule: NotificationRule, entities: Entity[], now: number, sourceId = rule.timeLeftEntity) {
  const source = sourceId ? notificationEntity(entities, sourceId) : rule.detailEntities
    .map(id => notificationEntity(entities, id))
    .find(entity => entity && isNotificationTimeSource(entity) && remainingTimeName.test(entity.entityId + " " + entity.name));
  if (source || sourceId) {
    if (!source || !isNotificationTimeSource(source) || !available(source)) return undefined;
    let minutes: number;
    if (source.attributes.device_class === "timestamp") {
      minutes = (Date.parse(source.state) - now) / 60000;
    } else {
      const value = progressNumber(source.state);
      if (value === undefined || value < 0) return undefined;
      minutes = value * minutesPerUnit.get(String(source.attributes.unit_of_measurement));
    }
    return Number.isFinite(minutes) ? Math.max(0, Math.ceil(minutes)) : undefined;
  }
  const progress = rule.progress;
  if (!progress || progress.current.attribute) return undefined;
  const current = notificationEntity(entities, progress.current.entity);
  const unit = minutesPerUnit.get(String(current?.attributes.unit_of_measurement));
  const range = notificationProgress(progress, entities);
  if (!unit || !range) return undefined;
  const remaining = (range.end - range.current) * Math.sign(range.end - range.start) * unit;
  return Number.isFinite(remaining) ? Math.max(0, Math.ceil(remaining)) : undefined;
}

export function notificationReadings(rule: NotificationRule) {
  const readings: (NotificationEntityDisplay & { roles: string[]; defaultPlacement: NotificationEntityDisplay["placement"] })[] = [];
  const add = (entity: string, attribute: string, role: string, placement: NotificationEntityDisplay["placement"]) => {
    if (!entity) return;
    const existing = readings.find(reading => reading.entity === entity && reading.attribute === attribute);
    if (existing) {
      if (!existing.roles.includes(role)) existing.roles.push(role);
      if (role === "Additional reading") existing.defaultPlacement = placement;
    } else readings.push({ entity, attribute, name: "", placement: "auto", defaultPlacement: placement, roles: [role] });
  };
  for (const trigger of notificationTriggers(rule)) if ("entity" in trigger) add(trigger.entity, trigger.type === "state" ? trigger.attribute : "", "Source entity", trigger.type === "state" ? "subtitle" : "hidden");
  rule.detailEntities.forEach((entity, index) => add(entity, "", "Additional reading", index === 0 ? "left" : index === 1 ? "right" : "footer"));
  if (rule.progress) {
    for (const [key, role] of [["current", "Current value"], ["start", "Start value"], ["end", "End / total value"]] as const) {
      const source = rule.progress[key];
      if (source.type === "entity") add(source.entity, source.attribute, role, "hidden");
    }
  }
  if (rule.kind === "camera" && rule.cameraEntity.startsWith("home|")) add(rule.cameraEntity, "", "Camera", "hidden");
  if (rule.hideTrigger) add(rule.hideTrigger.entity, rule.hideTrigger.attribute, "Hide condition", "hidden");
  return readings.map(reading => ({ ...reading, ...rule.entityDisplay?.find(item => item.entity === reading.entity && item.attribute === reading.attribute) }));
}

export function progressNumber(value: unknown) {
  return (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isFinite(Number(value)) ? Number(value) : undefined;
}

export function progressSourceValue(source: NotificationProgressSource, entities: Entity[]) {
  if (source.type === "value") return progressNumber(source.value);
  const entity = notificationEntity(entities, source.entity);
  if (!entity || !available(entity) || entity.attributes.mode === "password") return undefined;
  return progressNumber(source.attribute ? entity.attributes[source.attribute] : entity.state);
}

export function notificationProgress(progress: NotificationProgress, entities: Entity[]) {
  const current = progressSourceValue(progress.current, entities);
  const start = progressSourceValue(progress.start, entities);
  const end = progressSourceValue(progress.end, entities);
  if (current === undefined || start === undefined || end === undefined || start === end) return undefined;
  const fraction = (current - start) / (end - start);
  if (!Number.isFinite(fraction)) return undefined;
  return { current, start, end, percent: Math.max(0, Math.min(100, fraction * 100)) };
}

export function matchesState(trigger: NotificationTrigger, entity?: Entity) {
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

export function matchesEvent(trigger: NotificationTrigger, event: NotificationEvent) {
  return trigger.type === "ha-event" && event.event_type === trigger.eventType &&
    Object.entries(trigger.filters).every(([key, value]) => Object.prototype.hasOwnProperty.call(event.data, key) && event.data[key] === value);
}

type Observation = { signature: string; triggers: { entity?: Entity; matched: boolean }[]; stateId?: string; hideAt?: number; calendarIds: Set<string>; lastFired: number };

// Session-only state: never persist event payloads, camera images, or notification history.
// A widget edit changes the displayed tile without restarting the activation or its cooldown.
const ruleSignature = (rule: NotificationRule) => JSON.stringify({ ...rule, widget: undefined });

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
    if (!observation || observation.signature !== ruleSignature(rule) || now - observation.lastFired < rule.cooldownSeconds * 1000) return;
    observation.lastFired = now;
    for (const [id, entry] of this.entries) if (entry.rule.id === rule.id && entry.expiresAt !== undefined) this.entries.delete(id);
    const id = `${rule.id}:${++this.sequence}`;
    this.entries.set(id, { id, rule, startedAt: now, expiresAt: now + rule.durationSeconds * 1000, popup: rule.kind === "camera" });
  }
  receive(rules: NotificationRule[], event: NotificationEvent, now: number) {
    for (const rule of rules) if (rule.enabled && notificationTriggers(rule).some(trigger => matchesEvent(trigger, event))) this.fire(rule, now);
    return this.list();
  }
  private updateState(rule: NotificationRule, entities: Entity[], observation: Observation, previous: Observation | undefined, now: number) {
    const hide = rule.hideTrigger;
    const hiding = hide && matchesState(hide, notificationEntity(entities, hide.entity));
    const show = !hiding && observation.triggers.some((trigger, index) => trigger.matched && (!hide || !previous?.triggers[index].matched));
    if (observation.stateId) {
      if (hiding) observation.hideAt ??= now + hide.delayMinutes * 60000;
      const countdownEnded = observation.hideAt !== undefined && (now >= observation.hideAt || show);
      if (countdownEnded || (!hide && !show)) {
        this.entries.delete(observation.stateId);
        observation.stateId = undefined;
        observation.hideAt = undefined;
      }
    }
    if (!observation.stateId && show) {
      const id = `${rule.id}:${++this.sequence}`;
      observation.stateId = id;
      this.entries.set(id, { id, rule, startedAt: now, popup: false });
    }
  }
  update(rules: NotificationRule[], entities: Entity[], calendars: Record<string, CalendarEvent[] | null>, online: boolean, now: number, timeZone: string) {
    if (!online) { this.clear(); return this.list(); }
    const enabled = new Map(rules.filter(rule => rule.enabled).map(rule => [rule.id, rule]));
    for (const [id, old] of this.observations) {
      const rule = enabled.get(id);
      if (!rule || ruleSignature(rule) !== old.signature) { this.observations.delete(id); this.removeRule(id); }
    }
    for (const [id, entry] of this.entries) {
      const rule = enabled.get(entry.rule.id);
      if (entry.expiresAt <= now) this.entries.delete(id);
      else if (rule && entry.rule !== rule) this.entries.set(id, { ...entry, rule });
    }
    for (const rule of enabled.values()) {
      const previous = this.observations.get(rule.id);
      const triggers = notificationTriggers(rule);
      const observation: Observation = { signature: ruleSignature(rule), triggers: triggers.map(trigger => {
        const entity = "entity" in trigger ? notificationEntity(entities, trigger.entity) : undefined;
        return { entity, matched: matchesState(trigger, entity) };
      }), stateId: previous?.stateId, hideAt: previous?.hideAt, calendarIds: new Set(), lastFired: previous?.lastFired ?? -Infinity };
      this.observations.set(rule.id, observation);
      if (rule.kind !== "camera") this.updateState(rule, entities, observation, previous, now);
      let fired = false;
      triggers.forEach((trigger, index) => {
        const { entity, matched } = observation.triggers[index];
        const old = previous?.triggers[index];
        if (trigger.type === "state") {
          if (rule.kind === "camera" && matched && old && !old.matched && old.entity && available(old.entity)) fired = true;
        } else if (trigger.type === "entity-event") {
          if (entity?.domain === "event" && available(entity) && Number.isFinite(Date.parse(entity.state)) && old?.entity &&
            !["unavailable", "missing"].includes(old.entity.state) && Date.parse(entity.state) > Date.parse(old.entity.state === "unknown" ? old.entity.lastUpdated : old.entity.state) &&
            (!trigger.eventType || entity.attributes.event_type === trigger.eventType)) fired = true;
        } else if (trigger.type === "calendar") {
          const events = entity?.domain === "calendar" && available(entity) ? calendars[entity.entityId] : undefined;
          for (const event of events ?? []) {
            const from = calendarDateValue(event.start), to = calendarDateValue(event.end);
            const start = Date.parse(from.includes("T") ? from : calendarBoundary(from, timeZone));
            const end = Date.parse(to.includes("T") ? to : calendarBoundary(to, timeZone));
            if (!(now >= start - trigger.leadMinutes * 60000 && now < end)) continue;
            const id = JSON.stringify([rule.id, trigger.entity, event.uid ?? event.summary, event.recurrence_id, from]);
            observation.calendarIds.add(id);
            if (rule.kind === "current") this.entries.set(id, { id, rule, startedAt: now, popup: false, ...this.entries.get(id), calendarEntity: trigger.entity, eventTitle: event.summary, eventStart: start, eventAllDay: !from.includes("T") });
          }
        }
      });
      for (const id of previous?.calendarIds ?? []) if (!observation.calendarIds.has(id)) this.entries.delete(id);
      if (fired) this.fire(rule, now);
    }
    return this.list();
  }
}

const sections: Record<string, string> = { widget: "widget", title: "content", message: "content", pages: "content", presentation: "presentation", livePreviewBelowTitle: "camera", timeLeftEntity: "progress", trigger: "trigger", additionalTriggers: "trigger", hideTrigger: "hideTrigger", cameraEntity: "camera", cameraMedia: "camera", cameraPlacement: "camera", imageEntity: "camera", imagePlacement: "camera", showPersonSnapshot: "camera", detailEntities: "readings", progress: "progress", entityDisplay: "readings", icon: "appearance", animateIcon: "appearance", durationSeconds: "timing", cooldownSeconds: "timing" };
export const notificationIssueSection = (issue: ZodIssue) => sections[String(issue.path[0])] ?? "content";
