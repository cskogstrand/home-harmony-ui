import { useApp } from "@/contexts/AppContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { VehicleCard } from "@/components/HomePanels";
import { EntityCard } from "@/components/devices/EntityCard";
export default function EnergySaver() {
  const { currentHome, haUrl } = useApp();
  const meters = currentHome.entities.filter(e => e.domain === "sensor" && ["energy", "power", "monetary"].includes(String(e.attributes.device_class)));
  return <div className="planner-page energy-page"><PageHeading eyebrow="TAKE CARE OF TOMORROW" title="Home, charged & ready." description="Reported energy readings from your Home Assistant integrations." /><div className="energy-layout"><VehicleCard /><section className="glow-panel"><PanelHeading title="Energy in Home Assistant" /><p>Readings retain their reported units. Totals, tariffs and optimization depend on your HA configuration.</p>{haUrl && <a className="text-link" href={`${haUrl}/energy`} target="_blank" rel="noreferrer">Open Home Assistant Energy</a>}</section></div><div className="home-device-grid">{meters.map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>{!meters.length && <p className="glow-panel empty-note">No energy, power or monetary sensors loaded. Configure meters in Home Assistant.</p>}</div>;
}
