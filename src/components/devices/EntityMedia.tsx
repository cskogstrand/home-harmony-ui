import { useCallback, useEffect, useRef, useState } from "react";
import type { Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available } from "@/lib/ha-model";
import { Button } from "@/components/ui/button";
import { Expand } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function MediaImage({ src, name, caption, onError }: { src: string; name: string; caption?: string; onError: () => void }) {
  const { message: t } = useI18n();
  const [loaded, setLoaded] = useState(false);
  return <><img src={src} alt={name} draggable={false} onLoad={() => setLoaded(true)} onError={onError} />
    {!loaded && <p role="status">{t("Loading image…")}</p>}{loaded && caption && <span className="smart-media-caption">{t(caption)}</span>}</>;
}

function CameraVideo({ entity, expanded, onError }: { entity: Entity; expanded: boolean; onError: () => void }) {
  const { watchCameraStream } = useApp();
  const { message: t } = useI18n();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    watchCameraStream(entity.entityId, ref.current, controller.signal, onError);
    return () => controller.abort();
  }, [entity.entityId, watchCameraStream, onError]);
  return <><video ref={ref} aria-label={entity.name} autoPlay muted playsInline controls={expanded}
    poster={`/api/camera_proxy/${encodeURIComponent(entity.entityId)}`} onPlaying={() => setPlaying(true)} onWaiting={() => setPlaying(false)} onEmptied={() => setPlaying(false)} />
    {playing ? <span className="smart-media-caption">{t("Live camera")}</span> : <p role="status">{t("Loading video…")}</p>}</>;
}

function MediaSurface({ entity, suspended = false, expanded = false }: { entity: Entity; suspended?: boolean; expanded?: boolean }) {
  const { homeOnline } = useApp();
  const { message: t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false), [seen, setSeen] = useState(false), [active, setActive] = useState(!document.hidden);
  const [retry, setRetry] = useState(0), [failedSrc, setFailedSrc] = useState("");
  const [snapshot, setSnapshot] = useState(false);
  const [mjpeg, setMjpeg] = useState(false);
  const fallback = useCallback(() => setMjpeg(true), []);
  const camera = entity.domain === "camera";
  const reported = homeOnline && available(entity) && (!camera || entity.state !== "off");
  const path = camera ? snapshot ? "camera_proxy" : "camera_proxy_stream" : entity.domain === "image" ? "image_proxy" : "media_player_proxy";
  const src = `/api/${path}/${encodeURIComponent(entity.entityId)}?v=${encodeURIComponent(camera ? retry : `${entity.lastUpdated ?? entity.state}-${retry}`)}`;
  const failed = failedSrc === src;
  const paused = suspended || (camera && !snapshot && ((!visible && !expanded) || !active));
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
  return <div ref={ref} className={`smart-entity-media${entity.domain === "image" ? " is-map" : ""}`}>
    {reported && (seen || expanded) && !paused && !failed ? camera && !mjpeg
      ? <CameraVideo key={`${entity.entityId}-${retry}`} entity={entity} expanded={expanded} onError={fallback} />
      : <MediaImage key={src} src={src} name={entity.name} caption={camera ? snapshot ? "Snapshot · live stream unavailable" : "Camera preview · video unavailable" : undefined}
        onError={() => { if (camera && !snapshot) setSnapshot(true); else setFailedSrc(src); }} />
      : <p role="status">{t(suspended ? "Open in viewer" : !homeOnline ? "Offline" : !reported ? "Unavailable" : failed ? "Image unavailable" : paused ? "Stream paused" : "Loading image…")}</p>}
    {!suspended && reported && (failed || mjpeg) && <Button variant="outline" onClick={() => { setSnapshot(false); setMjpeg(false); setRetry(value => value + 1); }}>{t("Retry")}</Button>}
  </div>;
}

export function EntityMedia({ entity }: { entity: Entity }) {
  const { message: t } = useI18n();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const expandable = ["camera", "image"].includes(entity.domain);
  return <Dialog open={open} onOpenChange={setOpen}>
    <div className="smart-media-preview">
      <MediaSurface entity={entity} suspended={open} />
      {expandable && <button ref={opener} type="button" className="smart-media-open" aria-label={t("Expand {name}", { name: entity.name })} onClick={() => setOpen(true)}><span><Expand size={18} /></span></button>}
    </div>
    {expandable && <DialogContent className="smart-media-dialog" aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}>
      <DialogHeader><DialogTitle>{entity.name}</DialogTitle></DialogHeader>
      <MediaSurface entity={entity} expanded />
    </DialogContent>}
  </Dialog>;
}
