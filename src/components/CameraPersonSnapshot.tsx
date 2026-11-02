import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "./ui/button";

export function CameraPersonSnapshot({ cameraId }: { cameraId: string }) {
  const { message: t } = useI18n();
  const { currentHome } = useApp();
  const shared = useSharedConfiguration();
  const source = shared?.state.config.settings.cameras?.items.find(camera => camera.id === cameraId)?.personSnapshot;
  const imageEntity = source?.type === "home-assistant" ? currentHome.entities.find(entity => entity.entityId === source.entity) : undefined;
  const [revision, setRevision] = useState(Date.now);
  const [failed, setFailed] = useState("");
  const [loaded, setLoaded] = useState("");
  const configured = source && source.type !== "none";
  const sourceKey = JSON.stringify(source);
  const src = `/api/cameras/${encodeURIComponent(cameraId)}/person.jpg?v=${encodeURIComponent(`${revision}-${imageEntity?.lastUpdated ?? ""}`)}`;
  useEffect(() => { setRevision(Date.now()); }, [cameraId, sourceKey]);
  useEffect(() => {
    if (!configured) return;
    // Refresh while visible so a snapshot published just after the trigger can replace the previous one.
    const timer = window.setInterval(() => { if (!document.hidden && (loaded === src || failed === src)) setRevision(Date.now()); }, 5000);
    return () => window.clearInterval(timer);
  }, [configured, loaded, failed, src]);
  return <div className="smart-entity-media is-map">
    {configured && failed !== src && <img src={src} alt={t("Latest person snapshot")} onLoad={() => setLoaded(src)} onError={() => setFailed(src)} />}
    {!configured ? <p role="status">{t("Choose a person snapshot in Camera settings.")}</p>
      : failed === src ? <><p role="status">{t("Person snapshot unavailable. Check the source in Camera settings.")}</p><Button type="button" variant="outline" onClick={() => setRevision(Date.now())}>{t("Retry")}</Button></>
      : loaded !== src ? <p role="status">{t("Loading image…")}</p> : <span className="smart-media-caption">{t("Latest person snapshot · may predate this alert")}</span>}
  </div>;
}
