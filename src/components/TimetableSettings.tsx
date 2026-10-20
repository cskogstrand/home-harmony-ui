import { useFamily } from "@/contexts/FamilyContext";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import type { TimetableSettings as Settings } from "../../shared/configuration";

export function TimetableSettings({ child }: { child: string }) {
  const { timetableSettings, setTimetableSettings, memberName } = useFamily();
  const { currentHome, homeOnline } = useApp();
  const { t, calendarName } = useI18n();
  const settings = timetableSettings[child] ?? { type: "images", education: "school", calendars: {} };
  const calendars = currentHome.entities.filter(entity => entity.domain === "calendar");
  const missing = Object.keys(settings.calendars).filter(id => !calendars.some(entity => entity.preferenceId === id));
  const setRole = (id: string, role: string) => {
    const selected = { ...settings.calendars };
    if (role) selected[id] = role as Settings["calendars"][string]; else delete selected[id];
    setTimetableSettings(child, { calendars: selected });
  };
  return <div className="planner-form timetable-settings">
    <label>{t("School or kindergarten")}<select aria-label={t("School or kindergarten for {name}", { name: memberName(child) })} value={settings.education} onChange={event => setTimetableSettings(child, { education: event.target.value as Settings["education"] })}>
      <option value="school">{t("School")}</option><option value="kindergarten">{t("Kindergarten")}</option>
    </select></label>
    <label>{t("Timetable type")}<select aria-label={t("Timetable type for {name}", { name: memberName(child) })} value={settings.type} onChange={event => setTimetableSettings(child, { type: event.target.value as Settings["type"] })}>
      <option value="images">{t("PDF / images")}</option><option value="calendar">{t("Calendar week")}</option>
    </select></label>
    <p className="muted">{t("Changing type keeps your saved timetable pages and calendar choices.")}</p>
    {settings.type === "calendar" && <fieldset><legend>{t("Calendar sources")}</legend>
      <p className="muted">{t("Choose how each calendar appears. Changes are shared across your screens.")}</p>
      {!homeOnline && <p role="status">{t("Connect to Home Assistant to choose calendars.")}</p>}
      {homeOnline && !calendars.length && <p role="status">{t("No calendars available.")}</p>}
      {calendars.map(calendar => <label className="timetable-source" key={calendar.preferenceId}><span>{calendarName(calendar.name)}</span><select aria-label={t("Display {calendar} for {name}", { calendar: calendarName(calendar.name), name: memberName(child) })} value={settings.calendars[calendar.preferenceId] ?? ""} disabled={!homeOnline} onChange={event => setRole(calendar.preferenceId, event.target.value)}>
        <option value="">{t("Not used")}</option><option value="events">{t("Daily events")}</option><option value="message">{t("Message below the week")}</option><option value="closures">{t("Closure days")}</option><option value="hours">{t("Opening hours")}</option>
      </select></label>)}
      {missing.map(id => <label className="timetable-source" key={id}><span className="break-all">{t("Unavailable calendar: {calendar}", { calendar: id })}</span><select aria-label={t("Unavailable calendar: {calendar}", { calendar: id })} value={settings.calendars[id]} onChange={event => setRole(id, event.target.value)}><option value={settings.calendars[id]}>{t("Keep selection")}</option><option value="">{t("Remove selection")}</option></select></label>)}
      <p className="muted">{t("Use Daily events for Activities and Meetings, and Message below the week for Pedagogy. Messages use today’s entry, or the next available day within a year. The week moves to next Monday on weekends.")}</p>
      <p className="muted">{t("Invitations may repeat Activities or Meetings; matching events appear once. Select Closure days alongside Opening hours to hide hours on closed days.")}</p>
    </fieldset>}
  </div>;
}
