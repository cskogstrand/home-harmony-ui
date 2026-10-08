import { useEffect } from "react";
import { useParams, Link, Navigate, useLocation } from "react-router-dom";
import { Cpu } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { DeviceControl, DeviceIcon } from "@/components/devices/DeviceControl";
import { EntityDetails } from "@/components/devices/EntityDetails";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { deviceName, deviceReadingsLabel, entityDetailPath } from "@/lib/device-model";

export default function DeviceDetail() {
  const { deviceId } = useParams();
  const { hash } = useLocation();
  const { currentHome, homeOnline, haUrl, connectionStatus, metadataWarnings } = useApp();
  const device = currentHome.devices.find(device => device.id === deviceId);
  const entities = currentHome.entities.filter(entity => entity.device?.id === deviceId);
  const target = entities.find(entity => `#${encodeURIComponent(entity.entityId)}` === hash)?.entityId;
  useEffect(() => {
    if (!target) return;
    const control = document.getElementById(target);
    control?.scrollIntoView?.({ block: "center" });
    control?.focus({ preventScroll: true });
  }, [target, deviceId]);
  const loading = ["connecting", "syncing", "reconnecting"].includes(connectionStatus);
  if (!device) {
    const legacyEntity = currentHome.entities.find(entity => entity.entityId === deviceId);
    if (legacyEntity) return <Navigate to={entityDetailPath(legacyEntity)} replace />;
    return <div className="planner-page"><h1>{loading ? "Loading device…" : metadataWarnings.length ? "Device information unavailable" : "Device not found"}</h1><Link to="/devices" className="text-link">Back to devices</Link></div>;
  }
  const area = currentHome.areas.find(area => area.id === device.area_id);
  return <div className="planner-page device-page">
    <Link to="/devices" className="text-link">Back to devices</Link>
    <PageHeading eyebrow={area?.name.toUpperCase() ?? "UNASSIGNED"} title={deviceName(device)} description={[device.manufacturer, device.model].filter(Boolean).join(" · ")}><span className="device-symbol"><Cpu className="h-6 w-6" aria-hidden="true" /></span></PageHeading>
    <section className="glow-panel device-overview"><PanelHeading title="About this device" />
      <p className="page-note">{deviceReadingsLabel(entities, homeOnline)}</p>
      {!!metadataWarnings.length && <p className="page-note" role="status">Device information may be incomplete. {metadataWarnings.join(" ")}</p>}
      <dl className="device-readings"><div><dt>Room</dt><dd>{area ? <Link className="text-link" to={`/areas/${encodeURIComponent(area.id)}`}>{area.name}</Link> : "Unassigned"}</dd></div>
        {device.manufacturer && <div><dt>Brand</dt><dd>{device.manufacturer}</dd></div>}{device.model && <div><dt>Model</dt><dd>{device.model}</dd></div>}
      </dl>
      {haUrl && <a className="text-link" href={`${haUrl}/config/devices/device/${encodeURIComponent(device.id)}`} target="_blank" rel="noreferrer">Manage device in Home Assistant</a>}
    </section>
    <section aria-label="Controls and readings"><PanelHeading title="Controls and readings" />
      <div className="home-device-grid">{entities.map(entity => {
        const entityArea = currentHome.areas.find(area => area.id === entity.areaId);
        return <article key={entity.entityId} id={entity.entityId} tabIndex={-1} aria-label={entity.name} className="glow-panel home-device device-entity">
          <div className="home-device-title"><span className="device-symbol"><DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-5 w-5" /></span><div className="device-name"><h3>{entity.name}</h3>{entityArea && entityArea.id !== device.area_id && <small>{entityArea.name}</small>}</div></div>
          <DeviceControl entity={entity} /><EntityDetails entity={entity} />
        </article>;
      })}</div>
      {!entities.length && <p className="glow-panel empty-note">{metadataWarnings.length ? "Controls could not be fully loaded. Check your Home Assistant connection and permissions." : "This device has no visible controls or readings. Hidden and disabled entities are managed in Home Assistant."}</p>}
    </section>
    <details className="glow-panel device-details"><summary>Device technical details</summary><dl className="device-readings"><div><dt>Device ID</dt><dd>{device.id}</dd></div>{device.sw_version && <div><dt>Software</dt><dd>{device.sw_version}</dd></div>}</dl></details>
  </div>;
}
