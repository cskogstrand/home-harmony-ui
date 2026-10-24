import { useEffect, useRef, useState } from "react";
import type { Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available } from "@/lib/ha-model";
import { Button } from "@/components/ui/button";

function MediaImage({ src, name, caption, onError }: { src: string; name: string; caption?: string; onError: () => void }) {
  const { message: t } = useI18n();
  const [loaded, setLoaded] = useState(false);
  return <><img src={src} alt={name} onLoad={() => setLoaded(true)} onError={onError} />
    {!loaded && <p role="status">{t("Loading image…")}</p>}{loaded && caption && <span className="smart-media-caption">{t(caption)}</span>}</>;
}

export function EntityMedia({ entity }: { entity: Entity }) {
  const { homeOnline } = useApp();
  const { message: t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false), [seen, setSeen] = useState(false), [active, setActive] = useState(!document.hidden);
  const [retry, setRetry] = useState(0), [failedSrc, setFailedSrc] = useState("");
  const [snapshot, setSnapshot] = useState(false);
  const camera = entity.domain === "camera";
  const reported = homeOnline && available(entity) && (!camera || entity.state !== "off");
  const path = camera ? snapshot ? "camera_proxy" : "camera_proxy_stream" : entity.domain === "image" ? "image_proxy" : "media_player_proxy";
  const src = `/api/${path}/${encodeURIComponent(entity.entityId)}?v=${encodeURIComponent(camera ? retry : `${entity.lastUpdated ?? entity.state}-${retry}`)}`;
  const failed = failedSrc === src;
  const paused = camera && !snapshot && (!visible || !active);
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
    {reported && seen && !paused && !failed ? <MediaImage key={src} src={src} name={entity.name} caption={camera ? snapshot ? "Snapshot · live stream unavailable" : "Live camera" : undefined}
      onError={() => { if (camera && !snapshot) setSnapshot(true); else setFailedSrc(src); }} />
      : <p role="status">{t(!homeOnline ? "Offline" : !reported ? "Unavailable" : failed ? "Image unavailable" : paused ? "Stream paused" : "Loading image…")}</p>}
    {reported && (failed || snapshot) && <Button variant="outline" onClick={() => { setSnapshot(false); setRetry(value => value + 1); }}>{t("Retry")}</Button>}
  </div>;
}
