import type { HassConfig, HassServices } from "home-assistant-js-websocket";
import type { AlarmAction, Entity, EntityAction, EntityStates, Home, Registries } from "@/types/api";

export const emptyRegistries: Registries = { areas: [], devices: [], entities: [] };
export const numberValue = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
export const stringValues = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
export const available = (entity: Entity) => !(["unavailable", "missing"].includes(entity.state) || (entity.state === "unknown" && entity.domain !== "scene"));
export const feature = (entity: Entity, flag: number) => ((numberValue(entity.attributes.supported_features) ?? 0) & flag) !== 0;
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
  const rooms = new Map(registries.areas.map(a => [a.area_id, { id: a.area_id, name: a.name, entities: [] as Entity[] }]));
  const ids = new Set([...Object.keys(states), ...registries.entities.filter(e => !e.disabled_by && !e.hidden_by).map(e => e.entity_id)]);
  const entities: Entity[] = [];
  for (const id of ids) {
    const entry = registered.get(id);
    if (entry?.disabled_by || entry?.hidden_by) continue;
    const state = states[id];
    const device = devices.get(entry?.device_id);
    const area = entry?.area_id ?? device?.area_id;
    const areaId = rooms.has(area) ? area : "unassigned";
    if (!rooms.has(areaId)) rooms.set(areaId, { id: areaId, name: "Unassigned", entities: [] });
    const entity: Entity = {
      entityId: id, preferenceId: `${instance}|${entry?.id ?? id}`, domain: id.split(".")[0],
      name: entry?.name || state?.attributes.friendly_name || entry?.original_name || id,
      state: state?.state ?? "missing", attributes: state?.attributes ?? {}, areaId, device,
      lastChanged: state?.last_changed, lastUpdated: state?.last_updated,
    };
    entities.push(entity);
    rooms.get(areaId).entities.push(entity);
  }
  return { name: config?.location_name || "Home Assistant", timeZone: config?.time_zone || "Europe/Oslo",
    temperatureUnit: config?.unit_system.temperature, entities, rooms: [...rooms.values()], devices: registries.devices };
}

export function supportsAction(entity: Entity, action: EntityAction, services: HassServices) {
  const { domain, attributes: a } = entity;
  const service = ({ brightness: "turn_on", temperature: "set_temperature", hvac_mode: "set_hvac_mode", position: "set_cover_position" } as Record<string, string>)[action] ?? action;
  if (!services[domain]?.[service]) return false;
  if (["light", "switch", "automation"].includes(domain) && ["turn_on", "turn_off"].includes(action)) return true;
  if (domain === "scene") return action === "turn_on";
  if (domain === "light" && action === "brightness") return stringValues(a.supported_color_modes).some(m => !["onoff", "unknown"].includes(m));
  if (domain === "climate") return action === "temperature" ? feature(entity, 1) && numberValue(a.min_temp) !== undefined && numberValue(a.max_temp) !== undefined : action === "hvac_mode" && stringValues(a.hvac_modes).length > 0;
  if (domain === "cover") return feature(entity, ({ open_cover: 1, close_cover: 2, position: 4, stop_cover: 8 } as Record<string, number>)[action] ?? 0);
  if (domain === "lock") return action === "lock" || action === "unlock";
  if (domain === "alarm_control_panel") return action === "alarm_disarm" || feature(entity, alarmModes.find(m => m.action === action)?.flag ?? 0);
  return false;
}

export function entityCommand(entity: Entity, action: EntityAction, services: HassServices, value?: unknown, code?: string) {
  if (!available(entity)) throw new Error("This entity has no available state.");
  if (!supportsAction(entity, action, services)) throw new Error("This action is not supported by this entity.");
  let service: string = action;
  const data: Record<string, unknown> = {};
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

// Convert a planner date to midnight in HA's timezone, including DST boundaries.
export function calendarBoundary(date: string, timeZone: string) {
  const target = Date.parse(`${date}T00:00:00Z`);
  let timestamp = target;
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(p => [p.type, p.value]));
    const shown = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    timestamp += target - shown;
  }
  return new Date(timestamp).toISOString();
}
