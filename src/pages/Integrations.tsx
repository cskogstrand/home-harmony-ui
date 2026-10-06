import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
export default function Integrations() {
  const { haUrl } = useApp();
  return <div className="planner-page"><PageHeading eyebrow="CONNECTED AT HOME" title="Integrations" description="Connect devices and services through Home Assistant." /><section className="glow-panel"><h2>Manage integrations in Home Assistant</h2><p className="page-note">Add and configure the integrations that provide your home’s entities.</p>{haUrl && <a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">Open Home Assistant integrations</a>}</section></div>;
}
