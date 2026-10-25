import type { Entity } from "@/types/api";
import type { DeviceCardSettings } from "../../shared/configuration";
import { available, numberValue } from "./ha-model";

const readings: Partial<Record<DeviceCardSettings["type"], string[]>> = {
  light: ["power", "energy", "illuminance"], switch: ["power", "energy", "current", "voltage"],
  climate: ["temperature", "humidity", "power", "energy"], fan: ["temperature", "humidity", "power", "energy"],
  humidifier: ["humidity", "water", "power", "energy"], water_heater: ["temperature", "power", "energy"],
  cover: ["illuminance"], valve: ["water", "volume_flow_rate"], media_player: ["power", "energy"],
  vacuum: ["power", "energy"], lawn_mower: ["power", "energy"],
  air_quality: ["carbon_dioxide", "pm25", "pm10", "volatile_organic_compounds", "temperature", "humidity"],
  sensor: ["temperature", "humidity", "illuminance"], weather: ["temperature", "humidity", "wind_speed", "precipitation"],
};
const statuses: Partial<Record<DeviceCardSettings["type"], string[]>> = {
  lock: ["door", "opening", "tamper"], cover: ["door", "garage_door", "opening"],
  alarm_control_panel: ["door", "window", "opening", "motion", "occupancy", "smoke", "gas", "moisture", "tamper"],
  camera: ["motion", "occupancy", "sound"], valve: ["moisture"], humidifier: ["moisture", "problem"],
  vacuum: ["problem"], lawn_mower: ["problem"],
};

export function recommendedMainEntity(candidates: Entity[]) {
  const primary = candidates.filter(entity => available(entity) && !entity.category);
  return primary.length === 1 ? primary[0] : undefined;
}

export function recommendedSupportingEntities(type: DeviceCardSettings["type"], main: Entity | undefined, entities: Entity[], linkedIds: string[]) {
  if (!main?.device) return [];
  const included = [main, ...entities.filter(entity => linkedIds.includes(entity.preferenceId))];
  const kind = (entity: Entity) => `${entity.domain}:${entity.attributes.device_class}`;
  const present = new Set(included.map(kind));
  // These values already appear in the production card or its details.
  for (const entity of included) {
    if (entity !== main && ["sensor", "binary_sensor", "device_tracker", "event", "image", "camera"].includes(entity.domain)) continue;
    if (numberValue(entity.attributes.battery_level) !== undefined) present.add("sensor:battery");
    if (["climate", "water_heater"].includes(entity.domain) && numberValue(entity.attributes.current_temperature) !== undefined) present.add("sensor:temperature");
    if (["climate", "humidifier"].includes(entity.domain) && numberValue(entity.attributes.current_humidity) !== undefined) present.add("sensor:humidity");
    if (entity.domain === "weather") for (const field of ["temperature", "humidity", "wind_speed"]) {
      if (numberValue(entity.attributes[field]) !== undefined) present.add(`sensor:${field}`);
    }
  }
  return entities.filter(entity => entity.device?.id === main.device.id && entity.preferenceId !== main.preferenceId
    && !linkedIds.includes(entity.preferenceId) && available(entity) && entity.category !== "config")
    .sort((a, b) => a.preferenceId.localeCompare(b.preferenceId))
    .flatMap(entity => {
      const deviceClass = String(entity.attributes.device_class ?? "");
      if (present.has(kind(entity)) || entity.category === "diagnostic" && kind(entity) !== "sensor:battery") return [];
      let reason: string;
      if (entity.domain === "sensor" && deviceClass === "battery") reason = "Battery level from this device";
      else if (entity.domain === "sensor" && readings[type]?.includes(deviceClass)) reason = "Useful reading for this card type";
      else if (entity.domain === "binary_sensor" && statuses[type]?.includes(deviceClass)) reason = "Relevant status from this device";
      else if (entity.domain === "image" && ["vacuum", "lawn_mower"].includes(type) && !included.some(item => item.domain === "image")) reason = "Image from this device";
      else return [];
      return [{ entity, reason }];
    }).slice(0, 4);
}
