import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
export default function History() {
  const { t } = useI18n();
  const { haUrl } = useApp();
  return <div className="planner-page"><PageHeading title={t("History")} /><section className="glow-panel">{haUrl && <a className="text-link" href={`${haUrl}/history`} target="_blank" rel="noreferrer">{t("Open Home Assistant history")}</a>}</section></div>;
}
