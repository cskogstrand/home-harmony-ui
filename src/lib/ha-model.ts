import type { HassConfig, HassServices } from "home-assistant-js-websocket";
import { z } from "zod";
import type { AlarmAction, CalendarEvent, Entity, EntityAction, EntityStates, Home, Registries } from "@/types/api";

export const emptyRegistries: Registries = { areas: [], devices: [], entities: [] };
export const numberValue = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
export const stringValues = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
export const available = (entity: Entity) => !(["unavailable", "missing"].includes(entity.state) || (entity.state === "unknown" && entity.domain !== "scene"));
export const feature = (entity: Entity, flag: number) => ((numberValue(entity.attributes.supported_features) ?? 0) & flag) !== 0;
export const humanizeState = (value: string) => value.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
// HA interprets these wall-clock times in its configured timezone, not the browser's.
const calendarTime = z.string().datetime({ local: true, precision: 0 }).regex(/T\d{2}:\d{2}:\d{2}$/);
const newCalendarEvent = z.object({
  summary: z.string().trim().min(1).max(100),
  start_date_time: calendarTime, end_date_time: calendarTime,
  location: z.string().max(150), description: z.string().max(200),
}).refine(event => event.end_date_time > event.start_date_time);
const eventTime = z.union([z.string().date(), z.string().datetime({ offset: true })]);
const calendarEventIdentity = z.object({
  uid: z.string().min(1), recurrence_id: z.string().min(1).optional(),
}).strict();
const updatedCalendarEvent = calendarEventIdentity.extend({
  event: z.object({
    summary: z.string().trim().min(1), dtstart: eventTime, dtend: eventTime,
    location: z.string(), description: z.string(),
  }).refine(event => event.dtstart.includes("T") === event.dtend.includes("T") && Date.parse(event.dtend) > Date.parse(event.dtstart)),
});
export function entityStateLabel(entity: Entity) {
  if (!available(entity)) return entity.state === "unknown" ? "No reading" : "Unavailable";
  if (entity.domain === "scene") return "Scene";
  if (entity.domain === "binary_sensor" && ["on", "off"].includes(entity.state)) {
    const labels: Record<string, [string, string]> = {
      door: ["Closed", "Open"], window: ["Closed", "Open"], opening: ["Closed", "Open"], garage_door: ["Closed", "Open"],
      motion: ["Clear", "Motion detected"], occupancy: ["Clear", "Occupied"], presence: ["Away", "Home"],
      smoke: ["Clear", "Smoke detected"], moisture: ["Dry", "Leak detected"], gas: ["Clear", "Gas detected"],
      safety: ["Safe", "Unsafe"], problem: ["OK", "Problem"], battery: ["OK", "Low battery"],
      connectivity: ["Disconnected", "Connected"], plug: ["Unplugged", "Plugged in"], lock: ["Locked", "Unlocked"],
    };
    return (labels[String(entity.attributes.device_class)] ?? ["Off", "On"])[entity.state === "on" ? 1 : 0];
  }
  if (entity.domain === "automation") return entity.state === "on" ? "Enabled" : "Disabled";
  return humanizeState(entity.state);
}
export const alarmModes: { action: AlarmAction; label: string; flag: number }[] = [
  { action: "alarm_arm_home", label: "Home", flag: 1 },
  { action: "alarm_arm_away", label: "Away", flag: 2 },
  { action: "alarm_arm_night", label: "Night", flag: 4 },
  { action: "alarm_arm_vacation", label: "Vacation", flag: 32 },
  { action: "alarm_arm_custom_bypass", label: "Custom bypass", flag: 16 },
  { action: "alarm_trigger", label: "Trigger", flag: 8 },
];
export const needsCode = (entity: Entity, action: EntityAction) => !!entity.attributes.code_format &&
  (!action.startsWith("alarm_arm_") || entity.attributes.code_arm_required !== false);

export function mapHome(states: EntityStates, registries: Registries, instance: string, config?: HassConfig): Home {
  const registered = new Map(registries.entities.map(e => [e.entity_id, e]));
  const devices = new Map(registries.devices.map(d => [d.id, d]));
  const areas = new Map(registries.areas.map(a => [a.area_id, { id: a.area_id, name: a.name, entities: [] as Entity[] }]));
  const ids = new Set([...Object.keys(states), ...registries.entities.filter(e => !e.disabled_by && !e.hidden_by).map(e => e.entity_id)]);
  const entities: Entity[] = [];
  for (const id of ids) {
    const entry = registered.get(id);
    if (entry?.disabled_by || entry?.hidden_by) continue;
    const state = states[id];
    const device = devices.get(entry?.device_id);
    const area = entry?.area_id ?? device?.area_id;
    const areaId = areas.has(area) ? area : "unassigned";
    if (!areas.has(areaId)) areas.set(areaId, { id: areaId, name: "Unassigned", entities: [] });
    const entity: Entity = {
      entityId: id, preferenceId: `${instance}|${entry?.id ?? id}`, domain: id.split(".")[0],
      name: entry?.name || state?.attributes.friendly_name || entry?.original_name || humanizeState(id.slice(id.indexOf(".") + 1)),
      state: state?.state ?? "missing", attributes: state?.attributes ?? {}, areaId, device, category: entry?.entity_category,
      lastChanged: state?.last_changed, lastUpdated: state?.last_updated,
    };
    entities.push(entity);
    areas.get(areaId).entities.push(entity);
  }
  return { name: config?.location_name || "Home Assistant", timeZone: config?.time_zone || "Europe/Oslo",
    temperatureUnit: config?.unit_system.temperature, entities, areas: [...areas.values()], devices: registries.devices };
}

export function supportsAction(entity: Entity, action: EntityAction, services: HassServices) {
  const { domain, attributes: a } = entity;
  if (domain === "calendar" && action === "update_event") return feature(entity, 4);
  if (domain === "calendar" && action === "delete_event") return feature(entity, 2);
  const service = ({ brightness: "turn_on", temperature: "set_temperature", hvac_mode: "set_hvac_mode", position: "set_cover_position" } as Record<string, string>)[action] ?? action;
  if (!services[domain]?.[service]) return false;
  if (["light", "switch", "automation"].includes(domain) && ["turn_on", "turn_off"].includes(action)) return true;
  if (domain === "scene") return action === "turn_on";
  if (domain === "light" && action === "brightness") return stringValues(a.supported_color_modes).some(m => !["onoff", "unknown"].includes(m));
  if (domain === "climate") return action === "temperature" ? feature(entity, 1) && numberValue(a.min_temp) !== undefined && numberValue(a.max_temp) !== undefined : action === "hvac_mode" && stringValues(a.hvac_modes).length > 0;
  if (domain === "cover") return feature(entity, ({ open_cover: 1, close_cover: 2, position: 4, stop_cover: 8 } as Record<string, number>)[action] ?? 0);
  if (domain === "lock") return action === "lock" || action === "unlock";
  if (domain === "todo") return feature(entity, ({ add_item: 1, remove_item: 2, update_item: 4 } as Record<string, number>)[action] ?? 0);
  if (domain === "calendar") return action === "create_event" && feature(entity, 1);
  if (domain === "alarm_control_panel") return action === "alarm_disarm" || feature(entity, alarmModes.find(m => m.action === action)?.flag ?? 0);
  return false;
}

export function entityCommand(entity: Entity, action: EntityAction, services: HassServices, value?: unknown, code?: string) {
  if (!available(entity)) throw new Error("This entity has no available state.");
  if (!supportsAction(entity, action, services)) throw new Error("This action is not supported by this entity.");
  let service: string = action;
  const data: Record<string, unknown> = {};
  if (entity.domain === "calendar") {
    const parsed = (action === "delete_event" ? calendarEventIdentity : action === "update_event" ? updatedCalendarEvent : newCalendarEvent).safeParse(value);
    if (!parsed.success) throw new Error(action === "delete_event" ? "A valid event ID and, for recurring events, occurrence ID are required." : "Enter a title and valid dates and times, with the end after the start.");
    Object.assign(data, parsed.data);
  }
  if (entity.domain === "todo") {
    if (!value || typeof value !== "object" || !("item" in value) || typeof value.item !== "string" || !value.item.trim()) throw new Error("Enter a to-do item or item ID.");
    data.item = action === "add_item" ? value.item.trim() : value.item;
    if (action === "add_item" && value.item.trim().length > 120) throw new Error("Keep to-do items within 120 characters.");
    if (action === "update_item") {
      if (!("status" in value) && !("rename" in value)) throw new Error("Enter a to-do name or status to update.");
      if ("status" in value) {
        if (value.status !== "needs_action" && value.status !== "completed") throw new Error("Unsupported to-do status.");
        data.status = value.status;
      }
      if ("rename" in value) {
        if (typeof value.rename !== "string" || !value.rename.trim() || value.rename.trim().length > 120) throw new Error("Enter a to-do name within 120 characters.");
        data.rename = value.rename.trim();
      }
    }
  }
  if (["brightness", "position", "temperature"].includes(action)) {
    const min = action === "temperature" ? numberValue(entity.attributes.min_temp) : 0;
    const max = action === "temperature" ? numberValue(entity.attributes.max_temp) : 100;
    if (numberValue(value) === undefined || min === undefined || max === undefined || (value as number) < min || (value as number) > max) throw new Error("Value is outside the supported range.");
    if (action === "brightness") { service = "turn_on"; data.brightness = Math.round((value as number) * 255 / 100); }
    if (action === "position") { service = "set_cover_position"; data.position = Math.round(value as number); }
    if (action === "temperature") { service = "set_temperature"; data.temperature = value; }
  }
  if (action === "hvac_mode") {
    if (typeof value !== "string" || !stringValues(entity.attributes.hvac_modes).includes(value)) throw new Error("Unsupported climate mode.");
    service = "set_hvac_mode"; data.hvac_mode = value;
  }
  if (["lock", "alarm_control_panel"].includes(entity.domain)) {
    if (needsCode(entity, action) && !code) throw new Error("Enter the code required by Home Assistant.");
    if (code) data.code = code;
  }
  return { domain: entity.domain, service, data, target: { entity_id: entity.entityId } };
}

export function normalizeHaUrl(input: string, pageProtocol = window.location.protocol) {
  const url = new URL(input.trim());
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Enter only an HTTP or HTTPS Home Assistant origin, with no credentials, path or query.");
  if (pageProtocol === "https:" && url.protocol === "http:") throw new Error("An HTTPS dashboard cannot connect to HTTP Home Assistant. Serve this dashboard over local HTTP, or use trusted local HTTPS for both.");
  return url.origin;
}

// Convert a planner date/time in HA's timezone, including DST boundaries.
export function calendarBoundary(date: string, timeZone: string, time = "00:00:00") {
  const target = Date.parse(`${date}T${time}Z`);
  let timestamp = target;
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(p => [p.type, p.value]));
    const shown = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    timestamp += target - shown;
  }
  return new Date(timestamp).toISOString();
}

export const calendarDateValue = (value: CalendarEvent["start"]) => typeof value === "string" ? value : "dateTime" in value ? value.dateTime : value.date;

export function calendarTimeInput(value: CalendarEvent["start"], timeZone: string) {
  const date = calendarDateValue(value);
  if (!date.includes("T")) return date;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(date)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function calendarTimeValue(original: CalendarEvent["start"], input: string, timeZone: string) {
  if (!input.includes("T")) return input;
  const local = input.length === 16 ? `${input}:00` : input;
  // Preserve the original instant when clocks repeat an hour at the end of DST.
  if (local === calendarTimeInput(original, timeZone)) return new Date(calendarDateValue(original)).toISOString();
  const value = calendarBoundary(local.slice(0, 10), timeZone, local.slice(11));
  if (calendarTimeInput(value, timeZone) !== local) throw new Error(`This time does not exist in ${timeZone}. Choose another time.`);
  return value;
}
