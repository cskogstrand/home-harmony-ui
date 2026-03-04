import { Loader2, WifiOff, ShieldX, AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export type ViewState = "loading" | "empty" | "error" | "offline" | "no-access" | "success";

interface StateWrapperProps {
  state: ViewState;
  children: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  onRetry?: () => void;
  className?: string;
}

export function StateWrapper({
  state, children, emptyTitle, emptyDescription,
  errorTitle, errorDescription, onRetry, className = "",
}: StateWrapperProps) {
  if (state === "success") {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  const configs: Record<Exclude<ViewState, "success">, { icon: React.ReactNode; title: string; desc: string }> = {
    loading: { icon: <Loader2 className="h-8 w-8 animate-spin text-primary" />, title: "Loading…", desc: "Fetching your data" },
    empty: { icon: <Inbox className="h-8 w-8 text-muted-foreground" />, title: emptyTitle ?? "Nothing here yet", desc: emptyDescription ?? "Items will appear here once added." },
    error: { icon: <AlertTriangle className="h-8 w-8 text-destructive" />, title: errorTitle ?? "Something went wrong", desc: errorDescription ?? "We couldn't load this data. Please try again." },
    offline: { icon: <WifiOff className="h-8 w-8 text-muted-foreground" />, title: "You're offline", desc: "Check your connection and try again." },
    "no-access": { icon: <ShieldX className="h-8 w-8 text-warning" />, title: "Access restricted", desc: "You don't have permission to view this. Contact your home administrator." },
  };

  const cfg = configs[state];

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 px-4 text-center ${className}`}>
      {cfg.icon}
      <h3 className="text-base font-semibold text-foreground">{cfg.title}</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">{cfg.desc}</p>
      {(state === "error" || state === "offline") && onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">Try again</Button>
      )}
    </div>
  );
}
