import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { SmartHomeCard } from "@/components/devices/SmartHomeCard";
import { orderedScenes } from "@/lib/smart-home-cards";
export default function Moods() {
  const { t } = useI18n();
  const entities = useApp(app => app.currentHome.entities);
  const { smartHome, homeEntities } = useFamily();
  const scenes = orderedScenes(entities, smartHome, homeEntities);
  return <div className="planner-page"><PageHeading title={t("Scenes")} /><section className="glow-panel scene-panel" aria-label={t("Scenes")}>
    {scenes.length ? <div className="favorite-devices">{scenes.map(scene => <SmartHomeCard key={scene.entityId} entity={scene} />)}</div> : <p className="empty-note">{t("No scenes yet.")}</p>}
  </section></div>;
}
