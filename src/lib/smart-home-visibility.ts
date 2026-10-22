import type { Entity, Home } from "@/types/api";
import type { Planner } from "../../shared/configuration";
import { deviceName } from "./device-model";
import { humanizeState } from "./ha-model";
import { createI18n, type Language } from "./i18n";

export const visibilityGroupings = {
  domain: ["domain", "integration", "device"],
  integration: ["integration", "domain", "device"],
  room: ["room", "domain", "integration", "device"],
  device: ["device"],
  none: [],
} as const;
export type VisibilityGrouping = keyof typeof visibilityGroupings;
export type VisibilityDimension = "domain" | "integration" | "room" | "device";
export interface VisibilityGroup {
  id: string;
  name: string;
  deviceId?: string;
  entities: Entity[];
  children: VisibilityGroup[];
}

export function visibilityGroup(entity: Entity, dimension: VisibilityDimension, areas: Home["areas"], language: Language) {
  const { t, message } = createI18n(language);
  switch (dimension) {
    case "domain": return { id: entity.domain, name: message(humanizeState(entity.domain)) };
    case "integration": return { id: entity.integration ?? "", name: entity.integration || t("Unknown integration") };
    case "room": return { id: entity.areaId, name: entity.areaId === "unassigned" ? t("Unassigned") : areas.find(area => area.id === entity.areaId)?.name ?? t("Unassigned") };
    case "device": return { id: entity.device?.id ?? "", name: entity.device ? deviceName(entity.device, language) : t("Entities without a device") };
  }
}

export function visibilityTree(entities: Entity[], dimensions: readonly VisibilityDimension[], areas: Home["areas"], language: Language): VisibilityGroup[] {
  if (!dimensions.length) return [];
  const [dimension, ...remaining] = dimensions;
  const groups = new Map<string, VisibilityGroup>();
  for (const entity of entities) {
    const { id, name } = visibilityGroup(entity, dimension, areas, language);
    if (!groups.has(id)) groups.set(id, { id, name, deviceId: dimension === "device" ? entity.device?.id : undefined, entities: [], children: [] });
    groups.get(id)!.entities.push(entity);
  }
  return [...groups.values()].map(group => ({ ...group, children: visibilityTree(group.entities, remaining, areas, language) }))
    .sort((a, b) => Number(!a.id || a.id === "unassigned") - Number(!b.id || b.id === "unassigned") || a.name.localeCompare(b.name, language));
}

export function setEntitiesVisible(settings: Planner["smartHome"], entities: Entity[], ids: string[], visible: boolean): Planner["smartHome"] {
  const selected = new Set(ids);
  const hiddenEntities = new Set(settings.hiddenEntities);
  const revealedDevices = new Set(visible ? entities.filter(entity => selected.has(entity.preferenceId) && entity.device && settings.hiddenDevices.includes(entity.device.id)).map(entity => entity.device!.id) : []);
  // Revealing part of a hidden device must keep its other current entities hidden.
  for (const entity of entities) {
    if (entity.device && revealedDevices.has(entity.device.id)) hiddenEntities.add(entity.preferenceId);
  }
  for (const id of selected) {
    if (visible) hiddenEntities.delete(id); else hiddenEntities.add(id);
  }
  return { ...settings, hiddenDevices: settings.hiddenDevices.filter(id => !revealedDevices.has(id)), hiddenEntities: [...hiddenEntities],
    ...(settings.knownEntities && { knownEntities: [...new Set([...settings.knownEntities, ...ids])] }),
  };
}
