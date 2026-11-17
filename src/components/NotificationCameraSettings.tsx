import { useState } from "react";
import { Link } from "react-router-dom";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import type { NotificationRule } from "../../shared/notifications";
import { configuredCamera } from "../../shared/cameras";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { MediaSurface } from "./devices/EntityMedia";
import { CameraPersonSnapshot } from "./CameraPersonSnapshot";
import { useApp } from "@/contexts/AppContext";
import { EntityPicker } from "./EntityPicker";

export function NotificationCameraSettings({ rule, disabled, onChange, active }: { rule: NotificationRule; disabled: boolean; active: boolean; onChange: (change: Partial<NotificationRule>) => void }) {
  const { message: t } = useI18n();
  const shared = useSharedConfiguration();
  const { currentHome } = useApp();
  const [preview, setPreview] = useState(false);
  const [imagePreview, setImagePreview] = useState(false);
  const images = currentHome.entities.filter(entity => entity.domain === "image");
  const image = images.find(entity => entity.preferenceId === rule.imageEntity);
  const settings = shared?.state.config.settings.cameras;
  const camera = configuredCamera(settings, rule.cameraEntity);
  const person = camera && camera.personSnapshot.type !== "none";
  const connection = settings?.connections.find(item => item.id === camera?.connectionId);
  return <>
    <EntityPicker label={t("Image (optional)")} entities={images} value={rule.imageEntity ?? ""} disabled={disabled} clearLabel={t("No image")}
      onChange={imageEntity => { setImagePreview(false); onChange({ imageEntity }); }} />
    <p className="page-note">{t("Choose a Home Assistant image entity, for example the model being printed. The image updates when the entity changes.")}</p>
    {rule.imageEntity && <>
      <label>{t("Image placement")}<select value={rule.imagePlacement ?? "left"} disabled={disabled} onChange={event => onChange({ imagePlacement: event.target.value as NotificationRule["imagePlacement"] })}>
        <option value="left">{t("Left reading")}</option>
        <option value="right">{t("Right reading")}</option>
        <option value="footer">{t("At the bottom")}</option>
      </select></label>
      <Button type="button" variant="outline" disabled={!image} onClick={() => setImagePreview(value => !value)}>{t(imagePreview ? "Close image preview" : "Test image output")}</Button>
      {imagePreview && active && image && <MediaSurface key={image.preferenceId} entity={image} expanded />}
    </>}
    {rule.kind === "ongoing" && <p className="page-note">{t("Optionally show a camera while this task is running. The larger viewer opens only when you choose Show camera.")}</p>}
    <label>{t(rule.kind === "ongoing" ? "Camera (optional)" : "Camera")}<select value={rule.cameraEntity} disabled={disabled} onChange={event => { setPreview(false); onChange({ cameraEntity: event.target.value, cameraMedia: "live" }); }}>
      <option value="">{t(rule.kind === "ongoing" ? "No camera" : "Choose a camera")}</option>
      {rule.cameraEntity && !camera && <option value={rule.cameraEntity}>{t("Unavailable camera")}</option>}
      {settings?.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {!settings?.items.length && <p className="page-note">{t("Add a camera first. Cameras you configure are available here, regardless of their connection.")}</p>}
    <label>{t("Show in notification")}<select value={rule.cameraMedia ?? "live"} disabled={disabled || !camera} onChange={event => { setPreview(false); onChange({ cameraMedia: event.target.value as "live" | "person" }); }}>
      <option value="live">{connection?.type === "go2rtc" ? t("Live video from go2rtc · {stream}", { stream: camera.source }) : t("Live video from Home Assistant")}</option>
      <option value="person" disabled={!person}>{t("Person snapshot")}{!person ? ` · ${t("Not configured")}` : ""}</option>
    </select></label>
    <p className="page-note">{t("The selected video or person image appears on the notification card and in its larger camera viewer.")}</p>
    <label>{t("Camera placement")}<select value={rule.cameraPlacement ?? "footer"} disabled={disabled || !camera} onChange={event => onChange({ cameraPlacement: event.target.value as NotificationRule["cameraPlacement"] })}>
      <option value="footer">{t("At the bottom")}</option>
      <option value="left">{t("Left reading")}</option>
      <option value="right">{t("Right reading")}</option>
    </select></label>
    <p className="page-note">{t("Place the image and camera in separate columns to show them side by side in activity cards. Other styles show them below the readings.")}</p>
    {rule.cameraMedia !== "person" && <div className="notification-toggle"><span>{t("Show last person on card")}</span><Switch aria-label={t("Show last person on card")} checked={!!rule.showPersonSnapshot} disabled={disabled || !person} onCheckedChange={showPersonSnapshot => onChange({ showPersonSnapshot })} /></div>}
    {rule.cameraMedia !== "person" && <p className="page-note">{t("Show the latest person image over live video on this notification card. Fullscreen live previews always include it when configured.")}</p>}
    {camera && <p className="page-note break-words">{t("Connection: {name} · Source: {source}", { name: connection?.name ?? "Home Assistant", source: camera.source })}</p>}
    {rule.cameraMedia === "person" && !person && <p role="status">{t("Choose a person snapshot in Camera settings.")}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={!camera || (rule.cameraMedia === "person" && !person)} onClick={() => setPreview(value => !value)}>{t(preview ? "Close preview" : "Test camera output")}</Button>
      <Button type="button" variant="outline" asChild><Link to={camera ? `/settings/cameras?camera=${encodeURIComponent(camera.id)}` : "/settings/cameras?add"} target="_blank" rel="noreferrer">{t(camera ? "Configure camera (new tab)" : "Add camera (new tab)")}</Link></Button>
    </div>
    {preview && active && camera && (rule.cameraMedia === "person" ? <CameraPersonSnapshot key={camera.id} cameraId={camera.id} /> : <MediaSurface key={camera.id} camera={camera} expanded />)}
  </>;
}
