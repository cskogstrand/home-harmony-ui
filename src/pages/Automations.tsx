import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { EntityCard } from "@/components/devices/EntityCard";
export default function Automations() {
  const { t } = useI18n();
  const { currentHome, haUrl } = useApp();
  const automations = currentHome.entities.filter(e => e.domain === "automation");
  return <div className="planner-page"><PageHeading eyebrow={t("YOUR HOME, AUTOMATED")} title={t("Automations")} />{haUrl && <a className="text-link" href={`${haUrl}/config/automation/dashboard`} target="_blank" rel="noreferrer">{t("Edit automations in Home Assistant")}</a>}<div className="home-device-grid">{automations.map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>{!automations.length && <p className="glow-panel empty-note">{t("No automations available.")}</p>}</div>;
}
