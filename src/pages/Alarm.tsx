import { PanelTitle } from "@/components/PanelTitle";
import { Shield, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { available, alarmModes, entityStateLabel, needsCode, supportsAction } from "@/lib/ha-model";
import { alarmStateAction } from "@/lib/alarm-actions";
import type { AlarmAction } from "@/types/api";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { PinPadModal } from "@/components/devices/PinPadModal";
import { CommandFeedback } from "@/components/devices/DeviceControl";
import { EntityPicker } from "@/components/EntityPicker";
import "@/components/devices/device-cards.css";
import "./alarm.css";

const blockedReasons = {
  offline: "Home Assistant is offline.",
  unavailable: "This alarm is unavailable.",
  pending: "Waiting for the alarm to respond.",
  current: "The alarm is already in this state.",
} as const;

export default function Alarm() {
  const { t, message, language, locale } = useI18n();
  const { currentHome, homeOnline, services, commands, command, haUrl } = useApp();
  const { selectedAlarm: selected, setSelectedAlarm } = useFamily();
  const [action, setAction] = useState<AlarmAction>();
  const id = useId();
  const alarms = currentHome.entities.filter(e => e.domain === "alarm_control_panel");
  const alarm = alarms.find(e => e.preferenceId === selected) ?? alarms[0];
  useEffect(() => { setAction(undefined); }, [alarm?.entityId]);
  if (!alarm) return <div className="planner-page"><PageHeading title={t("Alarm")} />
    <section className="glow-panel empty-note"><PanelTitle icon={Shield}>{t("No alarm connected")}</PanelTitle>{haUrl && <a className="text-link" href={haUrl} target="_blank" rel="noreferrer">{t("Open Home Assistant")}</a>}</section>
  </div>;
  const pending = !!commands[alarm.entityId]?.pending;
  const reported = homeOnline && available(alarm);
  const current = reported ? alarmStateAction(alarm.state) : undefined;
  const armed = reported && alarm.state.startsWith("armed_");
  const alert = reported && ["triggered", "pending"].includes(alarm.state);
  const StateIcon = !reported ? Shield : alert ? ShieldAlert : armed ? ShieldCheck : alarm.state === "disarmed" ? ShieldOff : Shield;
  const since = alarm.lastChanged && new Date(alarm.lastChanged);
  const supported = (action: AlarmAction) => supportsAction(alarm, action, services);
  const arm = alarmModes.filter(mode => mode.action !== "alarm_trigger" && supported(mode.action));
  // The expected next step is the primary action: disarm whenever the panel is not disarmed, otherwise the first arm mode.
  const primary: AlarmAction | undefined = alarm.state !== "disarmed" && supported("alarm_disarm") ? "alarm_disarm" : arm.find(mode => mode.action !== current)?.action;
  const blocked = (action: AlarmAction) => !homeOnline ? "offline" : !available(alarm) ? "unavailable" : pending ? "pending" : action === current ? "current" : undefined;
  const actionButton = (action: AlarmAction, label: string, emergency = false) => {
    const reason = blocked(action);
    return <Button key={action} className={`alarm-action${emergency ? " is-emergency" : ""}`} variant={action === primary ? "default" : "outline"}
      disabled={!!reason} aria-describedby={reason ? `${id}-${reason}` : undefined} onClick={() => setAction(action)}>{label}</Button>;
  };
  const group = (key: string, title: string, children: ReactNode, emergency = false) => <div className={`alarm-action-group${emergency ? " is-emergency" : ""}`} role="group" aria-labelledby={`${id}-${key}`}>
    <h3 id={`${id}-${key}`}>{title}</h3><div>{children}</div>
  </div>;
  return <div className="planner-page"><PageHeading title={t("Alarm")} />
    <section className="glow-panel alarm-panel">
      {alarms.length > 1 && <EntityPicker label={t("Select alarm")} entities={alarms} value={alarm.preferenceId} onChange={value => { setAction(undefined); setSelectedAlarm(value); }} />}
      <PanelHeading icon={Shield} title={alarm.name} />
      <div className="device-card-designs alarm-status" role="status" aria-labelledby={`${id}-state`}>
        <div className={`dg-security-emblem${armed ? " is-secure" : ""}${alert ? " is-alert" : ""}`}><StateIcon strokeWidth={1.4} aria-hidden="true" /></div>
        <p className="alarm-status-label" id={`${id}-state`}>{t("Current state")}</p>
        <div className="dg-readout"><strong>{homeOnline ? entityStateLabel(alarm, language) : t("Offline")}</strong>
          <span>{!reported ? "" : since && Number.isFinite(since.getTime())
            ? t("Since {time}", { time: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: currentHome.timeZone }).format(since) })
            : t("No state reported")}</span></div>
      </div>
      <div className="command-controller alarm-actions" aria-busy={pending} role="group" aria-label={t("Alarm actions")}>
        {supported("alarm_disarm") && group("disarm", t("Turn off the alarm"), actionButton("alarm_disarm", t("Disarm")))}
        {!!arm.length && group("arm", t("Turn on the alarm"), arm.map(mode => actionButton(mode.action, message(mode.label))))}
        {supported("alarm_trigger") && group("emergency", t("Emergency"), actionButton("alarm_trigger", t("Trigger"), true), true)}
        {Object.entries(blockedReasons).map(([key, reason]) => <span key={key} id={`${id}-${key}`} hidden>{t(reason)}</span>)}
        <CommandFeedback entityId={alarm.entityId} />
      </div>
      {action && <PinPadModal disabled={!homeOnline || !available(alarm) || pending || !supported(action)} key={`${alarm.entityId}:${action}`} open onOpenChange={open => { if (!open) setAction(undefined); }} title={`${action === "alarm_disarm" ? t("Disarm") : message(alarmModes.find(mode => mode.action === action)?.label ?? "")} · ${alarm.name}`} description={needsCode(alarm, action) ? t("Enter your alarm code to continue.") : t("Confirm to continue.")} codeRequired={needsCode(alarm, action)} numeric={alarm.attributes.code_format === "number"} onSubmit={code => command(alarm.entityId, action, undefined, code)} />}
    </section>
  </div>;
}
