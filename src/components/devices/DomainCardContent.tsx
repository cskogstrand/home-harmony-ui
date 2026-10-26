import { useContext, useEffect, useState, type ReactNode } from "react";
import { House, LocateFixed, Minus, Pause, Play, Plus, Power, RotateCcw, Siren, Square, Volume2, VolumeX, Wind, Zap } from "lucide-react";
import type { Entity, EntityAction } from "@/types/api";
import { feature, humanizeState, numberValue, stringValues } from "@/lib/ha-model";
import { useI18n } from "@/hooks/use-i18n";
import { Action, Choice, More, Range, Readout, Toggle } from "./CardControls";
import { FanCard, HumidityCard, MediaCard, RobotCard, SecurityCard, ValveCard, WaterHeaterCard } from "./CardLayouts";
import { CardDisabled, CardPresentation } from "./card-presentation";

function SirenSettings({ entity, supports, send }: Pick<Parameters<typeof DomainCardContent>[0], "entity" | "supports" | "send">) {
  const { message: t } = useI18n();
  const disabled = useContext(CardDisabled);
  const [tone, setTone] = useState<string>(), [volume, setVolume] = useState<number>();
  const tones = entity.attributes.available_tones;
  const options = Array.isArray(tones) ? Object.fromEntries(stringValues(tones).map(tone => [tone, tone])) : tones && typeof tones === "object" ? tones : {};
  const hasTones = feature(entity, 4) && Object.keys(options).length > 0;
  const on = entity.state === "on", action = on ? "turn_off" : "turn_on";
  return <>{supports("turn_on") && (hasTones || feature(entity, 8)) && <More>
    {hasTones && <label className="dg-choice"><span>{t("Tone")}</span><select disabled={disabled} value={tone ?? ""} onChange={event => setTone(event.target.value)}><option value="">{t("Device default")}</option>{Object.entries(options).map(([value, label]) => <option key={value} value={value}>{String(label)}</option>)}</select></label>}
    {feature(entity, 8) && <Range label="Siren volume" icon={Volume2} value={volume} set={setVolume} />}
    <p>{t("Settings apply when you start the siren.")}</p>
  </More>}{supports(action) && <Action primary onClick={() => send(action, on ? undefined : { ...(tone ? { tone } : {}), ...(volume !== undefined ? { volume_level: volume / 100 } : {}) })}>{t(on ? "Stop siren" : "Start siren")}</Action>}</>;
}

function TimerReading({ entity, status, reported }: { entity: Entity; status: string; reported: boolean }) {
  const [now, setNow] = useState(Date.now);
  const finish = typeof entity.attributes.finishes_at === "string" ? Date.parse(entity.attributes.finishes_at) : NaN;
  const counting = reported && entity.state === "active" && Number.isFinite(finish);
  useEffect(() => {
    if (!counting) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [counting, finish]);
  const seconds = Math.max(0, Math.ceil((finish - now) / 1000));
  const remaining = entity.attributes.remaining ?? entity.attributes.duration;
  const value = counting ? `${Math.floor(seconds / 3600).toString().padStart(2, "0")}:${Math.floor(seconds / 60 % 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
    : reported && typeof remaining === "string" ? remaining : status;
  return <Readout value={value} caption={status} />;
}

// Both card and entity-detail views use the same supported controls and command boundary.
export function DomainCardContent({ entity, status, reported, temperatureUnit, supports, send, setting = false }: {
  entity: Entity; status: string; reported: boolean; temperatureUnit: string;
  supports: (action: EntityAction) => boolean; send: (action: EntityAction, value?: unknown) => void; setting?: boolean;
}) {
  const { message: t } = useI18n();
  const superCompact = useContext(CardPresentation).variant === "Super compact";
  const a = entity.attributes;
  const numeric = (attribute: string) => numberValue(a[attribute]);
  const text = (attribute: string) => typeof a[attribute] === "string" ? a[attribute] as string : "";
  const choice = (action: EntityAction, label: string, attribute: string, options: string[]) => supports(action) &&
    <Choice key={action} label={label} options={options} value={text(attribute)} literalOptions optionLabel={["repeat_set", "set_direction"].includes(action) ? value => t(humanizeState(value)) : undefined} set={value => send(action, value)} />;
  const toggle = (action: EntityAction, label: string, attribute: string) => supports(action) &&
    <Toggle key={action} label={label} on={a[attribute] === true || a[attribute] === "on"} set={value => send(action, value)} />;
  const action = (name: EntityAction, label: string, Icon = Play, primary = false, blocked = false) => supports(name) &&
    <Action key={name} label={label} compactIcon={Icon} primary={primary} disabled={blocked} onClick={() => send(name)}><Icon size={18} />{t(label)}</Action>;
  const extras = (...nodes: ReactNode[]) => { const shown = nodes.filter(Boolean); return shown.length ? shown : undefined; };
  const more = (...nodes: ReactNode[]) => { const shown = extras(...nodes); return shown && <More>{shown}</More>; };
  const powerAction = entity.state === "off" ? "turn_on" : "turn_off";
  const power = supports(powerAction) && <Toggle label="Device power" on={entity.state !== "off"} set={on => send(on ? "turn_on" : "turn_off")} />;
  const range = (action: EntityAction, label: string, attribute: string, min: number, max: number, step = 1, unit = "%") => supports(action) &&
    <Range key={action} label={label} value={numeric(attribute)} min={min} max={max} step={step} unit={unit} commitOnly set={value => send(action, value)} />;

  if (entity.domain === "media_player") {
    const playing = entity.state === "playing";
    const playback = playing ? "media_pause" : "media_play";
    const controls = extras(
      toggle("volume_mute", "Mute", "is_volume_muted"), choice("select_source", "Media source", "source", stringValues(a.source_list)),
      choice("select_sound_mode", "Sound mode", "sound_mode", stringValues(a.sound_mode_list)), toggle("shuffle_set", "Shuffle", "shuffle"),
      choice("repeat_set", "Repeat", "repeat", ["off", "one", "all"]), action("media_stop", "Stop", Square),
      action(powerAction, entity.state === "off" ? "Turn on" : "Turn off", Power),
    );
    return <MediaCard title={reported ? text("media_title") || status : status} subtitle={reported ? text("media_artist") : undefined} caption={status} playing={playing}
      previous={supports("media_previous_track") ? () => send("media_previous_track") : undefined}
      playPause={supports(playback) ? () => send(playback) : undefined} next={supports("media_next_track") ? () => send("media_next_track") : undefined}
      seek={range("media_seek", "Playback position", "media_position", 0, numeric("media_duration"), 1, " s")}
      volume={supports("volume_set") ? <Range label="Volume" icon={a.is_volume_muted === true ? VolumeX : Volume2} value={numeric("volume_level") === undefined ? undefined : Math.round(numeric("volume_level") * 100)} commitOnly set={value => send("volume_set", value / 100)} />
        : <div className="dg-actions">{action("volume_down", "Volume down", Minus)}{action("volume_up", "Volume up", Plus)}</div>}
      more={controls} />;
  }
  if (entity.domain === "fan") {
    const oscillation = toggle("oscillate", "Oscillate", "oscillating");
    return <FanCard on={reported && entity.state === "on"} speed={numeric("percentage")}>
      <Readout value={status} caption="" />{power}
      {supports("set_percentage") && <Range label="Fan speed" icon={Wind} value={numeric("percentage")} min={0} step={numeric("percentage_step") || 1} commitOnly set={value => send("set_percentage", value)} />}
      {!superCompact && oscillation}{more(superCompact && oscillation, choice("set_direction", "Direction", "direction", ["forward", "reverse"]), choice("set_preset_mode", "Fan preset", "preset_mode", stringValues(a.preset_modes)))}
    </FanCard>;
  }
  if (entity.domain === "humidifier") return <HumidityCard value={reported ? numeric("current_humidity") ?? "—" : status} unit={reported && numeric("current_humidity") !== undefined ? "%" : ""} caption={reported ? `${t("Current humidity")} · ${status}` : ""}>
    {range("set_humidity", "Target humidity", "humidity", numeric("min_humidity"), numeric("max_humidity"), numeric("target_humidity_step") || 1)}{power}
    {more(choice("set_mode", "Humidity mode", "mode", stringValues(a.available_modes)))}
  </HumidityCard>;
  if (entity.domain === "water_heater") {
    const modes = choice("set_operation_mode", "Water heater mode", "operation_mode", stringValues(a.operation_list));
    const min = numeric("min_temp"), max = numeric("max_temp"), temperature = numeric("temperature");
    return <WaterHeaterCard value={reported ? temperature ?? "—" : status} unit={reported && temperature !== undefined ? temperatureUnit : ""} caption={status} level={reported && max > min && temperature !== undefined ? (temperature - min) / (max - min) * 100 : 0}>
      {range("temperature", "Water temperature", "temperature", min, max, numeric("target_temp_step") || .5, temperatureUnit)}{power}
      {!superCompact && modes}{more(superCompact && modes, toggle("set_away_mode", "Away mode", "away_mode"))}
    </WaterHeaterCard>;
  }
  if (["vacuum", "lawn_mower"].includes(entity.domain)) {
    const mower = entity.domain === "lawn_mower", working = ["cleaning", "mowing"].includes(entity.state);
    return <RobotCard status={status} battery={reported ? numeric("battery_level") : undefined}
      actions={<div className="dg-actions">{action(working ? "pause" : mower ? "start_mowing" : "start", working ? "Pause" : "Start", working ? Pause : Play, true)}{action(mower ? "dock" : "return_to_base", "Return to dock", House)}</div>}
      more={extras(choice("set_fan_speed", "Suction", "fan_speed", stringValues(a.fan_speed_list)), action("locate", "Locate device", LocateFixed), action("stop", "Stop", Square))} />;
  }
  if (entity.domain === "valve") return <ValveCard value={status} position={reported ? numeric("current_position") : undefined} caption="">
    {range("set_valve_position", "Valve opening", "current_position", 0, 100)}<div className="dg-actions">{action("close_valve", "Close", Minus)}{action("stop_valve", "Stop", Square)}{action("open_valve", "Open valve", Plus)}</div>
  </ValveCard>;
  if (entity.domain === "siren") return <SecurityCard icon={Siren} value={status} alert={reported && entity.state === "on"} caption=""><SirenSettings entity={entity} supports={supports} send={send} /></SecurityCard>;
  if (["number", "input_number"].includes(entity.domain)) return <>{(!setting || !reported || !supports("set_value")) && <Readout value={status} unit={reported ? text("unit_of_measurement") : ""} caption="" />}{supports("set_value") && <Range label="Value" ariaLabel={setting ? entity.name : undefined} value={entity.state.trim() ? numberValue(Number(entity.state)) : undefined} min={numeric("min")} max={numeric("max")} step={numeric("step") || 1} unit={text("unit_of_measurement")} commitOnly set={value => send("set_value", value)} />}</>;
  if (["select", "input_select"].includes(entity.domain)) return <>{(!setting || !reported || !supports("select_option")) && <Readout value={status} caption="" />}{supports("select_option") && <Choice label="Option" ariaLabel={setting ? entity.name : undefined} value={entity.state} options={stringValues(a.options)} literalOptions set={value => send("select_option", value)} />}</>;
  if (entity.domain === "counter") return <><Readout value={status} caption="" /><div className="dg-stepper">{action("decrement", "Decrease counter", Minus, false, Number(entity.state) <= numeric("minimum"))}{action("reset", "Reset", RotateCcw)}{action("increment", "Increase counter", Plus, false, Number(entity.state) >= numeric("maximum"))}</div></>;
  if (entity.domain === "timer") return <><TimerReading entity={entity} status={status} reported={reported} /><div className="dg-actions">{action(entity.state === "active" ? "pause" : "start", entity.state === "active" ? "Pause" : "Start", entity.state === "active" ? Pause : Play, true)}{action("cancel", "Cancel", RotateCcw)}</div>{more(action("finish", "Finish timer", Square, false, entity.state === "idle"))}</>;
  if (["button", "input_button"].includes(entity.domain)) return setting ? <>{action("press", entity.name, Zap)}{!reported && <Readout value={status} caption="" />}</> : <><div className="dg-power-disc">{action("press", "Press button", Zap, true)}</div><Readout value={status} caption="" /></>;
  if (entity.domain === "script") return <><Readout value={status} caption="" />{action(entity.state === "on" ? "turn_off" : "turn_on", entity.state === "on" ? "Stop script" : "Run script", entity.state === "on" ? Square : Play, true)}</>;
  return <Readout value={status} unit={reported ? text("unit_of_measurement") : ""} caption="" />;
}
