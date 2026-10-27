import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { EntityPicker } from "@/components/EntityPicker";
import { useApp } from "@/contexts/AppContext";
import { Input } from "@/components/ui/input";

const sections = [
  ["morningSummary", "Morning summary"],
  ["wasteCollection", "Waste collection"],
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
  const { dashboard, setDashboard, wasteCalendarEntity, setWasteCalendarEntity, wasteCollectionDays, setWasteCollectionDays } = useFamily();
  const { currentHome } = useApp();
  const shared = useSharedConfiguration();
  const [wasteDays, setWasteDays] = useState(String(wasteCollectionDays));
  useEffect(() => setWasteDays(String(wasteCollectionDays)), [wasteCollectionDays]);
  return <Dialog>
    <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label={t("Customize Today")} title={t("Customize Today")}><Settings aria-hidden="true" /></Button></DialogTrigger>
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
          {key === "wasteCollection" && dashboard.wasteCollection && <div className="pb-4">
            <EntityPicker label={t("Waste collection calendar")} entities={currentHome.entities.filter(entity => entity.domain === "calendar")}
              value={wasteCalendarEntity} onChange={setWasteCalendarEntity} groupByDevice={false}
              placeholder={t("Choose a calendar")} clearLabel={t("Clear selection")}
              disabled={!shared?.state.loaded || !!shared.state.error} describedBy="waste-calendar-help" />
            <p id="waste-calendar-help" className="mt-2 text-sm text-muted-foreground">{t("Calendar event titles are used as waste types.")}</p>
            <label className="mt-4 flex items-center justify-between gap-4">
              <span className="text-sm">{t("Show up to (days ahead)")}</span>
              <Input type="number" min={0} max={90} step={1} required value={wasteDays} onChange={event => setWasteDays(event.currentTarget.value)}
                className="w-20 shrink-0" aria-describedby="waste-days-help" disabled={!shared?.state.loaded || !!shared.state.error}
                onBlur={event => { if (event.currentTarget.reportValidity()) setWasteCollectionDays(event.currentTarget.valueAsNumber); }} />
            </label>
            <p id="waste-days-help" className="mt-2 text-sm text-muted-foreground">{t("0–90 days. Use 0 for today only. Hidden when no pickups are due within this window.")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("Pickups are marked as picked up at 09:00 in your home’s time zone, based on time only.")}</p>
          </div>}
          {key === "day" && <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 pb-3 pl-4 text-sm text-muted-foreground">
            <span>{t("Show tomorrow’s plans")}</span><Switch checked={dashboard.showTomorrow} onCheckedChange={showTomorrow => setDashboard({ showTomorrow })}
              disabled={!dashboard.day || !shared?.state.loaded || !!shared.state.error} aria-label={t("Show tomorrow’s plans")} />
          </label>}
        </div>)}
      </div>
      <p className="text-sm text-muted-foreground">{t("Morning summary appears when available. School appears when timetables are configured.")}</p>
      <p role="status" className="text-sm text-muted-foreground">{shared?.state.saving ? t("Saving shared configuration…") : shared?.state.dirty ? t("Unsaved changes on this screen.") : shared?.state.loaded ? t("Shared configuration saved.") : t("Loading shared configuration…")}</p>
      {shared?.state.error && <div role="alert"><p className="text-destructive">{message(shared.state.error)}</p><DialogClose asChild><Link to="/settings/backups" className="text-link">{t("Storage and backups")}</Link></DialogClose></div>}
      <DialogFooter><DialogClose asChild><Button>{t("Close")}</Button></DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>;
}
