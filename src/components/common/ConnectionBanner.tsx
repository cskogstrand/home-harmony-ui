import { useI18n } from "@/hooks/use-i18n";
import { Link } from "react-router-dom";
import { WifiOff, CheckCircle2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
export function ConnectionBanner() {
  const { t, message } = useI18n();
  const { homeOnline, haUrl, connectionStatus, connectionError, metadataWarnings } = useApp();
  if (homeOnline && !metadataWarnings.length) return null;
  return <div className="connection-banner" role="status"><WifiOff size={19} /><span><strong>{!haUrl ? t("Connect your Home Assistant.") : homeOnline ? t("Some HA metadata is unavailable.") : t("Home Assistant: {value1}.", { value1: message(connectionStatus) })}</strong> {!homeOnline && t("Readings are stale; controls are paused.")} {message(connectionError)} <Link to="/settings/connection">{t("Connection settings")}</Link></span></div>;
}
export function SyncIndicator() {
  const { t } = useI18n();
  const { homeOnline } = useApp();
  return <span className="hub-state">{homeOnline ? <CheckCircle2 size={15} /> : <WifiOff size={15} />}{homeOnline ? t("Home Assistant connected") : t("Home Assistant offline")}</span>;
}
