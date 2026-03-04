import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { AnimatePresence, motion } from "framer-motion";

export function ConnectionBanner() {
  const { connectionStatus } = useApp();

  if (connectionStatus === "connected") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium ${
          connectionStatus === "offline"
            ? "bg-destructive/10 text-destructive"
            : "bg-warning/10 text-warning-foreground"
        }`}
      >
        {connectionStatus === "offline" ? (
          <><WifiOff className="h-3.5 w-3.5" /> You're offline — changes may not be saved</>
        ) : (
          <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Reconnecting…</>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export function SyncIndicator() {
  const { connectionStatus } = useApp();
  return (
    <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
      {connectionStatus === "connected" ? (
        <><CheckCircle2 className="h-3 w-3 text-success" /> Up to date</>
      ) : connectionStatus === "reconnecting" ? (
        <><RefreshCw className="h-3 w-3 animate-spin text-warning" /> Syncing…</>
      ) : (
        <><WifiOff className="h-3 w-3 text-destructive" /> Offline</>
      )}
    </div>
  );
}
