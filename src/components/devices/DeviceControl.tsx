import { Action, Choice, More, Range, Readout } from "./CardControls";
import { LightCard, ClimateCard, CoverCard, PowerCard, SecurityCard } from "./CardLayouts";
import { DomainCardContent } from "./DomainCardContent";
import { AlarmCardControls } from "./AlarmCardControls";
import { CardDisabled, CardPresentation } from "./card-presentation";
import { cardDesignFor } from "./card-designs";
import { msg, type Message } from "@/lib/i18n";
import { useI18n } from "@/hooks/use-i18n";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Entity, EntityAction } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { available, entityStateLabel, humanizeState, needsCode, numberValue, stringValues, supportsAction } from "@/lib/ha-model";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { PinPadModal } from "./PinPadModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Lock, Lightbulb, Thermometer, Plug, Radio, Blinds, Shield, Sparkles, MapPin, ArrowUp, ArrowDown, Square, Unlock, Droplets, Battery, Zap, DoorOpen, Activity, Play, Fan, Loader2, Power, Sun, type LucideIcon } from "lucide-react";

export function DeviceIcon({ type, deviceClass, className }: { type: string; deviceClass?: unknown; className?: string }) {
  const Icon = ({ temperature: Thermometer, humidity: Droplets, moisture: Droplets, battery: Battery, power: Zap, energy: Zap, door: DoorOpen, motion: Activity, smoke: Shield })[String(deviceClass)]
    ?? ({ light: Lightbulb, climate: Thermometer, lock: Lock, switch: Plug, cover: Blinds, alarm_control_panel: Shield, scene: Sparkles, zone: MapPin, automation: Sparkles, media_player: Play, fan: Fan })[type] ?? Radio;
  return <Icon className={className} aria-hidden="true" />;
}
export function CommandFeedback({ entityId }: { entityId: string }) {
  const { t, message } = useI18n();
  const { commands } = useApp();
  const command = commands[entityId];
  return command?.error ? <p role="alert" className="text-sm text-destructive">{message(command.error)}</p> : command?.pending ? <span role="status" className="command-spinner"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /><span className="sr-only">{t("Command in progress")}</span></span> : null;
}
function RangeControl({ label, name, value, min, max, step = 1, unit = "", disabled, commit, icon }: { label: string; name: string; value?: number; min: number; max: number; step?: number; unit?: string; disabled: boolean; commit: (value: number) => void; icon?: LucideIcon }) {
  return <Range label={label} ariaLabel={`${name} ${label.toLowerCase()}`} value={value} min={min} max={max} step={step} unit={unit} disabled={disabled} commitOnly set={commit} icon={icon} />;
}

function LightColorControl({ entity, disabled, commit }: { entity: Entity; disabled: boolean; commit: (value: number[]) => void }) {
  const { t } = useI18n();
  const rgb = entity.attributes.rgb_color;
  const reported = Array.isArray(rgb) && rgb.length === 3 && rgb.every(v => Number.isInteger(v) && v >= 0 && v <= 255)
    ? `#${rgb.map(v => v.toString(16).padStart(2, "0")).join("")}` : "#ffffff";
  const [draft, setDraft] = useState(reported);
  useEffect(() => setDraft(reported), [reported]);
  return <form className="flex flex-wrap items-center justify-between gap-2" onSubmit={event => {
    event.preventDefault();
    if (!disabled) commit([1, 3, 5].map(start => parseInt(draft.slice(start, start + 2), 16)));
  }}>
    <label className="flex items-center gap-3 text-sm"><span>{t("Color")}</span><input type="color" aria-label={t("Color for {name}", { name: entity.name })}
      className="h-12 w-12 cursor-pointer rounded-lg border bg-background p-1 disabled:cursor-not-allowed disabled:opacity-50" value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} /></label>
    <Button type="submit" variant="outline" disabled={disabled}>{t("Apply color")}</Button>
  </form>;
}
export function DeviceControl({ entity, card = false }: { entity: Entity; card?: boolean }) {
  const { t, message, language, number } = useI18n();
  const { homeOnline, command, commands, services, currentHome } = useApp();
  const { variant } = useContext(CardPresentation);
  const [lockAction, setLockAction] = useState<"lock" | "unlock">();
  const [confirmation, setConfirmation] = useState<{ action: EntityAction; value?: unknown; title: Message; description: Message }>();
  const disabled = !homeOnline || !available(entity) || !!commands[entity.entityId]?.pending;
  const supports = (action: EntityAction) => supportsAction(entity, action, services);
  const send = (action: EntityAction, value?: unknown) => {
    if (disabled || !supports(action)) return;
    const description = entity.domain === "automation" && action === "turn_off" ? msg("Its automatic actions will stop until you enable it again.")
      : entity.domain === "script" && action === "turn_on" || entity.domain === "automation" && action === "trigger" ? msg("This runs the configured actions in Home Assistant.")
      : entity.domain === "valve" && (action === "open_valve" || action === "set_valve_position") ? msg("This changes the supply through a physical valve. Check that it is safe to move.")
      : entity.domain === "siren" && action === "turn_on" ? msg("This sounds the physical siren. People nearby may hear it.")
      : entity.domain === "scene" ? msg("This applies the scene’s configured device changes in Home Assistant.")
      : entity.domain === "climate" && action === "hvac_mode" && value === "off" ? msg("Heating and cooling will stop until you turn it on again.")
      : entity.domain === "cover" && ["door", "garage", "gate"].includes(String(entity.attributes.device_class)) && action !== "stop_cover" ? msg("This moves a physical door or gate. Check that it is safe to move.")
      : "";
    if (description) {
      const title = ["script", "valve", "siren"].includes(entity.domain) || action === "trigger" ? msg("Confirm action for {name}", { name: entity.name })
        : entity.domain === "automation" ? msg("Disable {name}?", { name: entity.name })
        : entity.domain === "scene" ? msg("Activate {name}?", { name: entity.name })
        : entity.domain === "climate" ? msg("Turn off {name}?", { name: entity.name })
        : action === "position" ? msg("Set position to {position}% for {name}?", { position: String(value), name: entity.name })
        : msg(action === "open_cover" ? "Open {name}?" : "Close {name}?", { name: entity.name });
      setConfirmation({ action, value, title, description });
    } else void command(entity.entityId, action, value).catch(() => {});
  };
  const unit = typeof entity.attributes.unit_of_measurement === "string" ? entity.attributes.unit_of_measurement : "";
  const brightness = numberValue(entity.attributes.brightness);
  const temperature = numberValue(entity.attributes.temperature);
  const currentTemperature = numberValue(entity.attributes.current_temperature);
  const position = numberValue(entity.attributes.current_position);
  const toggle = ["light", "switch", "input_boolean", "automation"].includes(entity.domain) && supports(entity.state === "on" ? "turn_off" : "turn_on");
  const status = !homeOnline ? t("Offline") : entityStateLabel(entity, language);
  const showState = !homeOnline || !available(entity) || (entity.domain !== "scene" && !(entity.domain === "cover" && supports("position") && position !== undefined && ["open", "closed"].includes(entity.state)));
  const dimmer = supports("brightness") && <RangeControl label={t("Brightness")} icon={Sun} name={entity.name} value={brightness === undefined ? undefined : Math.max(1, Math.round(brightness * 100 / 255))} min={1} max={100} unit="%" disabled={disabled} commit={v => send("brightness", v)} />;
  const colorControls = <>
    {supports("color_temp_kelvin") && <RangeControl label={t("Color temperature")} name={entity.name} value={numberValue(entity.attributes.color_temp_kelvin)} min={numberValue(entity.attributes.min_color_temp_kelvin)} max={numberValue(entity.attributes.max_color_temp_kelvin)} unit=" K" disabled={disabled} commit={v => send("color_temp_kelvin", v)} />}
    {supports("rgb_color") && <LightColorControl entity={entity} disabled={disabled} commit={v => send("rgb_color", v)} />}
    {supports("white") && <Button variant="outline" disabled={disabled} onClick={() => send("white", brightness === undefined ? 100 : Math.max(1, Math.round(brightness * 100 / 255)))}>{t("White light")}</Button>}
    {supports("effect") && <label className="device-mode"><span>{t("Effect")}</span><select aria-label={t("Effect for {name}", { name: entity.name })} value={typeof entity.attributes.effect === "string" ? entity.attributes.effect : ""} disabled={disabled} onChange={event => send("effect", event.target.value)}>
      {!stringValues(entity.attributes.effect_list).includes(String(entity.attributes.effect)) && <option value={typeof entity.attributes.effect === "string" ? entity.attributes.effect : ""} disabled>{t("Choose effect")}</option>}
      {stringValues(entity.attributes.effect_list).map(effect => <option key={effect} value={effect}>{effect}</option>)}
    </select></label>}
</>;
  const hasColorControls = ["color_temp_kelvin", "rgb_color", "white", "effect"].some(action => supports(action as EntityAction));
  const climateMode = supports("hvac_mode") && <Choice key="hvac_mode" label="Mode" ariaLabel={t("{name} mode", { name: entity.name })} options={stringValues(entity.attributes.hvac_modes)} value={entity.state} optionLabel={value => message(humanizeState(value))} set={value => send("hvac_mode", value)} />;
  const climateExtras = ([
    { action: "set_fan_mode", label: "Fan mode", attribute: "fan_mode", options: "fan_modes" },
    { action: "set_preset_mode", label: "Preset", attribute: "preset_mode", options: "preset_modes" },
    { action: "set_swing_mode", label: "Swing", attribute: "swing_mode", options: "swing_modes" },
  ] as const).filter(({ action }) => supports(action)).map(({ action, label, attribute, options }) => <Choice key={action} label={label} options={stringValues(entity.attributes[options])} value={String(entity.attributes[attribute] ?? "")} literalOptions set={value => send(action, value)} />);
  const humidity = supports("set_humidity") && <Range key="humidity" label="Target humidity" value={numberValue(entity.attributes.humidity)} min={numberValue(entity.attributes.min_humidity)} max={numberValue(entity.attributes.max_humidity)} step={numberValue(entity.attributes.target_humidity_step) || 1} commitOnly set={value => send("set_humidity", value)} />;
  const climateMore = [...(variant === "Super compact" && climateMode ? [climateMode] : []), ...climateExtras, ...(humidity ? [humidity] : [])];
  const coverControls = <>
    {supports("position") && <RangeControl label={t("Open")} name={entity.name} value={position} min={0} max={100} unit="%" disabled={disabled} commit={v => send("position", v)} />}
    <div className="dg-actions">{([{ action: "close_cover", label: "Close", Icon: ArrowDown }, { action: "stop_cover", label: "Stop", Icon: Square }, { action: "open_cover", label: "Open", Icon: ArrowUp }] as const).filter(({ action }) => supports(action)).map(({ action, label, Icon }) => <Action key={action} compactIcon={Icon} label={`${t(label)} ${entity.name}`} onClick={() => send(action)}><Icon size={16} aria-hidden="true" />{t(label)}</Action>)}</div>
    {supports("tilt_position") && <More><Range label="Slat tilt" value={numberValue(entity.attributes.current_tilt_position)} commitOnly set={value => send("tilt_position", value)} /></More>}
  </>;
  const reported = homeOnline && available(entity);
  const power = toggle ? <Action label={t("Toggle {value1}", { value1: entity.name })} pressed={entity.state === "on"} onClick={() => send(entity.state === "on" ? "turn_off" : "turn_on")}><Power size={20} /></Action> : undefined;
  const design = cardDesignFor(entity.domain);
  const Icon = design?.icon;
  const on = reported && entity.state === "on";
  const percent = brightness === undefined ? undefined : Math.max(1, Math.round(brightness * 100 / 255));
  const domainContent = ["media_player", "fan", "humidifier", "water_heater", "vacuum", "lawn_mower", "valve", "siren", "number", "input_number", "select", "input_select", "counter", "timer", "button", "input_button", "script"].includes(entity.domain);
  const primary = domainContent ? <DomainCardContent entity={entity} status={status} reported={reported} temperatureUnit={currentHome.temperatureUnit ?? ""} supports={supports} send={send} /> : !card ? <>
    {toggle ? <div className="toggle-line"><span>{status}</span><Switch checked={entity.state === "on"} disabled={disabled} aria-label={t("Toggle {value1}", { value1: entity.name })} onCheckedChange={on => send(on ? "turn_on" : "turn_off")} /></div>
      : entity.domain === "climate" && homeOnline && available(entity) ? <div className="climate-reading"><strong>{currentTemperature === undefined ? "—" : number(currentTemperature)}<small>{currentHome.temperatureUnit}</small></strong><span>{t("Inside")}</span></div>
      : showState && <div className={entity.domain === "sensor" && homeOnline && available(entity) ? "sensor-reading" : "sensor-state"}>{status}{unit && homeOnline && available(entity) && <small> {unit}</small>}</div>}

    {dimmer}{colorControls}
    {entity.domain === "climate" && <>{supports("temperature") && <RangeControl label={t("Target")} name={entity.name} value={temperature} min={numberValue(entity.attributes.min_temp)} max={numberValue(entity.attributes.max_temp)} step={numberValue(entity.attributes.target_temp_step) ?? 0.1} unit={currentHome.temperatureUnit ?? ""} disabled={disabled} commit={v => send("temperature", v)} />}{climateMode}{climateExtras}{humidity}</>}
    {entity.domain === "cover" && coverControls}
  </> : entity.domain === "light" ? <LightCard value={on && percent !== undefined ? `${percent}%` : status} caption={on && percent !== undefined ? status : ""} strength={on ? (percent ?? 100) / 100 : 0} power={power} brightness={dimmer}>
    {hasColorControls && (variant === "Original" ? colorControls : <More label="Color & effects">{colorControls}</More>)}
  </LightCard> : entity.domain === "climate" ? <ClimateCard name={entity.name} value={reported ? temperature : undefined} unit={currentHome.temperatureUnit ?? ""}
    min={numberValue(entity.attributes.min_temp)} max={numberValue(entity.attributes.max_temp)} step={numberValue(entity.attributes.target_temp_step) ?? .1}
    set={supports("temperature") ? value => send("temperature", value) : undefined}
    caption={reported && currentTemperature !== undefined ? `${status} · ${t("Inside")} ${number(currentTemperature)}${currentHome.temperatureUnit ?? ""}` : status}>
    {variant !== "Super compact" && climateMode}{climateMore.length > 0 && <More>{climateMore}</More>}
  </ClimateCard> : entity.domain === "cover" ? <CoverCard position={reported ? position : undefined} tilt={numberValue(entity.attributes.current_tilt_position) ?? 0}>
    {showState && <Readout value={status} caption="" />}{coverControls}
  </CoverCard> : power ? <PowerCard on={on} power={power} value={status} caption="" />
    : Icon && ["lock", "alarm_control_panel", "siren", "binary_sensor"].includes(entity.domain) ? <SecurityCard icon={entity.domain === "lock" && entity.state === "unlocked" ? Unlock : Icon} value={status} caption="" secure={reported && entity.state === "locked"} />
    : <Readout value={status} unit={reported ? unit : ""} caption="" />;
  return <CardDisabled.Provider value={disabled}><div className={card ? "dg-card-body command-controller" : "control-stack command-controller"} aria-busy={!!commands[entity.entityId]?.pending}>
    {primary}
    {entity.domain === "alarm_control_panel" && <AlarmCardControls entity={entity} />}
    {entity.domain === "automation" && supports("trigger") && <Action label="Run actions" compactIcon={Play} onClick={() => send("trigger")}><Play size={18} />{t("Run actions")}</Action>}
    {entity.domain === "lock" && <>
      <div className="device-actions">{(["lock", "unlock"] as const).filter(action => supports(action) && !(entity.state === "locked" && action === "lock") && !(entity.state === "unlocked" && action === "unlock")).map(action => <Button key={action} variant="outline" disabled={disabled || ["locking", "unlocking", "opening"].includes(entity.state)} aria-label={`${message(humanizeState(action))} ${entity.name}`} onClick={() => setLockAction(action)}>{action === "lock" ? <Lock size={16} /> : <Unlock size={16} />}{message(humanizeState(action))}</Button>)}</div>
      {lockAction && <PinPadModal open disabled={disabled || !supports(lockAction)} onOpenChange={open => { if (!open) setLockAction(undefined); }} title={`${message(humanizeState(lockAction))} ${entity.name}`} description={needsCode(entity, lockAction) ? t("Enter your code to continue.") : t("Confirm to continue.")} codeRequired={needsCode(entity, lockAction)} numeric={entity.attributes.code_format === "number"} onSubmit={code => command(entity.entityId, lockAction, undefined, code)} />}
    </>}
    {entity.domain === "scene" && supports("turn_on") && <Button disabled={disabled} variant="outline" aria-label={t("Activate {value1}", { value1: entity.name })} onClick={() => send("turn_on")}><Sparkles size={16} />{t("Activate")}</Button>}
    {entity.domain === "alarm_control_panel" && <Link className="text-link" to="/alarm">{t("Manage alarm")}</Link>}
    <CommandFeedback entityId={entity.entityId} />
    {confirmation && <ConfirmDialog open onOpenChange={open => { if (!open) setConfirmation(undefined); }} title={confirmation.title} description={confirmation.description} destructive={entity.domain === "automation" || entity.domain === "climate"} disabled={disabled || !supports(confirmation.action)} onConfirm={() => command(entity.entityId, confirmation.action, confirmation.value)} />}
  </div></CardDisabled.Provider>;
}
