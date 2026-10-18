import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
export default function Integrations() {
  const { haUrl } = useApp();
  return <div className="planner-page"><PageHeading eyebrow="CONNECTED AT HOME" title="Integrations" /><section className="glow-panel">{haUrl && <a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">Open Home Assistant integrations</a>}</section></div>;
}
