import { useI18n } from "@/hooks/use-i18n";
import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { available, alarmModes, entityStateLabel, needsCode, supportsAction } from "@/lib/ha-model";
import type { AlarmAction } from "@/types/api";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { PinPadModal } from "@/components/devices/PinPadModal";
import { CommandFeedback } from "@/components/devices/DeviceControl";
export default function Alarm() {
  const { t, message, language, locale } = useI18n();
  const { currentHome, homeOnline, services, commands, command, haUrl } = useApp();
  const { selectedAlarm: selected, setSelectedAlarm } = useFamily();
  const [action, setAction] = useState<AlarmAction>();
  const alarms = currentHome.entities.filter(e => e.domain === "alarm_control_panel");
  const alarm = alarms.find(e => e.preferenceId === selected) ?? alarms[0];
  useEffect(() => { setAction(undefined); }, [alarm?.entityId]);
  return <div className="planner-page"><PageHeading eyebrow={t("HOME SECURITY")} title={t("Alarm")} />
    {!alarm ? <section className="glow-panel empty-note"><h2>{t("No alarm connected")}</h2>{haUrl && <a className="text-link" href={haUrl} target="_blank" rel="noreferrer">{t("Open Home Assistant")}</a>}</section> : <section className="glow-panel">
      {alarms.length > 1 && <label>{t("Alarm ")}<select aria-label={t("Select alarm")} className="rounded border bg-background p-2" value={alarm.preferenceId} onChange={e => { setAction(undefined); setSelectedAlarm(e.target.value); }}>{alarms.map(e => <option key={e.entityId} value={e.preferenceId}>{e.name}</option>)}</select></label>}
      <PanelHeading title={alarm.name} /><p role="status" className="text-lg font-semibold">{homeOnline ? entityStateLabel(alarm, language) : t("Offline")}</p><p className="page-note">{alarm.lastChanged ? t("Last changed: {value1}", { value1: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: currentHome.timeZone }).format(new Date(alarm.lastChanged)) }) : t("No state reported")}</p>
      <div className="command-controller" aria-busy={!!commands[alarm.entityId]?.pending}><div className="flex flex-wrap gap-3">{[{ action: "alarm_disarm" as const, label: t("Disarm") }, ...alarmModes].filter(mode => supportsAction(alarm, mode.action, services)).map(mode => <Button key={mode.action} variant={mode.action === "alarm_trigger" ? "destructive" : "outline"} disabled={!homeOnline || !available(alarm) || commands[alarm.entityId]?.pending} onClick={() => setAction(mode.action)}>{message(mode.label)}</Button>)}</div>
      <CommandFeedback entityId={alarm.entityId} /></div>
      {action && <PinPadModal disabled={!homeOnline || !available(alarm) || !!commands[alarm.entityId]?.pending || !supportsAction(alarm, action, services)} key={`${alarm.entityId}:${action}`} open onOpenChange={open => { if (!open) setAction(undefined); }} title={`${action === "alarm_disarm" ? t("Disarm") : message(alarmModes.find(mode => mode.action === action)?.label ?? "")} · ${alarm.name}`} description={needsCode(alarm, action) ? t("Enter your alarm code to continue.") : t("Confirm to continue.")} codeRequired={needsCode(alarm, action)} numeric={alarm.attributes.code_format === "number"} onSubmit={code => command(alarm.entityId, action, undefined, code)} />}
    </section>}
  </div>;
}
