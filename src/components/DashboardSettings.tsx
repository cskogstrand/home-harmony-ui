import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Columns2, MoveVertical, RectangleHorizontal, Settings } from "lucide-react";
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
import { PanelTitle } from "@/components/PanelTitle";
import { dashboardRows, dashboardSections, dashboardWidth, fillSections, fullWidthSections, type DashboardHomeworkOptions, type DashboardSection, type DashboardRow, type DashboardWidth, type FillSection } from "../../shared/configuration";
import type { MessageKey } from "@/lib/i18n";
import { todaySectionIcons as sectionIcons } from "@/lib/today-sections";

const sectionLabels = {
  homeStatus: "Home status", morningSummary: "Morning summary", wasteCollection: "Waste collection", nextPlan: "Next family plan",
  day: "Everyone’s day", week: "Everyone’s week", daily: "Daily rhythm", shopping: "Shopping", homework: "Homework", school: "School", home: "Home favorites", recentActivity: "Latest events",
} as const;
/** Sections that render nothing when they have nothing to say; their partner then takes the whole row. */
const conditionalSections: readonly DashboardSection[] = ["homeStatus", "morningSummary", "wasteCollection", "school"];
const fullWidthReasons: Record<typeof fullWidthSections[number], MessageKey> = {
  day: "Always full width: each person needs their own column.",
  week: "Always full width: the week needs room for seven days.",
  school: "Always full width: timetables sit side by side.",
};
const isFullWidthOnly = (key: DashboardSection): key is typeof fullWidthSections[number] => (fullWidthSections as readonly DashboardSection[]).includes(key);
const widthOptions = [["full", RectangleHorizontal, "Full"], ["half", Columns2, "Half"]] as const;

/** An inert miniature of Today's rows on wide screens. The section cards say the same in words, so it is hidden from assistive technology. */
function LayoutPreview({ rows, fill }: { rows: DashboardRow[]; fill: string }) {
  const { t } = useI18n();
  if (!rows.length) return null;
  const conditional = rows.some(row => row.sections.some(key => conditionalSections.includes(key)));
  const filling = rows.some(row => row.fill);
  return <div className="settings-card dashboard-preview" aria-hidden="true">
    <p className="dashboard-preview-title">{t("Layout on wide screens")}</p>
    <div className="dashboard-preview-rows">{rows.map(row => <div key={row.sections[0]} className="dashboard-preview-row" data-fill={row.fill || undefined}>
      {row.sections.map(key => {
        const Icon = sectionIcons[key];
        return <span key={key} className="dashboard-preview-block" data-conditional={conditionalSections.includes(key) || undefined} data-fill={key === fill || undefined}>
          <Icon size={16} strokeWidth={1.8} /><span>{t(sectionLabels[key])}</span>{key === fill && <MoveVertical size={16} strokeWidth={1.8} className="dashboard-preview-fill" />}
        </span>;
      })}
    </div>)}</div>
    {(conditional || filling) && <ul className="dashboard-preview-legend">
      {conditional && <li><span className="dashboard-preview-swatch" />{t("Dashed: appears only when it has something to show.")}</li>}
      {filling && <li><MoveVertical size={16} strokeWidth={1.8} />{t("Grows to fill the free space on the wall.")}</li>}
    </ul>}
  </div>;
}

export function DashboardSettings() {
  const { t, message } = useI18n();
  const { dashboard, setDashboard, morningSummaryEntity, setMorningSummaryEntity, morningSummaryScript, setMorningSummaryScript, morningSummaryPlaybackEntity, setMorningSummaryPlaybackEntity, wasteCalendarEntity, setWasteCalendarEntity, wasteCollectionDays, setWasteCollectionDays } = useFamily();
  const { currentHome } = useApp();
  const shared = useSharedConfiguration();
  const disabled = !shared?.state.loaded || !!shared.state.error;
  const setHomeworkOptions = (patch: Partial<DashboardHomeworkOptions>) => setDashboard({ homeworkOptions: { ...dashboard.homeworkOptions, ...patch } });
  const sectionsRef = useRef<HTMLOListElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const label = (key: DashboardSection) => t(sectionLabels[key]);
  const rows = dashboardRows(dashboard);
  const partnerIn = (layout: typeof rows, key: DashboardSection) => layout.find(row => row.sections.includes(key))?.sections.find(other => other !== key);
  const placement = (key: DashboardSection) => {
    const partner = partnerIn(rows, key);
    if (!partner) return t("Fills its row: no half-width section next to it.");
    return t(conditionalSections.includes(partner) ? "Beside {name} on wide screens; fills the row when {name} is hidden." : "Beside {name} on wide screens.", { name: label(partner) });
  };
  const setWidth = (key: DashboardSection, width: DashboardWidth) => {
    if (disabled || dashboardWidth(dashboard, key) === width) return;
    const widths = { ...dashboard.widths, [key]: width };
    if (!setDashboard({ widths })) return;
    const partner = partnerIn(dashboardRows({ ...dashboard, widths }), key);
    setAnnouncement(width === "full" ? t("{name}: full width.", { name: label(key) })
      : partner ? t("{name}: half width, beside {partner}.", { name: label(key), partner: label(partner) }) : t("{name}: half width, fills its row.", { name: label(key) }));
  };
  const defaultWidths = dashboardSections.every(key => dashboardWidth(dashboard, key) === dashboardWidth({ widths: {} }, key));
  const moveSection = (key: DashboardSection, direction: -1 | 1) => {
    const order = [...dashboard.order];
    const index = order.indexOf(key), target = index + direction;
    if (disabled || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    if (setDashboard({ order })) {
      const before = partnerIn(rows, key), after = dashboardWidth(dashboard, key) === "half" && dashboard[key] ? partnerIn(dashboardRows({ ...dashboard, order }), key) : before;
      const partner = after === before ? "" : " " + (after ? t("Now beside {name}.", { name: label(after) }) : t("Now fills its row."));
      setAnnouncement(t("Moved {name} to position {position} of {total}.", { name: label(key), position: target + 1, total: order.length }) + partner);
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
        <DialogTitle asChild><PanelTitle icon={Settings}>{t("Customize Today")}</PanelTitle></DialogTitle>
        <DialogDescription>{t("Choose which sections appear, how wide they are and their order. Changes are saved automatically and shared across screens.")}</DialogDescription>
      </DialogHeader>
      <LayoutPreview rows={rows} fill={dashboard.fill} />
      <ol ref={sectionsRef} aria-label={t("Section order")} className="settings-stack">
        {dashboard.order.map((key, index) => <li key={key} data-section={key} className="settings-card dashboard-settings-card">
          <div className="dashboard-settings-heading">
            <PanelTitle as="h3" icon={sectionIcons[key]} id={`dashboard-setting-${key}`}><label htmlFor={`dashboard-toggle-${key}`} className="cursor-pointer">{t(sectionLabels[key])}</label></PanelTitle>
            <div className="flex shrink-0 items-center gap-2">
              <Switch id={`dashboard-toggle-${key}`} checked={dashboard[key]} onCheckedChange={visible => setDashboard({ [key]: visible })}
                disabled={disabled} aria-labelledby={`dashboard-setting-${key}`} />
              <div className="flex shrink-0">
                <Button type="button" variant="ghost" size="icon" data-direction={-1} disabled={disabled || index === 0}
                  aria-label={t("Move {name} earlier", { name: t(sectionLabels[key]) })} title={t("Move {name} earlier", { name: t(sectionLabels[key]) })} onClick={() => moveSection(key, -1)}><ArrowUp aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="icon" data-direction={1} disabled={disabled || index === dashboard.order.length - 1}
                  aria-label={t("Move {name} later", { name: t(sectionLabels[key]) })} title={t("Move {name} later", { name: t(sectionLabels[key]) })} onClick={() => moveSection(key, 1)}><ArrowDown aria-hidden="true" /></Button>
              </div>
            </div>
          </div>
          {dashboard[key] && (isFullWidthOnly(key) ? <p className="text-sm text-muted-foreground">{t(fullWidthReasons[key])}</p> : <div className="dashboard-width">
            <div className="dashboard-width-choice">
              <span className="text-sm" aria-hidden="true">{t("Width")}</span>
              <div className="calendar-segment" role="group" aria-label={t("Width for {name}", { name: label(key) })}
                aria-describedby={dashboardWidth(dashboard, key) === "half" ? `dashboard-placement-${key}` : undefined}>
                {widthOptions.map(([width, Icon, text]) => <button key={width} type="button" aria-pressed={dashboardWidth(dashboard, key) === width} disabled={disabled}
                  onClick={() => setWidth(key, width)}><Icon size={18} aria-hidden="true" />{t(text)}</button>)}
              </div>
            </div>
            {dashboardWidth(dashboard, key) === "half" && <p id={`dashboard-placement-${key}`} className="text-sm text-muted-foreground">{placement(key)}</p>}
          </div>)}
          {key === "homeStatus" && <p className="text-sm text-muted-foreground">{t("Appears only when a selected source needs attention or has no reading.")}</p>}
          {key === "recentActivity" && <p className="text-sm text-muted-foreground">{t("Uses the sources and privacy choice from Settings → System → Activity.")}{" "}
            <DialogClose asChild><Link to="/settings/activity?panel=recent" className="text-link">{t("Choose sources")}</Link></DialogClose></p>}
          {key === "morningSummary" && (dashboard.morningSummary || dashboard.daySummaryPlayback) && <div>
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 pb-3 text-sm">
              <span>{t("Hide morning summary content")}</span><Switch checked={dashboard.hideMorningSummaryContent} onCheckedChange={hideMorningSummaryContent => setDashboard({ hideMorningSummaryContent })}
                disabled={disabled || !dashboard.morningSummary} aria-label={t("Hide morning summary content")} />
            </label>
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
            <EntityPicker className="mt-4" label={t("Playback switch (input_boolean)")} entities={currentHome.entities.filter(entity => entity.domain === "input_boolean")}
              value={currentHome.entities.find(entity => entity.entityId === morningSummaryPlaybackEntity)?.preferenceId ?? morningSummaryPlaybackEntity}
              onChange={setMorningSummaryPlaybackEntity} groupByDevice={false} clearLabel={t("Clear selection")}
              disabled={disabled} describedBy="morning-summary-playback-help" />
            <p id="morning-summary-playback-help" className="mt-2 text-sm text-muted-foreground">{t("Play is available only when this helper is on. Without a selection, playback is disabled.")}</p>
          </div>}
          {key === "nextPlan" && dashboard.nextPlan && <fieldset className="grid min-w-0 gap-3" disabled={!shared?.state.loaded || !!shared.state.error}>
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 text-sm">
              <span>{t("Hide description by default")}</span><Switch checked={dashboard.hideNextPlanDescription} onCheckedChange={hideNextPlanDescription => setDashboard({ hideNextPlanDescription })}
                disabled={disabled} aria-label={t("Hide description by default")} />
            </label>
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
          {key === "wasteCollection" && dashboard.wasteCollection && <div>
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
          {key === "homework" && dashboard.homework && <fieldset className="planner-form" disabled={disabled} aria-labelledby="dashboard-setting-homework">
            <label>{t("Due date")}<select value={dashboard.homeworkOptions.period} onChange={event => setHomeworkOptions({ period: event.target.value as DashboardHomeworkOptions["period"] })}>
              <option value="through-today">{t("Through today")}</option>
              <option value="through-tomorrow">{t("Through tomorrow")}</option>
              <option value="today">{t("Due today only")}</option>
              <option value="tomorrow">{t("Due tomorrow only")}</option>
              <option value="all">{t("All homework")}</option>
            </select></label>
            <div className="flex min-h-12 items-center justify-between gap-4 text-sm">
              <label htmlFor="homework-include-undated">{t("Include homework without a due date")}</label>
              <Switch id="homework-include-undated" checked={dashboard.homeworkOptions.includeUndated} onCheckedChange={includeUndated => setHomeworkOptions({ includeUndated })} disabled={disabled} />
            </div>
            <div className="flex min-h-12 items-center justify-between gap-4 text-sm">
              <label htmlFor="homework-show-completed">{t("Show completed homework")}</label>
              <Switch id="homework-show-completed" checked={dashboard.homeworkOptions.showCompleted} onCheckedChange={showCompleted => setHomeworkOptions({ showCompleted })} disabled={disabled} />
            </div>
            <label>{t("Homework action")}<select value={dashboard.homeworkOptions.action} onChange={event => setHomeworkOptions({ action: event.target.value as DashboardHomeworkOptions["action"] })}>
              <option value="check">{t("Check off on Today")}</option><option value="lists">{t("Open in Lists")}</option><option value="school">{t("Open in School")}</option>
            </select></label>
          </fieldset>}
          {key === "day" && <><label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 text-sm">
            <span>{t("Show summary button in Everyone’s day")}</span><Switch checked={dashboard.daySummaryPlayback} onCheckedChange={daySummaryPlayback => setDashboard({ daySummaryPlayback })}
              disabled={disabled || !dashboard.day} aria-label={t("Show summary button in Everyone’s day")} />
          </label><label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 text-sm">
            <span>{t("Show tomorrow’s plans")}</span><Switch checked={dashboard.showTomorrow} onCheckedChange={showTomorrow => setDashboard({ showTomorrow })}
              disabled={!dashboard.day || !shared?.state.loaded || !!shared.state.error} aria-label={t("Show tomorrow’s plans")} />
          </label></>}
        </li>)}
      </ol>
      <section className="settings-card dashboard-settings-card" aria-labelledby="dashboard-fill-title">
        <div className="dashboard-settings-heading"><PanelTitle as="h3" icon={MoveVertical} id="dashboard-fill-title">{t("Free space on the wall")}</PanelTitle></div>
        <label className="grid gap-2 text-sm">{t("Section that fills the space")}
          <select className="min-h-12 w-full min-w-0 rounded-lg border border-input bg-background p-2" value={dashboard.fill} disabled={disabled} aria-describedby="dashboard-fill-help"
            onChange={event => setDashboard({ fill: event.target.value as FillSection | "" })}>
            <option value="">{t("None")}</option>
            {dashboard.order.filter((key): key is FillSection => (fillSections as readonly DashboardSection[]).includes(key) && (dashboard[key] || key === dashboard.fill))
              .map(key => <option key={key} value={key}>{label(key)}</option>)}
          </select>
        </label>
        <p id="dashboard-fill-help" className="text-sm text-muted-foreground">{dashboard.fill && !dashboard[dashboard.fill]
          ? t("{name} is hidden, so nothing fills the space.", { name: label(dashboard.fill) })
          : t("On the large wall screen this section grows down to the navigation and shows as many rows as fit. Other screens show its usual length.")}</p>
      </section>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      <Button type="button" variant="outline" disabled={disabled || dashboard.order.every((key, index) => key === dashboardSections[index]) && defaultWidths}
        onClick={() => setDashboard({ order: [...dashboardSections], widths: {} })}>{t("Reset order and widths")}</Button>
      <p className="text-sm text-muted-foreground">{t("Morning summary appears when available. School appears when timetables are configured.")}</p>
      <p role="status" className="text-sm text-muted-foreground">{shared?.state.saving ? t("Saving shared configuration…") : shared?.state.dirty ? t("Unsaved changes on this screen.") : shared?.state.loaded ? t("Shared configuration saved.") : t("Loading shared configuration…")}</p>
      {shared?.state.error && <div role="alert"><p className="text-destructive">{message(shared.state.error)}</p><DialogClose asChild><Link to="/settings/backups" className="text-link">{t("Storage and backups")}</Link></DialogClose></div>}
      <DialogFooter><DialogClose asChild><Button>{t("Close")}</Button></DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>;
}
