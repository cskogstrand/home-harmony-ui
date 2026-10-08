import type { Entity, Home, PhysicalDevice } from "@/types/api";
import { available } from "./ha-model";

export const deviceName = (device: PhysicalDevice) => device.name_by_user || device.name || device.model || "Unnamed device";
export const entityDetailPath = (entity: Entity) => entity.device
  ? `/devices/${encodeURIComponent(entity.device.id)}#${encodeURIComponent(entity.entityId)}`
  : `/entities/${encodeURIComponent(entity.entityId)}`;

export function deviceGroups(home: Home) {
  const entitiesByDevice = new Map<string, Entity[]>();
  for (const entity of home.entities) {
    if (!entity.device) continue;
    if (!entitiesByDevice.has(entity.device.id)) entitiesByDevice.set(entity.device.id, []);
    entitiesByDevice.get(entity.device.id)!.push(entity);
  }
  return home.devices.map(device => ({ device, entities: entitiesByDevice.get(device.id) ?? [] }))
    .sort((a, b) => deviceName(a.device).localeCompare(deviceName(b.device)));
}

export function deviceReadingsLabel(entities: Entity[], homeOnline: boolean) {
  if (!homeOnline) return "Home Assistant offline";
  if (!entities.length) return "No controls or readings";
  const count = entities.filter(available).length;
  return count === entities.length ? "Readings available" : count ? "Some readings unavailable" : "Readings unavailable";
}
