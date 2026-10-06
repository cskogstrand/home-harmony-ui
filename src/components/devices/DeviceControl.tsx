import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Entity, EntityAction } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { available, needsCode, numberValue, stringValues, supportsAction } from "@/lib/ha-model";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PinPadModal } from "./PinPadModal";
import { Lock, Lightbulb, Thermometer, Plug, Radio, Blinds, Shield, Sparkles } from "lucide-react";

export function DeviceIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ({ light: Lightbulb, climate: Thermometer, lock: Lock, switch: Plug, cover: Blinds, alarm_control_panel: Shield, scene: Sparkles })[type] ?? Radio;
  return <Icon className={className} />;
}
export function CommandFeedback({ entityId }: { entityId: string }) {
  const { commands } = useApp();
  const command = commands[entityId];
  return command?.error ? <p role="alert" className="text-sm text-destructive">{command.error}</p> : command ? <p role="status" className="text-xs text-muted-foreground">{command.pending ? "Sending…" : command.message}</p> : null;
}
function RangeControl({ label, value, min, max, step = 1, disabled, commit }: { label: string; value: number; min: number; max: number; step?: number; disabled: boolean; commit: (value: number) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value, disabled]);
  return <label className="device-range"><span>{label}<strong>{draft}</strong></span><Slider aria-label={label} min={min} max={max} step={step} value={[draft]} disabled={disabled} onValueChange={([v]) => setDraft(v)} onValueCommit={([v]) => commit(v)} /></label>;
}
export function DeviceControl({ entity, compact = false }: { entity: Entity; compact?: boolean }) {
  const { homeOnline, command, commands, services, currentHome } = useApp();
  const [lockAction, setLockAction] = useState<"lock" | "unlock">();
  const disabled = !homeOnline || !available(entity) || !!commands[entity.entityId]?.pending;
  const supports = (action: EntityAction) => supportsAction(entity, action, services);
  const send = (action: EntityAction, value?: unknown) => { void command(entity.entityId, action, value).catch(() => {}); };
  const unit = typeof entity.attributes.unit_of_measurement === "string" ? entity.attributes.unit_of_measurement : "";
  const brightness = numberValue(entity.attributes.brightness);
  const temperature = numberValue(entity.attributes.temperature);
  const position = numberValue(entity.attributes.current_position);
  return <div className="control-stack">
    <span className="sensor-state">{!homeOnline && "Stale · "}{entity.state.replace(/_/g, " ")}{unit && ` ${unit}`}</span>
    {["on", "off"].includes(entity.state) && ["light", "switch", "automation"].includes(entity.domain) && supports(entity.state === "on" ? "turn_off" : "turn_on") && <div className="toggle-line"><span>{entity.domain === "automation" ? "Enabled" : "Power"}</span><Switch checked={entity.state === "on"} disabled={disabled} aria-label={`Toggle ${entity.name}`} onCheckedChange={on => send(on ? "turn_on" : "turn_off")} /></div>}
    {supports("brightness") && !compact && brightness !== undefined && <RangeControl label={`${entity.name} brightness (%)`} value={Math.round(brightness * 100 / 255)} min={0} max={100} disabled={disabled} commit={v => send("brightness", v)} />}
    {entity.domain === "climate" && <>
      <small>Current: {numberValue(entity.attributes.current_temperature) ?? "Not reported"} {currentHome.temperatureUnit} · Target: {temperature ?? "Not reported"} {currentHome.temperatureUnit}</small>
      {supports("temperature") && temperature !== undefined && <RangeControl label={`${entity.name} target temperature (${currentHome.temperatureUnit ?? "HA units"})`} value={temperature} min={numberValue(entity.attributes.min_temp)} max={numberValue(entity.attributes.max_temp)} step={numberValue(entity.attributes.target_temp_step) ?? 0.1} disabled={disabled} commit={v => send("temperature", v)} />}
      {supports("hvac_mode") && <label>Mode <select aria-label={`${entity.name} mode`} className="rounded border bg-background p-2" value={entity.state} disabled={disabled} onChange={e => send("hvac_mode", e.target.value)}>{!stringValues(entity.attributes.hvac_modes).includes(entity.state) && <option value={entity.state}>{entity.state}</option>}{stringValues(entity.attributes.hvac_modes).map(mode => <option key={mode}>{mode}</option>)}</select></label>}
    </>}
    {entity.domain === "cover" && <>
      <div className="flex gap-2">{(["open_cover", "close_cover", "stop_cover"] as const).filter(supports).map(action => <Button key={action} disabled={disabled} variant="outline" onClick={() => send(action)}>{action.split("_")[0]}</Button>)}</div>
      {!compact && supports("position") && position !== undefined && <RangeControl label={`${entity.name} position (%)`} value={position} min={0} max={100} disabled={disabled} commit={v => send("position", v)} />}
    </>}
    {entity.domain === "lock" && <>
      <div className="flex gap-2">{(["lock", "unlock"] as const).filter(supports).map(action => <Button key={action} variant="outline" disabled={disabled || ["locking", "unlocking", "opening"].includes(entity.state)} aria-label={`${action === "lock" ? "Lock" : "Unlock"} ${entity.name}`} onClick={() => setLockAction(action)}>{action === "lock" ? "Lock" : "Unlock"}</Button>)}</div>
      {lockAction && <PinPadModal open disabled={disabled} onOpenChange={open => { if (!open) setLockAction(undefined); }} title={`${lockAction === "lock" ? "Lock" : "Unlock"} ${entity.name}`} description="Send this action to Home Assistant. Check the reported state after sending." codeRequired={needsCode(entity, lockAction)} numeric={entity.attributes.code_format === "number"} onSubmit={code => command(entity.entityId, lockAction, undefined, code)} />}
    </>}
    {entity.domain === "scene" && supports("turn_on") && <Button disabled={disabled} onClick={() => send("turn_on")}>Activate {entity.name}</Button>}
    {entity.domain === "alarm_control_panel" && <Link className="text-link" to="/alarm">Open alarm controls</Link>}
    <CommandFeedback entityId={entity.entityId} />
  </div>;
}
