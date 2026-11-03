import { useCallback, useEffect, useRef, useState } from "react";
import type { Entity } from "@/types/api";
import { go2rtcPlayerUrl, type ConfiguredCamera } from "../../../shared/cameras";
import { useApp } from "@/contexts/AppContext";
import { usePageActive } from "@/contexts/PageActivityContext";
import { useI18n } from "@/hooks/use-i18n";
import { available } from "@/lib/ha-model";
import { Button } from "@/components/ui/button";
import { Expand, LoaderCircle, Video, VideoOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { playGo2rtcStream } from "@/lib/go2rtc-stream";
import { playGo2rtcMse } from "@/lib/go2rtc-mse";
import { CameraPersonSnapshot } from "@/components/CameraPersonSnapshot";
import { CameraStreamPreview } from "@/components/CameraStreamPreview";
import { CameraMediaStatus } from "@/components/CameraMediaStatus";

type MediaSource = { entity?: Entity; camera?: ConfiguredCamera };
function MediaImage({ src, name, caption, onError }: { src: string; name: string; caption?: string; onError: () => void }) {
  const { message: t } = useI18n();
  const [loaded, setLoaded] = useState(false);
  return <><img src={src} alt={name} draggable={false} onLoad={() => setLoaded(true)} onError={onError} />
    {!loaded && <p role="status">{t("Loading image…")}</p>}{loaded && caption && <CameraMediaStatus label={caption} icon={VideoOff} />}</>;
}
function CameraVideo({ id, name, go2rtc, previewSrc, expanded, onError }: { id: string; name: string; go2rtc: boolean; previewSrc: string; expanded: boolean; onError: (message?: string) => void }) {
  const { watchCameraStream } = useApp();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [transport, setTransport] = useState<"webrtc" | "mse">("webrtc");
  useEffect(() => {
    const video = ref.current;
    let stopped = false, lastTime = -1;
    let frame: number, timer: ReturnType<typeof setTimeout>;
    const progressed = () => {
      if (stopped) return;
      clearTimeout(timer); setPlaying(true);
      timer = setTimeout(() => { if (!video.paused) setPlaying(false); }, 3000);
    };
    const nextFrame: VideoFrameRequestCallback = () => {
      if (stopped) return;
      progressed(); frame = video.requestVideoFrameCallback(nextFrame);
    };
    const timeUpdate = () => {
      if (video.readyState >= 2 && video.currentTime !== lastTime) { lastTime = video.currentTime; progressed(); }
    };
    const emptied = () => { clearTimeout(timer); lastTime = -1; setPlaying(false); };
    // Waiting/playing can chatter around MSE chunks; only missing frame progress hides established video.
    if (video.requestVideoFrameCallback) frame = video.requestVideoFrameCallback(nextFrame);
    else { video.addEventListener("playing", timeUpdate); video.addEventListener("timeupdate", timeUpdate); }
    video.addEventListener("emptied", emptied);
    return () => {
      stopped = true; clearTimeout(timer);
      if (frame !== undefined) video.cancelVideoFrameCallback(frame);
      video.removeEventListener("playing", timeUpdate); video.removeEventListener("timeupdate", timeUpdate); video.removeEventListener("emptied", emptied);
    };
  }, [id, transport]);
  useEffect(() => {
    const controller = new AbortController();
    const failed = (message?: string) => {
      if (go2rtc && transport === "webrtc") { setPlaying(false); setTransport("mse"); }
      else onError(message);
    };
    (go2rtc ? transport === "mse" ? playGo2rtcMse : playGo2rtcStream : watchCameraStream)(id, ref.current, controller.signal, failed);
    return () => controller.abort();
  }, [id, go2rtc, transport, watchCameraStream, onError]);
  return <><div className={`smart-camera-player${playing ? " is-playing" : ""}`}>
    <CameraStreamPreview src={previewSrc} name={name} active={!playing} caption=""
      status={transport === "mse" ? "Trying video through Home Harmony…" : "Loading video…"} />
    <video ref={ref} aria-label={name} autoPlay muted playsInline controls={expanded} />
    <CameraMediaStatus icon={playing ? Video : LoaderCircle} label={playing ? go2rtc ? transport === "mse" ? "Live video from go2rtc · MSE" : "Live video from go2rtc" : "Live camera" : "Snapshot preview · connecting video…"} /></div></>;
}

export function MediaSurface({ entity, camera: configured, suspended = false, expanded = false, snapshotOnly = false }: MediaSource & { suspended?: boolean; expanded?: boolean; snapshotOnly?: boolean }) {
  const pageActive = usePageActive();
  const { homeOnline, currentHome } = useApp();
  const shared = useSharedConfiguration();
  const connection = shared?.state.config.settings.cameras.connections.find(item => item.id === configured?.connectionId);
  const customStream = !!configured && connection?.type === "go2rtc";
  const target = entity ?? (configured?.connectionId === "home-assistant" ? currentHome.entities.find(item => item.entityId === configured.source) : undefined);
  const id = customStream ? configured.id : target?.entityId ?? configured?.source ?? "";
  const name = configured?.name ?? target?.name ?? "Camera";
  const domain = target?.domain ?? "camera";
  const { message: t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false), [seen, setSeen] = useState(false), [active, setActive] = useState(!document.hidden);
  const [retry, setRetry] = useState(0), [failedSrc, setFailedSrc] = useState("");
  const [streamError, setStreamError] = useState("");
  const [snapshot, setSnapshot] = useState(false), [mjpeg, setMjpeg] = useState(false);
  const previewConnection = shared?.state.config.settings.cameras.connections.find(item => item.id === configured?.frigatePreview?.connectionId);
  const previewSrc = customStream || configured?.frigatePreview ? `/api/cameras/${encodeURIComponent(configured.id)}/snapshot.jpg` : `/api/camera_proxy/${encodeURIComponent(id)}`;
  const sourceKey = JSON.stringify([id, configured?.source, connection?.url, configured?.frigatePreview, previewConnection?.url]);
  const [previousSource, setPreviousSource] = useState(sourceKey);
  if (previousSource !== sourceKey) { setPreviousSource(sourceKey); setMjpeg(false); setSnapshot(false); setFailedSrc(""); }
  const camera = domain === "camera";
  const reported = customStream || homeOnline && target && available(target) && (!camera || target.state !== "off");
  const path = camera ? snapshot ? "camera_proxy" : "camera_proxy_stream" : domain === "image" ? "image_proxy" : "media_player_proxy";
  const src = `/api/${path}/${encodeURIComponent(id)}?v=${encodeURIComponent(camera ? retry : `${target?.lastUpdated ?? target?.state}-${retry}`)}`;
  const failed = failedSrc === src;
  const fallback = useCallback((message = "Stream unavailable. Check the camera connection.") => { if (customStream) { setStreamError(message); setFailedSrc(src); } else setMjpeg(true); }, [customStream, src]);
  const playerUrl = configured && go2rtcPlayerUrl(connection, configured.source);
  const paused = !pageActive || suspended || (camera && !snapshot && ((!visible && !expanded) || !active));
  useEffect(() => {
    if (!globalThis.IntersectionObserver) { setVisible(true); setSeen(true); return; }
    const observer = new IntersectionObserver(([entry]) => { setVisible(entry.isIntersecting); if (entry.isIntersecting) setSeen(true); }, { rootMargin: "100px" });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return <div ref={ref} className={`smart-entity-media${camera ? " is-camera" : domain === "image" ? " is-map" : ""}`}>
    {reported && (seen || expanded) && !paused && !failed ? snapshotOnly
      ? <div className="smart-camera-player"><CameraStreamPreview key={sourceKey} src={previewSrc} name={name} status="Loading image…" caption="Preview image · refreshes automatically" /></div>
      : camera && !mjpeg
      ? <CameraVideo key={`${sourceKey}-${retry}`} id={id} name={name} go2rtc={customStream} previewSrc={previewSrc} expanded={expanded} onError={fallback} />
      : <MediaImage key={src} src={src} name={name} caption={camera ? snapshot ? "Snapshot · live stream unavailable" : "Camera preview · video unavailable" : undefined}
        onError={() => { if (camera && !snapshot) setSnapshot(true); else setFailedSrc(src); }} />
      : <p role="status">{t(suspended ? "Open in viewer" : !homeOnline && !customStream ? "Offline" : !reported ? "Unavailable" : failed ? customStream ? streamError : "Image unavailable" : paused ? "Stream paused" : "Loading image…")}</p>}
    {!suspended && reported && (failed || mjpeg) && <Button type="button" variant="outline" onClick={() => { setFailedSrc(""); setSnapshot(false); setMjpeg(false); setRetry(value => value + 1); }}>{t("Retry")}</Button>}
    {!suspended && failed && playerUrl && <a className="text-primary underline underline-offset-4" href={playerUrl} target="_blank" rel="noreferrer">{t("Open in go2rtc (new tab)")}</a>}
  </div>;
}

export function EntityMedia({ entity, camera }: MediaSource) {
  const { message: t } = useI18n();
  const [open, setOpen] = useState(false), [person, setPerson] = useState(false);
  const hasPerson = camera && camera.personSnapshot.type !== "none";
  const name = camera?.name ?? entity?.name ?? "Camera";
  const opener = useRef<HTMLButtonElement>(null);
  const expandable = !!camera || ["camera", "image"].includes(entity?.domain);
  return <Dialog open={open} onOpenChange={setOpen}>
    <div className="smart-media-preview">
      <MediaSurface entity={entity} camera={camera} suspended={open} />
      {expandable && <button ref={opener} type="button" className="smart-media-open" aria-label={t("Expand {name}", { name })} onClick={() => setOpen(true)}><span><Expand size={18} /></span></button>}
    </div>
    {expandable && <DialogContent className="smart-media-dialog" aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}>
      <DialogHeader><DialogTitle>{name}</DialogTitle></DialogHeader>
      {hasPerson && <div className="flex flex-wrap gap-2" role="group" aria-label={t("Camera media")}>
        <Button variant={person ? "outline" : "default"} aria-pressed={!person} onClick={() => setPerson(false)}>{t("Live camera")}</Button>
        <Button variant={person ? "default" : "outline"} aria-pressed={person} onClick={() => setPerson(true)}>{t("Person snapshot")}</Button>
      </div>}
      {person && hasPerson ? <CameraPersonSnapshot cameraId={camera.id} /> : <MediaSurface entity={entity} camera={camera} expanded />}
    </DialogContent>}
  </Dialog>;
}
