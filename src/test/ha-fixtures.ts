import type { HassConfig, HassEntities, HassServices, HassUser } from "home-assistant-js-websocket";
import type { Registries } from "@/types/api";
export const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state: value, attributes, last_changed: "2026-10-06T10:00:00Z", last_updated: "2026-10-06T10:00:00Z", context: { id: "test", parent_id: null, user_id: null } });
export const states: HassEntities = {
  "light.living": state("light.living", "on", { friendly_name: "Living Room Light", supported_color_modes: ["brightness"], brightness: 128 }),
  "switch.charger": state("switch.charger", "off", { friendly_name: "Charger power" }),
  "sensor.power": state("sensor.power", "unknown", { device_class: "power", unit_of_measurement: "W" }),
  "binary_sensor.smoke": state("binary_sensor.smoke", "unavailable", { device_class: "smoke" }),
  "climate.living": state("climate.living", "heat", { supported_features: 1, min_temp: 7, max_temp: 30, temperature: 21, current_temperature: null, target_temp_step: 0.5, hvac_modes: ["off", "heat"] }),
  "cover.blind": state("cover.blind", "open", { supported_features: 15, current_position: 50 }),
  "lock.front": state("lock.front", "locked", { code_format: "text" }),
  "scene.evening": state("scene.evening", "unknown", { friendly_name: "Evening" }),
  "automation.sunset": state("automation.sunset", "on"),
  "alarm_control_panel.house": state("alarm_control_panel.house", "disarmed", { supported_features: 7, code_format: "number", code_arm_required: true }),
};
export const registries: Registries = {
  areas: [{ area_id: "living", name: "Living Room" }, { area_id: "hall", name: "Hall" }],
  devices: [{ id: "physical-1", area_id: "hall", name: "Multi sensor", manufacturer: "Reported manufacturer" }],
  entities: [
    { id: "stable-light", entity_id: "light.living", area_id: "living", device_id: "physical-1" },
    { id: "stable-sensor", entity_id: "sensor.power", device_id: "physical-1" },
    { id: "stable-missing", entity_id: "sensor.removed", area_id: "hall" },
  ],
};
const service = { fields: {} };
export const services: HassServices = {
  light: { turn_on: service, turn_off: service }, switch: { turn_on: service, turn_off: service },
  climate: { set_temperature: service, set_hvac_mode: service },
  cover: { open_cover: service, close_cover: service, stop_cover: service, set_cover_position: service },
  calendar: { create_event: service },
  lock: { lock: service, unlock: service }, scene: { turn_on: service }, automation: { turn_on: service, turn_off: service },
  alarm_control_panel: Object.fromEntries(["alarm_disarm", "alarm_arm_home", "alarm_arm_away", "alarm_arm_night", "alarm_arm_vacation", "alarm_arm_custom_bypass", "alarm_trigger"].map(s => [s, service])),
};
export const config = { location_name: "Test home", time_zone: "Europe/Oslo", unit_system: { temperature: "°C" } } as HassConfig;
export const user: HassUser = { id: "actual-user", name: "HA user", is_admin: false, is_owner: false };
