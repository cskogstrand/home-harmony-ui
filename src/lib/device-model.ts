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
/** The entity's own part of a Home Assistant "<device> <entity>" name, for places that already show the device. */
export const readingName = (entity: Entity) => {
  const prefix = [entity.device?.name_by_user, entity.device?.name].find(name => name && entity.name.startsWith(name + " "));
  return prefix ? entity.name.slice(prefix.length + 1) : entity.name;
};
export function deviceChoiceLabel(device: PhysicalDevice, home: Home, language: Language = "en") {
  const name = deviceName(device, language);
  const peers = home.devices.filter(item => deviceName(item, language) === name);
  if (peers.length < 2) return name;
  const detail = (item: PhysicalDevice) => [home.areas.find(area => area.id === item.area_id)?.name, item.model].filter(Boolean).join(" · ");
  const context = detail(device);
  return [name, context, peers.filter(item => detail(item) === context).length > 1 ? device.id : ""].filter(Boolean).join(" · ");
}

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

// Some integrations omit entity_category for maintenance entities.
function maintenanceSection(entity: Entity): "configuration" | "diagnostics" | undefined {
  if (entity.category === "config") return "configuration";
  if (entity.category === "diagnostic" || entity.domain === "update") return "diagnostics";
  const labels = [entity.name, entity.entityId.split(".")[1] ?? ""].map(value => value.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().replace(/[ -]+/g, "_"));
  if (labels.some(value => /(?:^|_)(identify|restart|reboot|firmware|firmware_version|next_hop|linkquality|link_quality|rssi|lqi)$/.test(value))) return "diagnostics";
  if (labels.some(value => /(?:^|_)(display_unit|calibration|sensitivity|threshold)$/.test(value))) return "configuration";
}

export function deviceDetailSections(entities: Entity[]) {
  const hasMainControl = entities.some(entity => !entity.category && deviceTypes.has(entity.domain) && entity.domain !== "switch");
  const sections: Record<"primary" | "readings" | "controls" | "configuration" | "diagnostics", Entity[]> = {
    primary: [], readings: [], controls: [], configuration: [], diagnostics: [],
  };
  for (const entity of entities) {
    const reading = ["sensor", "binary_sensor", "event", "device_tracker"].includes(entity.domain);
    const usefulDiagnostic = reading && ["battery", "problem", "tamper", "safety", "smoke", "gas", "carbon_monoxide", "moisture", "heat"].includes(String(entity.attributes.device_class));
    const section = usefulDiagnostic ? "readings"
      : maintenanceSection(entity) ?? (reading ? "readings"
      : entity.domain === "switch" && hasMainControl ? "controls"
      : deviceTypes.has(entity.domain) || ["lawn_mower", "siren", "image", "weather", "air_quality"].includes(entity.domain) ? "primary"
      : "controls");
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
