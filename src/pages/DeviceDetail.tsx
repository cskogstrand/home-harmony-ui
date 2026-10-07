import { useParams, Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { DeviceControl, DeviceIcon } from "@/components/devices/DeviceControl";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
export default function DeviceDetail() {
  const { deviceId } = useParams();
  const { currentHome } = useApp();
  const entity = currentHome.entities.find(e => e.entityId === deviceId);
  if (!entity) return <div className="planner-page"><h1>Device not found</h1><Link to="/devices">Back to devices</Link></div>;
  const device = entity.device;
  const area = currentHome.areas.find(r => r.id === entity.areaId);
  return <div className="planner-page"><Link to="/devices" aria-label="Back to devices" className="text-link">Back to devices</Link><PageHeading eyebrow={area?.id !== "unassigned" ? area?.name.toUpperCase() : undefined} title={entity.name}><span className="device-symbol"><DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-6 w-6" /></span></PageHeading>
    <div className="smart-bottom"><section className="glow-panel"><PanelHeading title="Controls" /><DeviceControl key={entity.entityId} entity={entity} /></section>
      <section className="glow-panel"><PanelHeading title="About" /><dl className="device-readings">{area && <div><dt>Room</dt><dd><Link to={`/areas/${entity.areaId}`}>{area.name}</Link></dd></div>}{device && <div><dt>Device</dt><dd>{device.name_by_user || device.name || device.id}</dd></div>}{device?.manufacturer && <div><dt>Brand</dt><dd>{device.manufacturer}</dd></div>}{device?.model && <div><dt>Model</dt><dd>{device.model}</dd></div>}</dl></section></div>
    <details className="glow-panel device-details"><summary>Technical details</summary><dl className="device-readings"><div><dt>Entity ID</dt><dd>{entity.entityId}</dd></div><div><dt>Last updated</dt><dd>{entity.lastUpdated ? new Date(entity.lastUpdated).toLocaleString() : "Not reported"}</dd></div>{device?.sw_version && <div><dt>Software</dt><dd>{device.sw_version}</dd></div>}{Object.entries(entity.attributes).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, " ")}</dt><dd>{value == null ? "Not reported" : typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl></details>
  </div>;
}
