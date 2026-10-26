import { useI18n } from "@/hooks/use-i18n";
import { useEffect } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, MapPin } from "lucide-react";
import { useParams, Link, Navigate, useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { PhysicalDeviceIcon } from "@/components/devices/DeviceCard";
import { DeviceControl, DeviceIcon } from "@/components/devices/DeviceControl";
import { EntityDetails } from "@/components/devices/EntityDetails";
import { DeviceReading } from "@/components/devices/DeviceReading";
import { SmartHomeCard } from "@/components/devices/SmartHomeCard";
import { DeviceTools } from "@/components/devices/DeviceTools";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { deviceDetailSections, deviceName, deviceReadingsLabel, deviceType, entityDetailPath } from "@/lib/device-model";
import type { Entity } from "@/types/api";
import "./device-detail.css";

export default function DeviceDetail() {
  const { t, message, language } = useI18n();
  const { deviceId } = useParams();
  const { hash, state } = useLocation();
  const backTo = { pathname: "/devices", search: typeof state?.deviceList === "string" ? state.deviceList : "" };
  const { currentHome, homeOnline, connectionStatus, metadataWarnings } = useApp();
  const device = currentHome.devices.find(device => device.id === deviceId);
  const entities = currentHome.entities.filter(entity => entity.device?.id === deviceId);
  const target = entities.find(entity => `#${encodeURIComponent(entity.entityId)}` === hash)?.entityId;
  useEffect(() => {
    if (!target) return;
    const control = document.getElementById(target);
    let parent = control?.parentElement;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    control?.scrollIntoView?.({ block: "center" });
    control?.focus({ preventScroll: true });
  }, [target, deviceId]);
  const loading = ["connecting", "syncing", "reconnecting"].includes(connectionStatus);
  if (!device) {
    const legacyEntity = currentHome.entities.find(entity => entity.entityId === deviceId);
    if (legacyEntity) return <Navigate to={entityDetailPath(legacyEntity)} state={state} replace />;
    return <div className="planner-page"><h1>{loading ? t("Loading device…") : metadataWarnings.length ? t("Device information unavailable") : t("Device not found")}</h1><Link to={backTo} className="text-link">{t("Back to devices")}</Link></div>;
  }
  const area = currentHome.areas.find(area => area.id === device.area_id);
  const sections = deviceDetailSections(entities);
  const identity = sections.primary.length ? sections.primary : entities;
  const availability = deviceReadingsLabel(entities, homeOnline);
  const StatusIcon = availability === "Readings available" ? CheckCircle2 : CircleAlert;
  const entityTitle = (entity: Entity) => {
    const entityArea = currentHome.areas.find(area => area.id === entity.areaId);
    return <div className="home-device-title"><span className="device-symbol"><DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-4 w-4" /></span><div className="device-name"><h3>{entity.name}</h3>{entityArea && entityArea.id !== device.area_id && <small>{entityArea.id === "unassigned" ? t("Unassigned") : entityArea.name}</small>}</div></div>;
  };
  const controls = (items: Entity[]) => <div className="device-entity-list">{items.map(entity => <article key={entity.entityId} id={entity.entityId} tabIndex={-1} aria-label={entity.name} className="device-entity">
    {entityTitle(entity)}<DeviceControl entity={entity} /><EntityDetails entity={entity} />
  </article>)}</div>;
  return <div className="planner-page device-page">
    <div className="device-detail-toolbar"><Link to={backTo} className="text-link"><ArrowLeft size={16} aria-hidden="true" />{t("Back to devices")}</Link>
      <DeviceTools key={device.id} device={device} entities={entities} configuration={sections.configuration} diagnostics={sections.diagnostics} target={target} />
    </div>
    <PageHeading title={deviceName(device, language)} description={[device.manufacturer, device.model].filter(Boolean).join(" · ")}><span className="device-symbol"><PhysicalDeviceIcon entities={identity} className="h-6 w-6" /></span></PageHeading>
    <section className="device-overview" aria-label={t("About this device")}>
      <div className="device-summary"><span className="device-detail-room"><MapPin size={15} aria-hidden="true" />{area ? <Link className="text-link" to={`/areas/${encodeURIComponent(area.id)}`}>{area.id === "unassigned" ? t("Unassigned") : area.name}</Link> : t("Unassigned")}</span>
        <span>{message(deviceType(identity))}</span>
        <span className="device-detail-status"><StatusIcon size={15} aria-hidden="true" />{message(availability)}</span>
      </div>
      {!!metadataWarnings.length && <p className="page-note" role="status">{t("Device information may be incomplete. {value1}", { value1: metadataWarnings.map(warning => message(warning)).join(" ") })}</p>}
    </section>
    {!!(sections.primary.length || sections.readings.length) && <div className={`device-detail-layout${sections.primary.length && sections.readings.length ? " device-detail-with-readings" : ""}`}>
      {!!sections.primary.length && <section className="device-detail-primary" aria-label={t("Device controls")}>
        {sections.primary.map(entity => <SmartHomeCard key={entity.entityId} entity={entity} density="original" detail />)}
      </section>}
      {!!sections.readings.length && <section className="device-detail-readings" aria-label={t("Readings and status")}>
        <PanelHeading title={t("Readings and status")} />
        <div className="device-reading-grid">{sections.readings.map(entity => <DeviceReading key={entity.entityId} entity={entity} />)}</div>
      </section>}
    </div>}
    {!!sections.controls.length && <section aria-label={t("Additional controls")}><PanelHeading title={t("Additional controls")} />{controls(sections.controls)}</section>}
    {!entities.length && <p className="glow-panel empty-note">{metadataWarnings.length ? t("Controls could not be fully loaded. Check your Home Assistant connection and permissions.") : t("This device has no visible controls or readings. Hidden and disabled entities are managed in Home Assistant.")}</p>}
  </div>;
}
