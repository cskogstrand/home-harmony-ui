import type { Entity } from "@/types/api";
import { available } from "./ha-model";
import { deviceName, readingName } from "./device-model";
import type { Language } from "./i18n";

/** Readings below this are idle: standby draw, not something the family is using. */
export const idleWatts = 5;
const wattsPer: Record<string, number> = { mW: 0.001, W: 1, kW: 1000, MW: 1_000_000 };

export interface PowerReading { entity: Entity; watts: number }

/** The current draw in watts, or undefined when the sensor is not a reported power reading in a known unit. */
export function powerWatts(entity: Entity) {
  if (entity.domain !== "sensor" || entity.attributes.device_class !== "power" || !available(entity) || !entity.state.trim()) return undefined;
  const factor = wattsPer[String(entity.attributes.unit_of_measurement ?? "").trim()];
  const value = Number(entity.state);
  return factor && Number.isFinite(value) ? value * factor : undefined;
}

const deviceLabel = (entity: Entity) => (entity.device?.name_by_user || entity.device?.name || "").trim().toLocaleLowerCase();
/**
 * Two power sensors measure the same thing when they belong to one device, or to devices of the same name in the
 * same room from different integrations (one car or charger connected twice). Their readings overlap.
 */
function sameConsumer(a: Entity, b: Entity) {
  if (!a.device || !b.device) return false;
  if (a.device.id === b.device.id) return true;
  return !!deviceLabel(a) && deviceLabel(a) === deviceLabel(b) && a.areaId === b.areaId && a.integration !== b.integration;
}

/**
 * Reported power sensors, normalised to watts and sorted by draw, largest first. One reading per consumer:
 * of overlapping sensors only the largest counts, so a sum never counts the same draw twice.
 * Entities hidden or disabled in Home Assistant never reach the mapped home, so they are excluded here too.
 */
export function powerNow(entities: Entity[]): PowerReading[] {
  const readings = entities.flatMap(entity => {
    const watts = powerWatts(entity);
    return watts === undefined ? [] : [{ entity, watts }];
  }).sort((a, b) => b.watts - a.watts || a.entity.name.localeCompare(b.entity.name));
  const kept: PowerReading[] = [];
  for (const reading of readings) if (!kept.some(other => sameConsumer(other.entity, reading.entity))) kept.push(reading);
  return kept;
}

/**
 * A consumer is named after the device it measures. Home Assistant's "<device> <reading>" name only repeats that
 * the row is a power reading, often in the integration's English ("AC total power"). Names the owner chose stay.
 */
export function consumerName(entity: Entity, language: Language = "en") {
  return entity.device && readingName(entity) !== entity.name ? deviceName(entity.device, language) : entity.name;
}

/** Split readings into what is drawing power now and idle meters below the threshold. */
export function splitIdle(readings: PowerReading[], threshold = idleWatts) {
  return { active: readings.filter(reading => reading.watts >= threshold), idle: readings.filter(reading => reading.watts < threshold) };
}

/** A sum in watts shown in the unit a person expects: W below 1 kW, kW from there. */
export function wattsReading(watts: number) {
  return Math.abs(watts) >= 1000 ? { value: watts / 1000, unit: "kW" } : { value: watts, unit: "W" };
}
