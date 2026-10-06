import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { EntityCard } from "@/components/devices/EntityCard";
export default function Automation() {
  const { currentHome, haUrl } = useApp();
  const automations = currentHome.entities.filter(e => e.domain === "automation");
  return <div className="planner-page"><PageHeading eyebrow="YOUR HOME’S ROUTINES" title="Automation" description="Enable or disable automations managed by Home Assistant." />{haUrl && <a className="text-link" href={`${haUrl}/config/automation/dashboard`} target="_blank" rel="noreferrer">Edit automations in Home Assistant</a>}<div className="home-device-grid">{automations.map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>{!automations.length && <p className="glow-panel empty-note">No automations loaded. Create routines in Home Assistant.</p>}</div>;
}
