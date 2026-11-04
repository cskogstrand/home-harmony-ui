import { useCallback, useState, type ReactNode } from "react";
import { useApp } from "./AppContext";
import { useSharedConfiguration } from "./SharedConfigurationContext";
import { CameraPersonImageContext, type CameraImage } from "./CameraPersonImageContext";
import { CameraImageLoader } from "./CameraImageLoader";
import { homeAssistantPicturePath } from "../../shared/cameras";

export function CameraPersonImageProvider({ children }: { children: ReactNode }) {
  const { currentHome, haUrl, connectionStatus } = useApp();
  const shared = useSharedConfiguration();
  const [images, setImages] = useState<Record<string, CameraImage>>({});
  const publish = useCallback((key: string, image?: CameraImage) => setImages(current => {
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
    {sources.map(source => <CameraImageLoader key={source.cacheKey} {...source} src={`/api/cameras/${encodeURIComponent(source.cameraId)}/person.jpg`} enabled={!shared.state.dirty && !shared.state.saving} publish={publish} />)}
    {children}
  </CameraPersonImageContext.Provider>;
}
