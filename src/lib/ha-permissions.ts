/**
 * Event types Home Assistant lets a user who is not an administrator subscribe to with `subscribe_events`. Home Assistant
 * refuses every other type for such a user and logs the refusal as an error, so the dashboard never asks for them.
 *
 * Copy of `SUBSCRIBE_ALLOWLIST` in Home Assistant Core 2026.11.3,
 * https://github.com/home-assistant/core/blob/2026.11.3/homeassistant/auth/permissions/events.py
 * (checked by `handle_subscribe_events` in homeassistant/components/websocket_api/commands.py). Compare it with each new
 * Home Assistant release; a type Home Assistant adds only becomes available here when it is copied in.
 */
export const HA_EVENT_SUBSCRIBE_ALLOWLIST: ReadonlySet<string> = new Set([
  "area_registry_updated",
  "component_loaded",
  "core_config_updated",
  "device_registry_updated",
  "entity_registry_updated",
  "repairs_issue_registry_updated",
  "lovelace_updated",
  "panels_updated",
  "recorder_5min_statistics_generated",
  "recorder_hourly_statistics_generated",
  "service_registered",
  "service_removed",
  "shopping_list_updated",
  "state_changed",
  "themes_updated",
  "label_registry_updated",
  "labs_updated",
  "category_registry_updated",
  "floor_registry_updated",
]);

/**
 * Whether the dashboard may subscribe to `eventType` for a Home Assistant user. `isAdmin` is undefined until the user is
 * loaded; an unknown user is treated as one who is not an administrator, so nothing is sent that Home Assistant could refuse.
 */
export const canSubscribeEvent = (eventType: string, isAdmin: boolean | undefined) => isAdmin === true || HA_EVENT_SUBSCRIBE_ALLOWLIST.has(eventType);
