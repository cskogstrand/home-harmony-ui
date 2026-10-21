import { useId } from "react";
import { useFamily } from "@/contexts/FamilyContext";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { CalendarTimetable } from "@/components/CalendarTimetable";
import type { TimetableSettings as Settings } from "../../shared/configuration";
import type { MessageKey } from "@/lib/i18n";

export function TimetableSettings({ child }: { child: string }) {
  const helpId = useId();
  const { timetableSettings, setTimetableSettings, memberName } = useFamily();
  const { currentHome, homeOnline } = useApp();
  const { t, calendarName } = useI18n();
  const settings = timetableSettings[child] ?? { type: "images", education: "school", calendars: {} };
  const calendars = currentHome.entities.filter(entity => entity.domain === "calendar");
  const missing = Object.keys(settings.calendars).filter(id => !calendars.some(entity => entity.preferenceId === id));
  const sources = [
    ...calendars.map(calendar => ({ id: calendar.preferenceId, name: calendarName(calendar.name), missing: false })),
    ...missing.map(id => ({ id, name: t("Unavailable calendar: {calendar}", { calendar: id }), missing: true })),
  ];
  const setRole = (id: string, role: Settings["calendars"][string][number], checked: boolean) => {
    const selected = Object.fromEntries(Object.entries(settings.calendars).map(([source, roles]) => [source, roles.filter(role => role.startsWith("popup"))]));
    const roles = (selected[id] ?? []).filter(value => value !== role);
    if (checked) roles.push(role);
    if (roles.length) selected[id] = roles; else delete selected[id];
    setTimetableSettings(child, { calendars: selected });
  };
  const categoryPicker = ([role, label]: readonly [Settings["calendars"][string][number], MessageKey], help: MessageKey) => {
    const selected = sources.filter(source => settings.calendars[source.id]?.includes(role));
    const choices = sources.filter(source => !source.missing || settings.calendars[source.id]?.includes(role));
    return <fieldset className="timetable-category" key={role}><legend>{t(label)}</legend>
      <Popover><PopoverTrigger asChild><Button variant="outline" className="timetable-calendar-picker" aria-describedby={`${helpId}-${role}`} aria-label={t("{category} calendars for {name}", { category: `${t("School day view")} · ${t(label)}`, name: memberName(child) })}>
        <span>{selected.length ? selected.map(source => source.name).join(", ") : t("Choose calendars")}</span><ChevronDown size={16} aria-hidden="true" />
      </Button></PopoverTrigger><PopoverContent className="timetable-calendar-options" aria-label={t(label)}>
        {choices.map(source => <label className="timetable-calendar-option" key={source.id}>
          <Checkbox checked={settings.calendars[source.id]?.includes(role) ?? false} disabled={!source.missing && !homeOnline} onCheckedChange={checked => setRole(source.id, role, checked === true)} />
          <span>{source.name}</span>
        </label>)}
        {!choices.length && <p className="muted">{t("No calendars available.")}</p>}
      </PopoverContent></Popover>
      <p id={`${helpId}-${role}`} className="muted timetable-source-help">{t(help)}</p>
    </fieldset>;
  };

  return <div className="planner-form timetable-settings">
    <label>{t("School or kindergarten")}<select aria-label={t("School or kindergarten for {name}", { name: memberName(child) })} value={settings.education} onChange={event => setTimetableSettings(child, { education: event.target.value as Settings["education"] })}>
      <option value="school">{t("School")}</option><option value="kindergarten">{t("Kindergarten")}</option>
    </select></label>
    <label>{t("Timetable type")}<select aria-label={t("Timetable type for {name}", { name: memberName(child) })} value={settings.type} onChange={event => setTimetableSettings(child, { type: event.target.value as Settings["type"] })}>
      <option value="images">{t("PDF / images")}</option><option value="calendar">{t("Calendars")}</option>
    </select></label>
    <p className="muted">{t("Changing type keeps your saved timetable pages and calendar choices.")}</p>
    {settings.type === "calendar" && <fieldset><legend>{t("Calendar sources")}</legend>
      <p className="muted">{t("Choose one or more calendars per category. A calendar can be used in several categories.")}</p>
      {!homeOnline && <p role="status">{t("Connect to Home Assistant to choose calendars.")}</p>}
      {homeOnline && !calendars.length && <p role="status">{t("No calendars available.")}</p>}
      <fieldset className="timetable-view-settings"><legend>{t("School day view")}</legend>
        <p className="muted">{t("Choose calendars where their events should appear. This live preview matches School and saves your choices automatically.")}</p>
        <div className="school-card glass-surface timetable-settings-preview">
          <CalendarTimetable child={child} dayView settings={{ ...settings, calendars: Object.fromEntries(Object.entries(settings.calendars)
            .map(([id, roles]) => [id, roles.filter(role => role.startsWith("popup"))] as const).filter(([, roles]) => roles.length)) }} sourceControls={{
            hours: <>
              {categoryPicker(["popupHours", "Opening hours"], "Hours appear in the heading and weekday tabs.")}
              {categoryPicker(["popupClosures", "Closure days"], "Closed days replace opening hours in the heading and tabs.")}
            </>,
            activities: categoryPicker(["popupActivities", "Activities"], "The selected day's activities appear here."),
            meetings: categoryPicker(["popupMeetings", "Meetings"], "Meetings appear here and add a count to the weekday tabs."),
            messages: categoryPicker(["popupMessages", "Messages (Pedagogy)"], "The selected day's messages appear below the schedule."),
          }} />
        </div>
      </fieldset>
      <p className="muted">{t("Invitations may repeat Activities or Meetings; matching events appear once. Select Closure days alongside Opening hours to hide hours on closed days.")}</p>
      <p className="muted">{t("Today uses the same calendars: activities and meetings in the week, messages underneath.")}</p>
    </fieldset>}
  </div>;
}
