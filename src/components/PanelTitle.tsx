import { forwardRef, type HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import type { PlannerArtwork } from "../../shared/configuration";
import { PlannerCardIcon } from "./CardArtwork";
import { cn } from "@/lib/utils";

type PanelTitleProps = HTMLAttributes<HTMLHeadingElement> & { icon: LucideIcon; artwork?: PlannerArtwork; as?: "h1" | "h2" | "h3" };

export const PanelTitle = forwardRef<HTMLHeadingElement, PanelTitleProps>(function PanelTitle({ icon: Icon, artwork, as: Heading = "h2", className, children, ...props }, ref) {
  const icon = <Icon className="panel-title-icon" strokeWidth={1.8} aria-hidden="true" />;
  return <Heading ref={ref} className={cn("panel-title", className)} {...props}>
    {artwork ? <PlannerCardIcon kind={artwork}>{icon}</PlannerCardIcon> : icon}
    <span>{children}</span>
  </Heading>;
});
