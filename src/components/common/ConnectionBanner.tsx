import { useI18n } from "@/hooks/use-i18n";
import { Link, useMatch } from "react-router-dom";
import { WifiOff, CheckCircle2, LoaderCircle } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
export function ConnectionBanner() {
  const { t, message } = useI18n();
  const { homeOnline, haUrl, connectionStatus, connectionStarting, awaitingFirstConnection, connectionError, metadataWarnings } = useApp();
  const onConnectionPage = useMatch("/settings/connection");
  if (onConnectionPage || homeOnline && !metadataWarnings.length) return null;
  // A fresh load has nothing stale yet: stay neutral until the grace period ends or the connection fails.
  if (connectionStarting && !homeOnline) return <div className="connection-banner" data-tone="neutral" role="status">
    <LoaderCircle size={19} className="motion-safe:animate-spin" aria-hidden="true" /><span>{t("Connecting to Home Assistant…")}</span>
  </div>;
  const paused = awaitingFirstConnection ? t("Controls are paused until Home Assistant connects.") : t("Readings are stale; controls are paused.");
  return <div className="connection-banner" role="status"><WifiOff size={19} aria-hidden="true" /><span><strong>{!haUrl ? t("Connect your Home Assistant.") : homeOnline ? t("Some Home Assistant details are unavailable.") : t("Home Assistant: {value1}.", { value1: message(connectionStatus) })}</strong> {!homeOnline && paused} {message(connectionError)} <Link to="/settings/connection">{t("Connection settings")}</Link></span></div>;
}
export function SyncIndicator() {
  const { t } = useI18n();
  const { homeOnline } = useApp();
  return <span className="hub-state">{homeOnline ? <CheckCircle2 size={15} /> : <WifiOff size={15} />}{homeOnline ? t("Home Assistant connected") : t("Home Assistant offline")}</span>;
}
