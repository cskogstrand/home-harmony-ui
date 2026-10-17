import { Link } from "react-router-dom";
import { WifiOff, CheckCircle2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
export function ConnectionBanner() {
  const { homeOnline, haUrl, connectionStatus, connectionError, metadataWarnings } = useApp();
  const shared = useSharedConfiguration();
  if (homeOnline && !metadataWarnings.length) return null;
  return <div className="connection-banner" role="status"><WifiOff size={19} /><span><strong>{!haUrl ? "Connect your Home Assistant." : homeOnline ? "Some HA metadata is unavailable." : `Home Assistant: ${connectionStatus}.`}</strong> {!homeOnline && `Cached readings are stale and controls are paused.${shared?.enabled ? " Reconnect to save shared planner changes." : " Your local family planner is still available."}`} {connectionError} <Link to="/settings">Connection settings</Link></span></div>;
}
export function SyncIndicator() {
  const { homeOnline } = useApp();
  return <span className="hub-state">{homeOnline ? <CheckCircle2 size={15} /> : <WifiOff size={15} />}{homeOnline ? "Home Assistant connected" : "Home Assistant offline"}</span>;
}
