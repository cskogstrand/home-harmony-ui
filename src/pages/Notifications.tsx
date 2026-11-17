import { Activity } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { deviceName, entityDetailPath } from "@/lib/device-model";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { useFamily } from "@/contexts/FamilyContext";
import { NotificationList } from "@/components/NotificationCenter";
import { Button } from "@/components/ui/button";
import { available } from "@/lib/ha-model";
export default function Notifications() {
  const { t, message, language } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const { notifications } = useFamily();
  const unavailable = currentHome.entities.filter(e => !available(e));
  const groups = new Map<string, typeof unavailable>();
  for (const entity of unavailable) {
    const key = entity.device ? `device:${entity.device.id}` : `integration:${entity.integration ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), entity]);
  }
  const unknown = unavailable.filter(entity => entity.state === "unknown").length;
  return <div className="planner-page"><PageHeading title={t("Notifications")} description={message("Running tasks, current events and camera alerts")}><Button variant="outline" asChild><Link to="/settings/notifications">{message("Notification settings")}</Link></Button></PageHeading>
    {!homeOnline && <p role="status" className="page-note">{message("Notifications are paused until Home Assistant reconnects.")}</p>}
    {!notifications.enabled && <p role="status" className="page-note">{message("Notifications are turned off in settings.")}</p>}
    {!notifications.rules.length && <p className="page-note">{message("No rules yet. Add an ongoing task for an appliance, a current alert for a state or calendar, or a camera popup for your doorbell.")}</p>}
    <NotificationList presentation={notifications.presentation} />
    <details className="glow-panel availability-diagnostics"><summary><Activity size={20} aria-hidden="true" /><strong>{t("Device availability")}</strong><span>{unavailable.length}</span></summary>
      {!homeOnline && <p className="page-note">{t("Cached status is stale while disconnected.")}</p>}
      {!!unavailable.length && <><p className="page-note">{t("{unavailable} unavailable · {unknown} unknown", { unavailable: unavailable.length - unknown, unknown })}</p><p className="page-note">{t("Unknown means no value has been reported. Unavailable means Home Assistant cannot currently read the entity.")}</p></>}
      {[...groups].map(([key, entities]) => <details key={key} className="availability-group"><summary>{entities[0].device ? deviceName(entities[0].device, language) : entities[0].integration || t("Other entities")} <span>({entities.length})</span></summary><ul>{entities.map(entity => <li key={entity.entityId}><Link className="text-link" to={entityDetailPath(entity)}>{entity.name}</Link><span>{message(entity.state)}</span></li>)}</ul></details>)}
      {!unavailable.length && <p>{t("No unavailable entities in the loaded state.")}</p>}
    </details>
  </div>;
}
