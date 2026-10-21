import { useFamily } from "@/contexts/FamilyContext";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { useTimetableCalendars } from "@/hooks/use-timetable-calendars";
import { timetableDays, timetableMessages, timetableWeek, type TimetableEvent } from "@/lib/calendar-timetable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronRight } from "lucide-react";
import type { TimetableSettings } from "../../shared/configuration";

export function CalendarTimetable({ child, settings }: { child: string; settings: TimetableSettings }) {
  const { today, memberName } = useFamily();
  const { currentHome, homeOnline } = useApp();
  const { t, dateLabel, eventTimeLabel, calendarName, calendarTitle } = useI18n();
  const start = timetableWeek(today);
  const { sources, loading, errors, refresh } = useTimetableCalendars(settings, start, today);
  const days = timetableDays(sources, start, currentHome.timeZone, child);
  const messages = timetableMessages(sources, today, currentHome.timeZone, child);
  if (!Object.keys(settings.calendars).length) return <p className="empty-note">{t("Choose calendars for this person in Settings → Timetables.")}</p>;
  if (!homeOnline) return <p role="status" className="empty-note">{t("Connect to Home Assistant to see this timetable.")}</p>;
  const loadError = !!errors.length && <div role="status" className="timetable-load-error"><p>{t("Some calendars could not be read: {calendars}. Check the connection and calendar integration. Opening hours stay hidden until closure calendars are available.", { calendars: errors.map(calendarName).join(", ") })}</p><Button variant="outline" onClick={refresh}>{t("Retry")}</Button></div>;
  const renderEvents = (events: TimetableEvent[], detailed = false) => <>
    {events.map(event => <div key={event.id} className="timetable-event">
      {event.role === "closures" && <span className="timetable-closure">{t("Closed")}</span>}
      {event.role === "hours" && <span className="muted">{t("Opening hours")}</span>}
      <strong>{calendarTitle(event.title)}</strong><span>{eventTimeLabel(event)}</span>
      {event.location && <span>{event.location}</span>}
      {detailed && <span className="muted">{t("Calendar: {value1}", { value1: calendarName(event.source) })}</span>}
      {event.note && (detailed ? <p>{event.note}</p> : <details><summary>{t("Details")}</summary><p>{event.note}</p></details>)}
    </div>)}
    {!events.length && <p className="muted">{loading ? t("Loading…") : errors.length ? t("Calendar unavailable") : t("No events")}</p>}
  </>;
  return <div className="calendar-timetable" aria-busy={loading}>
    <p className="timetable-week-label">{t("Week of {date}", { date: dateLabel(start, { day: "numeric", month: "long" }) })}</p>
    {loading && <p role="status">{t("Loading timetable…")}</p>}
    {loadError}
    <div className="timetable-week glass-surface">{days.map(day => <Dialog key={day.date}>
      <section className="timetable-day" aria-label={dateLabel(day.date)} aria-current={day.date === today ? "date" : undefined}>
        <h3><DialogTrigger asChild><button type="button" className="timetable-day-trigger" aria-label={t("View activities for {date}", { date: dateLabel(day.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) })}>
          <span>{dateLabel(day.date, { weekday: "long" })}<ChevronRight size={16} aria-hidden="true" /></span><time dateTime={day.date}>{dateLabel(day.date, { day: "numeric", month: "short" })}</time>
        </button></DialogTrigger></h3>
        <div className="timetable-day-events">{renderEvents(day.events)}</div>
      </section>
      <DialogContent>
        <DialogHeader><DialogTitle>{dateLabel(day.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</DialogTitle><DialogDescription>{t("Activities for {name}", { name: memberName(child) })}</DialogDescription></DialogHeader>
        <div className="timetable-dialog-scroll break-words" aria-busy={loading}>
          {loading && <p role="status">{t("Loading timetable…")}</p>}{loadError}
          {renderEvents(day.events, true)}
        </div>
      </DialogContent>
    </Dialog>)}</div>
    {messages.map(source => <section className="timetable-message" key={source.id}>
      <h3>{calendarName(source.name)}</h3>
      {source.date && <p className="muted">{source.date === today ? t("Today") : t("Next message · {date}", { date: dateLabel(source.date) })}</p>}
      {source.messages.map(event => <div key={event.id}><h4>{calendarTitle(event.title)}</h4>{event.note && event.note.trim() !== event.title.trim() && <p>{event.note}</p>}</div>)}
      {!source.messages.length && <p className="muted">{t("No message today or in the next year.")}</p>}
    </section>)}
  </div>;
}
