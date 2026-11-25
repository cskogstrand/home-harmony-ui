import type { Entity } from "@/types/api";
import { available } from "@/lib/ha-model";

const displayUnitName = /^display[\s_-]?unit$/i;
// Integrations name such entities by translation key, original name or the last part of the unique ID.
const names = (entity: Entity) => [entity.registryName, entity.uniqueId?.split(":").pop()].filter((name): name is string => !!name);

/**
 * Whether a thermostat regulates by heating power, a percentage, instead of a target temperature.
 *
 * Some thermostats can run in a "regulator" mode, where the setpoint is heating power. Home Assistant still reports
 * that setpoint through the climate entity's temperature attributes and temperature unit, so only other
 * entities on the same device reveal it: a display-unit sensor or select that reads "%", or a mode select set to
 * "regulator". A reported display unit decides on its own; the mode select is the fallback.
 */
export function regulatesByPercent(climate: Entity, entities: readonly Entity[]): boolean {
  const device = climate.device?.id;
  if (climate.domain !== "climate" || !device) return false;
  const siblings = entities.filter(entity => entity.device?.id === device && entity.entityId !== climate.entityId && available(entity));
  const displayUnit = siblings.find(entity => ["sensor", "select"].includes(entity.domain) && names(entity).some(name => displayUnitName.test(name)));
  if (displayUnit) return displayUnit.state.trim() === "%";
  return siblings.some(entity => entity.domain === "select" && entity.state.trim().toLowerCase() === "regulator");
}
