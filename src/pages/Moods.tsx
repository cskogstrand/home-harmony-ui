import { PageHeading } from "@/components/FamilyPlanner";
import { SceneButtons } from "@/components/HomePanels";
export default function Moods() {
  return <div className="planner-page"><PageHeading eyebrow="A MOOD FOR EVERY MOMENT" title="Scenes" description="One tap to set the mood." /><section className="glow-panel"><SceneButtons /></section></div>;
}
