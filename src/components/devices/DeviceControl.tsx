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
  const { commands } = useApp();
  const command = commands[entityId];
  return command?.error ? <p role="alert" className="text-sm text-destructive">{command.error}</p> : command?.pending ? <span role="status" className="command-spinner"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /><span className="sr-only">Command in progress</span></span> : null;
}
function RangeControl({ label, name, value, min, max, step = 1, unit = "", disabled, commit }: { label: string; name: string; value?: number; min: number; max: number; step?: number; unit?: string; disabled: boolean; commit: (value: number) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value, disabled]);
  const shown = draft === undefined ? "—" : `${draft}${unit}`;
  return <div className="device-range"><span>{label}<strong>{shown}</strong></span><Slider className="h-11" aria-label={`${name} ${label.toLowerCase()}`} aria-valuetext={draft === undefined ? "Not reported" : shown} min={min} max={max} step={step} value={[Math.min(max, Math.max(min, draft ?? min))]} disabled={disabled} onValueChange={([v]) => setDraft(v)} onValueCommit={([v]) => commit(v)} /></div>;
}
export function DeviceControl({ entity }: { entity: Entity }) {
  const { homeOnline, command, commands, services, currentHome } = useApp();
  const [lockAction, setLockAction] = useState<"lock" | "unlock">();
  const [confirmation, setConfirmation] = useState<{ action: EntityAction; value?: unknown; title: string; description: string }>();
  const disabled = !homeOnline || !available(entity) || !!commands[entity.entityId]?.pending;
  const supports = (action: EntityAction) => supportsAction(entity, action, services);
  const send = (action: EntityAction, value?: unknown) => {
    const description = entity.domain === "automation" && action === "turn_off" ? "Its automatic actions will stop until you enable it again."
      : entity.domain === "scene" ? "This applies the scene’s configured device changes in Home Assistant."
      : entity.domain === "climate" && action === "hvac_mode" && value === "off" ? "Heating and cooling will stop until you turn it on again."
      : entity.domain === "cover" && ["door", "garage", "gate"].includes(String(entity.attributes.device_class)) && action !== "stop_cover" ? "This moves a physical door or gate. Check that it is safe to move."
      : "";
    if (description) {
      setConfirmation({ action, value, title: `${entity.domain === "automation" ? "Disable" : entity.domain === "scene" ? "Activate" : entity.domain === "climate" ? "Turn off" : action === "position" ? `Set position to ${value}% for` : action === "open_cover" ? "Open" : "Close"} ${entity.name}?`, description });
    } else void command(entity.entityId, action, value).catch(() => {});
  };
  const unit = typeof entity.attributes.unit_of_measurement === "string" ? entity.attributes.unit_of_measurement : "";
  const brightness = numberValue(entity.attributes.brightness);
  const temperature = numberValue(entity.attributes.temperature);
  const currentTemperature = numberValue(entity.attributes.current_temperature);
  const position = numberValue(entity.attributes.current_position);
  const toggle = ["light", "switch", "automation"].includes(entity.domain) && supports(entity.state === "on" ? "turn_off" : "turn_on");
  const status = !homeOnline ? "Offline" : entityStateLabel(entity);
  const showState = !homeOnline || !available(entity) || (entity.domain !== "scene" && !(entity.domain === "cover" && supports("position") && position !== undefined && ["open", "closed"].includes(entity.state)));
  return <div className="control-stack command-controller" aria-busy={!!commands[entity.entityId]?.pending}>
    {toggle ? <div className="toggle-line"><span>{status}</span><Switch checked={entity.state === "on"} disabled={disabled} aria-label={`Toggle ${entity.name}`} onCheckedChange={on => send(on ? "turn_on" : "turn_off")} /></div>
      : entity.domain === "climate" && homeOnline && available(entity) ? <div className="climate-reading"><strong>{currentTemperature ?? "—"}<small>{currentHome.temperatureUnit}</small></strong><span>Inside</span></div>
      : showState && <div className={entity.domain === "sensor" && homeOnline && available(entity) ? "sensor-reading" : "sensor-state"}>{status}{unit && homeOnline && available(entity) && <small> {unit}</small>}</div>}
    {supports("brightness") && <RangeControl label="Brightness" name={entity.name} value={entity.state === "off" ? 0 : brightness === undefined ? undefined : Math.round(brightness * 100 / 255)} min={0} max={100} unit="%" disabled={disabled} commit={v => send("brightness", v)} />}
    {entity.domain === "climate" && <>
      {supports("temperature") && <RangeControl label="Target" name={entity.name} value={temperature} min={numberValue(entity.attributes.min_temp)} max={numberValue(entity.attributes.max_temp)} step={numberValue(entity.attributes.target_temp_step) ?? 0.1} unit={currentHome.temperatureUnit ?? ""} disabled={disabled} commit={v => send("temperature", v)} />}
      {supports("hvac_mode") && <label className="device-mode"><span>Mode</span><select aria-label={`${entity.name} mode`} value={entity.state} disabled={disabled} onChange={e => send("hvac_mode", e.target.value)}>{!stringValues(entity.attributes.hvac_modes).includes(entity.state) && <option value={entity.state}>{humanizeState(entity.state)}</option>}{stringValues(entity.attributes.hvac_modes).map(mode => <option key={mode} value={mode}>{humanizeState(mode)}</option>)}</select></label>}
    </>}
    {entity.domain === "cover" && <>
      {supports("position") && <RangeControl key={confirmation?.action === "position" ? "confirming" : "reported"} label="Open" name={entity.name} value={position} min={0} max={100} unit="%" disabled={disabled} commit={v => send("position", v)} />}
      <div className="device-actions">{([{ action: "open_cover", label: "Open", Icon: ArrowUp }, { action: "stop_cover", label: "Stop", Icon: Square }, { action: "close_cover", label: "Close", Icon: ArrowDown }] as const).filter(({ action }) => supports(action)).map(({ action, label, Icon }) => <Button key={action} disabled={disabled} variant="outline" aria-label={`${label} ${entity.name}`} onClick={() => send(action)}><Icon size={16} aria-hidden="true" /><span>{label}</span></Button>)}</div>
    </>}
    {entity.domain === "lock" && <>
      <div className="device-actions">{(["lock", "unlock"] as const).filter(action => supports(action) && !(entity.state === "locked" && action === "lock") && !(entity.state === "unlocked" && action === "unlock")).map(action => <Button key={action} variant="outline" disabled={disabled || ["locking", "unlocking", "opening"].includes(entity.state)} aria-label={`${humanizeState(action)} ${entity.name}`} onClick={() => setLockAction(action)}>{action === "lock" ? <Lock size={16} /> : <Unlock size={16} />}{humanizeState(action)}</Button>)}</div>
      {lockAction && <PinPadModal open disabled={disabled || !supports(lockAction)} onOpenChange={open => { if (!open) setLockAction(undefined); }} title={`${humanizeState(lockAction)} ${entity.name}`} description={needsCode(entity, lockAction) ? "Enter your code to continue." : "Confirm to continue."} codeRequired={needsCode(entity, lockAction)} numeric={entity.attributes.code_format === "number"} onSubmit={code => command(entity.entityId, lockAction, undefined, code)} />}
    </>}
    {entity.domain === "scene" && supports("turn_on") && <Button disabled={disabled} variant="outline" aria-label={`Activate ${entity.name}`} onClick={() => send("turn_on")}><Sparkles size={16} />Activate</Button>}
    {entity.domain === "alarm_control_panel" && <Link className="text-link" to="/alarm">Manage alarm</Link>}
    <CommandFeedback entityId={entity.entityId} />
    {confirmation && <ConfirmDialog open onOpenChange={open => { if (!open) setConfirmation(undefined); }} title={confirmation.title} description={confirmation.description} destructive={entity.domain === "automation" || entity.domain === "climate"} disabled={disabled || !supports(confirmation.action)} onConfirm={() => command(entity.entityId, confirmation.action, confirmation.value)} />}
  </div>;
}
