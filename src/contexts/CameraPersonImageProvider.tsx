import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "./AppContext";
import { useSharedConfiguration } from "./SharedConfigurationContext";
import { CameraPersonImageContext, type CameraPersonImage } from "./CameraPersonImageContext";
import { homeAssistantPicturePath } from "../../shared/cameras";

function PersonImageLoader({ cameraId, cacheKey, revision, poll, enabled, publish }: {
  cameraId: string; cacheKey: string; revision: string; poll: boolean; enabled: boolean;
  publish: (key: string, image?: CameraPersonImage) => void;
}) {
  const current = useRef("");
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
    publish(cacheKey, { src: current.current, failed: failed.current, refresh, watch });
    const load = async () => {
      try {
        const response = await fetch(`/api/cameras/${encodeURIComponent(cameraId)}/person.jpg`, { signal: controller.signal, cache: "no-store" });
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
        publish(cacheKey, { src: current.current, failed: false, refresh, watch });
        if (previous) URL.revokeObjectURL(previous);
      } catch {
        if (!stopped) {
          failed.current = true;
          publish(cacheKey, { src: current.current, failed: true, refresh, watch });
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
  }, [cameraId, cacheKey, enabled, retry, publish, refresh, watch]);
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

export function CameraPersonImageProvider({ children }: { children: ReactNode }) {
  const { currentHome, haUrl, connectionStatus } = useApp();
  const shared = useSharedConfiguration();
  const [images, setImages] = useState<Record<string, CameraPersonImage>>({});
  const publish = useCallback((key: string, image?: CameraPersonImage) => setImages(current => {
    const next = { ...current };
    if (image) next[key] = image; else delete next[key];
    return next;
  }), []);
  const settings = shared.state.config.settings.cameras;
  const ready = shared.state.loaded && !shared.state.error && connectionStatus !== "auth-error";
  const sources = ready ? settings.items.filter(camera => camera.personSnapshot.type !== "none").map(camera => {
    const source = camera.personSnapshot;
    const connection = source.type === "frigate" && settings.connections.find(item => item.id === source.connectionId);
    const entity = source.type === "home-assistant" && currentHome.entities.find(item => item.entityId === source.entity);
    const picturePath = entity && homeAssistantPicturePath(entity.attributes.entity_picture);
    const picture = picturePath && currentHome.entities.find(item => item.entityId === picturePath.slice(picturePath.lastIndexOf("/") + 1));
    return { cameraId: camera.id, cacheKey: JSON.stringify([camera.id, source, connection && connection.url, source.type === "home-assistant" && haUrl]),
      revision: JSON.stringify([entity && entity.lastUpdated, picture && picture.lastUpdated]), poll: source.type === "frigate" };
  }) : [];
  return <CameraPersonImageContext.Provider value={Object.fromEntries(sources.map(source => [source.cameraId, images[source.cacheKey]]))}>
    {sources.map(source => <PersonImageLoader key={source.cacheKey} {...source} enabled={!shared.state.dirty && !shared.state.saving} publish={publish} />)}
    {children}
  </CameraPersonImageContext.Provider>;
}
