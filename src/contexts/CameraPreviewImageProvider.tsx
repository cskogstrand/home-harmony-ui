import { useCallback, useState, type ReactNode } from "react";
import { useApp } from "./AppContext";
import { useSharedConfiguration } from "./SharedConfigurationContext";
import type { CameraImage } from "./CameraPersonImageContext";
import { CameraImageLoader } from "./CameraImageLoader";
import { CameraPreviewImageContext } from "./CameraPreviewImageContext";
import { cameraPreviewPath } from "../../shared/cameras";

export function CameraPreviewImageProvider({ children }: { children: ReactNode }) {
  const { haUrl, connectionStatus } = useApp();
  const shared = useSharedConfiguration();
  const [images, setImages] = useState<Record<string, CameraImage>>({});
  const publish = useCallback((key: string, image?: CameraImage) => setImages(current => {
    const next = { ...current };
    if (image) next[key] = image; else delete next[key];
    return next;
  }), []);
  const settings = shared.state.config.settings.cameras;
  const ready = shared.state.loaded && !shared.state.error && connectionStatus !== "auth-error";
  const sources = [...new Map(settings.items.map(camera => {
    const src = cameraPreviewPath(camera);
    const connection = settings.connections.find(item => item.id === camera.connectionId);
    const preview = settings.connections.find(item => item.id === camera.frigatePreview?.connectionId);
    return [src, { src, cacheKey: JSON.stringify([src, camera.source, connection?.url, camera.frigatePreview, preview?.url,
      camera.connectionId === "home-assistant" && haUrl]) }] as const;
  })).values()];
  return <CameraPreviewImageContext.Provider value={Object.fromEntries(sources.map(source => [source.src, ready ? images[source.cacheKey] : undefined]))}>
    {ready && sources.map(source => <CameraImageLoader key={source.cacheKey} {...source} revision="" poll
      enabled={!shared.state.dirty && !shared.state.saving} publish={publish} />)}
    {children}
  </CameraPreviewImageContext.Provider>;
}
