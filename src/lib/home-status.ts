import { available, numberValue } from "./ha-model";
import type { Entity } from "@/types/api";

export const homeStatusGroups = {
  fire: "Fire and gas", water: "Water and leaks", access: "Doors and locks", security: "Alarm and presence",
  climate: "Indoor climate", energy: "Energy and power", lighting: "Lighting", appliances: "Home appliances",
  outdoors: "Outdoors and weather", maintenance: "Device health",
} as const;
export type HomeStatusGroup = keyof typeof homeStatusGroups;

const domainGroups: Record<string, HomeStatusGroup | undefined> = {
  alarm_control_panel: "security", lock: "access", cover: "access", valve: "water", water_heater: "water",
  light: "lighting", climate: "climate", humidifier: "climate", fan: "climate", air_quality: "climate",
  vacuum: "appliances", switch: "appliances", lawn_mower: "outdoors", weather: "outdoors", update: "maintenance",
};
const binaryGroups: Record<string, HomeStatusGroup | undefined> = {
  smoke: "fire", gas: "fire", carbon_monoxide: "fire", heat: "fire", moisture: "water",
  door: "access", garage_door: "access", window: "access", opening: "access", lock: "access",
  motion: "security", occupancy: "security", presence: "security", safety: "security", tamper: "security",
  battery: "maintenance", connectivity: "maintenance", problem: "maintenance",
  running: "appliances", power: "energy", light: "lighting", cold: "climate",
};
const sensorGroups: Record<string, HomeStatusGroup | undefined> = {
  temperature: "climate", humidity: "climate", carbon_dioxide: "climate", aqi: "climate", pm1: "climate",
  pm25: "climate", pm10: "climate", volatile_organic_compounds: "climate", volatile_organic_compounds_parts: "climate",
  power: "energy", energy: "energy", energy_storage: "energy", current: "energy", voltage: "energy", gas: "energy",
  water: "water", volume_flow_rate: "water", battery: "maintenance", illuminance: "lighting",
  precipitation: "outdoors", precipitation_intensity: "outdoors", wind_speed: "outdoors", wind_direction: "outdoors",
  atmospheric_pressure: "outdoors", irradiance: "outdoors", moisture: "outdoors",
};
export function homeStatusGroup(entity: Entity) {
  const deviceClass = String(entity.attributes.device_class);
  if (entity.domain === "binary_sensor") return binaryGroups[deviceClass];
  if (entity.domain === "sensor") return sensorGroups[deviceClass];
  return domainGroups[entity.domain];
}

export function defaultHomeStatusSources(entities: Entity[], selectedAlarm: string) {
  const detectors = entities.filter(entity => entity.domain === "binary_sensor" && entity.attributes.device_class === "smoke" && entity.areaId !== "unassigned");
  const devices = new Set(detectors.flatMap(entity => entity.device ? [entity.device.id] : []));
  return [...new Set([...detectors.map(entity => entity.preferenceId), ...entities.filter(entity =>
    entity.device && devices.has(entity.device.id) && entity.domain === "binary_sensor" && entity.attributes.device_class === "battery"
  ).map(entity => entity.preferenceId), ...(selectedAlarm ? [selectedAlarm] : [])])];
}

const binaryAlerts = new Set(["smoke", "gas", "carbon_monoxide", "heat", "moisture", "door", "garage_door", "window", "opening", "lock", "safety", "tamper", "battery", "problem"]);
export function homeReadingState(entity?: Entity) {
  if (!entity || !available(entity) || !homeStatusGroup(entity)) return "unavailable";
  if (entity.domain === "binary_sensor") {
    if (!["on", "off"].includes(entity.state)) return "unavailable";
    const deviceClass = String(entity.attributes.device_class);
    if (entity.state === "on" && binaryAlerts.has(deviceClass) || entity.state === "off" && deviceClass === "connectivity") return "alert";
  }
  if (entity.domain === "alarm_control_panel" && entity.state === "triggered"
    || entity.domain === "lock" && ["unlocked", "open", "jammed"].includes(entity.state)
    || entity.domain === "cover" && ["door", "garage", "window", "gate"].includes(String(entity.attributes.device_class)) && entity.state === "open"
    || ["vacuum", "lawn_mower"].includes(entity.domain) && entity.state === "error") return "alert";
  if (entity.domain === "climate" && numberValue(entity.attributes.current_temperature) === undefined
    || entity.domain === "sensor" && (!entity.state.trim() || !Number.isFinite(Number(entity.state)))) return "unavailable";
  return "reported";
}
