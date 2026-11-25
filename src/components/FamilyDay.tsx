import { PlannerCardBackdrop } from "@/components/CardArtwork";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { PanelTitle } from "@/components/PanelTitle";
import { Armchair, CalendarCheck } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { addDays, isWeekend, useFamily, type FamilyEvent } from "@/contexts/FamilyContext";
import type { useCalendarPlans } from "@/hooks/use-calendar-plans";
import { useI18n } from "@/hooks/use-i18n";
import { phoneQuery, useMediaQuery } from "@/hooks/use-media-query";
import { uniqueCalendarPlans } from "@/lib/family-calendar";
import { HomeAssistantCalendar } from "./FamilyCalendar";
import { FamilyDayAgenda } from "./FamilyDayAgenda";
import { EventButton, MemberAvatar } from "./FamilyPlanner";
import { MorningSummary } from "./HomePanels";

export function FamilyDay({ data, onEdit }: { data: ReturnType<typeof useCalendarPlans>; onEdit: (event: FamilyEvent) => void }) {
  const { t, dateLabel } = useI18n();
  const { homeOnline, currentHome } = useApp();
  const { today, calendarMembers, todoLists, dashboard } = useFamily();
  const days = dashboard.showTomorrow ? [today, addDays(today, 1)] : [today];
  const hasSources = (id: string) => Object.values(calendarMembers).includes(id) || Object.values(todoLists).some(list => list.kind !== "shopping" && list.member === id);
  // People without calendars or lists stay off the shared board; Settings explains that gap. Fall back to everyone so a fresh setup still shows why the board is empty.
  const configured = data.people.filter(person => hasSources(person.id));
  const people = configured.length ? configured : data.people;
  const hasVisiblePlans = data.events.some(event => days.includes(event.date));
  const phone = useMediaQuery(phoneQuery);
  const board = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState<number>();
  useLayoutEffect(() => {
    const element = board.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      // Keep both dates under the same header, allowing 160px per person and 12px between columns.
      if (width) setCapacity(Math.max(1, Math.floor((width + 12) / (160 + 12))));
    };
    measure();
    if (!window.ResizeObserver) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [phone]);
  const columns = Math.min(capacity ?? people.length, people.length) || 1;
  const rows = [];
  for (let i = 0; i < people.length; i += columns) rows.push(people.slice(i, i + columns));

  return <section className="glow-panel col-span-full" aria-label={t("Everyone’s day")}>
    <PlannerCardBackdrop kind="day" />
    <div className="panel-heading"><PanelTitle artwork="day" icon={CalendarCheck}>{t("Everyone’s day")}</PanelTitle>{dashboard.daySummaryPlayback && <MorningSummary dialogTrigger />}</div>
    <HomeAssistantCalendar data={data} hasVisiblePlans={hasVisiblePlans} />
    {phone ? <FamilyDayAgenda data={data} days={days} people={people} onEdit={onEdit} hidden={!homeOnline && !hasVisiblePlans} /> :
    <div ref={board} className="family-day-board" hidden={!homeOnline && !hasVisiblePlans} style={{ "--day-columns": columns } as CSSProperties}>{rows.map(row => <div className="family-day-row" key={row[0].id}>
      <div className="family-lanes">{row.map(person => <div className="lane-heading" key={person.id}>
        <span aria-hidden="true"><MemberAvatar member={person.id} /></span><h3>{person.name}</h3>
      </div>)}</div>
      {days.map(date => {
        const label = t(date === today ? "Today" : "Tomorrow");
        return <section key={date} aria-label={label} className={date === today ? "family-day-date" : "family-day-date border-t border-border pt-5"} data-weekend={isWeekend(date) || undefined}>
          <h3 className={dashboard.showTomorrow ? "mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-medium" : "sr-only"}>
            <span>{label}</span> <time dateTime={date} className="text-sm font-normal text-muted-foreground">{dateLabel(date, { weekday: "short", day: "numeric", month: "short" })}</time>
          </h3>
          <div className="family-lanes">{row.map(person => {
            const personal = uniqueCalendarPlans(data.events.filter(event => event.member === person.id && event.date === date));
            const calendars = Object.keys(calendarMembers).filter(id => calendarMembers[id] === person.id);
            const hasLists = Object.values(todoLists).some(list => list.kind !== "shopping" && list.member === person.id);
            const missing = calendars.some(id => !currentHome.entities.some(entity => entity.preferenceId === id));
            const unavailableMessage = !calendars.length && !hasLists ? t("No calendars or to-do lists selected")
              : data.loading ? t("Loading plans…")
              : data.errors.length || missing ? t("Some calendars or to-do lists could not be loaded.")
              : null;
            return <div className="family-lane" role="group" aria-label={person.name} key={person.id}>
              {personal.map(event => <EventButton key={event.id} event={event} hideMember onClick={() => onEdit(event)} />)}
              {homeOnline && !personal.length && (unavailableMessage ? <p className="empty-note">{unavailableMessage}</p> :
                <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground" role="img" aria-label={t(date === today ? "No plans today." : "No plans tomorrow.")}>
                  <Armchair className="size-5" strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-sm">{t("Free")}</span>
                </div>)}
              {homeOnline && !!personal.length && missing && <p className="empty-note">{t("Some calendars could not be loaded.")}</p>}
            </div>;
          })}</div>
        </section>;
      })}
    </div>)}</div>}
  </section>;
}
