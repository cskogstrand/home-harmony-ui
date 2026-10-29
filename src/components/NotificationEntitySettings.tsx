import { X } from "lucide-react";
import { EntityPicker } from "./EntityPicker";
import { Button } from "./ui/button";
import { useI18n } from "@/hooks/use-i18n";
import { notificationEntity, notificationReadings } from "@/lib/notifications";
import type { Entity } from "@/types/api";
import type { NotificationEntityDisplay, NotificationRule } from "../../shared/notifications";

const placements = { auto: "Automatic placement", subtitle: "Under the title", left: "Left reading", right: "Right reading", footer: "At the bottom", hidden: "Hidden" } as const;

export function NotificationEntitySettings({ rule, entities, disabled, onChange }: { rule: NotificationRule; entities: Entity[]; disabled: boolean; onChange: (value: Partial<NotificationRule>) => void }) {
  const { message: t } = useI18n();
  const readings = notificationReadings(rule);
  const update = (reading: NotificationEntityDisplay, change: Partial<NotificationEntityDisplay>) => {
    const keyMatches = (item: NotificationEntityDisplay) => item.entity === reading.entity && item.attribute === reading.attribute;
    const display = { entity: reading.entity, attribute: reading.attribute, name: reading.name, placement: reading.placement, ...change };
    onChange({ entityDisplay: [...(rule.entityDisplay ?? []).filter(item => !keyMatches(item)), display] });
  };
  return <>
    <p className="page-note">{t("Names only change this notification. Place readings under the title, in either column, at the bottom, or hide them. Hidden readings still work as triggers and progress sources.")}</p>
    {rule.kind === "camera" && <EntityPicker label={t("Camera")} entities={entities.filter(entity => entity.domain === "camera")} value={rule.cameraEntity} disabled={disabled} onChange={cameraEntity => onChange({ cameraEntity })} />}
    {!readings.length && <p className="page-note">{t("Add an entity to choose its name and placement here.")}</p>}
    <div className="notification-entity-settings">{readings.map(reading => {
      const entity = notificationEntity(entities, reading.entity);
      const name = `${entity?.name ?? reading.entity.slice(reading.entity.indexOf("|") + 1)}${reading.attribute ? ` · ${reading.attribute}` : ""}`;
      return <fieldset key={JSON.stringify([reading.entity, reading.attribute])}>
        <legend>{name}</legend>
        <div className="notification-entity-heading"><p className="page-note">{reading.roles.map(role => t(role)).join(" · ")}</p>
          {reading.roles.includes("Additional reading") && <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t("Remove additional reading {name}", { name })} onClick={() => onChange({ detailEntities: rule.detailEntities.filter(id => id !== reading.entity) })}><X size={16} aria-hidden="true" /></Button>}
        </div>
        <div className="notification-range">
          <label>{t("Display name")}<input aria-label={t("{name}: display name", { name })} maxLength={100} placeholder={name} value={reading.name} disabled={disabled} onChange={event => update(reading, { name: event.target.value })} /></label>
          <label>{t("Placement")}<select aria-label={t("{name}: placement", { name })} value={reading.placement} disabled={disabled} onChange={event => update(reading, { placement: event.target.value as NotificationEntityDisplay["placement"] })}>
            {Object.entries(placements).map(([value, label]) => <option key={value} value={value}>{value === "auto" ? t("Automatic: {placement}", { placement: t(placements[reading.defaultPlacement]) }) : t(label)}</option>)}
          </select></label>
        </div>
      </fieldset>;
    })}</div>
    <EntityPicker label={t("Add entity")} emptyActionLabel={t("Add entity")} hideLabel entities={entities} value="" disabled={disabled || rule.detailEntities.length >= 100}
      disabledReason={entity => rule.detailEntities.includes(entity.preferenceId) ? t("Already added to this notification") : undefined}
      onChange={entity => onChange({ detailEntities: [...rule.detailEntities, entity] })} />
    {rule.detailEntities.length >= 100 && <p className="page-note">{t("Choose up to 100 additional readings.")}</p>}
  </>;
}
