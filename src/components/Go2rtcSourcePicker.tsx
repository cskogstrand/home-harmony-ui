import { useEffect, useState } from "react";
import { go2rtcLink, go2rtcPlayerUrl, type CameraConnection } from "../../shared/cameras";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "./ui/button";

export function Go2rtcSourcePicker({ connection, value, onChange }: { connection: CameraConnection; value: string; onChange: (value: string) => void }) {
  const { message: t } = useI18n();
  const [streams, setStreams] = useState<string[]>();
  const [failed, setFailed] = useState(false), [manual, setManual] = useState(false), [retry, setRetry] = useState(0);
  const link = go2rtcLink(value);
  const mismatched = link && link.serverUrl !== connection.url;
  const playerUrl = mismatched ? undefined : go2rtcPlayerUrl(connection, value);
  useEffect(() => {
    const controller = new AbortController();
    setStreams(undefined); setFailed(false);
    const timeout = setTimeout(() => controller.abort(), 16000);
    void fetch(`/api/camera-connections/${encodeURIComponent(connection.id)}/streams`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const names: unknown = await response.json();
      if (!Array.isArray(names) || names.some(name => typeof name !== "string")) throw new Error();
      if (!controller.signal.aborted) setStreams(names);
    }).catch(() => { if (!disposed) setFailed(true); }).finally(() => clearTimeout(timeout));
    let disposed = false;
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [connection.id, connection.url, retry]);
  return <div className="space-y-3">
    {manual ? <><label>{t("Stream name or go2rtc link")}<input maxLength={2048} placeholder="http://go2rtc.example:1984/stream.html?src=example_camera" value={value} onChange={event => onChange(event.target.value)} /></label><p className="page-note">{t("Paste a stream.html or webrtc.html link, a stream name, or an RTSP restream address.")}</p></>
      : <label>{t("Stream")}<select value={value} onChange={event => onChange(event.target.value)}><option value="">{t("Choose a stream")}</option>{value && !streams?.includes(value) && <option value={value}>{value}</option>}{streams?.map(name => <option key={name} value={name}>{name}</option>)}</select></label>}
    {!streams && !failed && <p role="status" className="page-note">{t("Loading streams from this connection…")}</p>}
    {failed && <p role="status" className="page-note">{t("Could not load streams. Check the connection, retry, or enter a stream name manually.")}</p>}
    {streams?.length === 0 && <p role="status" className="page-note">{t("This connection has no streams yet. Add streams in go2rtc, then refresh.")}</p>}
    {mismatched && <p role="alert" className="text-destructive">{t("This link uses a different go2rtc server. Choose its connection first.")}</p>}
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setRetry(value => value + 1)}>{t("Refresh streams")}</Button><Button type="button" variant="link" onClick={() => setManual(value => !value)}>{t(manual ? "Choose from available streams" : "Enter stream manually")}</Button></div>
    {playerUrl && <a className="text-primary underline underline-offset-4" href={playerUrl} target="_blank" rel="noreferrer">{t("Open in go2rtc (new tab)")}</a>}
  </div>;
}
