import { useState } from "react";
import { Link } from "react-router-dom";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { notificationEntity } from "@/lib/notifications";
import type { Entity } from "@/types/api";
import type { NotificationRule } from "../../shared/notifications";
import { EntityPicker } from "./EntityPicker";
import { Button } from "./ui/button";
import { MediaSurface } from "./devices/EntityMedia";
import { CameraPersonSnapshot } from "./CameraPersonSnapshot";

export function NotificationCameraSettings({ rule, entities, disabled, onChange, active }: { rule: NotificationRule; entities: Entity[]; disabled: boolean; active: boolean; onChange: (change: Partial<NotificationRule>) => void }) {
  const { message: t } = useI18n();
  const shared = useSharedConfiguration();
  const [preview, setPreview] = useState(false);
  const camera = notificationEntity(entities, rule.cameraEntity);
  const settings = shared?.state.config.settings.cameras;
  const source = camera && settings?.sources[camera.entityId];
  const person = source?.personSnapshot && source.personSnapshot.type !== "none";
  const liveLabel = (entity: Entity) => {
    const stream = settings?.sources[entity.entityId]?.stream;
    return stream ? t("go2rtc · {stream}", { stream }) : "Home Assistant";
  };
  return <>
    <EntityPicker label={t("Camera")} entities={entities.filter(entity => entity.domain === "camera")} value={rule.cameraEntity} disabled={disabled}
      getDescription={liveLabel} onChange={cameraEntity => { setPreview(false); onChange({ cameraEntity }); }} />
    <label>{t("Show in notification")}<select value={rule.cameraMedia ?? "live"} disabled={disabled || !camera} onChange={event => { setPreview(false); onChange({ cameraMedia: event.target.value as "live" | "person" }); }}>
      <option value="live">{source?.stream ? t("Live video from go2rtc · {stream}", { stream: source.stream }) : t("Live video from Home Assistant")}</option>
      <option value="person" disabled={!person}>{t("Person snapshot")}{!person ? ` · ${t("Not configured")}` : ""}</option>
    </select></label>
    {source?.stream && rule.cameraMedia !== "person" && <p className="page-note break-words">{t("This notification plays the go2rtc stream “{stream}” configured for this camera.", { stream: source.stream })}</p>}
    {camera && !source?.stream && rule.cameraMedia !== "person" && <p className="page-note">{t("To use go2rtc, open Configure camera and choose Frigate / go2rtc as its video source.")}</p>}
    {rule.cameraMedia === "person" && !person && <p role="status">{t("Choose a person snapshot in Camera settings.")}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={!camera || (rule.cameraMedia === "person" && !person)} onClick={() => setPreview(value => !value)}>{t(preview ? "Close preview" : "Test camera output")}</Button>
      <Button type="button" variant="outline" asChild><Link to={camera ? `/settings/cameras?camera=${encodeURIComponent(camera.entityId)}` : "/settings/cameras"} target="_blank" rel="noreferrer">{t("Configure camera (new tab)")}</Link></Button>
    </div>
    {preview && active && camera && (rule.cameraMedia === "person" ? <CameraPersonSnapshot key={camera.entityId} entityId={camera.entityId} /> : <MediaSurface key={camera.entityId} entity={camera} expanded />)}
  </>;
}
