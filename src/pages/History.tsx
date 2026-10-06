import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
export default function History() {
  const { haUrl } = useApp();
  return <div className="planner-page"><PageHeading eyebrow="HOME ACTIVITY" title="History" /><section className="glow-panel"><h2>View recorded history in Home Assistant</h2><p className="page-note">This dashboard does not load recorder history. Availability and retention depend on your HA recorder configuration.</p>{haUrl && <a className="text-link" href={`${haUrl}/history`} target="_blank" rel="noreferrer">Open Home Assistant history</a>}</section></div>;
}
