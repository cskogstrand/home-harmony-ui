import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { newPlannerId } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { cameraSettingsSchema, go2rtcLink, homeAssistantPicturePath, type ConfiguredCamera } from "../../shared/cameras";
import { EntityPicker } from "./EntityPicker";
import { Go2rtcSourcePicker } from "./Go2rtcSourcePicker";
import { Button } from "./ui/button";
import { MediaSurface } from "./devices/EntityMedia";
import { CameraPersonSnapshot } from "./CameraPersonSnapshot";
import { ConfirmDialog } from "./common/ConfirmDialog";

export function CameraSettings() {
  const { message: t } = useI18n();
  const { currentHome } = useApp();
  const shared = useSharedConfiguration();
  const [params, setParams] = useSearchParams();
  const settings = shared.state.config.settings.cameras;
  const [draft, setDraft] = useState<ConfiguredCamera>();
  const [original, setOriginal] = useState("");
  const [error, setError] = useState("");
  const [remove, setRemove] = useState<ConfiguredCamera>();
  const [preview, setPreview] = useState<{ id: string; type: "live" | "snapshot" | "person" }>();
  const disabled = !shared.state.loaded || !!shared.state.error || shared.state.saving;
  const begin = (camera: ConfiguredCamera, existing = false) => { setDraft(camera); setOriginal(existing ? JSON.stringify(camera) : ""); setError(""); setPreview(undefined); };
  useEffect(() => {
    if (!shared.state.loaded || draft) return;
    const requested = params.get("camera");
    const camera = settings.items.find(item => item.id === requested);
    if (camera || params.has("add")) {
      begin(camera ?? { id: newPlannerId(), name: "", connectionId: "", source: "", personSnapshot: { type: "none" } }, !!camera);
      const next = new URLSearchParams(params); next.delete("camera"); next.delete("add"); setParams(next, { replace: true });
    }
  }, [params, setParams, shared.state.loaded, settings.items, draft]);
  const connection = settings.connections.find(item => item.id === draft?.connectionId);
  const snapshot = draft?.personSnapshot;
  const previewCamera = preview && settings.items.find(item => item.id === preview.id);
  const inUse = (id: string) => shared.state.config.settings.notifications.rules.some(rule => rule.kind === "camera" && rule.cameraEntity === id);
  const save = (watch = false) => {
    try {
      shared.store.updateSettings(current => {
        const link = go2rtcLink(draft.source);
        if (link && current.cameras.connections.find(item => item.id === draft.connectionId)?.url !== link.serverUrl) throw new Error("This link uses a different go2rtc server. Choose its connection first.");
        const existing = current.cameras.items.find(item => item.id === draft.id);
        if (original && JSON.stringify(existing) !== original) throw new Error("This camera changed on another screen. Cancel and reopen it.");
        const result = cameraSettingsSchema.safeParse({ ...current.cameras, items: existing ? current.cameras.items.map(item => item.id === draft.id ? draft : item) : [...current.cameras.items, draft] });
        if (!result.success) throw new Error("Enter a camera name, choose a connection and source, and check the preview and optional person image.");
        return { ...current, cameras: result.data };
      });
      if (watch) setPreview({ id: draft.id, type: "live" });
      setDraft(undefined); setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "Camera settings could not be saved. Your draft is still here."); }
  };
  return <section className="glow-panel space-y-6">
    <p className="page-note">{t("Add the cameras you want to use. Each camera has a name, a connection and a video source. Only these cameras appear in Smart home and camera notifications.")}</p>
    <div className="flex flex-wrap gap-2">
      <Button disabled={disabled || !!draft || settings.items.length >= 200} onClick={() => begin({ id: newPlannerId(), name: "", connectionId: "", source: "", personSnapshot: { type: "none" } })}>{t("Add camera")}</Button>
      <Button variant="outline" asChild><Link to="/settings/camera-connections" target={draft ? "_blank" : undefined} rel="noreferrer">{t(draft ? "Connections (new tab)" : "Manage connections")}</Link></Button>
      <Button variant="outline" asChild><Link to="/cameras">{t("Watch cameras")}</Link></Button>
    </div>
    {!settings.items.length && !draft && <p role="status" className="page-note">{t("No cameras added yet. Start with Add camera. Home Assistant is ready to use, or set up a go2rtc connection first.")}</p>}
    {!draft && <ul className="divide-y">{settings.items.map(camera => <li key={camera.id} className="space-y-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-48 space-y-1">
          <h2 className="text-xl font-semibold break-words">{camera.name}</h2>
          <p className="page-note break-words">{camera.connectionId === "home-assistant" ? "Home Assistant" : settings.connections.find(item => item.id === camera.connectionId)?.name} · {camera.source}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={disabled} aria-label={t("Edit {name}", { name: camera.name })} onClick={() => begin(camera, true)}>{t("Edit")}</Button>
          <Button variant="ghost" disabled={disabled || inUse(camera.id)} aria-label={t("Delete {name}", { name: camera.name })} onClick={() => setRemove(camera)}>{t("Delete")}</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("Camera previews for {name}", { name: camera.name })}>
        <Button variant="outline" onClick={() => setPreview({ id: camera.id, type: "snapshot" })}>{t("Preview startup image")}</Button>
        <Button variant="outline" onClick={() => setPreview({ id: camera.id, type: "live" })}>{t("Watch live stream")}</Button>
        {camera.personSnapshot.type !== "none" && <Button variant="outline" onClick={() => setPreview({ id: camera.id, type: "person" })}>{t("Preview person snapshot")}</Button>}
      </div>
      {inUse(camera.id) && <p className="page-note">{t("Used by notifications. Choose another camera in those rules before deleting it.")}</p>}
    </li>)}</ul>}
    {draft && <form className="planner-form border-t pt-6" onSubmit={event => { event.preventDefault(); save(); }}>
      <h2 className="text-xl font-semibold">{t(original ? "Edit camera" : "Add camera")}</h2>
      <fieldset disabled={disabled} className="space-y-4">
        <label>{t("Camera name")}<input autoFocus maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>{t("Connection")}<select value={draft.connectionId} onChange={event => setDraft({ ...draft, connectionId: event.target.value, source: "" })}>
          <option value="">{t("Choose a connection")}</option><option value="home-assistant">Home Assistant</option>{settings.connections.filter(item => item.type === "go2rtc").map(item => <option key={item.id} value={item.id}>{item.name} · go2rtc</option>)}
        </select></label>
        {draft.connectionId === "home-assistant" && <EntityPicker label={t("Home Assistant camera")} entities={currentHome.entities.filter(entity => entity.domain === "camera")} value={draft.source ? `home|${draft.source}` : ""} onChange={value => setDraft({ ...draft, source: value.replace(/^home\|/, "") })} />}
        {connection?.type === "go2rtc" && <Go2rtcSourcePicker key={connection.id} connection={connection} value={draft.source} onChange={source => setDraft({ ...draft, source })} />}
        <div className="space-y-4 border-t pt-4">
          <label>{t("Preview while video connects")}<select value={draft.frigatePreview ? "frigate" : "video"} onChange={event => setDraft({ ...draft, frigatePreview: event.target.value === "frigate" ? { connectionId: "", camera: "" } : undefined })}>
            <option value="video">{t("Use the video connection")}</option><option value="frigate">{t("Frigate latest image")}</option>
          </select></label>
          <p className="page-note">{t("Show updating images immediately while live video connects. This also applies to camera notifications.")}</p>
          {draft.frigatePreview && <>
            <label>{t("Frigate preview connection")}<select value={draft.frigatePreview.connectionId} onChange={event => setDraft({ ...draft, frigatePreview: { ...draft.frigatePreview, connectionId: event.target.value } })}>
              <option value="">{t("Choose a connection")}</option>{settings.connections.filter(item => item.type === "frigate").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            <label>{t("Frigate preview camera")}<input maxLength={128} value={draft.frigatePreview.camera} onChange={event => setDraft({ ...draft, frigatePreview: { ...draft.frigatePreview, camera: event.target.value } })} /></label>
            <p className="page-note">{t("Use the camera name from Frigate. It can differ from the go2rtc stream name.")}</p>
            {!settings.connections.some(item => item.type === "frigate") && <Link className="text-primary underline" to="/settings/camera-connections" target="_blank" rel="noreferrer">{t("Add a Frigate connection (new tab)")}</Link>}
          </>}
        </div>
        <details open={snapshot.type !== "none" || undefined}><summary className="min-h-11 cursor-pointer py-2">{t("Person image (optional)")}</summary><div className="space-y-4 pt-3">
          <label>{t("Person snapshot source")}<select value={snapshot.type} onChange={event => setDraft({ ...draft, personSnapshot: event.target.value === "frigate" ? { type: "frigate", connectionId: "", camera: "" } : event.target.value === "home-assistant" ? { type: "home-assistant", entity: "" } : { type: "none" } })}><option value="none">{t("No person snapshot")}</option><option value="home-assistant">{t("Person image from Home Assistant")}</option><option value="frigate">{t("Person image directly from Frigate")}</option></select></label>
          {snapshot.type === "home-assistant" && <><EntityPicker label={t("Person image entity")} entities={currentHome.entities.filter(item => ["image", "camera", "sensor", "binary_sensor"].includes(item.domain))} value={snapshot.entity ? `home|${snapshot.entity}` : ""}
            disabledReason={item => !["image", "camera"].includes(item.domain) && !homeAssistantPicturePath(item.attributes.entity_picture) ? t("No image on this sensor. Choose the Frigate person image entity.") : undefined}
            onChange={value => setDraft({ ...draft, personSnapshot: { type: "home-assistant", entity: value.replace(/^home\|/, "") } })} /><p className="page-note">{t("Choose the person image, usually image.…_person. The occupancy sensor is used later to trigger the notification.")}</p></>}
          {snapshot.type === "frigate" && <><label>{t("Frigate connection")}<select value={snapshot.connectionId} onChange={event => setDraft({ ...draft, personSnapshot: { ...snapshot, connectionId: event.target.value } })}><option value="">{t("Choose a connection")}</option>{settings.connections.filter(item => item.type === "frigate").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{t("Frigate camera name")}<input maxLength={128} value={snapshot.camera} onChange={event => setDraft({ ...draft, personSnapshot: { ...snapshot, camera: event.target.value } })} /></label><p className="page-note">{t("Add a Frigate snapshots connection under Manage connections if it is not listed.")}</p></>}
        </div></details>
      </fieldset>
      {error && <p role="alert" className="text-destructive">{t(error)}</p>}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={disabled}>{t("Save camera")}</Button><Button type="button" variant="outline" disabled={disabled} onClick={() => save(true)}>{t("Save and test camera")}</Button><Button type="button" variant="outline" onClick={() => { setDraft(undefined); setError(""); }}>{t("Cancel")}</Button></div>
    </form>}
    {previewCamera && !draft && <div className="space-y-3 border-t pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{previewCamera.name}</h2><Button variant="outline" onClick={() => setPreview(undefined)}>{t("Close preview")}</Button></div>
      {preview.type === "snapshot" && <p className="page-note">{t("This image is shown while the live stream connects.")}</p>}
      {shared.state.error ? <p role="status">{t("Camera settings could not be saved. Check settings storage and retry.")}</p> : shared.state.saving || shared.state.dirty ? <p role="status">{t("Saving camera settings before opening the stream…")}</p> : preview.type === "person" ? <CameraPersonSnapshot cameraId={previewCamera.id} /> : <MediaSurface key={preview.type} camera={previewCamera} expanded snapshotOnly={preview.type === "snapshot"} />}
    </div>}
    <ConfirmDialog open={!!remove} onOpenChange={open => { if (!open) setRemove(undefined); }} title="Delete camera?" description="This removes the camera from Home Harmony. Its connection and the camera itself are unchanged." confirmLabel="Delete" destructive disabled={disabled || !!remove && inUse(remove.id)} onConfirm={() => {
      shared.store.updateSettings(current => {
        if (current.notifications.rules.some(rule => rule.kind === "camera" && rule.cameraEntity === remove.id)) throw new Error("Used by notifications. Choose another camera in those rules before deleting it.");
        return { ...current, cameras: { ...current.cameras, items: current.cameras.items.filter(item => item.id !== remove.id) } };
      });
    }} />
  </section>;
}
