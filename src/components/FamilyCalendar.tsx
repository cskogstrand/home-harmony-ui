import { useI18n } from "@/hooks/use-i18n";
import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { calendarBoundary, calendarDateValue, calendarTimeInput } from "@/lib/ha-model";
import type { CalendarEvent } from "@/types/api";
import { Columns3, Table2, Plus } from "lucide-react";
import { useFamily, addDays, homeDate, isPlannerDate, sortEvents, weekNumber, weekStart, type CalendarSettings, type FamilyEvent, type FamilyMember, type MemberId } from "@/contexts/FamilyContext";
import { EventButton, MemberAvatar } from "./FamilyPlanner";

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

export function uniqueCalendarPlans(events: FamilyEvent[]) {
  const seen = new Set<string>();
  return events.filter(event => {
    const id = event.calendarSpan?.id ?? event.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function weekEventRows(events: FamilyEvent[], start: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const spans = uniqueCalendarPlans(sortEvents(events.filter(event => event.date >= start && event.date <= days[6])))
    .map(event => {
      const lastDay = event.calendarSpan?.lastDay ?? event.date;
      return { event, start: days.indexOf(event.date), end: lastDay > days[6] ? 7 : days.indexOf(lastDay) + 1 };
    })
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const rows: typeof spans[] = [[]];
  for (const span of spans) {
    const row = rows.find(row => !row.length || row[row.length - 1].end <= span.start);
    if (row) row.push(span);
    else rows.push([span]);
  }
  return rows;
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
              {index === 0 && <th scope="rowgroup" rowSpan={rows.length + (compact ? 0 : 1)}><div className="week-person"><span aria-hidden="true"><MemberAvatar member={person.id} small /></span><span>{person.name}</span></div></th>}
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

// Expand only the visible range; HA end dates/times are exclusive, including midnight.
export function calendarPlans(event: CalendarEvent, calendarId: string, member: string, start: string, end: string, timeZone: string, index: number): FamilyEvent[] {
  const from = calendarDateValue(event.start), to = calendarDateValue(event.end);
  const allDay = isPlannerDate(from);
  const startTime = Date.parse(allDay ? calendarBoundary(from, timeZone) : from);
  const endTime = Date.parse(isPlannerDate(to) ? calendarBoundary(to, timeZone) : to);
  const firstDay = allDay ? from : homeDate(new Date(startTime), timeZone);
  const lastDay = isPlannerDate(to) ? addDays(to, -1) : homeDate(new Date(endTime - 1), timeZone);
  const calendarSpan = { id: JSON.stringify([calendarId, event.uid ?? index, event.recurrence_id ?? "", from]), firstDay, lastDay };
  const endInput = allDay ? "" : calendarTimeInput(event.end, timeZone);
  const plans: FamilyEvent[] = [];
  for (let day = start; day < end; day = addDays(day, 1)) {
    if (startTime >= Date.parse(calendarBoundary(addDays(day, 1), timeZone)) || endTime <= Date.parse(calendarBoundary(day, timeZone))) continue;
    plans.push({ id: `${calendarSpan.id}:${day}`, calendarId, calendarEvent: event, calendarSpan, member, date: day, allDay, continues: day > firstDay,
      time: allDay || day > firstDay ? "00:00" : new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(startTime)),
      endTime: allDay ? undefined : endInput.slice(11, 16), endDate: allDay ? undefined : endInput.slice(0, 10),
      title: event.summary, location: event.location ?? "", note: event.description ?? "" });
  }
  return plans;
}

// Calendar events stay in memory; settings storage never contains HA data.
export function useCalendarPlans(start: string, end: string) {
  const { t } = useI18n();
  const { currentHome, homeOnline, haUrl, watchCalendarEvents } = useApp();
  const { events, calendarMembers, members, compareMembers, isMemberVisible } = useFamily();
  const localEvents = events.filter(event => isMemberVisible(event.member));
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; events: { event: CalendarEvent; calendar: string }[]; errors: string[]; loading: boolean }>({ key: "", events: [], errors: [], loading: false });
  const calendars = currentHome.entities.filter(e => e.domain === "calendar");
  const selected = calendars.filter(e => calendarMembers[e.preferenceId] === "everyone" || members.some(m => m.id === calendarMembers[e.preferenceId]));
  const calendarIds = selected.map(e => e.entityId).sort().join(",");
  const requestKey = `${haUrl}|${calendarIds}|${start}|${end}|${currentHome.timeZone}`;
  useEffect(() => {
    if (!homeOnline || !calendarIds) {
      setResult(previous => previous.key ? { key: "", events: [], errors: [], loading: false } : previous);
      return;
    }
    const controller = new AbortController();
    setResult({ key: requestKey, events: [], errors: [], loading: true });
    const from = calendarBoundary(start, currentHome.timeZone);
    const to = calendarBoundary(end, currentHome.timeZone);
    const results = new Map<string, CalendarEvent[] | null>();
    const ids = calendarIds.split(",");
    for (const id of ids) watchCalendarEvents(id, from, to, controller.signal, events => {
      if (controller.signal.aborted) return;
      results.set(id, events);
      setResult({ key: requestKey, loading: results.size < ids.length,
        events: [...results].flatMap(([calendar, plans]) => (plans ?? []).map(event => ({ event, calendar }))),
        errors: [...results].flatMap(([calendar, plans]) => plans === null ? [calendar] : []),
      });
    });
    return () => controller.abort();
  }, [homeOnline, calendarIds, requestKey, start, end, currentHome.timeZone, watchCalendarEvents, refresh]);
  const remote = homeOnline && result.key === requestKey ? result.events.flatMap(({ event, calendar }, index) => {
    const entity = selected.find(e => e.entityId === calendar);
    return entity ? calendarPlans(event, calendar, calendarMembers[entity.preferenceId], start, end, currentHome.timeZone, index) : [];
  }) : [];
  // Local plans remain reachable when their HA person is removed or has not loaded yet.
  const people = [...members, ...[...new Set(localEvents.map(e => e.member))]
    .filter(id => id !== "everyone" && !members.some(m => m.id === id))
    .map(id => ({ id, name: t("Person unavailable"), initials: "?", color: "#c4d5a3" }))].sort((a, b) => compareMembers(a.id, b.id));
  people.unshift({ id: "everyone", name: t("Everyone"), initials: t("All"), color: "#c4d5a3" });
  return { events: sortEvents([...localEvents, ...remote]), people,
    loading: homeOnline && !!calendarIds && (result.key !== requestKey || result.loading),
    errors: homeOnline && result.key === requestKey ? result.errors.map(calendar => t("Could not read {value1}. Check the calendar integration, permissions, connection and HA CORS configuration.", { value1: calendar })) : [],
    refresh: () => setRefresh(n => n + 1), selectedCount: selected.length,
  };
}

export function HomeAssistantCalendar({ data }: { data: ReturnType<typeof useCalendarPlans> }) {
  const { t, message } = useI18n();
  const { homeOnline } = useApp();
  const { connectedPlanner } = useFamily();
  if (!connectedPlanner) return null;
  return <div className="page-note space-y-2">
    {data.selectedCount > 0 && <button className="text-link" disabled={!homeOnline || data.loading} onClick={data.refresh}>{t("Refresh calendars")}</button>}
    {data.loading && <p role="status">{t("Loading calendar events…")}</p>}
    {data.errors.map(error => <p role="alert" key={message(error)}>{message(error)}</p>)}
    {!homeOnline && <p role="status">{t("Home Assistant calendar events are unavailable while offline.")}</p>}
  </div>;
}
