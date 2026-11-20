import { useI18n } from "@/hooks/use-i18n";
import { isNotificationTimeSource, notificationMinutesLeft, progressNumber } from "@/lib/notifications";
import type { Entity } from "@/types/api";
import type { ConfiguredCamera } from "../../shared/cameras";
import { MAX_WIDGET_SLOTS, type NotificationRule, type NotificationWidget, type NotificationWidgetSlot } from "../../shared/notifications";
import { EntityPicker } from "./EntityPicker";

function acceptsSource(slot: NotificationWidgetSlot, entity: Entity) {
  if (entity.attributes.mode === "password") return false;
  if (slot.type === "remaining") return isNotificationTimeSource(entity);
  if (slot.type !== "progress" || entity.preferenceId === slot.entity) return true;
  const unit = entity.attributes.unit_of_measurement;
  return unit === "%" || !unit && progressNumber(entity.state) !== undefined;
}

export function NotificationWidgetSettings({ rule, entities, cameras, disabled, onChange }: {
  rule: NotificationRule; entities: Entity[]; cameras: ConfiguredCamera[]; disabled: boolean; onChange: (value: NotificationWidget) => void;
}) {
  const { message: t } = useI18n();
  const widget = rule.widget ?? {};
  const update = (patch: Partial<NotificationWidget>) => onChange({ ...widget, ...patch });
  const setSlot = (index: number, next: NotificationWidgetSlot) => {
    const slots = Array.from({ length: MAX_WIDGET_SLOTS }, (_, i) => i === index ? next : widget.slots?.[i] ?? { type: "empty" as const });
    update({ slots });
  };
  const defaultSlots = (): NotificationWidgetSlot[] => {
    const slots: NotificationWidgetSlot[] = [];
    if (rule.progress) slots.push({ type: "progress" });
    if (rule.kind === "ongoing" && (rule.timeLeftEntity || notificationMinutesLeft(rule, entities, Date.now()) !== undefined)) slots.push({ type: "remaining" });
    return slots;
  };
  const media = widget.media;
  const cameraId = media && "cameraId" in media ? media.cameraId : "";
  const cameraChoices = media?.type === "person" ? cameras.filter(camera => camera.personSnapshot.type !== "none") : cameras;
  return <>
    <p className="page-note">{t("These settings apply only to the tile below the page title. Empty text fields use the notification defaults.")}</p>
    <label>{t("Widget title")}<input name="widget.title" maxLength={100} value={widget.title ?? ""} disabled={disabled} onChange={event => update({ title: event.target.value })} /></label>
    <label>{t("Widget short text")}<input name="widget.text" maxLength={100} value={widget.text ?? ""} disabled={disabled} onChange={event => update({ text: event.target.value })} /></label>
    <label>{t("Widget media")}<select name="widget.media.type" value={media?.type ?? "auto"} disabled={disabled} onChange={event => {
      const type = event.target.value;
      if (type === "live" || type === "person") update({ media: { type, cameraId: type === "live" || cameras.some(camera => camera.id === cameraId && camera.personSnapshot.type !== "none") ? cameraId : "" } });
      else if (type === "image") update({ media: { type, entity: "" } });
      else update({ media: type === "none" ? { type } : undefined });
    }}>
      <option value="auto">{t("Automatic")}</option><option value="none">{t("No media")}</option>
      <option value="live">{t("Live video")}</option><option value="person">{t("Person snapshot")}</option><option value="image">{t("Image")}</option>
    </select></label>
    {media && "cameraId" in media && <label>{t("Widget camera")}<select name="widget.media.cameraId" value={cameraId} disabled={disabled} onChange={event => update({ media: { ...media, cameraId: event.target.value } })}>
      <option value="">{t("Choose a camera")}</option>
      {cameraId && !cameraChoices.some(camera => camera.id === cameraId) && <option value={cameraId}>{t("Unavailable camera")}</option>}
      {cameraChoices.map(camera => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
    </select></label>}
    {media?.type === "image" && <EntityPicker label={t("Widget image")} name="widget.media.entity" entities={entities.filter(entity => entity.domain === "image")} value={media.entity} disabled={disabled} onChange={entity => update({ media: { type: "image", entity } })} />}
    <label>{t("Widget fields")}<select value={widget.slots ? "custom" : "auto"} disabled={disabled}
      onChange={event => update({ slots: event.target.value === "custom" ? defaultSlots() : undefined })}>
      <option value="auto">{t("Automatic")}</option><option value="custom">{t("Choose fields")}</option>
    </select></label>
    {widget.slots && <><p className="page-note">{t("Fields appear from left to right on one row.")}</p>
      {Array.from({ length: MAX_WIDGET_SLOTS }, (_, index) => {
        const slot = widget.slots[index] ?? { type: "empty" as const };
        const field = t("Field {number}", { number: index + 1 });
        const shared = slot.type === "progress" && !!rule.progress || slot.type === "remaining" && rule.kind === "ongoing";
        const sourceLabel = slot.type === "progress" ? "Percentage sensor" : slot.type === "remaining" ? "Time left sensor" : "Sensor";
        return <fieldset key={index} className="notification-progress-field notification-widget-field">
          <legend>{field}</legend>
          <label>{t("Field type")}<select aria-label={t("{field} · type", { field })} name={`widget.slots.${index}.type`} value={slot.type} disabled={disabled} onChange={event => {
            const type = event.target.value as NotificationWidgetSlot["type"];
            setSlot(index, type === "reading" ? { type, entity: "" } : { type });
          }}>
            <option value="empty">{t("Empty")}</option><option value="progress">{t("Progress bar")}</option>
            <option value="reading">{t("Reading or status")}</option><option value="remaining">{t("Time remaining")}</option>
          </select></label>
          {slot.type !== "empty" && <EntityPicker name={`widget.slots.${index}.entity`} label={t(sourceLabel)} ariaLabel={t("{field} · {source}", { field, source: t(sourceLabel) })}
            entities={entities.filter(entity => acceptsSource(slot, entity))}
            value={slot.entity ?? ""} disabled={disabled} placeholder={shared ? t("From notification") : undefined} clearLabel={shared ? t("From notification") : undefined}
            onChange={entity => setSlot(index, slot.type === "reading" ? { type: "reading", entity } : { type: slot.type, entity: entity || undefined })} />}
        </fieldset>;
      })}</>}
  </>;
}
