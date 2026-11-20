import { useI18n } from "@/hooks/use-i18n";
import type { Entity } from "@/types/api";
import type { ConfiguredCamera } from "../../shared/cameras";
import { MAX_WIDGET_READINGS, type NotificationWidget } from "../../shared/notifications";
import { EntityPicker } from "./EntityPicker";
import { Switch } from "./ui/switch";

export function NotificationWidgetSettings({ widget = {}, entities, cameras, disabled, onChange }: {
  widget?: NotificationWidget; entities: Entity[]; cameras: ConfiguredCamera[]; disabled: boolean; onChange: (value: NotificationWidget) => void;
}) {
  const { message: t } = useI18n();
  const update = (patch: Partial<NotificationWidget>) => onChange({ ...widget, ...patch });
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
    <label className="notification-toggle"><span>{t("Choose widget readings")}</span><Switch checked={widget.readings !== undefined} disabled={disabled} onCheckedChange={custom => update({ readings: custom ? [] : undefined })} /></label>
    {widget.readings && <><EntityPicker multiple label={t("Widget readings")} name="widget.readings" entities={entities.filter(entity => entity.attributes.mode !== "password")}
      value={widget.readings} disabled={disabled} onChange={readings => update({ readings })}
      disabledReason={entity => widget.readings.length >= MAX_WIDGET_READINGS && !widget.readings.includes(entity.preferenceId) ? t("Choose up to two readings.") : undefined} />
      <p className="page-note">{t("Select up to two readings. Leave the selection empty to hide readings on the widget.")}</p></>}
  </>;
}
