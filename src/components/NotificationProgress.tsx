import { useI18n } from "@/hooks/use-i18n";
import { notificationEntity, notificationProgress, progressNumber, progressSourceValue } from "@/lib/notifications";
import type { Entity } from "@/types/api";
import type { NotificationRule, NotificationProgress as ProgressSettings, NotificationProgressSource } from "../../shared/notifications";
import { EntityPicker } from "./EntityPicker";
import { Progress } from "./ui/progress";
import { Switch } from "./ui/switch";

export function NotificationProgress({ progress, entities, title }: { progress: ProgressSettings; entities: Entity[]; title: string }) {
  const { message: t, number } = useI18n();
  const value = notificationProgress(progress, entities);
  if (!value) return <p className="notification-progress-unavailable">{t("Progress unavailable. Check the numeric readings and range.")}</p>;
  const entity = notificationEntity(entities, progress.current.entity);
  const unit = !progress.current.attribute && typeof entity?.attributes.unit_of_measurement === "string" ? ` ${entity.attributes.unit_of_measurement}` : "";
  const percent = number(Math.round(value.percent));
  const reading = `${number(value.current)}${unit}`;
  return <div className="notification-progress">
    <div className="notification-progress-label"><span>{t("{value} now · {target} at completion", { value: reading, target: `${number(value.end)}${unit}` })}</span><strong>{percent}%</strong></div>
    <Progress value={value.percent} aria-label={t("Progress for {name}", { name: title })} aria-valuetext={t("{percent}% complete, current value {value}", { percent, value: reading })} className="h-2" />
  </div>;
}

function ProgressSourceField({ label, source, onChange, entities, disabled, current = false }: {
  label: string; source: NotificationProgressSource; onChange: (source: NotificationProgressSource) => void; entities: Entity[]; disabled: boolean; current?: boolean;
}) {
  const { message: t } = useI18n();
  return <fieldset className="notification-progress-field">
    <legend>{t(label)}</legend>
    {!current && <label>{t("Value source")}<select aria-label={t("{name}: value source", { name: t(label) })} value={source.type} disabled={disabled} onChange={event => onChange(event.target.value === "entity" ? { type: "entity", entity: "", attribute: "" } : { type: "value", value: label === "Start value" ? 0 : 100 })}>
      <option value="value">{t("Fixed value")}</option><option value="entity">{t("Entity")}</option>
    </select></label>}
    {source.type === "value" ? <label>{t("Value")}<input aria-label={t(label)} type="number" step="any" required disabled={disabled} value={Number.isFinite(source.value) ? source.value : ""} onChange={event => onChange({ type: "value", value: event.target.valueAsNumber })} /></label> : <>
      <EntityPicker label={t("{name}: entity", { name: t(label) })} entities={entities} value={source.entity} onChange={entity => onChange({ ...source, entity, attribute: "" })} disabled={disabled} />
      <label>{t("Attribute (optional)")}<input aria-label={t("{name}: attribute", { name: t(label) })} maxLength={100} disabled={disabled} value={source.attribute} placeholder={t("Leave empty to use the state")} onChange={event => onChange({ ...source, attribute: event.target.value })} /></label>
    </>}
  </fieldset>;
}

export function NotificationProgressSettings({ rule, onChange, entities, disabled }: { rule: NotificationRule; onChange: (progress?: ProgressSettings) => void; entities: Entity[]; disabled: boolean }) {
  const { message: t } = useI18n();
  const progress = rule.progress;
  const enable = () => {
    const trigger = rule.trigger;
    const sources = [
      ...(trigger.type === "state" ? [{ type: "entity" as const, entity: trigger.entity, attribute: trigger.attribute }] : []),
      ...rule.detailEntities.map(entity => ({ type: "entity" as const, entity, attribute: "" })),
    ];
    const current = sources.find(source => progressSourceValue(source, entities) !== undefined) ?? { type: "entity" as const, entity: "", attribute: "" };
    const end = trigger.type === "state" ? progressNumber(trigger.value) ?? 100 : 100;
    onChange({ current, start: { type: "value", value: end === 0 ? 100 : 0 }, end: { type: "value", value: end } });
  };
  return <>
    <div className="notification-toggle"><span>{t("Show progress bar")}</span><Switch aria-label={t("Show progress bar")} checked={!!progress} disabled={disabled} onCheckedChange={checked => checked ? enable() : onChange(undefined)} /></div>
    <p className="page-note">{t("Use a numeric state or attribute. The trigger still decides when the notification appears and clears.")}</p>
    {progress && <>
      <ProgressSourceField label="Current value" current source={progress.current} entities={entities} disabled={disabled} onChange={current => { if (current.type === "entity") onChange({ ...progress, current }); }} />
      <div className="notification-range">
        <ProgressSourceField label="Start value" source={progress.start} entities={entities} disabled={disabled} onChange={start => onChange({ ...progress, start })} />
        <ProgressSourceField label="End / total value" source={progress.end} entities={entities} disabled={disabled} onChange={end => onChange({ ...progress, end })} />
      </div>
      <p className="page-note">{t("Counting up: start at 0 and use the total as the end. Counting down: use the total as the start and finish at 0. Keep all values in the same unit.")}</p>
    </>}
  </>;
}
