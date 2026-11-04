import type { ReactNode } from "react";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/hooks/use-i18n";

export function CameraMediaStatus({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children?: ReactNode }) {
  const { message: t } = useI18n();
  const text = t(label);
  return <Popover>
    <PopoverTrigger asChild>
      <Button type="button" variant="secondary" size="icon" className="smart-media-status" aria-label={text} title={text}>
        <Icon size={18} aria-hidden="true" className={Icon === LoaderCircle ? "motion-safe:animate-spin" : undefined} />
      </Button>
    </PopoverTrigger>
    <PopoverContent side="bottom" align="start" className="text-sm" aria-label={text}><p>{text}</p>{children && <div className="mt-2">{children}</div>}</PopoverContent>
  </Popover>;
}
