import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraImage } from "./CameraPersonImageContext";

export function CameraImageLoader({ src, cacheKey, revision, poll, enabled, publish }: {
  src: string; cacheKey: string; revision: string; poll: boolean; enabled: boolean;
  publish: (key: string, image?: CameraImage) => void;
}) {
  const current = useRef("");
  const dimensions = useRef<{ width: number; height: number }>();
  const busy = useRef(false), failed = useRef(false), viewers = useRef(0);
  const changed = useRef(false), previousRevision = useRef(revision);
  const [retry, setRetry] = useState(0);
  const refresh = useCallback(() => { if (!busy.current) setRetry(value => value + 1); }, []);
  const watch = useCallback(() => { viewers.current++; return () => { viewers.current--; }; }, []);
  useEffect(() => () => {
    if (current.current) URL.revokeObjectURL(current.current);
    publish(cacheKey);
  }, [cacheKey, publish]);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, pending = "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    busy.current = true; changed.current = false;
    publish(cacheKey, { src: current.current, ...dimensions.current, failed: failed.current, refresh, watch });
    const load = async () => {
      try {
        const response = await fetch(src, { signal: controller.signal, cache: "no-store" });
        if (!response.ok || !/^image\/(jpeg|png|webp|gif)(;|$)/i.test(response.headers.get("content-type") ?? "")) throw new Error();
        const blob = await response.blob();
        if (stopped) return;
        controller.signal.throwIfAborted();
        pending = URL.createObjectURL(blob);
        const image = new Image(); image.src = pending;
        await Promise.race([image.decode(), new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => reject(new Error("Image request cancelled")), { once: true });
        })]);
        if (stopped) return;
        controller.signal.throwIfAborted();
        const previous = current.current;
        current.current = pending; pending = ""; failed.current = false;
        dimensions.current = { width: image.naturalWidth, height: image.naturalHeight };
        publish(cacheKey, { src: current.current, ...dimensions.current, failed: false, refresh, watch });
        if (previous) URL.revokeObjectURL(previous);
      } catch {
        if (!stopped) {
          failed.current = true;
          publish(cacheKey, { src: current.current, ...dimensions.current, failed: true, refresh, watch });
        }
      } finally {
        clearTimeout(timeout);
        if (pending) { URL.revokeObjectURL(pending); pending = ""; }
        if (!stopped) {
          busy.current = false;
          if (changed.current) { changed.current = false; refresh(); }
        }
      }
    };
    void load();
    return () => {
      stopped = true; controller.abort(); clearTimeout(timeout); busy.current = false;
      if (pending) { URL.revokeObjectURL(pending); pending = ""; }
    };
  }, [src, cacheKey, enabled, retry, publish, refresh, watch]);
  useEffect(() => {
    if (previousRevision.current === revision) return;
    previousRevision.current = revision;
    // Coalesce HA updates during a slow request so frequent events cannot starve the image.
    if (busy.current) changed.current = true; else refresh();
  }, [revision, refresh]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden && (poll || failed.current || viewers.current > 0)) refresh(); }, 5000);
    const visible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [poll, refresh]);
  return null;
}
