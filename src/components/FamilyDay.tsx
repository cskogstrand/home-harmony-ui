import { Armchair } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { addDays, useFamily, type FamilyEvent } from "@/contexts/FamilyContext";
import type { useCalendarPlans } from "@/hooks/use-calendar-plans";
import { useI18n } from "@/hooks/use-i18n";
import { uniqueCalendarPlans } from "@/lib/family-calendar";
import { CalendarRefreshButton, HomeAssistantCalendar } from "./FamilyCalendar";
import { EventButton, MemberAvatar } from "./FamilyPlanner";

export function FamilyDay({ data, onEdit }: { data: ReturnType<typeof useCalendarPlans>; onEdit: (event: FamilyEvent) => void }) {
  const { t, dateLabel } = useI18n();
  const { homeOnline, currentHome } = useApp();
  const { today, calendarMembers, dashboard } = useFamily();
  const days = dashboard.showTomorrow ? [today, addDays(today, 1)] : [today];
  return <section className="glow-panel col-span-full" aria-label={t("Everyone’s day")}>
    <div className="panel-heading"><h2>{t("Everyone’s day")}</h2><CalendarRefreshButton data={data} /></div>
    <HomeAssistantCalendar data={data} />
    <div className="family-day-board relative mt-4">
    <div className="family-lanes family-day-column-lines" aria-hidden="true">{data.people.map(person => <span key={person.id} />)}</div>
    <div className="family-lanes family-day-people">{data.people.map(person => <div className="family-lane" key={person.id}>
      <div className="lane-heading"><MemberAvatar member={person.id} /><strong>{person.name}</strong></div>
    </div>)}</div>
    <div className="mt-4 space-y-6">{days.map(date => {
      const label = t(date === today ? "Today" : "Tomorrow");
      return <section key={date} aria-label={label} className={date === today ? undefined : "border-t border-border pt-6"}>
        <h3 className={dashboard.showTomorrow ? "mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-medium" : "sr-only"}>
          <span>{label}</span><time dateTime={date} className="text-sm font-normal text-muted-foreground">{dateLabel(date, { day: "numeric", month: "short" })}</time>
        </h3>
        <div className="family-lanes">{data.people.map(person => {
          const personal = uniqueCalendarPlans(data.events.filter(event => event.member === person.id && event.date === date));
          const calendars = Object.keys(calendarMembers).filter(id => calendarMembers[id] === person.id);
          const missing = calendars.some(id => !currentHome.entities.some(entity => entity.preferenceId === id));
          const unavailableMessage = !homeOnline ? t("Calendars unavailable while offline.")
            : !calendars.length ? t("No calendars selected")
            : data.loading ? t("Loading plans…")
            : data.errors.length || missing ? t("Some calendars could not be loaded.")
            : null;
          return <div className="family-lane" role="group" aria-label={person.name} key={person.id}>
            {personal.map(event => <EventButton key={event.id} event={event} showMember onClick={() => onEdit(event)} />)}
            {!personal.length && (unavailableMessage ? <p className="empty-note">{unavailableMessage}</p> :
              <div className="flex flex-1 items-center justify-center py-5 text-muted-foreground" role="img" aria-label={t(date === today ? "No plans today." : "No plans tomorrow.")}>
                <Armchair className="size-10" strokeWidth={1.5} aria-hidden="true" />
              </div>)}
            {!!personal.length && missing && <p className="empty-note">{person.name}: {t("Some calendars could not be loaded.")}</p>}
          </div>;
        })}</div>
      </section>;
    })}</div>
    </div>
  </section>;
}
