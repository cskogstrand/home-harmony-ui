import { entityDetailPath } from "@/lib/device-model";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { available } from "@/lib/ha-model";
export default function Notifications() {
  const { currentHome, homeOnline } = useApp();
  const unavailable = currentHome.entities.filter(e => !available(e));
  return <div className="planner-page"><PageHeading eyebrow="HOME STATUS" title="Notifications" description="Device availability" /><section className="glow-panel">{!homeOnline && <p className="page-note">Cached status is stale while disconnected.</p>}{unavailable.map(e => <p key={e.entityId}><Link className="text-link" to={entityDetailPath(e)}>{e.name} · {e.state}</Link></p>)}{!unavailable.length && <p>No unavailable entities in the loaded state.</p>}</section></div>;
}
