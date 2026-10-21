import { useFamily } from "@/contexts/FamilyContext";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import type { TimetableSettings as Settings } from "../../shared/configuration";

const categories = [
  ["events", "Daily events"], ["message", "Message below the week"],
  ["closures", "Closure days"], ["hours", "Opening hours"],
] as const;
const popupCategories = [
  ["popupActivities", "Activities"], ["popupMeetings", "Meetings"],
  ["popupHours", "Opening hours"], ["popupClosures", "Closure days"], ["popupMessages", "Messages (Pedagogy)"],
] as const;

export function TimetableSettings({ child }: { child: string }) {
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
    const selected = { ...settings.calendars };
    const roles = (selected[id] ?? []).filter(value => value !== role);
    if (checked) roles.push(role);
    if (roles.length) selected[id] = roles; else delete selected[id];
    setTimetableSettings(child, { calendars: selected });
  };
  const categoryPicker = ([role, label]: (typeof categories | typeof popupCategories)[number], popup = false) => {
    const selected = sources.filter(source => settings.calendars[source.id]?.includes(role));
    const choices = sources.filter(source => !source.missing || settings.calendars[source.id]?.includes(role));
    return <fieldset className="timetable-category" key={role}><legend>{t(label)}</legend>
      <Popover><PopoverTrigger asChild><Button variant="outline" className="timetable-calendar-picker" aria-label={t("{category} calendars for {name}", { category: popup ? `${t("Day popup")} · ${t(label)}` : t(label), name: memberName(child) })}>
        <span>{selected.length ? selected.map(source => source.name).join(", ") : t("Choose calendars")}</span><ChevronDown size={16} aria-hidden="true" />
      </Button></PopoverTrigger><PopoverContent className="timetable-calendar-options" aria-label={t(label)}>
        {choices.map(source => <label className="timetable-calendar-option" key={source.id}>
          <Checkbox checked={settings.calendars[source.id]?.includes(role) ?? false} disabled={!source.missing && !homeOnline} onCheckedChange={checked => setRole(source.id, role, checked === true)} />
          <span>{source.name}</span>
        </label>)}
        {!choices.length && <p className="muted">{t("No calendars available.")}</p>}
      </PopoverContent></Popover>
    </fieldset>;
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
      <p className="muted">{t("Choose one or more calendars for each category. A calendar can appear in several categories. Changes are shared across your screens.")}</p>
      {!homeOnline && <p role="status">{t("Connect to Home Assistant to choose calendars.")}</p>}
      {homeOnline && !calendars.length && <p role="status">{t("No calendars available.")}</p>}
      {categories.map(category => categoryPicker(category))}
      <fieldset className="timetable-popup-settings"><legend>{t("Day popup")}</legend>
        <p className="muted">{t("Choose calendars for each popup section. These choices are separate from the week. Use Closure days to hide popup opening hours on closed days.")}</p>
        {popupCategories.map(category => categoryPicker(category, true))}
      </fieldset>
      <p className="muted">{t("Use Daily events for Activities and Meetings, and Message below the week for Pedagogy. Messages use today’s entry, or the next available day within a year. The week moves to next Monday on weekends.")}</p>
      <p className="muted">{t("Invitations may repeat Activities or Meetings; matching events appear once. Select Closure days alongside Opening hours to hide hours on closed days.")}</p>
    </fieldset>}
  </div>;
}
