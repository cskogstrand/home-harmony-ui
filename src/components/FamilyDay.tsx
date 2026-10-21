import { useApp } from "@/contexts/AppContext";
import { useFamily, type FamilyEvent } from "@/contexts/FamilyContext";
import type { useCalendarPlans } from "@/hooks/use-calendar-plans";
import { useI18n } from "@/hooks/use-i18n";
import { uniqueCalendarPlans } from "@/lib/family-calendar";
import { HomeAssistantCalendar } from "./FamilyCalendar";
import { EventButton, MemberAvatar, PanelHeading } from "./FamilyPlanner";

export function FamilyDay({ data, onEdit }: { data: ReturnType<typeof useCalendarPlans>; onEdit: (event: FamilyEvent) => void }) {
  const { t } = useI18n();
  const { homeOnline, currentHome } = useApp();
  const { today, calendarMembers } = useFamily();
  const events = data.events.filter(event => event.date === today);
  return <section className="glow-panel col-span-full" aria-label={t("Everyone’s day")}>
    <PanelHeading title={t("Everyone’s day")} to={`/calendar?date=${today}`} label="Open calendar" />
    <HomeAssistantCalendar data={data} />
    <div className="family-lanes mt-4">{data.people.map(person => {
      const personal = uniqueCalendarPlans(events.filter(event => event.member === person.id));
      const calendars = Object.keys(calendarMembers).filter(id => calendarMembers[id] === person.id);
      const missing = calendars.some(id => !currentHome.entities.some(entity => entity.preferenceId === id));
      const emptyMessage = !homeOnline ? t("Calendars unavailable while offline.")
        : !calendars.length ? t("No calendars selected")
        : data.loading ? t("Loading plans…")
        : data.errors.length || missing ? t("Some calendars could not be loaded.")
        : t("No plans today.");
      return <div className="family-lane" role="group" aria-label={person.name} key={person.id}>
        <div className="lane-heading"><MemberAvatar member={person.id} /><h3 className="font-medium">{person.name}</h3></div>
        {personal.map(event => <EventButton key={event.id} event={event} onClick={() => onEdit(event)} />)}
        {!personal.length && <p className="empty-note">{emptyMessage}</p>}
        {!!personal.length && missing && <p className="empty-note">{t("Some calendars could not be loaded.")}</p>}
      </div>;
    })}</div>
  </section>;
}
