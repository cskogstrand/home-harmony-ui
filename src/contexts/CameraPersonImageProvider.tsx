import { useCallback, useState, type ComponentProps, type ReactNode } from "react";
import { useApp } from "./AppContext";
import { useSharedConfiguration } from "./SharedConfigurationContext";
import { CameraPersonImageContext, type CameraImage } from "./CameraPersonImageContext";
import { CameraImageLoader } from "./CameraImageLoader";
import { homeAssistantPicturePath } from "../../shared/cameras";

export function CameraPersonImageProvider({ children }: { children: ReactNode }) {
  const haUrl = useApp(app => app.haUrl);
  const connectionStatus = useApp(app => app.connectionStatus);
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
    return { cameraId: camera.id, cacheKey: JSON.stringify([camera.id, source, connection && connection.url, source.type === "home-assistant" && haUrl]),
      entityId: source.type === "home-assistant" ? source.entity : undefined, poll: source.type === "frigate" };
  }) : [];
  return <CameraPersonImageContext.Provider value={Object.fromEntries(sources.map(source => [source.cameraId, images[source.cacheKey]]))}>
    {sources.map(source => <PersonImageLoader key={source.cacheKey} {...source} src={`/api/cameras/${encodeURIComponent(source.cameraId)}/person.jpg`} enabled={!shared.state.dirty && !shared.state.saving} publish={publish} />)}
    {children}
  </CameraPersonImageContext.Provider>;
}

function PersonImageLoader({ entityId, ...props }: Omit<ComponentProps<typeof CameraImageLoader>, "revision"> & { entityId?: string }) {
  const revision = useApp(app => {
    if (!entityId) return "";
    const entity = app.currentHome.entities.find(item => item.entityId === entityId);
    const path = entity && homeAssistantPicturePath(entity.attributes.entity_picture);
    const picture = path && app.currentHome.entities.find(item => item.entityId === path.slice(path.lastIndexOf("/") + 1));
    return JSON.stringify([entity?.lastUpdated, picture && picture.lastUpdated]);
  });
  return <CameraImageLoader {...props} revision={revision} />;
}
