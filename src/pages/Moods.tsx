import { PageHeading } from "@/components/FamilyPlanner";
import { SceneButtons } from "@/components/HomePanels";
export default function Moods() {
  return <div className="planner-page"><PageHeading eyebrow="A MOOD FOR EVERY MOMENT" title="Scenes" description="Activate scenes defined in Home Assistant. Scenes are actions and have no persistent active mode." /><section className="glow-panel"><SceneButtons /></section></div>;
}
