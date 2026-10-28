import { forwardRef, type HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PanelTitleProps = HTMLAttributes<HTMLHeadingElement> & { icon: LucideIcon; as?: "h2" | "h3" };

export const PanelTitle = forwardRef<HTMLHeadingElement, PanelTitleProps>(function PanelTitle({ icon: Icon, as: Heading = "h2", className, children, ...props }, ref) {
  return <Heading ref={ref} className={cn("panel-title", className)} {...props}>
    <Icon className="panel-title-icon" strokeWidth={1.8} aria-hidden="true" />
    <span>{children}</span>
  </Heading>;
});
