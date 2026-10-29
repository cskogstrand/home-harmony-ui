import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Settings } from "lucide-react";
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
import { dashboardSections, type DashboardSection } from "../../shared/configuration";

const sectionLabels = {
  morningSummary: "Morning summary", wasteCollection: "Waste collection", nextPlan: "Next family plan",
  day: "Everyone’s day", week: "Everyone’s week", daily: "Daily rhythm", shopping: "Shopping", school: "School", home: "Home favorites",
} as const;

export function DashboardSettings() {
  const { t, message } = useI18n();
  const { dashboard, setDashboard, morningSummaryEntity, setMorningSummaryEntity, morningSummaryScript, setMorningSummaryScript, wasteCalendarEntity, setWasteCalendarEntity, wasteCollectionDays, setWasteCollectionDays } = useFamily();
  const { currentHome } = useApp();
  const shared = useSharedConfiguration();
  const disabled = !shared?.state.loaded || !!shared.state.error;
  const sectionsRef = useRef<HTMLOListElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const moveSection = (key: DashboardSection, direction: -1 | 1) => {
    const order = [...dashboard.order];
    const index = order.indexOf(key), target = index + direction;
    if (disabled || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    if (setDashboard({ order })) {
      setAnnouncement(t("Moved {name} to position {position} of {total}.", { name: t(sectionLabels[key]), position: target + 1, total: order.length }));
      requestAnimationFrame(() => {
        const row = sectionsRef.current?.querySelector(`[data-section="${key}"]`);
        const control = row?.querySelector<HTMLButtonElement>(`[data-direction="${direction}"]:not(:disabled)`) ?? row?.querySelector<HTMLButtonElement>('[role="switch"]');
        control?.focus();
      });
    }
  };
  const [wasteDays, setWasteDays] = useState(String(wasteCollectionDays));
  useEffect(() => setWasteDays(String(wasteCollectionDays)), [wasteCollectionDays]);
  const [planDays, setPlanDays] = useState(String(dashboard.nextPlanDays === "auto" ? 1 : dashboard.nextPlanDays));
  useEffect(() => { if (dashboard.nextPlanDays !== "auto") setPlanDays(String(dashboard.nextPlanDays)); }, [dashboard.nextPlanDays]);
  return <Dialog>
    <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label={t("Customize Today")} title={t("Customize Today")}><Settings aria-hidden="true" /></Button></DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-24px)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{t("Customize Today")}</DialogTitle>
        <DialogDescription>{t("Choose which sections appear and use the arrows to change their order. Changes are saved automatically and shared across screens.")}</DialogDescription>
      </DialogHeader>
      <ol ref={sectionsRef} aria-label={t("Section order")} className="min-w-0 divide-y divide-border">
        {dashboard.order.map((key, index) => <li key={key} data-section={key}>
          <div className="flex min-h-12 items-center gap-2 py-3">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3">
              <span className="min-w-0 break-words">{t(sectionLabels[key])}</span><Switch checked={dashboard[key]} onCheckedChange={visible => setDashboard({ [key]: visible })}
                disabled={disabled} aria-label={t(sectionLabels[key])} />
            </label>
            <div className="flex shrink-0">
              <Button type="button" variant="ghost" size="icon" data-direction={-1} disabled={disabled || index === 0}
                aria-label={t("Move {name} earlier", { name: t(sectionLabels[key]) })} title={t("Move {name} earlier", { name: t(sectionLabels[key]) })} onClick={() => moveSection(key, -1)}><ArrowUp aria-hidden="true" /></Button>
              <Button type="button" variant="ghost" size="icon" data-direction={1} disabled={disabled || index === dashboard.order.length - 1}
                aria-label={t("Move {name} later", { name: t(sectionLabels[key]) })} title={t("Move {name} later", { name: t(sectionLabels[key]) })} onClick={() => moveSection(key, 1)}><ArrowDown aria-hidden="true" /></Button>
            </div>
          </div>
          {key === "morningSummary" && dashboard.morningSummary && <div className="pb-4">
            <EntityPicker label={t("Morning summary sensor")} entities={currentHome.entities.filter(entity => entity.domain === "sensor")}
              value={currentHome.entities.find(entity => entity.entityId === morningSummaryEntity)?.preferenceId ?? morningSummaryEntity}
              onChange={setMorningSummaryEntity} groupByDevice={false} clearLabel={t("Clear selection")}
              disabled={!shared?.state.loaded || !!shared.state.error} describedBy="morning-summary-help" />
            <p id="morning-summary-help" className="mt-2 text-sm text-muted-foreground">{t("Shown only when the selected sensor has a summary dated today.")}</p>
            <EntityPicker className="mt-4" label={t("Playback script")} entities={currentHome.entities.filter(entity => entity.domain === "script")}
              value={currentHome.entities.find(entity => entity.entityId === morningSummaryScript)?.preferenceId ?? morningSummaryScript}
              onChange={setMorningSummaryScript} groupByDevice={false} clearLabel={t("Clear selection")}
              disabled={disabled} describedBy="morning-summary-script-help" />
            <p id="morning-summary-script-help" className="mt-2 text-sm text-muted-foreground">{t("The script that runs when you press Play. Choose the speaker and voice in Home Assistant.")}</p>
          </div>}
          {key === "nextPlan" && dashboard.nextPlan && <fieldset className="grid min-w-0 gap-3 pb-4" disabled={!shared?.state.loaded || !!shared.state.error}>
            <label className="grid gap-2 text-sm">{t("Look ahead")}
              <select className="min-w-0 w-full rounded-lg border border-input bg-background p-2" value={dashboard.nextPlanDays === "auto" ? "auto" : "custom"}
                onChange={event => setDashboard({ nextPlanDays: event.target.value === "auto" ? "auto" : 1 })}>
                <option value="auto">{t("Auto · follow Everyone’s day")}</option><option value="custom">{t("Choose number of days")}</option>
              </select>
            </label>
            {dashboard.nextPlanDays !== "auto" && <label className="flex items-center justify-between gap-4 text-sm"><span>{t("Days ahead")}</span>
              <Input type="number" min={0} max={90} step={1} required className="w-20" value={planDays} onChange={event => {
                setPlanDays(event.currentTarget.value);
                if (event.currentTarget.validity.valid) setDashboard({ nextPlanDays: event.currentTarget.valueAsNumber });
              }} onBlur={event => event.currentTarget.reportValidity()} />
            </label>}
            <p className="text-sm text-muted-foreground">{t(dashboard.nextPlanDays === "auto" ? "Checks today, plus tomorrow when Show tomorrow’s plans is enabled." : "0–90 days ahead, including today. Use 0 for today only.")}</p>
            <p className="text-sm text-muted-foreground">{t("Only timed plans count. This controls the “No plans” message; the next plan can still be shown beyond this window.")}</p>
          </fieldset>}
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
        </li>)}
      </ol>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      <Button type="button" variant="outline" disabled={disabled || dashboard.order.every((key, index) => key === dashboardSections[index])}
        onClick={() => setDashboard({ order: [...dashboardSections] })}>{t("Reset section order")}</Button>
      <p className="text-sm text-muted-foreground">{t("Morning summary appears when available. School appears when timetables are configured.")}</p>
      <p role="status" className="text-sm text-muted-foreground">{shared?.state.saving ? t("Saving shared configuration…") : shared?.state.dirty ? t("Unsaved changes on this screen.") : shared?.state.loaded ? t("Shared configuration saved.") : t("Loading shared configuration…")}</p>
      {shared?.state.error && <div role="alert"><p className="text-destructive">{message(shared.state.error)}</p><DialogClose asChild><Link to="/settings/backups" className="text-link">{t("Storage and backups")}</Link></DialogClose></div>}
      <DialogFooter><DialogClose asChild><Button>{t("Close")}</Button></DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>;
}
