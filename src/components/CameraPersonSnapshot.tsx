import { useCameraPersonImage } from "@/contexts/CameraPersonImageContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "./ui/button";

export function CameraPersonSnapshot({ cameraId }: { cameraId: string }) {
  const { message: t } = useI18n();
  const shared = useSharedConfiguration();
  const source = shared?.state.config.settings.cameras?.items.find(camera => camera.id === cameraId)?.personSnapshot;
  const image = useCameraPersonImage(cameraId);
  const configured = source && source.type !== "none";
  return <div className="smart-entity-media is-map">
    {configured && image?.src && <img src={image.src} alt={t("Latest person snapshot")} />}
    {!configured ? <p role="status">{t("Choose a person snapshot in Camera settings.")}</p>
      : image?.failed ? <><div role="status" className="smart-media-caption">{t(image.src ? "Could not update the person snapshot. Showing the previous image." : "Person snapshot unavailable. Check the source in Camera settings.")}</div><Button type="button" variant="outline" onClick={image.refresh}>{t("Retry")}</Button></>
      : !image?.src ? <p role="status">{t("Loading image…")}</p> : <span className="smart-media-caption">{t("Latest person snapshot · may predate this alert")}</span>}
  </div>;
}
