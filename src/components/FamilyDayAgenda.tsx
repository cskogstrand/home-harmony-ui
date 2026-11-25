import { Armchair, ChevronDown } from "lucide-react";
import { useId } from "react";
import { useApp } from "@/contexts/AppContext";
import { useFamily, type FamilyEvent } from "@/contexts/FamilyContext";
import type { useCalendarPlans } from "@/hooks/use-calendar-plans";
import { useI18n } from "@/hooks/use-i18n";
import { uniqueCalendarPlans } from "@/lib/family-calendar";
import { EventButton, MemberAvatar } from "./FamilyPlanner";
import "./family-day-agenda.css";

type Plans = ReturnType<typeof useCalendarPlans>;
type Person = Plans["people"][number];

/**
 * Everyone's day on phones: one heading per day, a compact row for each person with plans or a status,
 * and everyone free on one line. Tomorrow starts folded behind a native disclosure.
 */
export function FamilyDayAgenda({ data, days, people, onEdit, hidden }: { data: Plans; days: string[]; people: Person[]; onEdit: (event: FamilyEvent) => void; hidden?: boolean }) {
  const { t, dateLabel } = useI18n();
  const { homeOnline, currentHome } = useApp();
  const { today, calendarMembers, todoLists, dashboard } = useFamily();
  const baseId = useId();
  // Same per-person rules as the board's lanes: plans, then a reason the lane is empty, else free.
  const personDay = (person: Person, date: string) => {
    const plans = uniqueCalendarPlans(data.events.filter(event => event.member === person.id && event.date === date));
    const calendars = Object.keys(calendarMembers).filter(id => calendarMembers[id] === person.id);
    const hasLists = Object.values(todoLists).some(list => list.kind !== "shopping" && list.member === person.id);
    const missing = calendars.some(id => !currentHome.entities.some(entity => entity.preferenceId === id));
    const message = !calendars.length && !hasLists ? t("No calendars or to-do lists selected")
      : data.loading ? t("Loading plans…")
      : data.errors.length || missing ? t("Some calendars or to-do lists could not be loaded.")
      : null;
    return { person, plans, missing, message: homeOnline ? message : null };
  };

  return <div className="family-day-agenda" hidden={hidden}>{days.map(date => {
    const isToday = date === today;
    const label = t(isToday ? "Today" : "Tomorrow");
    const lanes = people.map(person => personDay(person, date));
    const listed = lanes.filter(lane => lane.plans.length || lane.message);
    // Offline, an empty lane is unknown rather than free.
    const free = homeOnline ? lanes.filter(lane => !lane.plans.length && !lane.message) : [];
    const count = lanes.reduce((total, lane) => total + lane.plans.length, 0);
    const freeId = `${baseId}-${date}-free`;
    const when = <time dateTime={date} className="family-day-agenda-date">{dateLabel(date, { day: "numeric", month: "short" })}</time>;
    const body = <>
      {listed.map(({ person, plans, missing, message }) => <div className="family-day-agenda-person" role="group" aria-label={person.name} key={person.id}>
        <span aria-hidden="true"><MemberAvatar member={person.id} /></span>
        <div className="family-day-agenda-plans">
          <p className="family-day-agenda-name">{person.name}</p>
          {plans.map(event => <EventButton key={event.id} event={event} hideMember onClick={() => onEdit(event)} />)}
          {!plans.length && message && <p className="family-day-agenda-note">{message}</p>}
          {homeOnline && !!plans.length && missing && <p className="family-day-agenda-note">{t("Some calendars could not be loaded.")}</p>}
        </div>
      </div>)}
      {!!free.length && <div className="family-day-agenda-free">
        <Armchair className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span id={freeId}>{t(isToday ? "Free today" : "Free tomorrow")}</span>
        <ul aria-labelledby={freeId}>{free.map(({ person }) => <li key={person.id}>
          <span aria-hidden="true"><MemberAvatar member={person.id} small /></span>{person.name}
        </li>)}</ul>
      </div>}
    </>;
    if (isToday) return <section key={date} aria-label={label} className="family-day-agenda-day">
      <h3 className={dashboard.showTomorrow ? "family-day-agenda-heading" : "sr-only"}><span>{label}</span> {when}</h3>
      {body}
    </section>;
    return <details key={date} className="family-day-agenda-day family-day-agenda-later">
      <summary>
        <span className="family-day-agenda-heading"><span>{label}</span> {when}</span>
        {!data.loading && <span className="family-day-agenda-count">{t(count === 1 ? "{count} plan" : "{count} plans", { count })}</span>}
        <ChevronDown className="family-day-agenda-chevron" size={20} aria-hidden="true" />
      </summary>
      <section aria-label={label} className="family-day-agenda-body">{body}</section>
    </details>;
  })}</div>;
}
