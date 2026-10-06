import { useParams, Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { DeviceControl, DeviceIcon } from "@/components/devices/DeviceControl";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
export default function DeviceDetail() {
  const { deviceId } = useParams();
  const { currentHome, homeOnline } = useApp();
  const entity = currentHome.entities.find(e => e.entityId === deviceId);
  if (!entity) return <div className="planner-page"><h1>Entity not found</h1><Link to="/devices">Back to devices</Link></div>;
  const device = entity.device;
  const room = currentHome.rooms.find(r => r.id === entity.areaId);
  return <div className="planner-page"><Link to="/devices" aria-label="Back to devices" className="text-link">Back to devices</Link><PageHeading eyebrow={room?.name.toUpperCase()} title={entity.name} description={entity.entityId}><span className="device-symbol"><DeviceIcon type={entity.domain} className="h-6 w-6" /></span></PageHeading>
    <div className="smart-bottom"><section className="glow-panel"><PanelHeading title="Reported state & controls" /><DeviceControl entity={entity} /><p className="page-note">{homeOnline ? "Readings come from Home Assistant. Service acceptance does not guarantee a physical state change." : "Cached readings are stale. Controls are paused."}</p></section>
      <section className="glow-panel"><PanelHeading title="At a glance" /><dl className="device-readings"><div><dt>Area</dt><dd><Link to={`/rooms/${entity.areaId}`}>{room?.name}</Link></dd></div><div><dt>Physical device</dt><dd>{device?.name_by_user || device?.name || device?.id || "Not registered"}</dd></div>{device?.manufacturer && <div><dt>Manufacturer</dt><dd>{device.manufacturer}</dd></div>}{device?.model && <div><dt>Model</dt><dd>{device.model}</dd></div>}{device?.sw_version && <div><dt>Software</dt><dd>{device.sw_version}</dd></div>}<div><dt>Last updated</dt><dd>{entity.lastUpdated ? new Date(entity.lastUpdated).toLocaleString() : "Not reported"}</dd></div></dl></section></div>
    <section className="glow-panel"><PanelHeading title="Entity attributes" /><dl className="device-readings">{Object.entries(entity.attributes).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, " ")}</dt><dd className="break-all">{value == null ? "Not reported" : typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl></section>
  </div>;
}
