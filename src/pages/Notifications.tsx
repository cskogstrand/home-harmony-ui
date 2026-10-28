import { Activity } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { entityDetailPath } from "@/lib/device-model";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { useFamily } from "@/contexts/FamilyContext";
import { NotificationList } from "@/components/NotificationCenter";
import { Button } from "@/components/ui/button";
import { available } from "@/lib/ha-model";
export default function Notifications() {
  const { t, message } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const { notifications } = useFamily();
  const unavailable = currentHome.entities.filter(e => !available(e));
  return <div className="planner-page"><PageHeading title={t("Notifications")} description={message("Running tasks, current events and camera alerts")}><Button variant="outline" asChild><Link to="/settings/notifications">{message("Notification settings")}</Link></Button></PageHeading>
    {!homeOnline && <p role="status" className="page-note">{message("Notifications are paused until Home Assistant reconnects.")}</p>}
    {!notifications.enabled && <p role="status" className="page-note">{message("Notifications are turned off in settings.")}</p>}
    {!notifications.rules.length && <p className="page-note">{message("No rules yet. Add an ongoing task for an appliance, a current alert for a state or calendar, or a camera popup for your doorbell.")}</p>}
    <NotificationList />
    <section className="glow-panel"><PanelHeading icon={Activity} title={t("Device availability")} />{!homeOnline && <p className="page-note">{t("Cached status is stale while disconnected.")}</p>}{unavailable.map(e => <p key={e.entityId}><Link className="text-link" to={entityDetailPath(e)}>{e.name} · {message(e.state)}</Link></p>)}{!unavailable.length && <p>{t("No unavailable entities in the loaded state.")}</p>}</section>
  </div>;
}
