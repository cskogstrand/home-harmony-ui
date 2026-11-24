import { memo } from "react";
import { groupWasteCollections, weekEventRows } from "@/lib/family-calendar";
import { isWasteCollected } from "@/lib/waste-collection";
import type { useCalendarPlans } from "@/hooks/use-calendar-plans";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { CalendarDays, Check, Columns3, Table2, Plus } from "lucide-react";
import { useFamily, addDays, weekNumber, weekStart, type CalendarSettings, type FamilyEvent, type FamilyMember, type MemberId } from "@/contexts/FamilyContext";
import { EventButton, MemberAvatar } from "./FamilyPlanner";
import { WasteTypeIcons } from "./WasteCollection";
import { Button } from "./ui/button";
import { SharedSettingsStatus } from "./common/SharedSettingsStatus";
import { SettingsPopover } from "./common/SettingsPopover";

/** Shared layout settings; `note` explains what stays local to this screen, beside the shared save status. */
export function CalendarViewControls({ onChange, note }: { onChange?: (settings: Partial<CalendarSettings>) => void; note?: string }) {
  const { t } = useI18n();
  const { calendar, setCalendarSettings, today } = useFamily();
  const change = (settings: Partial<CalendarSettings>) => { setCalendarSettings(settings); onChange?.(settings); };
  return <div className="calendar-view-controls">
    <span className="calendar-current-week">{t("Today · Week {value1}", { value1: weekNumber(today) })}</span>
    <SettingsPopover label={t("Calendar settings")}>
      <SharedSettingsStatus />
      {note && <p className="calendar-local-note">{note}</p>}
      <fieldset className="settings-card"><legend className="panel-title text-sm font-semibold"><Table2 className="panel-title-icon" strokeWidth={1.8} aria-hidden="true" /><span>{t("Calendar layout")}</span></legend><div className="calendar-segment">
        <button aria-pressed={calendar.view === "week"} onClick={() => change({ view: "week" })}><Table2 size={16} aria-hidden="true" />{t("Weekly grid")}</button>
        <button aria-pressed={calendar.view === "people"} onClick={() => change({ view: "people" })}><Columns3 size={16} aria-hidden="true" />{t("By person")}</button>
      </div></fieldset>
      <fieldset className="settings-card"><legend className="panel-title text-sm font-semibold"><CalendarDays className="panel-title-icon" strokeWidth={1.8} aria-hidden="true" /><span>{t("Seven-day preview starts")}</span></legend><div className="calendar-segment">
        <button aria-pressed={calendar.startDay === "today"} onClick={() => change({ startDay: "today" })}>{t("Today")}</button>
        <button aria-pressed={calendar.startDay === "monday"} onClick={() => change({ startDay: "monday" })}>{t("Monday")}</button>
      </div></fieldset>
    </SettingsPopover>
  </div>;
}

/** A day's waste pickups as one compact chip; the read-only dialog lists every fraction. */
function WasteChip({ event, count, onClick }: { event: FamilyEvent; count: number; onClick: () => void }) {
  const { t } = useI18n();
  const { today, time, memberColor } = useFamily();
  const collected = isWasteCollected(event.date, today, time);
  const label = count === 1 ? event.title || t("Waste collection") : t("{count} pickups", { count });
  return <button type="button" className="week-waste-chip press-feedback" data-state={collected ? "collected" : undefined} style={{ "--member": memberColor(event.member) } as React.CSSProperties} title={event.title || undefined} onClick={onClick}>
    <WasteTypeIcons title={event.title} size={16} />
    <span className="week-waste-label">{label}</span>
    {collected && <Check size={14} aria-hidden="true" />}
    <span className="sr-only">{count > 1 && event.title ? `: ${event.title}` : ""}, {t(collected ? "Picked up today" : "Waste collection")}</span>
  </button>;
}

interface FamilyWeekGridProps {
  start: string;
  events: FamilyEvent[];
  members?: ReadonlyArray<FamilyMember>;
  compact?: boolean;
  onEdit: (event: FamilyEvent) => void;
  onAdd: (date: string, member: MemberId) => void;
  onDay?: (date: string) => void;
}

export const FamilyWeekGrid = memo(function FamilyWeekGrid({ start, events, members, compact = false, onEdit, onAdd, onDay }: FamilyWeekGridProps) {
  const { t, dateLabel, language } = useI18n();
  const { today, members: familyMembers } = useFamily();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  // One add control per person; the editor starts on today when it is in view, and the day header leads to a single day's own Add a plan.
  const addDay = days.includes(today) ? today : start;
  return <div className={`weekly-scroll ${compact ? "weekly-compact" : ""}`} role="region" aria-label={t("Family weekly calendar")} tabIndex={0}>
      <table className="family-week-table" lang={language}>
        <caption className="sr-only">{t("Family plans from {value1} to {value2}", { value1: dateLabel(start), value2: dateLabel(addDays(start, 6)) })}</caption>
        <colgroup><col className="week-member-column" />{days.map(day => <col key={day} className={day === today ? "week-today" : ""} />)}</colgroup>
        <thead><tr><th scope="col"><span className="week-member-label">{t("Family")}</span></th>{days.map(day => <th scope="col" key={day} className={day === today ? "week-today" : ""}>
          <small className="calendar-week-number">{(day === start || day === weekStart(day)) && t("Week {value1}", { value1: weekNumber(day) })}</small>
          {onDay ? <button className="calendar-week-day" onClick={() => onDay(day)} aria-label={dateLabel(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}><time dateTime={day} aria-current={day === today ? "date" : undefined}><span>{day === today ? t("Today") : dateLabel(day, { weekday: "short" })}</span><strong>{dateLabel(day, { day: "numeric", month: "short" })}</strong></time></button> :
            <time dateTime={day} aria-label={dateLabel(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} aria-current={day === today ? "date" : undefined}><span>{day === today ? t("Today") : dateLabel(day, { weekday: "short" })}</span><strong>{dateLabel(day, { day: "numeric", month: "short" })}</strong></time>}
        </th>)}</tr></thead>
        {(members ?? familyMembers).map(person => {
          const { events: personal, pickups } = groupWasteCollections(events.filter(event => event.member === person.id));
          const rows = weekEventRows(personal, start);
          return <tbody key={person.id} style={{ "--member": person.color } as React.CSSProperties}>
            {rows.map((row, index) => <tr key={index} className="week-event-row">
              {index === 0 && <th scope="rowgroup" rowSpan={rows.length} aria-label={person.name}><div className="week-person" title={person.name}><span aria-hidden="true"><MemberAvatar member={person.id} /></span><span className="week-member-label">{person.name}</span>
                {!compact && <button type="button" className="week-add-plan" aria-label={t("Add a plan for {value1}", { value1: person.name })} title={t("Add a plan for {value1}", { value1: person.name })} onClick={() => onAdd(addDay, person.id)}><Plus size={18} aria-hidden="true" /></button>}
              </div></th>}
              {days.map((day, column) => {
                if (row.some(span => span.start < column && span.end > column)) return null;
                const span = row.find(span => span.start === column);
                return <td key={day} colSpan={span ? span.end - span.start : 1}>
                  {span?.event.wasteCollection ? <WasteChip event={span.event} count={pickups.get(span.event.id)?.length ?? 1} onClick={() => onEdit(span.event)} /> :
                    span && <EventButton event={span.event} continuesBefore={span.event.calendarSpan?.firstDay < start} continuesAfter={span.event.calendarSpan?.lastDay > days[6]} onClick={() => onEdit(span.event)} />}
                </td>;
              })}
            </tr>)}
          </tbody>;
        })}
      </table>
    </div>;
});

export function HomeAssistantCalendar({ data, hasVisiblePlans = !!data.events.length }: { data: ReturnType<typeof useCalendarPlans>; hasVisiblePlans?: boolean }) {
  const { t, message } = useI18n();
  const { homeOnline } = useApp();
  const { connectedPlanner } = useFamily();
  if (!connectedPlanner || (homeOnline && !data.loading && !data.errors.length)) return null;
  if (!homeOnline) return <p className="page-note">{t(hasVisiblePlans ? "Showing last loaded plans." : "Plans unavailable.")}</p>;
  return <div className="page-note space-y-2">
    {data.loading && <p role="status">{t("Loading plans…")}</p>}
    {data.errors.map(error => <p role="alert" key={message(error)}>{message(error)}</p>)}
    {homeOnline && !!data.errors.length && <Button variant="outline" disabled={data.loading} onClick={data.refresh}>{t("Retry")}</Button>}
  </div>;
}
