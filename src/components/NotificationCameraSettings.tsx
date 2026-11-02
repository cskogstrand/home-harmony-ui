import { useState } from "react";
import { Link } from "react-router-dom";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import type { NotificationRule } from "../../shared/notifications";
import { configuredCamera } from "../../shared/cameras";
import { Button } from "./ui/button";
import { MediaSurface } from "./devices/EntityMedia";
import { CameraPersonSnapshot } from "./CameraPersonSnapshot";

export function NotificationCameraSettings({ rule, disabled, onChange, active }: { rule: NotificationRule; disabled: boolean; active: boolean; onChange: (change: Partial<NotificationRule>) => void }) {
  const { message: t } = useI18n();
  const shared = useSharedConfiguration();
  const [preview, setPreview] = useState(false);
  const settings = shared?.state.config.settings.cameras;
  const camera = configuredCamera(settings, rule.cameraEntity);
  const person = camera && camera.personSnapshot.type !== "none";
  const connection = settings?.connections.find(item => item.id === camera?.connectionId);
  return <>
    <label>{t("Camera")}<select value={rule.cameraEntity} disabled={disabled} onChange={event => { setPreview(false); onChange({ cameraEntity: event.target.value, cameraMedia: "live" }); }}>
      <option value="">{t("Choose a camera")}</option>
      {rule.cameraEntity && !camera && <option value={rule.cameraEntity}>{t("Unavailable camera")}</option>}
      {settings?.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {!settings?.items.length && <p className="page-note">{t("Add a camera first. Cameras you configure are available here, regardless of their connection.")}</p>}
    <label>{t("Show in notification")}<select value={rule.cameraMedia ?? "live"} disabled={disabled || !camera} onChange={event => { setPreview(false); onChange({ cameraMedia: event.target.value as "live" | "person" }); }}>
      <option value="live">{connection?.type === "go2rtc" ? t("Live video from go2rtc · {stream}", { stream: camera.source }) : t("Live video from Home Assistant")}</option>
      <option value="person" disabled={!person}>{t("Person snapshot")}{!person ? ` · ${t("Not configured")}` : ""}</option>
    </select></label>
    {camera && <p className="page-note break-words">{t("Connection: {name} · Source: {source}", { name: connection?.name ?? "Home Assistant", source: camera.source })}</p>}
    {rule.cameraMedia === "person" && !person && <p role="status">{t("Choose a person snapshot in Camera settings.")}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={!camera || (rule.cameraMedia === "person" && !person)} onClick={() => setPreview(value => !value)}>{t(preview ? "Close preview" : "Test camera output")}</Button>
      <Button type="button" variant="outline" asChild><Link to={camera ? `/settings/cameras?camera=${encodeURIComponent(camera.id)}` : "/settings/cameras?add"} target="_blank" rel="noreferrer">{t(camera ? "Configure camera (new tab)" : "Add camera (new tab)")}</Link></Button>
    </div>
    {preview && active && camera && (rule.cameraMedia === "person" ? <CameraPersonSnapshot key={camera.id} cameraId={camera.id} /> : <MediaSurface key={camera.id} camera={camera} expanded />)}
  </>;
}
