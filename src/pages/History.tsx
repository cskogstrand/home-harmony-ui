import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
export default function History() {
  const { haUrl } = useApp();
  return <div className="planner-page"><PageHeading eyebrow="HOME ACTIVITY" title="History" /><section className="glow-panel">{haUrl && <a className="text-link" href={`${haUrl}/history`} target="_blank" rel="noreferrer">Open Home Assistant history</a>}</section></div>;
}
