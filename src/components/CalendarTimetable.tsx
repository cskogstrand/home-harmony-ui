import { useFamily } from "@/contexts/FamilyContext";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { useTimetableCalendars } from "@/hooks/use-timetable-calendars";
import { timetableDays, timetableEventIsCurrent, timetableMessages, timetableWeek, type TimetableEvent } from "@/lib/calendar-timetable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronRight } from "lucide-react";
import type { TimetableSettings } from "../../shared/configuration";

export function CalendarTimetable({ child, settings }: { child: string; settings: TimetableSettings }) {
  const { today, now, time, memberName } = useFamily();
  const { currentHome, homeOnline } = useApp();
  const { t, dateLabel, eventTimeLabel, calendarName, calendarTitle } = useI18n();
  const start = timetableWeek(today);
  const { sources, closuresUnknown, popupClosuresUnknown, loading, errors, refresh } = useTimetableCalendars(settings, start, today);
  const daySources = sources.map(source => ({ ...source, roles: source.roles.filter(role =>
    !(closuresUnknown && role === "hours") && !(popupClosuresUnknown && role === "popupHours")) }));
  const days = timetableDays(daySources, start, currentHome.timeZone, child);
  const messages = timetableMessages(sources, today, currentHome.timeZone, child);
  const popupGroups = [
    ["activities", "Activities", ["popupActivities"]], ["meetings", "Meetings", ["popupMeetings"]],
    ["messages", "Messages (Pedagogy)", ["popupMessages"]],
  ] as const;
  const selectedPopupGroups = popupGroups.filter(([, , roles]) => Object.values(settings.calendars).some(selected => roles.some(role => selected.includes(role))));
  const hasPopupHours = Object.values(settings.calendars).some(roles => roles.includes("popupHours") || roles.includes("popupClosures"));
  const emptyEventsLabel = loading ? t("Loading…") : errors.length ? t("Calendar unavailable") : t("No events");
  if (!Object.keys(settings.calendars).length) return <p className="empty-note">{t("Choose calendars for this person in Settings → Timetables.")}</p>;
  if (!homeOnline) return <p role="status" className="empty-note">{t("Connect to Home Assistant to see this timetable.")}</p>;
  const loadError = !!errors.length && <div role="status" className="timetable-load-error"><p>{t("Some calendars could not be read: {calendars}. Check the connection and calendar integration. Opening hours stay hidden until closure calendars are available.", { calendars: errors.map(calendarName).join(", ") })}</p><Button variant="outline" onClick={refresh}>{t("Retry")}</Button></div>;
  const renderEvents = (events: TimetableEvent[], header = false) => <>
    {events.map(event => <div key={event.id} className="timetable-event">
      {event.role === "closures" && <span className="timetable-closure">{t("Closed for the day")}</span>}
      {event.role === "hours" && <span className="muted">{t("Opening hours")}</span>}
      {!(header && event.role === "hours") && <strong>{calendarTitle(event.title)}</strong>}<span>{eventTimeLabel(event)}</span>
      {event.location && <span>{event.location}</span>}
      {event.note && <details><summary>{t("Details")}</summary><p>{event.note}</p></details>}
    </div>)}
    {!events.length && <p className="muted">{emptyEventsLabel}</p>}
  </>;
  const renderPopupEvents = (events: TimetableEvent[], messages: boolean) => <>
    {events.map(event => {
      const current = timetableEventIsCurrent(event, now, today);
      return <div key={event.id} className="timetable-popup-event" aria-current={current ? "time" : undefined}>
        {!(messages && event.allDay) && <span className="timetable-popup-time">{eventTimeLabel(event)}</span>}
        <div className="timetable-popup-event-body">
          <div className="timetable-popup-event-title"><strong>{calendarTitle(event.title)}</strong>{current && <span className="timetable-popup-current">{t("Happening now")}</span>}</div>
          {event.location && <span className="timetable-popup-location">{event.location}</span>}
          {event.note && <p>{event.note}</p>}
        </div>
      </div>;
    })}
    {!events.length && <p className="muted">{emptyEventsLabel}</p>}
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
      <DialogContent className="timetable-day-dialog">
        <DialogHeader className="timetable-popup-header">
          <DialogTitle>{dateLabel(day.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</DialogTitle>
          <DialogDescription>{t("Activities for {name}", { name: memberName(child) })}</DialogDescription>
          {(day.date === today || hasPopupHours) && <div className="timetable-popup-status">
            {day.date === today && <span className="timetable-popup-clock">{t("Now")} <time dateTime={now.toISOString()}>{time}</time></span>}
            {hasPopupHours && <section className="timetable-popup-hours" aria-label={t("Opening hours / Closed")} aria-busy={loading}>
              {day.popup.hours.length ? renderEvents(day.popup.hours, true) : <p className="muted">{t("Opening hours / Closed")} · {emptyEventsLabel}</p>}
            </section>}
          </div>}
        </DialogHeader>
        <div className="timetable-dialog-scroll break-words" aria-busy={loading}>
          {loading && <p role="status">{t("Loading timetable…")}</p>}{loadError}
          {selectedPopupGroups.length ? <div className="timetable-popup-grid">{selectedPopupGroups.map(([key, label]) => <section className={`timetable-popup-section timetable-popup-${key}`} aria-label={t(label)} key={key}>
            <h3>{t(label)}</h3>{renderPopupEvents(day.popup[key], key === "messages")}
          </section>)}</div> : !hasPopupHours && <p className="muted">{t("Choose calendars for Day popup in Settings → Timetables.")}</p>}
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
