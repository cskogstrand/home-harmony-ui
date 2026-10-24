import { useId, type ReactNode } from "react";
import { Settings, X } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function SettingsPopover({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useI18n();
  const titleId = useId();
  return <Popover>
    <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={label} title={label}><Settings aria-hidden="true" /></Button></PopoverTrigger>
    <PopoverContent align="end" className="settings-popover" aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-base font-semibold">{label}</h2>
        <PopoverClose asChild><Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={t("Close")}><X aria-hidden="true" /></Button></PopoverClose>
      </div>
      {children}
    </PopoverContent>
  </Popover>;
}
