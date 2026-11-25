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

/**
 * Reported power sensors, normalised to watts and sorted by draw, largest first.
 * Entities hidden or disabled in Home Assistant never reach the mapped home, so they are excluded here too.
 */
export function powerNow(entities: Entity[]): PowerReading[] {
  return entities.flatMap(entity => {
    const watts = powerWatts(entity);
    return watts === undefined ? [] : [{ entity, watts }];
  }).sort((a, b) => b.watts - a.watts || a.entity.name.localeCompare(b.entity.name));
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
