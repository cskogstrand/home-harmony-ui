import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/hooks/use-i18n";

// A decoded frame stays visible while the next request loads; never queue snapshots.
export function CameraStreamPreview({ src, name, status, active = true, caption = "Snapshot preview · connecting video…" }: { src: string; name: string; status: string; active?: boolean; caption?: string }) {
  const { message: t } = useI18n();
  const [frame, setFrame] = useState("");
  const [failed, setFailed] = useState(false);
  const current = useRef("");
  useEffect(() => {
    setFrame(""); setFailed(false);
    return () => { if (current.current) URL.revokeObjectURL(current.current); current.current = ""; };
  }, [src]);
  useEffect(() => {
    if (!active) return;
    let stopped = false, pending = "";
    let request: AbortController;
    let timer: ReturnType<typeof setTimeout>, timeout: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      const started = performance.now();
      request = new AbortController();
      timeout = setTimeout(() => request.abort(), 5000);
      let delay = 2000;
      try {
        const response = await fetch(src, { signal: request.signal, cache: "no-store" });
        if (!response.ok || !/^image\/(jpeg|png|webp|gif)(;|$)/i.test(response.headers.get("content-type") ?? "")) throw new Error();
        const blob = await response.blob();
        if (stopped || request.signal.aborted) return;
        pending = URL.createObjectURL(blob);
        const image = new Image(); image.src = pending;
        await image.decode();
        if (stopped || request.signal.aborted) return;
        setFrame(pending);
        setFailed(false);
        if (current.current) URL.revokeObjectURL(current.current);
        current.current = pending; pending = "";
        delay = Math.max(0, 500 - (performance.now() - started));
      } catch {
        // Snapshot errors must not interrupt the parallel live-video connection.
        if (!stopped) setFailed(true);
      } finally {
        clearTimeout(timeout);
        if (pending) { URL.revokeObjectURL(pending); pending = ""; }
        if (!stopped) timer = setTimeout(() => { void refresh(); }, delay);
      }
    };
    void refresh();
    return () => {
      stopped = true; clearTimeout(timer); clearTimeout(timeout); request?.abort();
      if (pending) { URL.revokeObjectURL(pending); pending = ""; }
    };
  }, [src, active]);
  return <div className="smart-camera-preview">
    {frame ? <><img src={frame} alt={name} draggable={false} />{caption && <span className="smart-media-caption">{t(caption)}</span>}</>
      : <p role="status">{t(failed ? "Preview image unavailable. Check the camera connection. Retrying…" : status)}</p>}
  </div>;
}
