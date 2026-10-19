import { useI18n } from "@/hooks/use-i18n";
import { PageHeading } from "@/components/FamilyPlanner";
import { SceneButtons } from "@/components/HomePanels";
export default function Moods() {
  const { t } = useI18n();
  return <div className="planner-page"><PageHeading title={t("Scenes")} /><section className="glow-panel"><SceneButtons /></section></div>;
}
