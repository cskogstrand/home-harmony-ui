import { PanelTitle } from "@/components/PanelTitle";
import { CalendarDays } from "lucide-react";
import { useFamily, addDays, type FamilyEvent } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { uniqueCalendarPlans } from "@/lib/family-calendar";
import { EventButton } from "./FamilyPlanner";

export function CalendarMonth({ date, start, end, events, unavailable, onDay, onEdit }: {
  date: string; start: string; end: string; events: FamilyEvent[]; unavailable?: string;
  onDay: (date: string) => void; onEdit: (event: FamilyEvent) => void;
}) {
  const { today, memberColor, memberName } = useFamily();
  const { t, dateLabel, eventTimeLabel } = useI18n();
  const days: string[] = [];
  for (let day = start; day < end; day = addDays(day, 1)) days.push(day);
  return <section className="glow-panel calendar-month" aria-label={t("Month view")}>
    <div className="calendar-month-weekdays" aria-hidden="true">{days.slice(0, 7).map(day => <span key={day}>{dateLabel(day, { weekday: "short" })}</span>)}</div>
    <div className="calendar-month-grid">{days.map(day => {
      const plans = uniqueCalendarPlans(events.filter(event => event.date === day));
      const count = t(plans.length === 1 ? "{count} plan" : "{count} plans", { count: plans.length });
      return <div key={day} className={`calendar-month-day${day.slice(0, 7) !== date.slice(0, 7) ? " is-outside" : ""}${day === today ? " is-today" : ""}`}>
        <button className="calendar-month-date" aria-label={`${dateLabel(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${unavailable || count}`} aria-current={day === today ? "date" : undefined} onClick={() => onDay(day)}>
          <time dateTime={day}>{dateLabel(day, { day: "numeric" })}</time>
          {!!plans.length && <span className="calendar-month-count">{count}</span>}
        </button>
        <div className="calendar-month-events">{plans.slice(0, 3).map(event => <button key={event.id} className="calendar-month-event" style={{ "--member": memberColor(event.member) } as React.CSSProperties}
          aria-label={`${event.title}, ${eventTimeLabel(event)}, ${memberName(event.member)}`} onClick={() => onEdit(event)}>
          <span className="calendar-event-dot" aria-hidden="true" /><span>{event.title}</span>{!event.allDay && !event.continues && <time>{event.time}</time>}
        </button>)}
          {plans.length > 3 && <button className="calendar-month-more" onClick={() => onDay(day)}>{t("{count} more", { count: plans.length - 3 })}</button>}
        </div>
      </div>;
    })}</div>
  </section>;
}

export function CalendarDay({ date, events, unavailable, onEdit }: {
  date: string; events: FamilyEvent[]; unavailable?: string; onEdit: (event: FamilyEvent) => void;
}) {
  const { t, dateLabel } = useI18n();
  const plans = uniqueCalendarPlans(events);
  return <section className="glow-panel calendar-agenda" aria-label={t("Day view")}>
    <PanelTitle icon={CalendarDays}>{dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}</PanelTitle>
    {!plans.length ? <div className="calendar-agenda-empty"><CalendarDays size={32} strokeWidth={1.5} aria-hidden="true" /><p>{unavailable || t("No plans for this day.")}</p></div> :
      ([true, false] as const).map(allDay => {
        const group = plans.filter(event => !!event.allDay === allDay);
        return !!group.length && <section key={String(allDay)} className="calendar-agenda-group" aria-label={t(allDay ? "All day" : "Schedule")}>
          <h3>{t(allDay ? "All day" : "Schedule")}</h3>
          <div>{group.map(event => <EventButton key={event.id} event={event} showMember onClick={() => onEdit(event)} />)}</div>
        </section>;
      })}
  </section>;
}
