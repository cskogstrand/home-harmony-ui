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
