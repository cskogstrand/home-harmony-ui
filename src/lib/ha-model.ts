import { createI18n, MessageError, type Language } from "./i18n";
import type { HassConfig, HassServices } from "home-assistant-js-websocket";
import { z } from "zod";
import type { AlarmAction, CalendarEvent, Entity, EntityAction, EntityStates, Home, Registries } from "@/types/api";

export const emptyRegistries: Registries = { areas: [], devices: [], entities: [] };
export const numberValue = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
export const stringValues = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
export const available = (entity: Entity) => !(["unavailable", "missing"].includes(entity.state) || (entity.state === "unknown" && !["scene", "button", "input_button"].includes(entity.domain)));
export const isTemperatureEntity = (entity: Entity) => ["sensor", "number", "input_number"].includes(entity.domain)
  && (entity.attributes.device_class === "temperature" || ["°C", "°F", "K"].includes(String(entity.attributes.unit_of_measurement)));
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
export function entityStateLabel(entity: Entity, language: Language = "en") {
  if (["text", "input_text"].includes(entity.domain) && entity.attributes.mode === "password" && available(entity)) return "••••••";
  if (entity.domain === "update" && available(entity)) return createI18n(language).message(entity.state === "on" ? "Update available" : "Up to date");
  const { message, number } = createI18n(language);
  if (!available(entity)) return message(entity.state === "unknown" ? "No reading" : "Unavailable");
  if (entity.domain === "scene") return message("Scene");
  if (entity.domain === "weather") return message(humanizeState(entity.state === "partlycloudy" ? "partly_cloudy" : entity.state === "clear-night" ? "clear_night" : entity.state));
  if (entity.domain === "binary_sensor" && ["on", "off"].includes(entity.state)) {
    const labels: Record<string, [string, string]> = {
      door: ["Closed", "state.open"], window: ["Closed", "state.open"], opening: ["Closed", "state.open"], garage_door: ["Closed", "state.open"],
      motion: ["Clear", "Motion detected"], occupancy: ["Clear", "Occupied"], presence: ["Away", "Home"],
      smoke: ["Clear", "Smoke detected"], moisture: ["state.dry", "Leak detected"], gas: ["Clear", "Gas detected"],
      safety: ["Safe", "Unsafe"], problem: ["OK", "Problem"], battery: ["OK", "Low battery"],
      connectivity: ["Disconnected", "Connected"], plug: ["Unplugged", "Plugged in"], lock: ["Locked", "Unlocked"],
    };
    return message((labels[String(entity.attributes.device_class)] ?? ["Off", "On"])[entity.state === "on" ? 1 : 0]);
  }
  if (entity.domain === "automation") return message(entity.state === "on" ? "Enabled" : "Disabled");
  if (entity.state === "open") return message("state.open");
  if (entity.state.trim() && Number.isFinite(Number(entity.state))) return number(Number(entity.state));
  const known = ["on", "off", "open", "closed", "opening", "closing", "locked", "unlocked", "locking", "unlocking", "jammed", "home", "not_home", "heat", "cool", "heat_cool", "auto", "dry", "fan_only", "idle", "heating", "cooling", "armed_home", "armed_away", "armed_night", "armed_vacation", "armed_custom_bypass", "disarmed", "arming", "disarming", "pending", "triggered", "unknown", "unavailable"];
  return [...known, "playing", "paused", "docked", "cleaning", "mowing", "returning"].includes(entity.state) ? message(humanizeState(entity.state)) : humanizeState(entity.state);
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
      entityId: id, preferenceId: `${instance}|${id.startsWith("person.") ? id : entry?.id ?? id}`, domain: id.split(".")[0],
      name: entry?.name || state?.attributes.friendly_name || entry?.original_name || humanizeState(id.slice(id.indexOf(".") + 1)),
      state: state?.state ?? "missing", attributes: state?.attributes ?? {}, areaId, device, category: entry?.entity_category, integration: entry?.platform,
      lastChanged: state?.last_changed, lastUpdated: state?.last_updated,
    };
    entities.push(entity);
    areas.get(areaId).entities.push(entity);
  }
  return { name: config?.location_name || "Home Assistant", timeZone: config?.time_zone || "Europe/Oslo",
    temperatureUnit: config?.unit_system.temperature, entities, areas: [...areas.values()], devices: registries.devices };
}

const actionServices: Partial<Record<EntityAction, string>> = {
  brightness: "turn_on", rgb_color: "turn_on", color_temp_kelvin: "turn_on", white: "turn_on", effect: "turn_on",
  temperature: "set_temperature", hvac_mode: "set_hvac_mode", position: "set_cover_position", tilt_position: "set_cover_tilt_position",
};
// Home Assistant entity feature flags; service existence alone does not mean a device supports it.
const deviceFeatures: Record<string, Partial<Record<EntityAction, number>>> = {
  media_player: { media_pause: 1, media_seek: 2, volume_set: 4, volume_mute: 8, media_previous_track: 16, media_next_track: 32,
    turn_on: 128, turn_off: 256, volume_up: 1024, volume_down: 1024, select_source: 2048, media_stop: 4096,
    media_play: 16384, shuffle_set: 32768, select_sound_mode: 65536, repeat_set: 262144 },
  climate: { set_humidity: 4, set_fan_mode: 8, set_preset_mode: 16, set_swing_mode: 32 },
  fan: { set_percentage: 1, oscillate: 2, set_direction: 4, set_preset_mode: 8, turn_off: 16, turn_on: 32 },
  humidifier: { set_mode: 1 },
  water_heater: { temperature: 1, set_operation_mode: 2, set_away_mode: 4, turn_on: 8, turn_off: 8 },
  vacuum: { pause: 4, stop: 8, return_to_base: 16, set_fan_speed: 32, locate: 512, start: 8192 },
  lawn_mower: { start_mowing: 1, pause: 2, dock: 4, stop: 8 },
  valve: { open_valve: 1, close_valve: 2, set_valve_position: 4, stop_valve: 8 },
  siren: { turn_on: 1, turn_off: 2 },
};
const optionAttributes: Partial<Record<EntityAction, string>> = {
  select_source: "source_list", select_sound_mode: "sound_mode_list", set_fan_mode: "fan_modes", set_preset_mode: "preset_modes",
  set_swing_mode: "swing_modes", set_mode: "available_modes", set_operation_mode: "operation_list", set_fan_speed: "fan_speed_list", select_option: "options",
};
export function supportsAction(entity: Entity, action: EntityAction, services: HassServices) {
  const { domain, attributes: a } = entity;
  if (domain === "calendar" && action === "update_event") return feature(entity, 4);
  if (domain === "calendar" && action === "delete_event") return feature(entity, 2);
  const service = actionServices[action] ?? action;
  if (!services[domain]?.[service]) return false;
  if (optionAttributes[action] && !stringValues(a[optionAttributes[action]]).length) return false;
  if (action === "media_seek" && !(numberValue(a.media_duration) > 0)) return false;
  if (action === "temperature" && !(numberValue(a.max_temp) > numberValue(a.min_temp))) return false;
  if (action === "set_humidity" && !(numberValue(a.max_humidity) > numberValue(a.min_humidity))) return false;
  const flag = deviceFeatures[domain]?.[action];
  if (flag !== undefined) return feature(entity, flag);
  if (["light", "switch", "input_boolean", "automation", "humidifier", "script"].includes(domain) && ["turn_on", "turn_off"].includes(action)) return true;
  if (domain === "humidifier" && action === "set_humidity") return true;
  if (domain === "scene") return action === "turn_on";
  if (domain === "automation" && action === "trigger") return true;
  if (["number", "input_number"].includes(domain) && action === "set_value") return numberValue(a.max) > numberValue(a.min);
  if (["select", "input_select"].includes(domain) && action === "select_option") return true;
  if (["button", "input_button"].includes(domain)) return action === "press";
  if (domain === "counter") return ["increment", "decrement", "reset"].includes(action);
  if (domain === "timer") return ["start", "pause", "cancel", "finish"].includes(action);
  if (domain === "light" && action === "brightness") return stringValues(a.supported_color_modes).some(m => !["onoff", "unknown"].includes(m));
  if (domain === "light" && action === "rgb_color") return stringValues(a.supported_color_modes).some(m => ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(m));
  if (domain === "light" && action === "color_temp_kelvin") return stringValues(a.supported_color_modes).some(m => ["color_temp", "rgbww"].includes(m))
    && numberValue(a.min_color_temp_kelvin) > 0 && numberValue(a.max_color_temp_kelvin) > numberValue(a.min_color_temp_kelvin);
  if (domain === "light" && action === "white") return stringValues(a.supported_color_modes).includes("white");
  if (domain === "light" && action === "effect") return feature(entity, 4) && stringValues(a.effect_list).length > 0;
  if (domain === "climate") return action === "temperature" ? feature(entity, 1) && numberValue(a.min_temp) !== undefined && numberValue(a.max_temp) !== undefined : action === "hvac_mode" && stringValues(a.hvac_modes).length > 0;
  if (domain === "cover") return feature(entity, ({ open_cover: 1, close_cover: 2, position: 4, stop_cover: 8, tilt_position: 128 } as Record<string, number>)[action] ?? 0);
  if (domain === "lock") return action === "lock" || action === "unlock";
  if (domain === "todo") return feature(entity, ({ add_item: 1, remove_item: 2, update_item: 4 } as Record<string, number>)[action] ?? 0);
  if (domain === "calendar") return action === "create_event" && feature(entity, 1);
  if (domain === "alarm_control_panel") return action === "alarm_disarm" || feature(entity, alarmModes.find(m => m.action === action)?.flag ?? 0);
  return false;
}

export function entityCommand(entity: Entity, action: EntityAction, services: HassServices, value?: unknown, code?: string) {
  if (!available(entity)) throw new Error("This entity has no available state.");
  if (!supportsAction(entity, action, services)) throw new Error("This action is not supported by this entity.");
  let service: string = actionServices[action] ?? action;
  const data: Record<string, unknown> = {};
  const a = entity.attributes;
  if (entity.domain === "script" && action === "turn_on" && value !== undefined) {
    const parsed = z.object({ variables: z.record(z.unknown()) }).strict().safeParse(value);
    if (!parsed.success) throw new Error("Choose valid script variables.");
    data.variables = parsed.data.variables;
  }
  if (entity.domain === "siren" && action === "turn_on" && value !== undefined) {
    const parsed = z.object({ tone: z.string().optional(), volume_level: z.number().min(0).max(1).optional() }).strict().safeParse(value);
    if (!parsed.success) throw new Error("Choose valid siren settings.");
    const tones = Array.isArray(a.available_tones) ? stringValues(a.available_tones) : a.available_tones && typeof a.available_tones === "object" ? Object.keys(a.available_tones) : [];
    if (parsed.data.tone !== undefined && (!feature(entity, 4) || !tones.includes(parsed.data.tone))) throw new Error("Choose an option reported by this device.");
    if (parsed.data.volume_level !== undefined && !feature(entity, 8)) throw new Error("This action is not supported by this entity.");
    Object.assign(data, parsed.data);
  }
  const numericFields: Partial<Record<EntityAction, [string, number | undefined, number | undefined]>> = {
    volume_set: ["volume_level", 0, 1], media_seek: ["seek_position", 0, numberValue(a.media_duration)],
    set_percentage: ["percentage", 0, 100], set_humidity: ["humidity", numberValue(a.min_humidity), numberValue(a.max_humidity)],
    tilt_position: ["tilt_position", 0, 100], set_valve_position: ["position", 0, 100], set_value: ["value", numberValue(a.min), numberValue(a.max)],
  };
  const numeric = numericFields[action];
  if (numeric) {
    const [field, min, max] = numeric;
    if (numberValue(value) === undefined || min === undefined || max === undefined || (value as number) < min || (value as number) > max) throw new Error("Value is outside the supported range.");
    data[field] = value;
  }
  const booleanField = ({ volume_mute: "is_volume_muted", shuffle_set: "shuffle", oscillate: "oscillating", set_away_mode: "away_mode" } as Partial<Record<EntityAction, string>>)[action];
  if (booleanField) {
    if (typeof value !== "boolean") throw new Error("Choose an on or off value.");
    data[booleanField] = value;
  }
  const optionAttribute = optionAttributes[action];
  if (optionAttribute || action === "repeat_set" || action === "set_direction") {
    const options = action === "repeat_set" ? ["off", "one", "all"] : action === "set_direction" ? ["forward", "reverse"] : stringValues(a[optionAttribute]);
    if (typeof value !== "string" || !options.includes(value)) throw new Error("Choose an option reported by this device.");
    const field = ({ select_source: "source", select_sound_mode: "sound_mode", select_option: "option", repeat_set: "repeat" } as Partial<Record<EntityAction, string>>)[action] ?? action.replace(/^set_/, "");
    data[field] = value;
  }
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
      if (!["status", "rename", "due_date", "due_datetime", "description"].some(field => field in value)) throw new Error("Enter a to-do name or status to update.");
      if ("status" in value) {
        if (value.status !== "needs_action" && value.status !== "completed") throw new Error("Unsupported to-do status.");
        data.status = value.status;
      }
      if ("rename" in value) {
        if (typeof value.rename !== "string" || !value.rename.trim() || value.rename.trim().length > 120) throw new Error("Enter a to-do name within 120 characters.");
        data.rename = value.rename.trim();
      }
    }
    if (action === "add_item" || action === "update_item") {
      const details = z.object({
        due_date: z.string().date().nullish(), due_datetime: z.string().datetime({ offset: true }).nullish(), description: z.string().nullish(),
      }).safeParse(value);
      if (!details.success || "due_date" in value && "due_datetime" in value) throw new MessageError("Enter a valid due date or date and time, and a text description.");
      for (const [field, flag] of [["due_date", 16], ["due_datetime", 32], ["description", 64]] as const) {
        if (!(field in details.data)) continue;
        if (!feature(entity, flag)) throw new MessageError("This list does not support that item detail.");
        data[field] = details.data[field];
      }
    }
  }
  if (["brightness", "white", "position", "temperature", "color_temp_kelvin"].includes(action)) {
    const min = action === "temperature" ? numberValue(entity.attributes.min_temp) : action === "color_temp_kelvin" ? numberValue(entity.attributes.min_color_temp_kelvin) : action === "position" ? 0 : 1;
    const max = action === "temperature" ? numberValue(entity.attributes.max_temp) : action === "color_temp_kelvin" ? numberValue(entity.attributes.max_color_temp_kelvin) : 100;
    if (numberValue(value) === undefined || min === undefined || max === undefined || (value as number) < min || (value as number) > max) throw new Error("Value is outside the supported range.");
    if (action === "brightness") { service = "turn_on"; data.brightness = Math.round((value as number) * 255 / 100); }
    if (action === "white") { service = "turn_on"; data.white = Math.round((value as number) * 255 / 100); }
    if (action === "color_temp_kelvin") { service = "turn_on"; data.color_temp_kelvin = Math.round(value as number); }
    if (action === "position") { service = "set_cover_position"; data.position = Math.round(value as number); }
    if (action === "temperature") { service = "set_temperature"; data.temperature = value; }
  }
  if (action === "rgb_color") {
    const channel = z.number().int().min(0).max(255);
    const parsed = z.tuple([channel, channel, channel]).safeParse(value);
    if (!parsed.success) throw new Error("Choose a valid RGB color.");
    service = "turn_on"; data.rgb_color = parsed.data;
  }
  if (action === "effect") {
    if (typeof value !== "string" || !stringValues(entity.attributes.effect_list).includes(value)) throw new Error("Unsupported light effect.");
    service = "turn_on"; data.effect = value;
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
  if (calendarTimeInput(value, timeZone) !== local) throw new MessageError("This time does not exist in {timeZone}. Choose another time.", { timeZone });
  return value;
}
