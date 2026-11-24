import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

/** Settings → System → Activity. Links to Home Assistant history until the app shows its own activity log. */
export default function History() {
  const { t } = useI18n();
  const { haUrl } = useApp();
  return <section className="settings-card">
    {haUrl ? <a className="text-link min-h-11" href={`${haUrl}/history`} target="_blank" rel="noreferrer">{t("Open Home Assistant history")}<ExternalLink size={16} aria-label={t("Opens in a new tab")} /></a>
      : <Link className="text-link min-h-11" to="/settings/connection">{t("Open connection settings")}</Link>}
  </section>;
}
