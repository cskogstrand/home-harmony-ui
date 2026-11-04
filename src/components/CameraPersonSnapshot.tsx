import { useCameraPersonImage } from "@/contexts/CameraPersonImageContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CircleAlert, UserRound } from "lucide-react";
import { CameraMediaStatus } from "./CameraMediaStatus";

export function CameraPersonSnapshot({ cameraId, overlay = false }: { cameraId: string; overlay?: boolean }) {
  const { message: t } = useI18n();
  const shared = useSharedConfiguration();
  const camera = shared?.state.config.settings.cameras?.items.find(camera => camera.id === cameraId);
  const source = camera?.personSnapshot;
  const image = useCameraPersonImage(cameraId);
  const configured = source && source.type !== "none";
  const retry = configured && image?.failed && <Button type="button" variant="outline" onClick={image.refresh}>{t("Retry")}</Button>;
  const status = !configured ? "Choose a person snapshot in Camera settings."
    : image?.failed ? image.src ? "Could not update the person snapshot. Showing the previous image." : "Person snapshot unavailable. Check the source in Camera settings."
    : !image?.src ? "Loading image…" : "Latest person snapshot · may predate this alert";
  if (overlay) return <Popover>
    <PopoverTrigger asChild><button type="button" className="smart-person-pip" data-size={camera?.personPipSize ?? "medium"} aria-label={t("Latest person snapshot")} title={t(status)}>
      {configured && image?.src ? <img src={image.src} alt={t("Latest person snapshot")} /> : <UserRound size={24} aria-hidden="true" />}
      {image?.failed && <CircleAlert className="smart-person-pip-error" size={18} aria-hidden="true" />}
    </button></PopoverTrigger>
    <PopoverContent side="bottom" align="end" className="space-y-2 text-sm" aria-label={t("Latest person snapshot")}>
      <p role="status">{t(status)}</p>
      {retry}
    </PopoverContent>
  </Popover>;
  return <div className="smart-entity-media is-camera">
    {configured && image?.src ? <>
      <img src={image.src} alt={t("Latest person snapshot")} />
      <CameraMediaStatus label={status} icon={image.failed ? CircleAlert : UserRound}>{retry}</CameraMediaStatus>
    </> : <><p role="status">{t(status)}</p>{retry}</>}
  </div>;
}
