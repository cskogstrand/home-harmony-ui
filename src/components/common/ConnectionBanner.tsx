import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
export function ConnectionBanner() {
  const { homeOnline, connectionStatus } = useApp();
  if (homeOnline) return null;
  return <div className="connection-banner" role="status"><WifiOff size={19} /><span><strong>{connectionStatus === "reconnecting" ? "Reconnecting to your home…" : "The home hub is offline."}</strong> Home readings are last known and controls are paused. Your family planner is still available.</span></div>;
}
export function SyncIndicator() {
  const { homeOnline, connectionStatus } = useApp();
  return <span className="hub-state">{homeOnline ? <CheckCircle2 size={15} /> : connectionStatus === "reconnecting" ? <RefreshCw size={15} /> : <WifiOff size={15} />}{homeOnline ? "Demo hub connected" : "Hub offline"}</span>;
}
