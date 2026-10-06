import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
export default function Services() {
  const { haUrl } = useApp();
  return <div className="planner-page"><PageHeading eyebrow="CONNECTED AT HOME" title="Services" /><section className="glow-panel"><h2>Integrations live in Home Assistant</h2><p className="page-note">Subscriptions, alarm monitoring and emergency contacts are not managed by this dashboard. No monitoring subscription is implied by an alarm entity.</p>{haUrl && <a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">Open Home Assistant integrations</a>}</section></div>;
}
