import { SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const sections = [
  ["morningSummary", "Morning summary"],
  ["nextPlan", "Next family plan"],
  ["day", "Everyone’s day"],
  ["week", "Everyone’s week"],
  ["daily", "Daily rhythm"],
  ["shopping", "Shopping"],
  ["school", "School"],
  ["home", "Home favorites"],
] as const;

export function DashboardSettings() {
  const { t, message } = useI18n();
  const { dashboard, setDashboard } = useFamily();
  const shared = useSharedConfiguration();
  return <Dialog>
    <DialogTrigger asChild><Button variant="outline" size="sm"><SlidersHorizontal size={16} aria-hidden="true" />{t("Customize Today")}</Button></DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-24px)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{t("Customize Today")}</DialogTitle>
        <DialogDescription>{t("Choose which sections appear. Changes are saved automatically and shared across screens.")}</DialogDescription>
      </DialogHeader>
      <div className="divide-y divide-border">
        {sections.map(([key, label]) => <div key={key}>
          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-3">
            <span>{t(label)}</span><Switch checked={dashboard[key]} onCheckedChange={visible => setDashboard({ [key]: visible })}
              disabled={!shared?.state.loaded || !!shared.state.error} aria-label={t(label)} />
          </label>
          {key === "day" && <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 pb-3 pl-4 text-sm text-muted-foreground">
            <span>{t("Show tomorrow’s plans")}</span><Switch checked={dashboard.showTomorrow} onCheckedChange={showTomorrow => setDashboard({ showTomorrow })}
              disabled={!dashboard.day || !shared?.state.loaded || !!shared.state.error} aria-label={t("Show tomorrow’s plans")} />
          </label>}
        </div>)}
      </div>
      <p className="text-sm text-muted-foreground">{t("Morning summary appears when available. School appears when timetables are configured.")}</p>
      <p role="status" className="text-sm text-muted-foreground">{shared?.state.saving ? t("Saving shared configuration…") : shared?.state.dirty ? t("Unsaved changes on this screen.") : shared?.state.loaded ? t("Shared configuration saved.") : t("Loading shared configuration…")}</p>
      {shared?.state.error && <div role="alert"><p className="text-destructive">{message(shared.state.error)}</p><DialogClose asChild><Link to="/user-settings" className="text-link">{t("App preferences")}</Link></DialogClose></div>}
      <DialogFooter><DialogClose asChild><Button>{t("Close")}</Button></DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>;
}
