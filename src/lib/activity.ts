import { z } from "zod";
import type { Entity } from "@/types/api";
import { createI18n, msg, type Language, type Message, type MessageKey, type MessageValues } from "./i18n";
import { entityReading, entityStateLabel, humanizeState } from "./ha-model";
import { homeStatusGroup, type HomeStatusGroup } from "./home-status";
import { entityDetailPath } from "./device-model";

/** One Home Assistant logbook entry: a state change (`state`) or a described event (`message`). `when` is in milliseconds. */
export interface LogbookEvent { entityId: string; when: number; state?: string; message?: string; name?: string }

/** Items in Recent at home on Smart home. */
export const RECENT_ACTIVITY_LIMIT = 6;
/** The logbook backfill never reaches further back than this, so a subscription cannot request days of history. */
export const MAX_LOGBOOK_BACKFILL_MS = 2 * 86400000;

const logbookEventSchema = z.object({
  entity_id: z.string().regex(/^[a-z0-9_]+\.[a-z0-9_]+$/),
  // Home Assistant sends epoch seconds with a fraction.
  when: z.number().finite().positive(),
  state: z.string().max(255).optional(),
  message: z.string().max(1000).optional(),
  name: z.string().max(255).optional(),
});
const logbookMessageSchema = z.object({ events: z.array(z.unknown()) });

/** Valid entity events from one `logbook/event_stream` message; entries without an entity or with an invalid shape are dropped. */
export function parseLogbookMessage(message: unknown): LogbookEvent[] | undefined {
  const parsed = logbookMessageSchema.safeParse(message);
  if (!parsed.success) return undefined;
  return parsed.data.events.flatMap(value => {
    const event = logbookEventSchema.safeParse(value);
    if (!event.success || event.data.state === undefined && event.data.message === undefined) return [];
    const { entity_id, when, state, message, name } = event.data;
    return [{ entityId: entity_id, when: Math.round(when * 1000), ...(state !== undefined ? { state } : {}), ...(message !== undefined ? { message } : {}), ...(name ? { name } : {}) }];
  });
}

const eventKey = (event: LogbookEvent) => `${event.entityId}|${event.when}|${event.state ?? ""}|${event.message ?? ""}`;
/** Adds a batch to the known events: newest first, without duplicates (a reconnect replays history) and capped at `limit`. */
export function mergeLogbook(previous: LogbookEvent[], batch: LogbookEvent[], limit = 2000) {
  const events = new Map(previous.map(event => [eventKey(event), event]));
  for (const event of batch) events.set(eventKey(event), event);
  return [...events.values()].sort((a, b) => b.when - a.when).slice(0, limit);
}

/** What an event means for the household. Quiet kinds (see `quietKinds`) stay out of the curated panel. */
export type ActivityKind = "opened" | "closed" | "locked" | "unlocked" | "jammed" | "alarm" | "finished" | "started" | "docked" | "error"
  | "person-detected" | "clear" | "doorbell" | "pressed" | "event" | "came-home" | "left-home" | "arrived" | "on" | "off" | "transition" | "changed" | "message";
export type ActivityIcon = "door" | "garage" | "window" | "lock" | "alarm" | "appliance" | "robot" | "mower" | "camera" | "doorbell" | "person" | "power" | "activity";
export type ActivityGroup = HomeStatusGroup | "people" | "other";
export interface ActivityItem {
  id: string;
  entityId: string;
  when: number;
  kind: ActivityKind;
  icon: ActivityIcon;
  group: ActivityGroup;
  areaId?: string;
  /** A translated template; Home Assistant's own message only for unknown events in the full log. */
  sentence: Message;
  /** Entity or device detail page, when the entity still exists. */
  path?: string;
  /** Changes of the same entity folded into this item (1 when nothing was folded). */
  count: number;
}
export interface ActivityOptions {
  /** `curated` shows the chosen sources' meaningful changes and folds flapping; `full` shows every event. */
  mode: "curated" | "full";
  language: Language;
  /** Include people and device trackers coming and going. Off by default for privacy on a shared screen. */
  people: boolean;
  /** Curated sources as preference IDs; the suggested defaults when omitted. */
  sources?: string[];
  /** Camera person sensors by entity ID, with the camera name to show. */
  personSensors?: Record<string, string>;
  limit?: number;
  /** Same-entity changes closer together than this fold into one curated item. */
  collapseMs?: number;
  /** The home's time zone, for logged timestamp states; the browser's when omitted. */
  timeZone?: string;
}

const peopleDomains = new Set(["person", "device_tracker"]);
const openingClasses = new Set(["door", "garage_door", "window", "opening"]);
const coverClasses = new Set(["door", "garage", "gate", "window"]);
const finishedStates = /^(finished|finish|end|ended|complete|completed|done|program_finished|programme_finished)$/i;
const transitionStates = new Set(["opening", "closing", "locking", "unlocking", "arming", "disarming", "pending", "returning", "unknown", "unavailable"]);
const quietKinds = new Set<ActivityKind>(["transition", "started", "clear", "changed", "message", "pressed", "event"]);
// Domains whose changes are noise or administration on a family screen; numeric sensors are excluded separately.
const excludedDomains = new Set(["automation", "script", "scene", "update", "zone", "sun", "weather", "calendar", "todo", "camera", "image",
  "number", "input_number", "counter", "timer", "conversation", "stt", "tts", "wake_word", "assist_satellite", "ai_task", "notify", "tag",
  "button", "input_button", "text", "input_text", "date", "time", "datetime", "input_datetime"]);

const deviceClass = (entity?: Entity) => String(entity?.attributes.device_class ?? "");
const numeric = (entity: Entity) => entity.domain === "sensor" && (entity.attributes.unit_of_measurement !== undefined
  || entity.attributes.state_class !== undefined || !!entity.state.trim() && Number.isFinite(Number(entity.state)));
const finishingAppliance = (entity: Entity) => entity.domain === "sensor" && !numeric(entity)
  && Array.isArray(entity.attributes.options) && entity.attributes.options.some(option => typeof option === "string" && finishedStates.test(option));

/** Entities the owner can add as curated sources: no numeric sensors, diagnostics, updates, automations or scripts. People use their own switch. */
export function activitySourceCandidates(entities: Entity[]) {
  return entities.filter(entity => !entity.category && !excludedDomains.has(entity.domain) && !peopleDomains.has(entity.domain) && !numeric(entity));
}

/** Suggested curated sources: openings, locks, alarms, finishing appliances, robots, doorbells and camera person sensors. */
export function defaultActivitySources(entities: Entity[], personSensors: string[] = []) {
  const cameras = new Set(personSensors);
  return entities.filter(entity => !entity.category && (cameras.has(entity.entityId)
    || entity.domain === "binary_sensor" && (openingClasses.has(deviceClass(entity)) || deviceClass(entity) === "running")
    || entity.domain === "cover" && coverClasses.has(deviceClass(entity))
    || ["lock", "alarm_control_panel", "vacuum", "lawn_mower"].includes(entity.domain)
    || entity.domain === "event" && deviceClass(entity) === "doorbell"
    || finishingAppliance(entity))).map(entity => entity.preferenceId);
}

/** Entity IDs the curated panel follows: its sources, plus people when opted in. */
export function curatedActivityEntityIds(entities: Entity[], options: Pick<ActivityOptions, "people" | "sources" | "personSensors">) {
  const sources = new Set(options.sources ?? defaultActivitySources(entities, Object.keys(options.personSensors ?? {})));
  return [...new Set(entities.filter(entity => sources.has(entity.preferenceId) && !peopleDomains.has(entity.domain)
    || options.people && peopleDomains.has(entity.domain)).map(entity => entity.entityId))].sort();
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isoMoment = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})?$/;
// Untranslated integration values read as English words at best and as machine tokens ("OnOffSwitch", "70d07e…") at worst.
const englishWords = (value: string) => /^[A-Za-z]+(?:[ _][A-Za-z]+)*$/.test(value) && !/[a-z][A-Z]/.test(value);
// Owners write these values themselves, in their own language.
const ownWords = new Set(["input_select", "input_text", "text"]);

/** A dashboard-language text for a logged state, or undefined when the value has no readable form. */
function stateText(entity: Entity | undefined, value: string, options: ActivityOptions) {
  const { language } = options;
  const { locale, dateLabel } = createI18n(language);
  if (isoDate.test(value)) return dateLabel(value, { day: "numeric", month: "short", year: "numeric" });
  const moment = isoMoment.exec(value);
  if (moment) {
    // A time without an offset is already the home's wall clock.
    const [, date, time, offset] = moment;
    const when = Date.parse(`${date}T${time}${offset ? offset.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2") : "Z"}`);
    return Number.isFinite(when) ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: offset ? options.timeZone : "UTC" }).format(when) : undefined;
  }
  if (!entity) return language === "en" && englishWords(value) ? humanizeState(value) : undefined;
  // Home Assistant's translation is known for the entity's current state only.
  const logged = { ...entity, state: value, stateLabel: value === entity.state ? entity.stateLabel : undefined };
  if (value.trim() && Number.isFinite(Number(value)) || ownWords.has(entity.domain)) return entityReading(logged, language);
  const label = entityStateLabel(logged, language);
  if (logged.stateLabel || label !== humanizeState(value)) return label;
  return language === "en" && englishWords(value) ? label : undefined;
}

function classify(event: LogbookEvent, entity: Entity | undefined, options: ActivityOptions): { kind: ActivityKind; icon: ActivityIcon; sentence: Message } {
  const domain = event.entityId.split(".")[0], cls = deviceClass(entity), state = event.state;
  const camera = options.personSensors?.[event.entityId];
  // An entity part Home Assistant left in the integration's words reads as the device and its translated class.
  const name = camera ?? entity?.classNamed ?? entity?.name ?? event.name ?? event.entityId;
  const said = (kind: ActivityKind, icon: ActivityIcon, key: MessageKey, values: MessageValues = {}) => ({ kind, icon, sentence: msg(key, { name, ...values }) });
  // Home Assistant's message is used only for events that are not state changes; the curated panel never shows them.
  if (state === undefined) return said("message", "activity", "{name} {message}", { message: event.message ?? "" });
  const label = (value: string) => entity ? entityStateLabel({ ...entity, state: value, stateLabel: value === entity.state ? entity.stateLabel : undefined }, options.language) : humanizeState(value);
  const changed = (icon: ActivityIcon = "activity", kind?: ActivityKind) => {
    const text = stateText(entity, state, options);
    return said(kind ?? (transitionStates.has(state) ? "transition" : "changed"), icon, text === undefined ? "{name} changed status" : "{name} changed to {state}", text === undefined ? {} : { state: text });
  };
  if (peopleDomains.has(domain)) {
    if (state === "home") return said("came-home", "person", "{name} came home");
    if (state === "not_home") return said("left-home", "person", "{name} left home");
    return transitionStates.has(state) ? changed("person") : said("arrived", "person", "{name} arrived at {zone}", { zone: state });
  }
  if (camera !== undefined) return state === "on" ? said("person-detected", "camera", "Person at {name}") : changed("camera", state === "off" ? "clear" : undefined);
  if (domain === "binary_sensor" && openingClasses.has(cls) || domain === "cover") {
    const icon = cls === "garage_door" || cls === "garage" ? "garage" : cls === "window" ? "window" : "door";
    if (domain === "binary_sensor" ? state === "on" : state === "open") return said("opened", icon, "{name} opened");
    if (domain === "binary_sensor" ? state === "off" : state === "closed") return said("closed", icon, "{name} closed");
    return changed(icon);
  }
  if (domain === "lock") {
    if (state === "locked") return said("locked", "lock", "{name} locked");
    if (state === "unlocked") return said("unlocked", "lock", "{name} unlocked");
    if (state === "open") return said("opened", "lock", "{name} opened");
    if (state === "jammed") return said("jammed", "lock", "{name} jammed");
    return changed("lock");
  }
  if (domain === "alarm_control_panel") return transitionStates.has(state) ? changed("alarm") : said("alarm", "alarm", "{name}: {state}", { state: label(state) });
  if (domain === "binary_sensor" && cls === "running") {
    if (state === "off") return said("finished", "appliance", "{name} finished");
    return state === "on" ? said("started", "appliance", "{name} started") : changed("appliance");
  }
  if (domain === "vacuum" || domain === "lawn_mower") {
    const icon = domain === "vacuum" ? "robot" : "mower";
    if (state === "docked") return said("docked", icon, "{name} docked");
    if (state === "error") return said("error", icon, "{name} reported an error");
    return ["cleaning", "mowing"].includes(state) ? said("started", icon, "{name} started") : changed(icon);
  }
  if (domain === "sensor" && finishedStates.test(state)) return said("finished", "appliance", "{name} finished");
  if (domain === "event") {
    if (transitionStates.has(state)) return changed(cls === "doorbell" ? "doorbell" : "activity");
    if (cls === "doorbell") return said("doorbell", "doorbell", "{name} rang");
    return cls === "button" ? said("pressed", "activity", "{name} was pressed") : said("event", "activity", "{name} reported an event");
  }
  // Buttons and scenes report when they were last used.
  if (["button", "input_button", "scene"].includes(domain) && isoMoment.test(state)) return domain === "scene" ? said("event", "activity", "{name} was activated") : said("pressed", "activity", "{name} was pressed");
  if (state === "on") return said("on", "power", "{name} turned on");
  if (state === "off") return said("off", "power", "{name} turned off");
  return changed();
}

function activityGroup(entity: Entity | undefined, entityId: string, kind: ActivityKind): ActivityGroup {
  if (peopleDomains.has(entityId.split(".")[0])) return "people";
  if (kind === "doorbell" || kind === "person-detected") return "security";
  return entity && homeStatusGroup(entity) || "other";
}

/** Turns logbook events into display items, newest first. */
export function curateActivity(events: LogbookEvent[], entities: Entity[], options: ActivityOptions): ActivityItem[] {
  const byId = new Map(entities.map(entity => [entity.entityId, entity]));
  const curated = options.mode === "curated";
  const sources = curated ? new Set(curatedActivityEntityIds(entities, options)) : undefined;
  const sorted = [...events].sort((a, b) => b.when - a.when);
  // The previous state of the same entity, so the curated panel skips recoveries after an outage.
  const previous = new Map<LogbookEvent, string | undefined>();
  const last = new Map<string, string>();
  for (let index = sorted.length - 1; index >= 0; index--) {
    const event = sorted[index];
    if (event.state === undefined) continue;
    previous.set(event, last.get(event.entityId));
    last.set(event.entityId, event.state);
  }
  const items: ActivityItem[] = [];
  const chains = new Map<string, { item: ActivityItem; when: number }>();
  const collapseMs = options.collapseMs ?? 120000;
  for (const event of sorted) {
    if (!options.people && peopleDomains.has(event.entityId.split(".")[0])) continue;
    if (sources && !sources.has(event.entityId)) continue;
    const entity = byId.get(event.entityId);
    const { kind, icon, sentence } = classify(event, entity, options);
    if (curated && (quietKinds.has(kind) || ["unavailable", "unknown"].includes(previous.get(event) ?? ""))) continue;
    const chain = curated ? chains.get(event.entityId) : undefined;
    if (chain && chain.when - event.when <= collapseMs) { chain.item.count++; chain.when = event.when; continue; }
    const item: ActivityItem = { id: eventKey(event), entityId: event.entityId, when: event.when, kind, icon, group: activityGroup(entity, event.entityId, kind),
      areaId: entity?.areaId, sentence, path: entity ? entityDetailPath(entity) : undefined, count: 1 };
    chains.set(event.entityId, { item, when: event.when });
    items.push(item);
  }
  return options.limit === undefined ? items : items.slice(0, options.limit);
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();
const dayKey = (value: number, timeZone: string) => {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) dayFormatters.set(timeZone, formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }));
  return formatter.format(value);
};
/** "now", "5 minutes ago", "14:02", "yesterday 14:02" or a short date and time, in the home's time zone. */
export function activityTime(when: number, now: number, locale: string, timeZone: string) {
  const minutes = Math.floor((now - when) / 60000);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (minutes < 1) return relative.format(0, "second");
  if (minutes < 60) return relative.format(-minutes, "minute");
  const clock = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
  const time = new Intl.DateTimeFormat(locale, { timeZone, ...clock }).format(when);
  const day = dayKey(when, timeZone), today = dayKey(now, timeZone);
  if (day === today) return time;
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (day === yesterday.toISOString().slice(0, 10)) return `${relative.format(-1, "day")} ${time}`;
  return new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short", ...clock }).format(when);
}
