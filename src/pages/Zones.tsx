import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { numberValue } from "@/lib/ha-model";

export default function Zones() {
  const { currentHome, homeOnline, haUrl } = useApp();
  const zones = currentHome.entities.filter(entity => entity.domain === "zone");
  return <div className="planner-page">
    <PageHeading eyebrow="THE PLACES IN YOUR DAY" title="Zones" description="Locations and presence reported by Home Assistant, such as home, school and work." />
    {haUrl && <a className="text-link" href={`${haUrl}/config/zone`} target="_blank" rel="noreferrer">Manage zones in Home Assistant<ArrowUpRight size={17} /></a>}
    {!homeOnline && !!zones.length && <p className="page-note" role="status">Cached zone readings are stale while Home Assistant is offline.</p>}
    <div className="home-device-grid">{zones.map(zone => {
      const radius = numberValue(zone.attributes.radius);
      const latitude = numberValue(zone.attributes.latitude);
      const longitude = numberValue(zone.attributes.longitude);
      const passive = zone.attributes.passive === true;
      const presence = /^\d+$/.test(zone.state) ? `${zone.state} ${Number(zone.state) === 1 ? "person" : "people"}` : zone.state;
      return <article key={zone.entityId} className="glow-panel space-y-4" aria-label={zone.name}>
        <div className="panel-heading"><h2 className="flex items-center gap-2"><MapPin size={20} />{zone.name}</h2><Link className="text-link" to={`/devices/${zone.entityId}`} aria-label={`View ${zone.name} zone details`}><ArrowUpRight size={18} /></Link></div>
        <p className="sensor-state">{!homeOnline && "Stale · "}{presence}</p>
        <dl className="device-readings">
          <div><dt>Radius</dt><dd>{radius !== undefined && radius >= 0 ? `${radius} m` : "Not reported"}</dd></div>
          <div><dt>Latitude</dt><dd>{latitude !== undefined && Math.abs(latitude) <= 90 ? latitude : "Not reported"}</dd></div>
          <div><dt>Longitude</dt><dd>{longitude !== undefined && Math.abs(longitude) <= 180 ? longitude : "Not reported"}</dd></div>
          <div><dt>Presence tracking</dt><dd>{passive ? "Passive · automations only" : zone.attributes.passive === false ? "Active" : "Not reported"}</dd></div>
        </dl>
        {passive && <p className="muted">Passive zones can be used in automations without changing a tracked person’s location state.</p>}
      </article>;
    })}</div>
    {!zones.length && <p className="glow-panel empty-note">No zones loaded. Connect Home Assistant and configure your zones there.</p>}
  </div>;
}
