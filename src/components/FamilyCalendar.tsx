import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { calendarBoundary } from "@/lib/ha-model";
import type { CalendarEvent } from "@/types/api";
import { Columns3, Table2, Plus } from "lucide-react";
import { useFamily, familyMembers, addDays, dateLabel, sortEvents, type CalendarSettings, type FamilyEvent, type MemberId } from "@/contexts/FamilyContext";
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
  members?: ReadonlyArray<(typeof familyMembers)[number]>;
  compact?: boolean;
  onEdit: (event: FamilyEvent) => void;
  onAdd: (date: string, member: MemberId) => void;
}

export function FamilyWeekGrid({ start, events, members = familyMembers, compact = false, onEdit, onAdd }: FamilyWeekGridProps) {
  const { today } = useFamily();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const plansFor = (date: string, member: MemberId) => sortEvents(events.filter(e => e.date === date && (e.member === member || e.member === "everyone")));
  return <div className={`weekly-scroll ${compact ? "weekly-compact" : ""}`} role="region" aria-label="Family weekly calendar" tabIndex={0}>
      <table className="family-week-table">
        <caption className="sr-only">Family plans from {dateLabel(start)} to {dateLabel(addDays(start, 6))}</caption>
        <colgroup><col className="week-member-column" />{days.map(day => <col key={day} />)}</colgroup>
        <thead><tr><th scope="col">Family</th>{days.map(day => <th scope="col" key={day} className={day === today ? "week-today" : ""}>
          <time dateTime={day} aria-label={dateLabel(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} aria-current={day === today ? "date" : undefined}><span>{day === today ? "Today" : dateLabel(day, { weekday: "short" })}</span><strong>{dateLabel(day, { day: "numeric", month: "short" })}</strong></time>
        </th>)}</tr></thead>
        <tbody>{members.map(person => <tr key={person.id} className={`member-${person.id}`}>
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

// Remote events stay read-only and never enter FamilyContext/localStorage.
export function HomeAssistantCalendar({ start, end }: { start: string; end: string }) {
  const { currentHome, homeOnline, haUrl, calendarEvents } = useApp();
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; events: { event: CalendarEvent; calendar: string }[]; errors: string[]; loading: boolean }>({ key: "", events: [], errors: [], loading: false });
  const calendars = currentHome.entities.filter(e => e.domain === "calendar");
  const calendarIds = calendars.map(e => e.entityId).sort().join(",");
  const requestKey = `${haUrl}|${calendarIds}|${start}|${end}|${currentHome.timeZone}`;
  useEffect(() => {
    if (!homeOnline || !calendarIds) return;
    const controller = new AbortController();
    setResult(previous => ({ key: requestKey, events: previous.key === requestKey ? previous.events : [], errors: [], loading: true }));
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
  const events = result.key === requestKey ? result.events : [];
  const dateValue = (value: CalendarEvent["start"]) => typeof value === "string" ? value : "dateTime" in value ? value.dateTime : value.date;
  const eventDate = (value: CalendarEvent["start"]) => {
    const date = dateValue(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${dateLabel(date)} (all day)`;
    const parsed = new Date(date);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("en-GB", { timeZone: currentHome.timeZone, dateStyle: "medium", timeStyle: "short" }) : "Date not reported";
  };
  return <section className="glow-panel col-span-full"><div className="panel-heading"><h2>Home Assistant calendars</h2><button className="text-link" disabled={!homeOnline} onClick={() => setRefresh(n => n + 1)}>Refresh calendars</button></div>
    <p className="page-note">Read-only · {dateLabel(start)} to {dateLabel(addDays(end, -1))} · {currentHome.timeZone}. Local family plans are shown separately above.</p>
    {!homeOnline && <p role="status">Home Assistant calendars are offline. Any cached events below are stale; local plans remain available.</p>}
    {!calendars.length && <p className="empty-note">No HA calendar entities loaded. Manage calendar integrations in Home Assistant.</p>}
    {homeOnline && result.loading && <p role="status">Loading calendar events…</p>}
    {homeOnline && result.key === requestKey && result.errors.map(error => <p role="alert" key={error}>{error}</p>)}
    {homeOnline && calendars.length > 0 && !result.loading && result.key === requestKey && !events.length && !result.errors.length && <p>No HA events in this date range.</p>}
    <div className="space-y-3">{[...events].sort((a, b) => dateValue(a.event.start).localeCompare(dateValue(b.event.start))).map(({ event, calendar }, i) => <article key={`${calendar}:${event.uid ?? i}:${dateValue(event.start)}`} className="rounded-lg border p-3"><small>Home Assistant · {calendars.find(c => c.entityId === calendar)?.name ?? calendar}</small><h3>{event.summary}</h3><p>{eventDate(event.start)} — {eventDate(event.end)} <small>(end exclusive)</small></p>{event.location && <p>{event.location}</p>}{event.description && <p className="whitespace-pre-wrap">{event.description}</p>}</article>)}</div>
  </section>;
}
