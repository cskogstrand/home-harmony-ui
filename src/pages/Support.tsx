import { useI18n } from "@/hooks/use-i18n";
import { Link } from "react-router-dom";
import { PageHeading } from "@/components/FamilyPlanner";
export default function Support() {
  const { t } = useI18n();
  return <div className="planner-page"><PageHeading eyebrow={t("LOCAL CONNECTION")} title={t("Connection help")} /><section className="glow-panel"><p>{t("Check the instance URL, local network, certificate trust and Home Assistant account access.")}</p><Link className="text-link" to="/settings">{t("Open connection settings")}</Link></section></div>;
}
