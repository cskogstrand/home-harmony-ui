import { deviceCardSchema, type DeviceCardSettings } from "../../shared/configuration";
import type { HassServices } from "home-assistant-js-websocket";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { services, state } from "./ha-fixtures";

export const cardServices: HassServices = { ...services, ...Object.fromEntries(Object.entries({
  media_player: ["media_play", "media_pause", "media_stop", "media_previous_track", "media_next_track", "media_seek", "volume_set", "volume_mute", "volume_up", "volume_down", "select_source", "select_sound_mode", "shuffle_set", "repeat_set", "turn_on", "turn_off"],
  climate: ["set_temperature", "set_hvac_mode", "set_fan_mode", "set_preset_mode", "set_swing_mode", "set_humidity"],
  cover: ["open_cover", "close_cover", "stop_cover", "set_cover_position", "set_cover_tilt_position"],
  fan: ["turn_on", "turn_off", "set_percentage", "oscillate", "set_direction", "set_preset_mode"],
  humidifier: ["turn_on", "turn_off", "set_humidity", "set_mode"], water_heater: ["set_temperature", "set_operation_mode", "set_away_mode", "turn_on", "turn_off"],
  vacuum: ["start", "pause", "stop", "return_to_base", "locate", "set_fan_speed"], lawn_mower: ["start_mowing", "pause", "dock", "stop"],
  valve: ["open_valve", "close_valve", "stop_valve", "set_valve_position"], siren: ["turn_on", "turn_off"],
  number: ["set_value"], input_number: ["set_value"], select: ["select_option"], input_select: ["select_option"], input_boolean: ["turn_on", "turn_off"],
  counter: ["increment", "decrement", "reset"], timer: ["start", "pause", "cancel", "finish"], button: ["press"], input_button: ["press"], script: ["turn_on", "turn_off"], automation: ["turn_on", "turn_off", "trigger"],
}).map(([domain, actions]) => [domain, Object.fromEntries(actions.map(action => [action, { fields: {} }]))])) };

export const cardEntity = (domain: string, value: string, attributes: Record<string, unknown> = {}) => mapHome({
  [`${domain}.example`]: state(`${domain}.example`, value, { friendly_name: `Example ${domain}`, ...attributes }),
}, emptyRegistries, "example").entities[0];

export const mediaEntity = () => cardEntity("media_player", "paused", {
  supported_features: 1 + 2 + 4 + 8 + 16 + 32 + 128 + 256 + 1024 + 2048 + 4096 + 16384 + 32768 + 65536 + 262144,
  media_title: "Example track", media_artist: "Example artist", media_duration: 240, media_position: 74,
  volume_level: .35, is_volume_muted: false, source: "Demo library", source_list: ["Demo library", "Radio"],
  sound_mode: "Stereo", sound_mode_list: ["Stereo", "Movie"], shuffle: false, repeat: "off",
});

export const configuredCard = (mainEntity: string, type: DeviceCardSettings["type"] = "light", settings: Partial<DeviceCardSettings> = {}) => deviceCardSchema.parse({ id: mainEntity, mainEntity, type, ...settings });

type PrinterOverride = string | { state: string; attributes?: Record<string, unknown> };
/** A fictional 3D printer with one filament unit. Entity ids and translation keys follow the Bambu Lab integration. */
export function printerHome(overrides: Record<string, PrinterOverride> = {}, { translationKeys = true } = {}) {
  const printer = "example-printer", unit = "example-filament-unit";
  const entities: [id: string, value: string, attributes: Record<string, unknown>, key: string][] = [
    ["sensor.workshop_printer_print_progress", "42", { unit_of_measurement: "%" }, "print_progress"],
    ["sensor.workshop_printer_print_status", "running", { device_class: "enum" }, "print_status"],
    ["sensor.workshop_printer_current_stage", "printing", { device_class: "enum" }, "stage"],
    ["sensor.workshop_printer_remaining_time", "1.25", { device_class: "duration", unit_of_measurement: "h" }, "remaining_time"],
    ["sensor.workshop_printer_end_time", "2030-06-15T12:20:00+00:00", { device_class: "timestamp" }, "end_time"],
    ["sensor.workshop_printer_nozzle_temp", "219.6", { device_class: "temperature", unit_of_measurement: "°C" }, "nozzle_temp"],
    ["sensor.workshop_printer_target_nozzle_temp", "220", { device_class: "temperature", unit_of_measurement: "°C" }, "target_nozzle_temp"],
    ["sensor.workshop_printer_bed_temp", "54.8", { device_class: "temperature", unit_of_measurement: "°C" }, "bed_temp"],
    ["sensor.workshop_printer_target_bed_temp", "55", { device_class: "temperature", unit_of_measurement: "°C" }, "target_bed_temp"],
    ["binary_sensor.workshop_printer_print_error", "off", { device_class: "problem" }, "print_error"],
    ["binary_sensor.workshop_printer_hms_errors", "off", { device_class: "problem", Count: 0 }, "hms_errors"],
    ["camera.workshop_printer_camera", "idle", { access_token: "example" }, "camera"],
    ["image.workshop_printer_cover_image", "2030-06-15T10:00:00+00:00", { entity_picture: "/api/image_proxy/image.workshop_printer_cover_image" }, "cover_image"],
    ["light.workshop_printer_chamber_light", "on", { supported_color_modes: ["onoff"], color_mode: "onoff" }, "chamber_light"],
    ["sensor.workshop_printer_external_spool", "Generic PETG", { color: "#1F2A44FF", type: "PETG", active: false, empty: false }, "external_spool"],
    ["sensor.filament_unit_tray_1", "Example PLA", { color: "#F4F1E8FF", type: "PLA", active: true, empty: false }, "tray"],
    ["sensor.filament_unit_tray_2", "Example PLA", { color: "#D9482BFF", type: "PLA", active: false, empty: false }, "tray"],
    ["sensor.filament_unit_tray_3", "Empty", { color: "#00000000", type: "", active: false, empty: true }, "tray"],
  ];
  const deviceOf = (id: string) => id.startsWith("sensor.filament_unit") ? unit : printer;
  const label = (id: string) => (deviceOf(id) === unit ? "Filament unit " : "Workshop printer ") + id.split(".")[1].replace(/^(workshop_printer|filament_unit)_/, "").replace(/_/g, " ");
  const states = Object.fromEntries(entities.map(([id, value, attributes]) => {
    const override = overrides[id];
    const next = typeof override === "string" ? { state: override } : override;
    return [id, state(id, next?.state ?? value, { friendly_name: label(id), ...attributes, ...next?.attributes })];
  }));
  return mapHome(states, {
    areas: [],
    devices: [{ id: printer, name: "Workshop printer", manufacturer: "Example Labs", model: "Example 3D" }, { id: unit, name: "Filament unit", via_device_id: printer }],
    entities: entities.map(([id, , , key]) => ({ id: `registry-${id}`, entity_id: id, platform: "bambu_lab", device_id: deviceOf(id), translation_key: translationKeys ? key : null })),
  }, "example");
}
