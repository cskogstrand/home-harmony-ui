import { createI18n, locales, type Language } from "./i18n";
import type { Entity, Home, PhysicalDevice } from "@/types/api";
import { available } from "./ha-model";
import type { Planner } from "../../shared/configuration";

export function smartHomeEntities(entities: Entity[], settings?: Planner["smartHome"]) {
  const selected = settings && new Set(settings.layout.flatMap(card => [card.mainEntity, ...card.linkedEntities]));
  return entities.filter(entity => !(entity.attributes.mode === "password" && ["text", "input_text"].includes(entity.domain))
    && (!selected || selected.has(entity.preferenceId)));
}

export const deviceName = (device: PhysicalDevice, language: Language = "en") => device.name_by_user || device.name || device.model || createI18n(language).t("Unnamed device");
export const entityDetailPath = (entity: Entity) => entity.device
  ? `/devices/${encodeURIComponent(entity.device.id)}#${encodeURIComponent(entity.entityId)}`
  : `/entities/${encodeURIComponent(entity.entityId)}`;

export function deviceGroups(home: Home, language: Language = "en") {
  const entitiesByDevice = new Map<string, Entity[]>();
  for (const entity of home.entities) {
    if (!entity.device) continue;
    if (!entitiesByDevice.has(entity.device.id)) entitiesByDevice.set(entity.device.id, []);
    entitiesByDevice.get(entity.device.id)!.push(entity);
  }
  return home.devices.map(device => ({ device, entities: entitiesByDevice.get(device.id) ?? [] }))
    .sort((a, b) => deviceName(a.device, language).localeCompare(deviceName(b.device, language), locales[language]));
}

const deviceTypes = new Map([
  ["light", "Lights"], ["climate", "Climate"], ["water_heater", "Climate"], ["humidifier", "Climate"],
  ["cover", "Blinds & doors"], ["lock", "Locks"], ["alarm_control_panel", "Alarms"],
  ["media_player", "Media players"], ["camera", "Cameras"], ["fan", "Fans"], ["vacuum", "Vacuums"],
  ["switch", "Switches"], ["valve", "Valves"],
]);

export function deviceType(entities: Entity[]) {
  const primary = entities.filter(entity => !entity.category);
  const types = new Set(primary.map(entity => deviceTypes.get(entity.domain)).filter(Boolean));
  if (types.size > 1) return "Multi-function";
  if (types.size === 1) return [...types][0];
  return primary.some(entity => ["sensor", "binary_sensor"].includes(entity.domain)) ? "Sensors" : "Other";
}

export function deviceDetailSections(entities: Entity[]) {
  const hasMainControl = entities.some(entity => !entity.category && deviceTypes.has(entity.domain) && entity.domain !== "switch");
  const sections: Record<"primary" | "readings" | "controls" | "configuration" | "diagnostics", Entity[]> = {
    primary: [], readings: [], controls: [], configuration: [], diagnostics: [],
  };
  for (const entity of entities) {
    const reading = ["sensor", "binary_sensor", "event", "device_tracker"].includes(entity.domain);
    const usefulDiagnostic = reading && ["battery", "problem", "tamper", "safety"].includes(String(entity.attributes.device_class));
    const section = entity.category === "config" ? "configuration"
      : entity.category === "diagnostic" && !usefulDiagnostic ? "diagnostics"
      : reading ? "readings"
      : entity.domain === "switch" && hasMainControl ? "controls"
      : deviceTypes.has(entity.domain) || ["lawn_mower", "siren", "image", "weather", "air_quality"].includes(entity.domain) ? "primary"
      : "controls";
    sections[section].push(entity);
  }
  return sections;
}

export type DeviceGrouping = "room" | "type" | "none";

export function deviceSections(devices: ReturnType<typeof deviceGroups>, areas: Home["areas"], grouping: DeviceGrouping, language: Language = "en") {
  const { message } = createI18n(language);
  if (!devices.length) return [];
  if (grouping === "none") return [{ id: "all", name: message("All devices"), devices }];
  const sections = new Map<string, { id: string; name: string; devices: typeof devices }>();
  for (const item of devices) {
    const area = areas.find(area => area.id === item.device.area_id);
    const type = deviceType(item.entities);
    const name = grouping === "room" ? area?.name ?? message("Unassigned") : message(type);
    const id = grouping === "room" ? area?.id ?? "unassigned" : type;
    if (!sections.has(id)) sections.set(id, { id, name, devices: [] });
    sections.get(id)!.devices.push(item);
  }
  const last = grouping === "room" ? "unassigned" : "Other";
  return [...sections.values()].sort((a, b) => Number(a.id === last) - Number(b.id === last) || a.name.localeCompare(b.name, locales[language]));
}

export function deviceReadingsLabel(entities: Entity[], homeOnline: boolean) {
  if (!homeOnline) return "Home Assistant offline";
  if (!entities.length) return "No controls or readings";
  const count = entities.filter(available).length;
  return count === entities.length ? "Readings available" : count ? "Some readings unavailable" : "Readings unavailable";
}
