import { weekEventRows } from "@/lib/family-calendar";
import type { useCalendarPlans } from "@/hooks/use-calendar-plans";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { Columns3, Table2, Plus, RefreshCw } from "lucide-react";
import { useFamily, addDays, weekNumber, weekStart, type CalendarSettings, type FamilyEvent, type FamilyMember, type MemberId } from "@/contexts/FamilyContext";
import { EventButton, MemberAvatar } from "./FamilyPlanner";
import { Button } from "./ui/button";

export function CalendarViewControls({ onChange }: { onChange?: (settings: Partial<CalendarSettings>) => void }) {
  const { t } = useI18n();
  const { calendar, setCalendarSettings, today } = useFamily();
  const change = (settings: Partial<CalendarSettings>) => { setCalendarSettings(settings); onChange?.(settings); };
  return <div className="calendar-view-controls">
    <span className="calendar-current-week">{t("Today · Week {value1}", { value1: weekNumber(today) })}</span>
    <div className="calendar-segment" role="group" aria-label={t("Calendar layout")}>
      <button aria-pressed={calendar.view === "week"} onClick={() => change({ view: "week" })}><Table2 size={16} aria-hidden="true" />{t("Weekly grid")}</button>
      <button aria-pressed={calendar.view === "people"} onClick={() => change({ view: "people" })}><Columns3 size={16} aria-hidden="true" />{t("By person")}</button>
    </div>
    <div className="calendar-start-control"><span>{t("Start")}</span><div className="calendar-segment" role="group" aria-label={t("Seven-day preview starts")}>
      <button aria-pressed={calendar.startDay === "today"} onClick={() => change({ startDay: "today" })}>{t("Today")}</button>
      <button aria-pressed={calendar.startDay === "monday"} onClick={() => change({ startDay: "monday" })}>{t("Monday")}</button>
    </div></div>
  </div>;
}

interface FamilyWeekGridProps {
  start: string;
  events: FamilyEvent[];
  members?: ReadonlyArray<FamilyMember>;
  compact?: boolean;
  onEdit: (event: FamilyEvent) => void;
  onAdd: (date: string, member: MemberId) => void;
}

export function FamilyWeekGrid({ start, events, members, compact = false, onEdit, onAdd }: FamilyWeekGridProps) {
  const { t, dateLabel } = useI18n();
  const { today, members: familyMembers } = useFamily();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return <div className={`weekly-scroll ${compact ? "weekly-compact" : ""}`} role="region" aria-label={t("Family weekly calendar")} tabIndex={0}>
      <table className="family-week-table">
        <caption className="sr-only">{t("Family plans from {value1} to {value2}", { value1: dateLabel(start), value2: dateLabel(addDays(start, 6)) })}</caption>
        <colgroup><col className="week-member-column" />{days.map(day => <col key={day} className={day === today ? "week-today" : ""} />)}</colgroup>
        <thead><tr><th scope="col">{t("Family")}</th>{days.map(day => <th scope="col" key={day} className={day === today ? "week-today" : ""}>
          <small className="calendar-week-number">{(day === start || day === weekStart(day)) && t("Week {value1}", { value1: weekNumber(day) })}</small>
          <time dateTime={day} aria-label={dateLabel(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} aria-current={day === today ? "date" : undefined}><span>{day === today ? t("Today") : dateLabel(day, { weekday: "short" })}</span><strong>{dateLabel(day, { day: "numeric", month: "short" })}</strong></time>
        </th>)}</tr></thead>
        {(members ?? familyMembers).map(person => {
          const personal = events.filter(event => event.member === person.id);
          const rows = weekEventRows(personal, start);
          return <tbody key={person.id} style={{ "--member": person.color } as React.CSSProperties}>
            {rows.map((row, index) => <tr key={index} className="week-event-row">
              {index === 0 && <th scope="rowgroup" rowSpan={rows.length + (compact ? 0 : 1)}><div className="week-person"><span aria-hidden="true"><MemberAvatar member={person.id} /></span><span>{person.name}</span></div></th>}
              {days.map((day, column) => {
                if (row.some(span => span.start < column && span.end > column)) return null;
                const span = row.find(span => span.start === column);
                return <td key={day} colSpan={span ? span.end - span.start : 1}>
                  {span && <EventButton event={span.event} continuesBefore={span.event.calendarSpan?.firstDay < start} continuesAfter={span.event.calendarSpan?.lastDay > days[6]} onClick={() => onEdit(span.event)} />}
                </td>;
              })}
            </tr>)}
            {!compact && <tr className="week-add-row">{days.map(day => <td key={day}>
              <button className="week-add-plan" aria-label={t("Add a plan for {value1} on {value2}", { value1: person.name, value2: dateLabel(day) })} onClick={() => onAdd(day, person.id)}><Plus size={15} aria-hidden="true" /><span>{personal.some(event => event.date === day) ? t("Add") : t("Add plan")}</span></button>
            </td>)}</tr>}
          </tbody>;
        })}
      </table>
    </div>;
}

export function CalendarRefreshButton({ data }: { data: ReturnType<typeof useCalendarPlans> }) {
  const { t } = useI18n();
  const { homeOnline } = useApp();
  const { connectedPlanner } = useFamily();
  if (!connectedPlanner || !data.selectedCount) return null;
  return <Button variant="ghost" size="icon" className="shrink-0" aria-label={t("Refresh calendars")} title={t("Refresh calendars")}
    disabled={!homeOnline || data.loading} aria-busy={data.loading} onClick={data.refresh}>
    <RefreshCw aria-hidden="true" className={data.loading ? "motion-safe:animate-spin" : undefined} />
  </Button>;
}

export function HomeAssistantCalendar({ data }: { data: ReturnType<typeof useCalendarPlans> }) {
  const { t, message } = useI18n();
  const { homeOnline } = useApp();
  const { connectedPlanner } = useFamily();
  if (!connectedPlanner || (homeOnline && !data.loading && !data.errors.length)) return null;
  return <div className="page-note space-y-2">
    {data.loading && <p role="status">{t("Loading calendar events…")}</p>}
    {data.errors.map(error => <p role="alert" key={message(error)}>{message(error)}</p>)}
    {!homeOnline && <p role="status">{t("Home Assistant calendar events are unavailable while offline.")}</p>}
  </div>;
}
