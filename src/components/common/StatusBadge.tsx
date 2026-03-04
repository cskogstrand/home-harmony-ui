import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant = "online" | "offline" | "warning" | "error" | "pending" | "info" | "safety";

const variantClasses: Record<StatusVariant, string> = {
  online: "bg-success/15 text-success border-success/20",
  offline: "bg-muted text-muted-foreground border-border",
  warning: "bg-warning/15 text-warning-foreground border-warning/20",
  error: "bg-destructive/15 text-destructive border-destructive/20",
  pending: "bg-pending/15 text-pending border-pending/20",
  info: "bg-info/15 text-info border-info/20",
  safety: "bg-safety/15 text-safety border-safety/20",
};

interface StatusBadgeProps {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function StatusBadge({ variant, children, className, dot = true }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 text-2xs font-medium", variantClasses[variant], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", {
        "bg-success": variant === "online",
        "bg-muted-foreground/40": variant === "offline",
        "bg-warning": variant === "warning" || variant === "pending",
        "bg-destructive": variant === "error",
        "bg-info": variant === "info",
        "bg-safety": variant === "safety",
      })} />}
      {children}
    </Badge>
  );
}
