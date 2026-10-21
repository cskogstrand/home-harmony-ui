import type { HassEntities } from "home-assistant-js-websocket";

export interface AreaRegistryEntry { area_id: string; name: string; icon?: string | null }
export interface PhysicalDevice {
  id: string;
  area_id?: string | null;
  name?: string | null;
  name_by_user?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  sw_version?: string | null;
}
export interface EntityRegistryEntry {
  id: string;
  entity_id: string;
  platform?: string;
  area_id?: string | null;
  device_id?: string | null;
  name?: string | null;
  original_name?: string | null;
  disabled_by?: string | null;
  hidden_by?: string | null;
  entity_category?: string | null;
}
export interface Registries {
  areas: AreaRegistryEntry[];
  devices: PhysicalDevice[];
  entities: EntityRegistryEntry[];
}
// A controllable entity is not a physical device. Several entities may share device.id.
export interface Entity {
  entityId: string;
  preferenceId: string;
  name: string;
  domain: string;
  integration?: string;
  category?: string | null;
  state: string;
  attributes: Record<string, unknown>;
  areaId: string;
  device?: PhysicalDevice;
  lastChanged?: string;
  lastUpdated?: string;
}
export interface Area { id: string; name: string; entities: Entity[] }
export interface Home {
  name: string;
  timeZone: string;
  temperatureUnit?: string;
  entities: Entity[];
  areas: Area[];
  devices: PhysicalDevice[];
}
export type EntityStates = HassEntities;
export type AlarmAction = "alarm_disarm" | "alarm_arm_home" | "alarm_arm_away" | "alarm_arm_night" | "alarm_arm_vacation" | "alarm_arm_custom_bypass" | "alarm_trigger";
export type TodoAction = "add_item" | "update_item" | "remove_item";
export type EntityAction = "turn_on" | "turn_off" | "brightness" | "temperature" | "hvac_mode" | "open_cover" | "close_cover" | "stop_cover" | "position" | "lock" | "unlock" | "create_event" | "update_event" | "delete_event" | AlarmAction | TodoAction;
export interface TodoItem { uid: string; summary: string; status: "needs_action" | "completed" | null }
export interface CalendarEvent {
  summary: string;
  start: string | { date: string } | { dateTime: string };
  end: string | { date: string } | { dateTime: string };
  location?: string | null;
  description?: string | null;
  uid?: string | null;
  recurrence_id?: string | null;
  rrule?: string | null;
}
