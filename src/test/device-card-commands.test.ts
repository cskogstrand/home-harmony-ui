import { describe, expect, it } from "vitest";
import type { EntityAction } from "@/types/api";
import { entityCommand, supportsAction } from "@/lib/ha-model";
import { cardEntity, cardServices, mediaEntity } from "./device-card-fixtures";

describe("live card commands", () => {
  it("maps media controls to HA payloads without changing units or targets", () => {
    const media = mediaEntity();
    expect(entityCommand(media, "media_play", cardServices)).toEqual({ domain: "media_player", service: "media_play", data: {}, target: { entity_id: media.entityId } });
    for (const [action, value, data] of [
      ["volume_set", .35, { volume_level: .35 }], ["volume_mute", false, { is_volume_muted: false }],
      ["media_seek", 120, { seek_position: 120 }], ["select_source", "Radio", { source: "Radio" }],
      ["select_sound_mode", "Stereo", { sound_mode: "Stereo" }], ["shuffle_set", true, { shuffle: true }], ["repeat_set", "one", { repeat: "one" }],
    ] as const) expect(entityCommand(media, action, cardServices, value)).toMatchObject({ service: action, data });
  });

  it("requires each media capability AND the service, including optional sources and seeking", () => {
    const media = mediaEntity();
    for (const action of Object.keys(cardServices.media_player) as EntityAction[]) {
      expect(supportsAction(media, action, cardServices)).toBe(true);
      expect(supportsAction({ ...media, attributes: { ...media.attributes, supported_features: 0 } }, action, cardServices)).toBe(false);
      expect(supportsAction(media, action, {})).toBe(false);
      expect(() => entityCommand({ ...media, state: "unavailable" }, action, cardServices)).toThrow("available");
    }
    expect(supportsAction({ ...media, attributes: { ...media.attributes, source_list: [] } }, "select_source", cardServices)).toBe(false);
    for (const duration of [undefined, null, 0, -1, NaN, "240"]) expect(supportsAction({ ...media, attributes: { ...media.attributes, media_duration: duration } }, "media_seek", cardServices)).toBe(false);
  });

  it("rejects malformed media values before a service can be called", () => {
    for (const value of [-.01, 1.01, NaN, Infinity, "0.5", null]) expect(() => entityCommand(mediaEntity(), "volume_set", cardServices, value)).toThrow("range");
    for (const value of [-1, 241, NaN, "5"]) expect(() => entityCommand(mediaEntity(), "media_seek", cardServices, value)).toThrow("range");
    for (const action of ["volume_mute", "shuffle_set"] as const) for (const value of [0, 1, "false", null]) expect(() => entityCommand(mediaEntity(), action, cardServices, value)).toThrow("on or off");
    for (const action of ["select_source", "select_sound_mode", "repeat_set"] as const) expect(() => entityCommand(mediaEntity(), action, cardServices, "invented")).toThrow("option");
  });

  it("validates climate, fan, humidity, heater, cover and valve controls against reported capabilities", () => {
    const climate = cardEntity("climate", "heat", { supported_features: 61, min_temp: 7, max_temp: 30, min_humidity: 30, max_humidity: 70, fan_modes: ["auto", "low"], preset_modes: ["eco"], swing_modes: ["both"] });
    expect(entityCommand(climate, "set_fan_mode", cardServices, "low").data).toEqual({ fan_mode: "low" });
    expect(entityCommand(climate, "set_preset_mode", cardServices, "eco").data).toEqual({ preset_mode: "eco" });
    expect(entityCommand(climate, "set_swing_mode", cardServices, "both").data).toEqual({ swing_mode: "both" });
    expect(entityCommand(climate, "set_humidity", cardServices, 50).data).toEqual({ humidity: 50 });
    expect(() => entityCommand(climate, "set_humidity", cardServices, 71)).toThrow("range");
    const fan = cardEntity("fan", "on", { supported_features: 63, preset_modes: ["sleep"] });
    expect(entityCommand(fan, "set_percentage", cardServices, 40).data).toEqual({ percentage: 40 });
    expect(entityCommand(fan, "oscillate", cardServices, false).data).toEqual({ oscillating: false });
    expect(entityCommand(fan, "set_direction", cardServices, "reverse").data).toEqual({ direction: "reverse" });
    expect(() => entityCommand(fan, "set_direction", cardServices, "left")).toThrow("option");
    const humidity = cardEntity("humidifier", "on", { supported_features: 1, min_humidity: 30, max_humidity: 70, available_modes: ["auto"] });
    expect(entityCommand(humidity, "set_mode", cardServices, "auto").data).toEqual({ mode: "auto" });
    expect(() => entityCommand(humidity, "set_humidity", cardServices, 80)).toThrow("range");
    const heater = cardEntity("water_heater", "eco", { supported_features: 15, min_temp: 40, max_temp: 80, operation_list: ["eco"] });
    expect(entityCommand(heater, "temperature", cardServices, 62.5)).toMatchObject({ service: "set_temperature", data: { temperature: 62.5 } });
    expect(entityCommand(heater, "set_operation_mode", cardServices, "eco").data).toEqual({ operation_mode: "eco" });
    expect(entityCommand(heater, "set_away_mode", cardServices, true).data).toEqual({ away_mode: true });
    expect(entityCommand(cardEntity("cover", "open", { supported_features: 128 }), "tilt_position", cardServices, 70)).toMatchObject({ service: "set_cover_tilt_position", data: { tilt_position: 70 } });
    expect(entityCommand(cardEntity("valve", "closed", { supported_features: 15 }), "set_valve_position", cardServices, 35).data).toEqual({ position: 35 });
    for (const [entity, action] of [[climate, "set_fan_mode"], [fan, "oscillate"], [heater, "set_away_mode"]] as const) expect(supportsAction({ ...entity, attributes: { ...entity.attributes, supported_features: 0 } }, action, cardServices)).toBe(false);
  });

  it("supports robot and helper commands without treating unrelated domains as controllable", () => {
    expect(entityCommand(cardEntity("vacuum", "docked", { supported_features: 8192 }), "start", cardServices).service).toBe("start");
    expect(supportsAction(cardEntity("vacuum", "docked", { supported_features: 8192 }), "pause", cardServices)).toBe(false);
    expect(entityCommand(cardEntity("lawn_mower", "mowing", { supported_features: 2 }), "pause", cardServices).data).toEqual({});
    expect(entityCommand(cardEntity("input_number", "3", { min: -5, max: 5 }), "set_value", cardServices, -.5).data).toEqual({ value: -.5 });
    expect(() => entityCommand(cardEntity("number", "3", { min: -5, max: 5 }), "set_value", cardServices, 6)).toThrow("range");
    expect(entityCommand(cardEntity("input_select", "eco", { options: ["eco", "comfort"] }), "select_option", cardServices, "comfort").data).toEqual({ option: "comfort" });
    expect(supportsAction(cardEntity("sensor", "3"), "set_value", { sensor: cardServices.number })).toBe(false);
    for (const [domain, action] of [["input_boolean", "turn_on"], ["counter", "increment"], ["timer", "pause"], ["button", "press"], ["script", "turn_off"], ["automation", "trigger"]] as const) expect(entityCommand(cardEntity(domain, "off"), action, cardServices).service).toBe(action);
    expect(entityCommand(cardEntity("input_button", "unknown"), "press", cardServices).service).toBe("press");
  });

  it("allows siren drafts only within reported tone and volume capabilities", () => {
    const siren = cardEntity("siren", "off", { supported_features: 15, available_tones: { "1": "Chime", "2": "Alarm" } });
    expect(entityCommand(siren, "turn_on", cardServices, { tone: "1", volume_level: .2 }).data).toEqual({ tone: "1", volume_level: .2 });
    for (const draft of [{ tone: "3" }, { volume_level: 20 }, { volume_level: "0.2" }, { duration: 200 }, { target: "another" }]) expect(() => entityCommand(siren, "turn_on", cardServices, draft)).toThrow();
    expect(() => entityCommand({ ...siren, attributes: { supported_features: 3 } }, "turn_on", cardServices, { volume_level: .2 })).toThrow("not supported");
  });
});
