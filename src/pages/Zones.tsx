import { useI18n } from "@/hooks/use-i18n";
import { entityDetailPath } from "@/lib/device-model";
import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { numberValue } from "@/lib/ha-model";

export default function Zones() {
  const { t, number } = useI18n();
  const { currentHome, homeOnline, haUrl } = useApp();
  const zones = currentHome.entities.filter(entity => entity.domain === "zone");
  return <div className="planner-page">
    <PageHeading eyebrow={t("THE PLACES IN YOUR DAY")} title={t("Zones")} />
    {haUrl && <a className="text-link" href={`${haUrl}/config/zone`} target="_blank" rel="noreferrer">{t("Manage zones in Home Assistant")}<ArrowUpRight size={17} /></a>}
    {!homeOnline && !!zones.length && <p className="page-note" role="status">{t("Cached zone readings are stale while Home Assistant is offline.")}</p>}
    <div className="home-device-grid">{zones.map(zone => {
      const radius = numberValue(zone.attributes.radius);
      const latitude = numberValue(zone.attributes.latitude);
      const longitude = numberValue(zone.attributes.longitude);
      const passive = zone.attributes.passive === true;
      const presence = /^\d+$/.test(zone.state) ? t(Number(zone.state) === 1 ? "{count} person" : "{count} people", { count: zone.state }) : zone.state;
      return <article key={zone.entityId} className="glow-panel space-y-4" aria-label={zone.name}>
        <div className="panel-heading"><h2 className="flex items-center gap-2"><MapPin size={20} />{zone.name}</h2><Link className="text-link" to={entityDetailPath(zone)} aria-label={t("View {value1} zone details", { value1: zone.name })}><ArrowUpRight size={18} /></Link></div>
        <p className="sensor-state">{!homeOnline && t("Stale · ")}{presence}</p>
        <details className="device-details"><summary>{t("Location details")}</summary><dl className="device-readings">
          <div><dt>{t("Radius")}</dt><dd>{radius !== undefined && radius >= 0 ? `${number(radius)} m` : t("Not reported")}</dd></div>
          <div><dt>{t("Latitude")}</dt><dd>{latitude !== undefined && Math.abs(latitude) <= 90 ? number(latitude) : t("Not reported")}</dd></div>
          <div><dt>{t("Longitude")}</dt><dd>{longitude !== undefined && Math.abs(longitude) <= 180 ? number(longitude) : t("Not reported")}</dd></div>
          <div><dt>{t("Presence tracking")}</dt><dd>{passive ? t("Passive · automations only") : zone.attributes.passive === false ? t("Active") : t("Not reported")}</dd></div>
        </dl></details>
      </article>;
    })}</div>
    {!zones.length && <p className="glow-panel empty-note">{t("No zones available.")}</p>}
  </div>;
}
