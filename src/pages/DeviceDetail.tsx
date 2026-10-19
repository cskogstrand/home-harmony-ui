import { useI18n } from "@/hooks/use-i18n";
import { useEffect } from "react";
import { useParams, Link, Navigate, useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { PhysicalDeviceIcon } from "@/components/devices/DeviceCard";
import { DeviceControl, DeviceIcon } from "@/components/devices/DeviceControl";
import { EntityDetails } from "@/components/devices/EntityDetails";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { deviceName, deviceReadingsLabel, entityDetailPath } from "@/lib/device-model";

export default function DeviceDetail() {
  const { t, message, language } = useI18n();
  const { deviceId } = useParams();
  const { hash, state } = useLocation();
  const backTo = { pathname: "/devices", search: typeof state?.deviceList === "string" ? state.deviceList : "" };
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
    if (legacyEntity) return <Navigate to={entityDetailPath(legacyEntity)} state={state} replace />;
    return <div className="planner-page"><h1>{loading ? t("Loading device…") : metadataWarnings.length ? t("Device information unavailable") : t("Device not found")}</h1><Link to={backTo} className="text-link">{t("Back to devices")}</Link></div>;
  }
  const area = currentHome.areas.find(area => area.id === device.area_id);
  return <div className="planner-page device-page">
    <Link to={backTo} className="text-link">{t("Back to devices")}</Link>
    <PageHeading context={(area?.id === "unassigned" ? t("Unassigned") : area?.name)?.toUpperCase() ?? t("UNASSIGNED")} title={deviceName(device, language)} description={[device.manufacturer, device.model].filter(Boolean).join(" · ")}><span className="device-symbol"><PhysicalDeviceIcon entities={entities} className="h-6 w-6" /></span></PageHeading>
    <section className="device-overview" aria-label={t("About this device")}>
      <div className="device-summary"><span className="muted">{t("Room: ")}{area ? <Link className="text-link" to={`/areas/${encodeURIComponent(area.id)}`}>{area.id === "unassigned" ? t("Unassigned") : area.name}</Link> : t("Unassigned")}</span>
        <span className="muted">{message(deviceReadingsLabel(entities, homeOnline))}</span>
        {haUrl && <a className="text-link" href={`${haUrl}/config/devices/device/${encodeURIComponent(device.id)}`} target="_blank" rel="noreferrer">{t("Manage device in Home Assistant")}</a>}
      </div>
      {!!metadataWarnings.length && <p className="page-note" role="status">{t("Device information may be incomplete. {value1}", { value1: metadataWarnings.map(warning => message(warning)).join(" ") })}</p>}
    </section>
    <section aria-label={t("Controls and readings")}><PanelHeading title={t("Controls and readings")} />
      <div className="device-entity-list">{entities.map(entity => {
        const entityArea = currentHome.areas.find(area => area.id === entity.areaId);
        return <article key={entity.entityId} id={entity.entityId} tabIndex={-1} aria-label={entity.name} className="device-entity">
          <div className="home-device-title"><span className="device-symbol"><DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-4 w-4" /></span><div className="device-name"><h3>{entity.name}</h3>{entityArea && entityArea.id !== device.area_id && <small>{entityArea.id === "unassigned" ? t("Unassigned") : entityArea.name}</small>}</div></div>
          <DeviceControl entity={entity} /><EntityDetails entity={entity} />
        </article>;
      })}</div>
      {!entities.length && <p className="glow-panel empty-note">{metadataWarnings.length ? t("Controls could not be fully loaded. Check your Home Assistant connection and permissions.") : t("This device has no visible controls or readings. Hidden and disabled entities are managed in Home Assistant.")}</p>}
    </section>
    <details className="device-details"><summary>{t("Device technical details")}</summary><dl className="device-readings"><div><dt>{t("Device ID")}</dt><dd>{device.id}</dd></div>{device.sw_version && <div><dt>{t("Software")}</dt><dd>{device.sw_version}</dd></div>}</dl></details>
  </div>;
}
