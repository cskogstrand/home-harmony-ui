import { useContext, useState } from "react";
import type { AlarmAction, Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { alarmModes, needsCode, supportsAction } from "@/lib/ha-model";
import { Action, More } from "./CardControls";
import { CardDisabled } from "./card-presentation";
import { PinPadModal } from "./PinPadModal";

export function AlarmCardControls({ entity }: { entity: Entity }) {
  const { t, message } = useI18n();
  const { services, command } = useApp();
  const disabled = useContext(CardDisabled);
  const [selected, setSelected] = useState<AlarmAction>(), [action, setAction] = useState<AlarmAction>();
  const modes = alarmModes.filter(mode => mode.action !== "alarm_trigger" && supportsAction(entity, mode.action, services));
  const mode = modes.find(mode => mode.action === selected) ?? modes[0];
  const disarm = entity.state !== "disarmed" && supportsAction(entity, "alarm_disarm", services);
  return <>
    {!disarm && mode && <label className="dg-choice"><span>{t("Arm mode")}</span><select disabled={disabled} value={mode.action} onChange={event => setSelected(event.target.value as AlarmAction)}>{modes.map(mode => <option key={mode.action} value={mode.action}>{message(mode.label)}</option>)}</select></label>}
    {(disarm || mode) && <Action primary onClick={() => setAction(disarm ? "alarm_disarm" : mode.action)}>{t(disarm ? "Disarm" : "Arm alarm")}</Action>}
    {supportsAction(entity, "alarm_trigger", services) && <More><Action onClick={() => setAction("alarm_trigger")}>{t("Trigger")}</Action></More>}
    {action && <PinPadModal key={`${entity.entityId}:${action}`} open onOpenChange={open => { if (!open) setAction(undefined); }}
      title={`${action === "alarm_disarm" ? t("Disarm") : message(alarmModes.find(mode => mode.action === action)?.label)} · ${entity.name}`}
      description={needsCode(entity, action) ? t("Enter your alarm code to continue.") : t("Confirm to continue.")} codeRequired={needsCode(entity, action)} numeric={entity.attributes.code_format === "number"}
      disabled={disabled || !supportsAction(entity, action, services)} onSubmit={code => command(entity.entityId, action, undefined, code)} />}
  </>;
}
