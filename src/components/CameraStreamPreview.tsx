import { useContext, useEffect, useRef, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { CameraMediaStatus } from "@/components/CameraMediaStatus";
import { useI18n } from "@/hooks/use-i18n";
import { CameraPreviewImageContext } from "@/contexts/CameraPreviewImageContext";

// A decoded frame stays visible while the next request loads; never queue snapshots.
export function CameraStreamPreview({ src, name, status, active = true, caption = "Snapshot preview · connecting video…" }: { src: string; name: string; status: string; active?: boolean; caption?: string }) {
  const { message: t } = useI18n();
  const cache = useContext(CameraPreviewImageContext);
  // The shared cache owns configured sources even before the first frame is ready.
  const cached = src in cache;
  const [frame, setFrame] = useState("");
  const [failed, setFailed] = useState(false);
  const current = useRef("");
  useEffect(() => {
    setFrame(""); setFailed(false);
    return () => { if (current.current) URL.revokeObjectURL(current.current); current.current = ""; };
  }, [src]);
  useEffect(() => {
    if (!active || cached) return;
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
  }, [src, active, cached]);
  const image = cached ? cache[src]?.src : frame;
  const unavailable = cached ? cache[src]?.failed : failed;
  return <div className="smart-camera-preview">
    {image ? <><img src={image} alt={name} draggable={false} />{caption && <CameraMediaStatus label={caption} icon={ImageIcon} />}</>
      : <p role="status">{t(unavailable ? "Preview image unavailable. Check the camera connection. Retrying…" : status)}</p>}
  </div>;
}
