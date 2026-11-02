import { Link } from "react-router-dom";
import { Camera, Settings } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { PageHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { EntityMedia } from "@/components/devices/EntityMedia";

export default function Cameras() {
  const { message: t } = useI18n();
  const { currentHome } = useApp();
  const shared = useSharedConfiguration();
  const cameras = currentHome.entities.filter(entity => entity.domain === "camera");
  return <div className="planner-page">
    <PageHeading title={t("Cameras")} description={t("Watch live video here. Configure each camera to choose Home Assistant or a go2rtc stream.")}>
      <Button variant="outline" asChild><Link to="/settings/cameras"><Settings size={18} aria-hidden="true" />{t("Camera settings")}</Link></Button>
    </PageHeading>
    {!cameras.length && <section className="glow-panel empty-note"><Camera size={28} aria-hidden="true" /><p>{t("No Home Assistant camera entities available. Add a camera in Home Assistant, then reconnect.")}</p></section>}
    <div className="grid gap-6 lg:grid-cols-2">{cameras.map(entity => {
      const source = shared?.state.config.settings.cameras.sources[entity.entityId];
      return <section key={entity.entityId} className="glow-panel min-w-0 space-y-4" aria-label={entity.name}>
        <div><h2 className="text-xl font-semibold break-words">{entity.name}</h2><p className="page-note break-words">{source?.stream ? t("Live video: go2rtc · {stream}", { stream: source.stream }) : t("Live video: Home Assistant")}</p></div>
        <EntityMedia entity={entity} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link to={`/settings/cameras?camera=${encodeURIComponent(entity.entityId)}`}>{t("Configure camera")}</Link></Button>
          <Button variant="outline" asChild><Link to={`/settings/notifications?camera=${encodeURIComponent(entity.entityId)}`}>{t("Use in notification")}</Link></Button>
        </div>
      </section>;
    })}</div>
  </div>;
}
