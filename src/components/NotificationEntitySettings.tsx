import { ArrowUpRight, Link2, X } from "lucide-react";
import { EntityPicker } from "./EntityPicker";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { useI18n } from "@/hooks/use-i18n";
import { notificationEntity, notificationReadings } from "@/lib/notifications";
import type { Entity } from "@/types/api";
import type { NotificationEntityDisplay, NotificationRule } from "../../shared/notifications";

const placements = { auto: "Automatic placement", subtitle: "Under the title", left: "Left reading", right: "Right reading", footer: "At the bottom", hidden: "Hidden" } as const;

export function NotificationEntitySettings({ rule, entities, disabled, onChange, onEditUsage }: { rule: NotificationRule; entities: Entity[]; disabled: boolean; onChange: (value: Partial<NotificationRule>) => void; onEditUsage: (section: "trigger" | "progress" | "readings") => void }) {
  const { message: t } = useI18n();
  const readings = notificationReadings(rule);
  const update = (reading: NotificationEntityDisplay, change: Partial<NotificationEntityDisplay>) => {
    const keyMatches = (item: NotificationEntityDisplay) => item.entity === reading.entity && item.attribute === reading.attribute;
    const display = { entity: reading.entity, attribute: reading.attribute, name: reading.name, placement: reading.placement, ...rule.entityDisplay?.find(keyMatches), ...change };
    onChange({ entityDisplay: [...(rule.entityDisplay ?? []).filter(item => !keyMatches(item)), display] });
  };
  return <>
    <p className="page-note">{t("Choose a name and placement for each entity. These names only apply to this notification.")}</p>
    {rule.kind === "camera" && <EntityPicker label={t("Camera")} entities={entities.filter(entity => entity.domain === "camera")} value={rule.cameraEntity} disabled={disabled} onChange={cameraEntity => onChange({ cameraEntity })} />}
    <EntityPicker label={t("Add entity")} emptyActionLabel={t("Add entity")} hideLabel entities={entities} value="" disabled={disabled || rule.detailEntities.length >= 100}
      disabledReason={entity => rule.detailEntities.includes(entity.preferenceId) ? t("Already added to this notification") : undefined}
      onChange={entity => onChange({ detailEntities: [...rule.detailEntities, entity] })} />
    {rule.detailEntities.length >= 100 && <p className="page-note">{t("Choose up to 100 additional readings.")}</p>}
    {!readings.length && <p className="page-note">{t("Add an entity to choose its name and placement here.")}</p>}
    <div className="notification-entity-settings">{readings.map(reading => {
      const entity = notificationEntity(entities, reading.entity);
      const name = `${entity?.name ?? reading.entity.slice(reading.entity.indexOf("|") + 1)}${reading.attribute ? ` · ${reading.attribute}` : ""}`;
      const additional = reading.roles.includes("Additional reading");
      const inUse = reading.roles.some(role => role !== "Additional reading");
      return <fieldset key={JSON.stringify([reading.entity, reading.attribute])}>
        <legend className="sr-only">{name}</legend>
        <div className="notification-entity-heading">
          <div><strong>{name}</strong><p className="page-note">{reading.roles.map(role => t(role)).join(" · ")}</p></div>
          {additional && <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t("Remove additional reading {name}", { name })} title={inUse ? t("Removing the extra reading keeps its other uses.") : t("Remove additional reading {name}", { name })} onClick={() => onChange({ detailEntities: rule.detailEntities.filter(id => id !== reading.entity) })}><X size={16} aria-hidden="true" /></Button>}
        </div>
        {inUse && <div className="notification-entity-usage">
          <span className="notification-entity-in-use"><Link2 size={14} aria-hidden="true" />{t("In use")}</span>
          <p>{t(additional ? "Removing the extra reading keeps its other uses." : "Change its assignment before removing this entity.")}</p>
          <div className="notification-entity-shortcuts">
            {reading.roles.includes("Source entity") && <Button type="button" variant="link" onClick={() => onEditUsage("trigger")}>{t("Edit trigger")}<ArrowUpRight size={14} aria-hidden="true" /></Button>}
            {reading.roles.some(role => ["Current value", "Start value", "End / total value"].includes(role)) && <Button type="button" variant="link" onClick={() => onEditUsage("progress")}>{t("Edit progress")}<ArrowUpRight size={14} aria-hidden="true" /></Button>}
            {reading.roles.includes("Camera") && <Button type="button" variant="link" onClick={() => onEditUsage("readings")}>{t("Change camera")}<ArrowUpRight size={14} aria-hidden="true" /></Button>}
          </div>
        </div>}
        <div className="notification-range">
          <label>{t("Display name")}<input aria-label={t("{name}: display name", { name })} maxLength={100} placeholder={name} value={reading.name} disabled={disabled} onChange={event => update(reading, { name: event.target.value })} /></label>
          <label>{t("Placement")}<select aria-label={t("{name}: placement", { name })} value={reading.placement} disabled={disabled} onChange={event => update(reading, { placement: event.target.value as NotificationEntityDisplay["placement"] })}>
            {Object.entries(placements).map(([value, label]) => <option key={value} value={value}>{value === "auto" ? t("Automatic: {placement}", { placement: t(placements[reading.defaultPlacement]) }) : t(label)}</option>)}
          </select></label>
        </div>
        <label className="notification-toggle notification-entity-name-toggle"><span>{t("Show name in activity card")}</span><Switch aria-label={t("{name}: show name in activity card", { name })} checked={!reading.hideName} disabled={disabled} onCheckedChange={show => update(reading, { hideName: !show })} /></label>
        {reading.placement === "hidden" && inUse && <p className="page-note notification-entity-hidden-note">{t("Hidden in the notification. Its other uses stay active.")}</p>}
      </fieldset>;
    })}</div>
  </>;
}
