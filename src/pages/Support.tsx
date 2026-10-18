import { Link } from "react-router-dom";
import { PageHeading } from "@/components/FamilyPlanner";
export default function Support() {
  return <div className="planner-page"><PageHeading eyebrow="LOCAL CONNECTION" title="Connection help" /><section className="glow-panel"><p>Check the instance URL, local network, certificate trust and Home Assistant account access.</p><Link className="text-link" to="/settings">Open connection settings</Link></section></div>;
}
