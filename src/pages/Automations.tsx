import { ExternalLink } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { EntityCard } from "@/components/devices/EntityCard";

/** Settings → System → Automations. Kept out of everyday navigation because these controls change how the house behaves. */
export default function Automations() {
  const { t } = useI18n();
  const { currentHome, haUrl } = useApp();
  const automations = currentHome.entities.filter(e => e.domain === "automation");
  return <>
    {automations.length ? <div className="home-device-grid">{automations.map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>
      : <p className="settings-card">{t("No automations available.")}</p>}
    {haUrl && <a className="settings-related text-link" href={`${haUrl}/config/automation/dashboard`} target="_blank" rel="noreferrer">{t("Edit automations in Home Assistant")}<ExternalLink size={16} aria-label={t("Opens in a new tab")} /></a>}
  </>;
}
