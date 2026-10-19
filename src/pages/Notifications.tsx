import { useI18n } from "@/hooks/use-i18n";
import { entityDetailPath } from "@/lib/device-model";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { available } from "@/lib/ha-model";
export default function Notifications() {
  const { t, message } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const unavailable = currentHome.entities.filter(e => !available(e));
  return <div className="planner-page"><PageHeading title={t("Notifications")} description={t("Device availability")} /><section className="glow-panel">{!homeOnline && <p className="page-note">{t("Cached status is stale while disconnected.")}</p>}{unavailable.map(e => <p key={e.entityId}><Link className="text-link" to={entityDetailPath(e)}>{e.name} · {message(e.state)}</Link></p>)}{!unavailable.length && <p>{t("No unavailable entities in the loaded state.")}</p>}</section></div>;
}
