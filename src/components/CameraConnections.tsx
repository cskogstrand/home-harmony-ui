import { useState } from "react";
import { Link } from "react-router-dom";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { newPlannerId } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { cameraConnectionSchema, type CameraConnection } from "../../shared/cameras";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./common/ConfirmDialog";

export function CameraConnections() {
  const { message: t } = useI18n();
  const shared = useSharedConfiguration();
  const settings = shared.state.config.settings.cameras;
  const [draft, setDraft] = useState<CameraConnection>();
  const [original, setOriginal] = useState("");
  const [error, setError] = useState("");
  const [remove, setRemove] = useState<CameraConnection>();
  const disabled = !shared.state.loaded || !!shared.state.error || shared.state.saving;
  const used = (id: string) => settings.items.some(camera => camera.connectionId === id || camera.personSnapshot.type === "frigate" && camera.personSnapshot.connectionId === id);
  const begin = (connection: CameraConnection, existing = false) => { setDraft(connection); setOriginal(existing ? JSON.stringify(connection) : ""); setError(""); };
  const save = () => {
    const result = cameraConnectionSchema.safeParse(draft);
    if (!result.success) { setError("Enter a connection name and an HTTP or HTTPS address without passwords or tokens."); return; }
    try {
      shared.store.updateSettings(current => {
        const existing = current.cameras.connections.find(item => item.id === draft.id);
        if (original && JSON.stringify(existing) !== original) throw new Error("This connection changed on another screen. Cancel and reopen it.");
        return { ...current, cameras: { ...current.cameras, connections: existing ? current.cameras.connections.map(item => item.id === draft.id ? result.data : item) : [...current.cameras.connections, result.data] } };
      });
      setDraft(undefined);
    } catch (error) { setError(error instanceof Error ? error.message : "Camera settings could not be saved. Your draft is still here."); }
  };
  return <section className="glow-panel space-y-6">
    <p className="page-note">{t("Set up each server once. When adding a camera, choose one of these connections and its video source.")}</p>
    <div className="flex flex-wrap gap-2"><Button disabled={disabled || !!draft || settings.connections.length >= 100} onClick={() => begin({ id: newPlannerId(), name: "", type: "go2rtc", url: "" })}>{t("Add connection")}</Button><Button variant="outline" asChild><Link to="/settings/cameras">{t("Set up cameras")}</Link></Button></div>
    <ul className="divide-y">
      <li className="py-4"><h2 className="font-semibold">Home Assistant</h2><p className="page-note">{t("Already connected to this home. Provides camera entities and person images.")}</p></li>
      {settings.connections.map(connection => <li key={connection.id} className="flex flex-wrap items-center gap-3 py-4">
        <div className="min-w-0 flex-1 basis-64"><h2 className="font-semibold break-words">{connection.name}</h2><p className="page-note break-all">{connection.type === "go2rtc" ? "go2rtc" : t("Frigate snapshots")} · {connection.url}</p>{used(connection.id) && <p className="page-note">{t("In use by cameras. Change their sources before deleting this connection.")}</p>}</div>
        <Button variant="outline" disabled={disabled || !!draft} aria-label={t("Edit {name}", { name: connection.name })} onClick={() => begin(connection, true)}>{t("Edit")}</Button>
        <Button variant="ghost" disabled={disabled || !!draft || used(connection.id)} aria-label={t("Delete {name}", { name: connection.name })} onClick={() => setRemove(connection)}>{t("Delete")}</Button>
      </li>)}
    </ul>
    {draft && <form className="planner-form border-t pt-6" onSubmit={event => { event.preventDefault(); save(); }}>
      <h2 className="text-xl font-semibold">{t(original ? "Edit connection" : "Add connection")}</h2>
      <fieldset disabled={disabled} className="space-y-4">
        <label>{t("Connection name")}<input autoFocus maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>{t("Connection type")}<select value={draft.type} disabled={used(draft.id)} onChange={event => setDraft({ ...draft, type: event.target.value as CameraConnection["type"] })}><option value="go2rtc">go2rtc</option><option value="frigate">{t("Frigate snapshots")}</option></select></label>
        <label>{t("Server address")}<input type="url" maxLength={2048} placeholder={draft.type === "go2rtc" ? "http://go2rtc.example:1984" : "http://frigate.example:5000"} value={draft.url} onChange={event => setDraft({ ...draft, url: event.target.value })} /></label>
        {draft.type === "go2rtc" && <p className="page-note">{t("You can also paste a working go2rtc player link. We will use its server address.")}</p>}
        <p className="page-note">{t(draft.type === "go2rtc" ? "Use the go2rtc API address, usually port 1984. Cameras will list the streams from this server." : "Use Frigate's internal API address for person snapshots, usually port 5000. For live video, add a go2rtc connection.")}</p>
        <details><summary className="min-h-11 cursor-pointer py-2">{t("Connection help")}</summary><p className="page-note">{t("Use an internal server reachable by Home Harmony without login. Camera credentials stay on the server, not in these settings.")}</p>{draft.type === "go2rtc" && <p className="page-note">{t("Direct WebRTC usually uses port 8555. If it cannot connect, compatible video is relayed through Home Harmony.")}</p>}</details>
      </fieldset>
      {error && <p role="alert" className="text-destructive">{t(error)}</p>}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={disabled}>{t("Save connection")}</Button><Button type="button" variant="outline" onClick={() => setDraft(undefined)}>{t("Cancel")}</Button></div>
    </form>}
    <ConfirmDialog open={!!remove} onOpenChange={open => { if (!open) setRemove(undefined); }} title="Delete connection?" description="This removes the saved connection from Home Harmony. The server itself is unchanged." confirmLabel="Delete" destructive disabled={disabled || !!remove && used(remove.id)} onConfirm={() => {
      shared.store.updateSettings(current => {
        if (current.cameras.items.some(camera => camera.connectionId === remove.id || camera.personSnapshot.type === "frigate" && camera.personSnapshot.connectionId === remove.id)) throw new Error("In use by cameras. Change their sources before deleting this connection.");
        return { ...current, cameras: { ...current.cameras, connections: current.cameras.connections.filter(item => item.id !== remove.id) } };
      });
    }} />
  </section>;
}
