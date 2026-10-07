import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { available, alarmModes, entityStateLabel, needsCode, supportsAction } from "@/lib/ha-model";
import type { AlarmAction } from "@/types/api";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { PinPadModal } from "@/components/devices/PinPadModal";
import { CommandFeedback } from "@/components/devices/DeviceControl";
export default function Alarm() {
  const { currentHome, homeOnline, services, commands, command, haUrl } = useApp();
  const [selected, setSelected] = useState(() => { try { return localStorage.getItem("home-harmony:alarm") ?? ""; } catch { return ""; } });
  const [action, setAction] = useState<AlarmAction>();
  const alarms = currentHome.entities.filter(e => e.domain === "alarm_control_panel");
  const alarm = alarms.find(e => e.preferenceId === selected) ?? alarms[0];
  return <div className="planner-page"><PageHeading eyebrow="HOME SECURITY" title="Alarm" />
    {!alarm ? <section className="glow-panel empty-note"><h2>No alarm connected</h2><p>Add your alarm in Home Assistant to see it here.</p>{haUrl && <a className="text-link" href={haUrl} target="_blank" rel="noreferrer">Open Home Assistant</a>}</section> : <section className="glow-panel">
      {alarms.length > 1 && <label>Alarm <select aria-label="Select alarm" className="rounded border bg-background p-2" value={alarm.preferenceId} onChange={e => { setAction(undefined); setSelected(e.target.value); try { localStorage.setItem("home-harmony:alarm", e.target.value); } catch { /* Selection remains in memory. */ } }}>{alarms.map(e => <option key={e.entityId} value={e.preferenceId}>{e.name}</option>)}</select></label>}
      <PanelHeading title={alarm.name} /><p role="status" className="text-lg font-semibold">{homeOnline ? entityStateLabel(alarm) : "Offline"}</p><p className="page-note">{alarm.lastChanged ? `Last changed: ${new Date(alarm.lastChanged).toLocaleString()}` : "No state reported"}</p>
      <div className="command-controller" aria-busy={!!commands[alarm.entityId]?.pending}><div className="flex flex-wrap gap-3">{[{ action: "alarm_disarm" as const, label: "Disarm" }, ...alarmModes].filter(mode => supportsAction(alarm, mode.action, services)).map(mode => <Button key={mode.action} variant={mode.action === "alarm_trigger" ? "destructive" : "outline"} disabled={!homeOnline || !available(alarm) || commands[alarm.entityId]?.pending} onClick={() => setAction(mode.action)}>{mode.label}</Button>)}</div>
      <CommandFeedback entityId={alarm.entityId} /></div>
      {action && <PinPadModal disabled={!homeOnline || !available(alarm)} key={`${alarm.entityId}:${action}`} open onOpenChange={open => { if (!open) setAction(undefined); }} title={`${action === "alarm_disarm" ? "Disarm" : alarmModes.find(mode => mode.action === action)?.label} · ${alarm.name}`} description={needsCode(alarm, action) ? "Enter your alarm code to continue." : "Confirm to continue."} codeRequired={needsCode(alarm, action)} numeric={alarm.attributes.code_format === "number"} onSubmit={code => command(alarm.entityId, action, undefined, code)} />}
    </section>}
  </div>;
}
