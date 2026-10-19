import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
export default function Integrations() {
  const { t } = useI18n();
  const { haUrl } = useApp();
  return <div className="planner-page"><PageHeading eyebrow={t("CONNECTED AT HOME")} title={t("Integrations")} /><section className="glow-panel">{haUrl && <a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">{t("Open Home Assistant integrations")}</a>}</section></div>;
}
