import { Link } from "react-router-dom";
import { Camera } from "lucide-react";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { PageHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { EntityMedia } from "@/components/devices/EntityMedia";

export default function Cameras() {
  const { message: t } = useI18n();
  const shared = useSharedConfiguration();
  const settings = shared.state.config.settings.cameras;
  return <div className="planner-page">
    <PageHeading title={t("Cameras")} description={t("Your cameras, ready to watch or use in notifications.")}>
      <Button asChild><Link to="/settings/cameras?add">{t("Add camera")}</Link></Button>
      <Button variant="outline" asChild><Link to="/settings/cameras">{t("Manage cameras")}</Link></Button>
    </PageHeading>
    {!settings.items.length && <section className="glow-panel space-y-3"><Camera size={28} aria-hidden="true" /><h2 className="text-xl font-semibold">{t("No cameras added yet")}</h2><p className="page-note">{t("Add a camera and choose its connection. Home Assistant cameras are available to select, but are not added automatically.")}</p><Button variant="outline" asChild><Link to="/settings/camera-connections">{t("Manage connections")}</Link></Button></section>}
    <div className="grid gap-6 lg:grid-cols-2">{settings.items.map(camera => <section key={camera.id} className="glow-panel min-w-0 space-y-4" aria-label={camera.name}>
      <div><h2 className="text-xl font-semibold break-words">{camera.name}</h2><p className="page-note break-words">{camera.connectionId === "home-assistant" ? "Home Assistant" : settings.connections.find(item => item.id === camera.connectionId)?.name} · {camera.source}</p></div>
      <EntityMedia camera={camera} />
      <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link to={`/settings/cameras?camera=${encodeURIComponent(camera.id)}`}>{t("Configure camera")}</Link></Button><Button variant="outline" asChild><Link to={`/settings/notifications?camera=${encodeURIComponent(camera.id)}`}>{t("Use in notification")}</Link></Button></div>
    </section>)}</div>
  </div>;
}
