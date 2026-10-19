import { msg, type Message } from "@/lib/i18n";
import { useI18n } from "@/hooks/use-i18n";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Entity, EntityAction } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { available, entityStateLabel, humanizeState, needsCode, numberValue, stringValues, supportsAction } from "@/lib/ha-model";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PinPadModal } from "./PinPadModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Lock, Lightbulb, Thermometer, Plug, Radio, Blinds, Shield, Sparkles, MapPin, ArrowUp, ArrowDown, Square, Unlock, Droplets, Battery, Zap, DoorOpen, Activity, Play, Fan, Loader2 } from "lucide-react";

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
function RangeControl({ label, name, value, min, max, step = 1, unit = "", disabled, commit }: { label: string; name: string; value?: number; min: number; max: number; step?: number; unit?: string; disabled: boolean; commit: (value: number) => void }) {
  const { t, number } = useI18n();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value, disabled]);
  const shown = draft === undefined ? "—" : `${number(draft)}${unit}`;
  return <div className="device-range"><span>{label}<strong>{shown}</strong></span><Slider className="h-12" aria-label={`${name} ${label.toLowerCase()}`} aria-valuetext={draft === undefined ? t("Not reported") : shown} min={min} max={max} step={step} value={[Math.min(max, Math.max(min, draft ?? min))]} disabled={disabled} onValueChange={([v]) => setDraft(v)} onValueCommit={([v]) => commit(v)} /></div>;
}
export function DeviceControl({ entity }: { entity: Entity }) {
  const { t, message, language, number } = useI18n();
  const { homeOnline, command, commands, services, currentHome } = useApp();
  const [lockAction, setLockAction] = useState<"lock" | "unlock">();
  const [confirmation, setConfirmation] = useState<{ action: EntityAction; value?: unknown; title: Message; description: Message }>();
  const disabled = !homeOnline || !available(entity) || !!commands[entity.entityId]?.pending;
  const supports = (action: EntityAction) => supportsAction(entity, action, services);
  const send = (action: EntityAction, value?: unknown) => {
    const description = entity.domain === "automation" && action === "turn_off" ? msg("Its automatic actions will stop until you enable it again.")
      : entity.domain === "scene" ? msg("This applies the scene’s configured device changes in Home Assistant.")
      : entity.domain === "climate" && action === "hvac_mode" && value === "off" ? msg("Heating and cooling will stop until you turn it on again.")
      : entity.domain === "cover" && ["door", "garage", "gate"].includes(String(entity.attributes.device_class)) && action !== "stop_cover" ? msg("This moves a physical door or gate. Check that it is safe to move.")
      : "";
    if (description) {
      const title = entity.domain === "automation" ? msg("Disable {name}?", { name: entity.name })
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
  const toggle = ["light", "switch", "automation"].includes(entity.domain) && supports(entity.state === "on" ? "turn_off" : "turn_on");
  const status = !homeOnline ? t("Offline") : entityStateLabel(entity, language);
  const showState = !homeOnline || !available(entity) || (entity.domain !== "scene" && !(entity.domain === "cover" && supports("position") && position !== undefined && ["open", "closed"].includes(entity.state)));
  return <div className="control-stack command-controller" aria-busy={!!commands[entity.entityId]?.pending}>
    {toggle ? <div className="toggle-line"><span>{status}</span><Switch checked={entity.state === "on"} disabled={disabled} aria-label={t("Toggle {value1}", { value1: entity.name })} onCheckedChange={on => send(on ? "turn_on" : "turn_off")} /></div>
      : entity.domain === "climate" && homeOnline && available(entity) ? <div className="climate-reading"><strong>{currentTemperature === undefined ? "—" : number(currentTemperature)}<small>{currentHome.temperatureUnit}</small></strong><span>{t("Inside")}</span></div>
      : showState && <div className={entity.domain === "sensor" && homeOnline && available(entity) ? "sensor-reading" : "sensor-state"}>{status}{unit && homeOnline && available(entity) && <small> {unit}</small>}</div>}
    {supports("brightness") && <RangeControl label={t("Brightness")} name={entity.name} value={entity.state === "off" ? 0 : brightness === undefined ? undefined : Math.round(brightness * 100 / 255)} min={0} max={100} unit="%" disabled={disabled} commit={v => send("brightness", v)} />}
    {entity.domain === "climate" && <>
      {supports("temperature") && <RangeControl label={t("Target")} name={entity.name} value={temperature} min={numberValue(entity.attributes.min_temp)} max={numberValue(entity.attributes.max_temp)} step={numberValue(entity.attributes.target_temp_step) ?? 0.1} unit={currentHome.temperatureUnit ?? ""} disabled={disabled} commit={v => send("temperature", v)} />}
      {supports("hvac_mode") && <label className="device-mode"><span>{t("Mode")}</span><select aria-label={t("{name} mode", { name: entity.name })} value={entity.state} disabled={disabled} onChange={e => send("hvac_mode", e.target.value)}>{!stringValues(entity.attributes.hvac_modes).includes(entity.state) && <option value={entity.state}>{message(humanizeState(entity.state))}</option>}{stringValues(entity.attributes.hvac_modes).map(mode => <option key={mode} value={mode}>{message(humanizeState(mode))}</option>)}</select></label>}
    </>}
    {entity.domain === "cover" && <>
      {supports("position") && <RangeControl key={confirmation?.action === "position" ? "confirming" : "reported"} label={t("Open")} name={entity.name} value={position} min={0} max={100} unit="%" disabled={disabled} commit={v => send("position", v)} />}
      <div className="device-actions">{([{ action: "open_cover", label: t("Open"), Icon: ArrowUp }, { action: "stop_cover", label: t("Stop"), Icon: Square }, { action: "close_cover", label: t("Close"), Icon: ArrowDown }] as const).filter(({ action }) => supports(action)).map(({ action, label, Icon }) => <Button key={action} disabled={disabled} variant="outline" aria-label={`${label} ${entity.name}`} onClick={() => send(action)}><Icon size={16} aria-hidden="true" /><span>{label}</span></Button>)}</div>
    </>}
    {entity.domain === "lock" && <>
      <div className="device-actions">{(["lock", "unlock"] as const).filter(action => supports(action) && !(entity.state === "locked" && action === "lock") && !(entity.state === "unlocked" && action === "unlock")).map(action => <Button key={action} variant="outline" disabled={disabled || ["locking", "unlocking", "opening"].includes(entity.state)} aria-label={`${message(humanizeState(action))} ${entity.name}`} onClick={() => setLockAction(action)}>{action === "lock" ? <Lock size={16} /> : <Unlock size={16} />}{message(humanizeState(action))}</Button>)}</div>
      {lockAction && <PinPadModal open disabled={disabled || !supports(lockAction)} onOpenChange={open => { if (!open) setLockAction(undefined); }} title={`${message(humanizeState(lockAction))} ${entity.name}`} description={needsCode(entity, lockAction) ? t("Enter your code to continue.") : t("Confirm to continue.")} codeRequired={needsCode(entity, lockAction)} numeric={entity.attributes.code_format === "number"} onSubmit={code => command(entity.entityId, lockAction, undefined, code)} />}
    </>}
    {entity.domain === "scene" && supports("turn_on") && <Button disabled={disabled} variant="outline" aria-label={t("Activate {value1}", { value1: entity.name })} onClick={() => send("turn_on")}><Sparkles size={16} />{t("Activate")}</Button>}
    {entity.domain === "alarm_control_panel" && <Link className="text-link" to="/alarm">{t("Manage alarm")}</Link>}
    <CommandFeedback entityId={entity.entityId} />
    {confirmation && <ConfirmDialog open onOpenChange={open => { if (!open) setConfirmation(undefined); }} title={confirmation.title} description={confirmation.description} destructive={entity.domain === "automation" || entity.domain === "climate"} disabled={disabled || !supports(confirmation.action)} onConfirm={() => command(entity.entityId, confirmation.action, confirmation.value)} />}
  </div>;
}
