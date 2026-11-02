import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { cameraSettingsSchema, cameraSourceSchema, homeAssistantPicturePath, type CameraSettings as Settings, type CameraSource } from "../../shared/cameras";
import { EntityPicker } from "./EntityPicker";
import { Button } from "./ui/button";
import { MediaSurface } from "./devices/EntityMedia";
import { CameraPersonSnapshot } from "./CameraPersonSnapshot";

const defaultSource = cameraSourceSchema.parse({});

export function CameraSettings() {
  const { message: t } = useI18n();
  const { currentHome } = useApp();
  const shared = useSharedConfiguration();
  const [params] = useSearchParams();
  const saved = shared.state.config.settings.cameras;
  const [draft, setDraft] = useState<Settings>();
  const [videoChoices, setVideoChoices] = useState<Record<string, boolean>>({});
  const [original, setOriginal] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ entity: string; type: "live" | "person" }>();
  const settings = draft ?? saved;
  const disabled = !shared.state.loaded || !!shared.state.error || shared.state.saving;
  const cameras = currentHome.entities.filter(entity => entity.domain === "camera");
  const cameraIds = [...new Set([...cameras.map(entity => entity.entityId), ...Object.keys(settings.sources)])];
  const edit = (next: Settings) => {
    if (!draft) setOriginal(JSON.stringify(saved));
    setDraft(next); setError(""); setPreview(undefined);
  };
  const changeSource = (id: string, change: Partial<CameraSource>) => edit({ ...settings, sources: { ...settings.sources, [id]: { ...(settings.sources[id] ?? defaultSource), ...change } } });
  const save = (watch?: string) => {
    if (!draft) { if (watch) setPreview({ entity: watch, type: "live" }); return; }
    if (JSON.stringify(saved) !== original) { setError("Camera settings changed on another screen. Discard this draft and try again."); return; }
    if (Object.entries(videoChoices).some(([id, go2rtc]) => go2rtc && !settings.sources[id]?.stream.trim())) { setError("Enter a stream name or RTSP address for each camera using go2rtc."); return; }
    const parsed = cameraSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      setError(parsed.error.issues.some(issue => issue.path[0] === "go2rtcUrl") ? "Enter the go2rtc server address, for example http://go2rtc.example:1984."
        : parsed.error.issues.some(issue => issue.path[0] === "frigateUrl") ? "Enter the Frigate server address for person snapshots."
        : "Check the stream name and person image source. RTSP addresses must not contain passwords or tokens."); return;
    }
    try {
      shared.store.updateSettings(current => ({ ...current, cameras: parsed.data }));
      setDraft(undefined); setVideoChoices({}); setError("");
      if (watch) setPreview({ entity: watch, type: "live" });
    } catch { setError("Camera settings could not be saved. Your draft is still here."); }
  };
  return <section className="glow-panel space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <p className="page-note max-w-prose">{t("Open a camera below, choose its video source, then save and watch. The same source is available in camera notifications.")}</p>
      <Button variant="outline" asChild><Link to="/cameras">{t("Watch cameras")}</Link></Button>
    </div>
    {!cameraIds.length && <p role="status">{t("No Home Assistant camera entities available. Add a camera in Home Assistant, then reconnect.")}</p>}
    <form className="planner-form" onSubmit={event => { event.preventDefault(); save(); }}>
      {cameraIds.map(id => {
        const entity = cameras.find(camera => camera.entityId === id);
        const source = settings.sources[id] ?? defaultSource;
        const go2rtc = videoChoices[id] ?? !!source.stream;
        const snapshot = source.personSnapshot;
        const imageEntity = snapshot.type === "home-assistant" && currentHome.entities.find(item => item.entityId === snapshot.entity);
        return <details key={id} className="border-t pt-4" open={params.get("camera") === id || cameraIds.length === 1 ? true : undefined}>
          <summary className="min-h-12 cursor-pointer py-2"><strong className="break-words">{entity?.name ?? id}</strong><span className="page-note ml-2 break-words">{go2rtc ? source.stream ? t("go2rtc · {stream}", { stream: source.stream }) : "Frigate / go2rtc" : "Home Assistant"}</span></summary>
          <fieldset disabled={disabled} className="space-y-4 py-4">
            <legend className="sr-only">{t("Configure {name}", { name: entity?.name ?? id })}</legend>
            {!entity && <p role="status">{t("Camera entity unavailable. Its saved sources are kept.")}</p>}
            <label>{t("Video source")}<select value={go2rtc ? "go2rtc" : "home-assistant"} onChange={event => {
              const selected = event.target.value === "go2rtc";
              setVideoChoices(values => ({ ...values, [id]: selected }));
              changeSource(id, { stream: selected ? source.stream : "" });
            }}><option value="home-assistant">Home Assistant</option><option value="go2rtc">Frigate / go2rtc</option></select></label>
            {go2rtc ? <>
              <label>{t("go2rtc server address")}<input type="url" maxLength={2048} placeholder="http://go2rtc.example:1984" value={settings.go2rtcUrl} onChange={event => edit({ ...settings, go2rtcUrl: event.target.value })} /></label>
              <p className="page-note">{t("The address of go2rtc's web API, usually port 1984. This server address is shared by all cameras using go2rtc.")}</p>
              <label>{t("Stream name or RTSP address")}<input maxLength={2048} placeholder="rtsp://frigate.example:8554/example_camera" value={source.stream} onChange={event => changeSource(id, { stream: event.target.value })} /></label>
              <p className="page-note">{t("Paste the Frigate restream address, or enter the name from go2rtc → streams, for example example_camera.")}</p>
              <details><summary className="cursor-pointer min-h-11 py-2 text-sm">{t("Connection help")}</summary><p className="page-note">{t("Use the go2rtc API address, usually port 1984. The browser plays its RTSP restream through WebRTC; port 8555 must be reachable from this screen.")}</p><p className="page-note">{t("Only the stream name is saved from an RTSP address. Camera passwords stay in Frigate/go2rtc.")}</p></details>
            </> : <p className="page-note">{t("Uses this camera's existing Home Assistant stream. No stream address is needed.")}</p>}
            <label>{t("Person snapshot source")}<select value={snapshot.type} onChange={event => changeSource(id, { personSnapshot: event.target.value === "frigate" ? { type: "frigate", camera: "" } : event.target.value === "home-assistant" ? { type: "home-assistant", entity: "" } : { type: "none" } })}>
              <option value="none">{t("No person snapshot")}</option><option value="home-assistant">{t("Person image from Home Assistant")}</option><option value="frigate">{t("Person image directly from Frigate")}</option>
            </select></label>
            {snapshot.type === "frigate" && <>
              <label>{t("Frigate server address")}<input type="url" maxLength={2048} placeholder="http://frigate.example:5000" value={settings.frigateUrl} onChange={event => edit({ ...settings, frigateUrl: event.target.value })} /></label>
              <label>{t("Frigate camera name")}<input maxLength={128} value={snapshot.camera} onChange={event => changeSource(id, { personSnapshot: { type: "frigate", camera: event.target.value } })} /></label>
              <p className="page-note">{t("Only needed for direct Frigate snapshots. Use an internal API reachable by this server without login, or select a Home Assistant image entity instead. Do not enter passwords or tokens.")}</p>
            </>}
            {snapshot.type === "home-assistant" && <>
              <EntityPicker label={t("Person image entity")} entities={currentHome.entities.filter(item => ["image", "camera", "sensor", "binary_sensor"].includes(item.domain))} value={imageEntity ? imageEntity.preferenceId : snapshot.entity} disabled={disabled}
                disabledReason={item => !["image", "camera"].includes(item.domain) && !homeAssistantPicturePath(item.attributes.entity_picture) ? t("No image on this sensor. Choose the Frigate person image entity.") : undefined}
                onChange={value => changeSource(id, { personSnapshot: { type: "home-assistant", entity: value.replace(/^home\|/, "") } })} />
              <p className="page-note">{t("Choose the person image, usually image.…_person. The occupancy sensor is used later to trigger the notification.")}</p>
            </>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!entity} onClick={() => save(id)}>{t(draft ? "Save and watch stream" : "Watch live stream")}</Button>
              {snapshot.type !== "none" && <Button type="button" variant="outline" disabled={!!draft} onClick={() => setPreview({ entity: id, type: "person" })}>{t("Preview person snapshot")}</Button>}
              {!draft && entity && <Button type="button" variant="outline" asChild><Link to={`/settings/notifications?camera=${encodeURIComponent(id)}`}>{t("Use in notification")}</Link></Button>}
            </div>
            {draft && <p className="page-note">{t("Save once to use this source on camera cards and in notifications.")}</p>}
          </fieldset>
          {preview?.entity === id && !draft && <div className="space-y-3">
            <Button type="button" variant="outline" onClick={() => setPreview(undefined)}>{t("Close preview")}</Button>
            {shared.state.saving || shared.state.dirty ? <p role="status">{t("Saving camera settings before opening the stream…")}</p>
              : preview.type === "person" ? <CameraPersonSnapshot entityId={id} /> : entity && <MediaSurface entity={entity} expanded />}
          </div>}
        </details>;
      })}
      {error && <p role="alert" className="text-destructive">{t(error)}</p>}
      {draft && <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={disabled}>{t("Save camera settings")}</Button>
        <Button type="button" variant="outline" onClick={() => { setDraft(undefined); setVideoChoices({}); setError(""); }}>{t("Discard draft")}</Button>
      </div>}
    </form>
  </section>;
}
