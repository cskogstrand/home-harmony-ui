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
