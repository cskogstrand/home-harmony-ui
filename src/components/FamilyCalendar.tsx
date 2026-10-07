import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { calendarBoundary } from "@/lib/ha-model";
import type { CalendarEvent } from "@/types/api";
import { Columns3, Table2, Plus } from "lucide-react";
import { useFamily, addDays, dateLabel, homeDate, isPlannerDate, sortEvents, type CalendarSettings, type FamilyEvent, type FamilyMember, type MemberId } from "@/contexts/FamilyContext";
import { EventButton, MemberAvatar } from "./FamilyPlanner";

export function CalendarViewControls({ onChange }: { onChange?: (settings: Partial<CalendarSettings>) => void }) {
  const { calendar, setCalendarSettings } = useFamily();
  const change = (settings: Partial<CalendarSettings>) => { setCalendarSettings(settings); onChange?.(settings); };
  return <div className="calendar-view-controls">
    <div className="calendar-segment" role="group" aria-label="Calendar layout">
      <button aria-pressed={calendar.view === "people"} onClick={() => change({ view: "people" })}><Columns3 size={16} aria-hidden="true" />By person</button>
      <button aria-pressed={calendar.view === "week"} onClick={() => change({ view: "week" })}><Table2 size={16} aria-hidden="true" />Weekly grid</button>
    </div>
    <div className="calendar-start-control"><span>Start</span><div className="calendar-segment" role="group" aria-label="Seven-day preview starts">
      <button aria-pressed={calendar.startDay === "today"} onClick={() => change({ startDay: "today" })}>Today</button>
      <button aria-pressed={calendar.startDay === "monday"} onClick={() => change({ startDay: "monday" })}>Monday</button>
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
  const { today, members: familyMembers } = useFamily();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const plansFor = (date: string, member: MemberId) => sortEvents(events.filter(e => e.date === date && (e.member === member || e.member === "everyone")));
  return <div className={`weekly-scroll ${compact ? "weekly-compact" : ""}`} role="region" aria-label="Family weekly calendar" tabIndex={0}>
      <table className="family-week-table">
        <caption className="sr-only">Family plans from {dateLabel(start)} to {dateLabel(addDays(start, 6))}</caption>
        <colgroup><col className="week-member-column" />{days.map(day => <col key={day} />)}</colgroup>
        <thead><tr><th scope="col">Family</th>{days.map(day => <th scope="col" key={day} className={day === today ? "week-today" : ""}>
          <time dateTime={day} aria-label={dateLabel(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} aria-current={day === today ? "date" : undefined}><span>{day === today ? "Today" : dateLabel(day, { weekday: "short" })}</span><strong>{dateLabel(day, { day: "numeric", month: "short" })}</strong></time>
        </th>)}</tr></thead>
        <tbody>{(members ?? familyMembers).map(person => <tr key={person.id} style={{ "--member": person.color } as React.CSSProperties}>
          <th scope="row"><div className="week-person"><span aria-hidden="true"><MemberAvatar member={person.id} small /></span><span>{person.name}</span></div></th>
          {days.map(day => {
            const plans = plansFor(day, person.id);
            return <td key={day} className={day === today ? "week-today" : ""}>
              <div className="week-cell-plans">
                {plans.map(event => <EventButton key={event.id} event={event} onClick={() => onEdit(event)} />)}
                <button className="week-add-plan" aria-label={`Add a plan for ${person.name} on ${dateLabel(day)}`} onClick={() => onAdd(day, person.id)}><Plus size={15} aria-hidden="true" /><span>{plans.length ? "Add" : "Add plan"}</span></button>
              </div>
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>;
}

const dateValue = (value: CalendarEvent["start"]) => typeof value === "string" ? value : "dateTime" in value ? value.dateTime : value.date;

// Expand only the visible range; HA end dates/times are exclusive, including midnight.
export function calendarPlans(event: CalendarEvent, calendarId: string, member: string, start: string, end: string, timeZone: string, index: number): FamilyEvent[] {
  const from = dateValue(event.start), to = dateValue(event.end);
  const allDay = isPlannerDate(from);
  const startTime = Date.parse(allDay ? calendarBoundary(from, timeZone) : from);
  const endTime = Date.parse(isPlannerDate(to) ? calendarBoundary(to, timeZone) : to);
  const firstDay = allDay ? from : homeDate(new Date(startTime), timeZone);
  const plans: FamilyEvent[] = [];
  for (let day = start; day < end; day = addDays(day, 1)) {
    if (startTime >= Date.parse(calendarBoundary(addDays(day, 1), timeZone)) || endTime <= Date.parse(calendarBoundary(day, timeZone))) continue;
    plans.push({ id: `${calendarId}:${event.uid ?? index}:${from}:${day}`, calendarId, member, date: day, allDay, continues: day > firstDay,
      time: allDay || day > firstDay ? "00:00" : new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(startTime)),
      title: event.summary, location: event.location ?? "", note: event.description ?? "" });
  }
  return plans;
}

// Remote events stay read-only and never enter FamilyContext/localStorage.
export function useCalendarPlans(start: string, end: string) {
  const { currentHome, homeOnline, haUrl, calendarEvents } = useApp();
  const { events: localEvents, calendarMembers, members } = useFamily();
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
    void Promise.allSettled(calendarIds.split(",").map(async id => ({ id, events: await calendarEvents(id, from, to, controller.signal) }))).then(results => {
      if (controller.signal.aborted) return;
      setResult({ key: requestKey, loading: false,
        events: results.flatMap(r => r.status === "fulfilled" ? r.value.events.map(event => ({ event, calendar: r.value.id })) : []),
        errors: results.flatMap((r, i) => r.status === "rejected" ? [`Could not read ${calendarIds.split(",")[i]}. Check the calendar integration, permissions, connection and HA CORS configuration.`] : []),
      });
    });
    return () => controller.abort();
  }, [homeOnline, calendarIds, requestKey, start, end, currentHome.timeZone, calendarEvents, refresh]);
  const remote = homeOnline && result.key === requestKey ? result.events.flatMap(({ event, calendar }, index) => {
    const entity = selected.find(e => e.entityId === calendar);
    return entity ? calendarPlans(event, calendar, calendarMembers[entity.preferenceId], start, end, currentHome.timeZone, index) : [];
  }) : [];
  // Local plans remain reachable when their HA person is removed or has not loaded yet.
  const people = [...members, ...[...new Set(localEvents.map(e => e.member))]
    .filter(id => id !== "everyone" && !members.some(m => m.id === id))
    .map(id => ({ id, name: "Person unavailable", initials: "?", color: "#c4d5a3" }))];
  if (!people.length) people.push({ id: "everyone", name: "Everyone", initials: "All", color: "#c4d5a3" });
  return { events: sortEvents([...localEvents, ...remote]), people,
    loading: homeOnline && !!calendarIds && (result.key !== requestKey || result.loading),
    errors: homeOnline && result.key === requestKey ? result.errors : [],
    refresh: () => setRefresh(n => n + 1), selectedCount: selected.length,
  };
}

export function CalendarSetupNotice() {
  const { currentHome, homeOnline } = useApp();
  const { connectedPlanner, members, calendarMembers } = useFamily();
  if (!connectedPlanner) return null;
  const calendars = currentHome.entities.filter(e => e.domain === "calendar");
  const unassigned = calendars.some(e => calendarMembers[e.preferenceId] !== "everyone" && !members.some(m => m.id === calendarMembers[e.preferenceId]));
  return <div className="page-note space-y-2">
    {!homeOnline ? <p role="status">Connect to Home Assistant to load people and calendars. <Link className="text-link" to="/settings">Connection settings</Link></p> : <>
      {!members.length && <p>Set up people in Home Assistant → Settings → People to see each person’s week.</p>}
      {!calendars.length && <p>Set up a calendar integration in Home Assistant, then assign its calendar in this app.</p>}
      {unassigned && <p>Set up calendars in this app: choose a person or Everyone for each calendar you want to show.</p>}
    </>}
    <Link className="text-link" to="/settings#family-calendar">Set up people and calendars</Link>
  </div>;
}

export function HomeAssistantCalendar({ data }: { data: ReturnType<typeof useCalendarPlans> }) {
  const { homeOnline } = useApp();
  const { connectedPlanner } = useFamily();
  if (!connectedPlanner) return null;
  return <div className="page-note space-y-2">
    <CalendarSetupNotice />
    {data.selectedCount > 0 && <p>Home Assistant events are read-only. Local plans are saved on this screen. <button className="text-link" disabled={!homeOnline || data.loading} onClick={data.refresh}>Refresh calendars</button></p>}
    {data.loading && <p role="status">Loading calendar events…</p>}
    {data.errors.map(error => <p role="alert" key={error}>{error}</p>)}
    {!homeOnline && <p role="status">Home Assistant calendar events are unavailable while offline. Local plans remain available.</p>}
  </div>;
}
