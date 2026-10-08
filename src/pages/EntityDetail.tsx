import { useParams, Link, Navigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { DeviceControl, DeviceIcon } from "@/components/devices/DeviceControl";
import { EntityDetails } from "@/components/devices/EntityDetails";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { entityDetailPath } from "@/lib/device-model";

export default function EntityDetail() {
  const { entityId } = useParams();
  const { currentHome, connectionStatus } = useApp();
  const entity = currentHome.entities.find(entity => entity.entityId === entityId);
  if (!entity) return <div className="planner-page"><h1>{["connecting", "syncing", "reconnecting"].includes(connectionStatus) ? "Loading control…" : "Control not found"}</h1><Link to="/devices" className="text-link">Back to devices</Link></div>;
  if (entity.device) return <Navigate to={entityDetailPath(entity)} replace />;
  const area = currentHome.areas.find(area => area.id === entity.areaId);
  return <div className="planner-page device-page"><Link to="/devices" className="text-link">Back to devices</Link>
    <PageHeading eyebrow={area?.name.toUpperCase() ?? "OTHER CONTROLS"} title={entity.name} description="No associated device in the loaded home information."><span className="device-symbol"><DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-6 w-6" /></span></PageHeading>
    <section className="glow-panel"><PanelHeading title="Controls and readings" /><DeviceControl key={entity.entityId} entity={entity} /></section>
    {area && <section className="glow-panel"><dl className="device-readings"><div><dt>Room</dt><dd><Link className="text-link" to={`/areas/${encodeURIComponent(area.id)}`}>{area.name}</Link></dd></div></dl></section>}
    <section className="glow-panel"><EntityDetails entity={entity} /></section>
  </div>;
}
