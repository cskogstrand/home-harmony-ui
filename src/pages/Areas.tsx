import { PanelTitle } from "@/components/PanelTitle";
import { SettingsPopover } from "@/components/common/SettingsPopover";
import { useI18n } from "@/hooks/use-i18n";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { DoorOpen, ArrowUpRight } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { available, entityReading } from "@/lib/ha-model";
import { deviceDetailSections, smartHomeEntities } from "@/lib/device-model";
import { SmartHomeCard } from "@/components/devices/SmartHomeCard";
import { DeviceReading } from "@/components/devices/DeviceReading";
import "./device-detail.css";
import { EntityCard } from "@/components/devices/EntityCard";
export default function Areas() {
  const { t, language } = useI18n();
  const { currentHome, haUrl, homeOnline } = useApp();
  const { areaId } = useParams();
  const { pathname } = useLocation();
  if (pathname.startsWith("/rooms/")) return <Navigate to={`/areas/${encodeURIComponent(areaId)}`} replace />;
  const area = currentHome.areas.find(a => a.id === areaId);
  const sections = deviceDetailSections(smartHomeEntities(area?.entities ?? []));
  const advanced = [...sections.configuration, ...sections.diagnostics];
  return <div className="planner-page device-card-designs"><PageHeading title={areaId ? (area?.id === "unassigned" ? t("Unassigned") : area?.name) ?? t("Area not found") : t("Areas")}>{haUrl && <SettingsPopover label={t("Area settings")}><a className="text-link min-h-11" href={`${haUrl}/config/areas/dashboard`} target="_blank" rel="noreferrer">{t("Manage areas in Home Assistant")}</a></SettingsPopover>}</PageHeading>
    {areaId && <Link className="text-link" to="/areas">{t("Back to areas")}</Link>}
    {areaId ? <>
      <div className="home-device-grid">{[...sections.primary, ...sections.controls].map(entity => <SmartHomeCard key={entity.entityId} entity={entity} density="compact" />)}</div>
      {!!sections.readings.length && <section aria-label={t("Readings and status")}><PanelTitle icon={DoorOpen}>{t("Readings and status")}</PanelTitle><div className="device-reading-grid mt-4">{sections.readings.map(entity => <DeviceReading key={entity.entityId} entity={entity} />)}</div></section>}
      {!!advanced.length && <details className="room-advanced"><summary>{t("Advanced")} <span>({advanced.length})</span></summary><p className="page-note mb-4">{t("Device settings and diagnostics. Everyday controls are shown above.")}</p><div className="home-device-grid">{advanced.map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div></details>}
    </> : <div className="home-device-grid">{currentHome.areas.map(room => {
      const everyday = deviceDetailSections(smartHomeEntities(room.entities));
      const entities = [...everyday.primary, ...everyday.controls, ...everyday.readings];
      const lights = entities.filter(entity => entity.domain === "light");
      const reportedLights = lights.filter(available);
      const lightsOn = lights.filter(entity => entity.state === "on").length;
      const temperature = entities.find(entity => available(entity) && entity.attributes.device_class === "temperature" && entity.state.trim() !== "" && Number.isFinite(Number(entity.state)));
      const count = new Set(entities.map(entity => entity.device?.id ?? entity.entityId)).size;
      return <Link key={room.id} to={`/areas/${encodeURIComponent(room.id)}`} className="glow-panel space-y-3"><PanelTitle icon={DoorOpen}>{room.id === "unassigned" ? t("Unassigned") : room.name}</PanelTitle>
        <p>{!homeOnline ? t("Offline") : [reportedLights.length ? t(lightsOn === 1 ? "{count} light on" : "{count} lights on", { count: lightsOn }) : "", reportedLights.length < lights.length ? t("Some readings unavailable") : "", temperature ? entityReading(temperature, language) : ""].filter(Boolean).join(" · ") || t(count === 1 ? "{count} device" : "{count} devices", { count })}</p><ArrowUpRight aria-hidden="true" />
      </Link>;
    })}</div>}
    {!currentHome.areas.length && <p className="glow-panel empty-note">{t("No areas available.")}</p>}
  </div>;
}
