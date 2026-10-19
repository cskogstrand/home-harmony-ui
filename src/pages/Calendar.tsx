import { useI18n } from "@/hooks/use-i18n";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFamily, isPlannerDate, weekStart, weekNumber, addDays, type FamilyEvent, type MemberId } from "@/contexts/FamilyContext";
import { PageHeading, MemberAvatar, EventButton, EventEditor } from "@/components/FamilyPlanner";
import { CalendarViewControls, FamilyWeekGrid, HomeAssistantCalendar, uniqueCalendarPlans, useCalendarPlans } from "@/components/FamilyCalendar";

export default function Calendar() {
  const { t, dateLabel } = useI18n();
  const { today, connectedPlanner, calendar, calendarStart } = useFamily();
  const [params, setParams] = useSearchParams();
  const selected = params.get("date");
  const validDate = isPlannerDate(selected) ? selected : null;
  const selectedWeek = params.get("week");
  // A bookmarked day outside the current preview still opens in its own range.
  const dayOutsidePreview = validDate && (validDate < calendarStart || validDate >= addDays(calendarStart, 7));
  const start = isPlannerDate(selectedWeek) ? selectedWeek : dayOutsidePreview
    ? (calendar.startDay === "monday" ? weekStart(validDate) : validDate) : calendarStart;
  const rangeStart = calendar.view === "people" && validDate ? validDate : start;
  const data = useCalendarPlans(rangeStart, addDays(rangeStart, calendar.view === "people" && validDate ? 1 : 7));
  const { events, people: familyMembers } = data;
  const [selectedMember, setMember] = useState<MemberId | "all">("all");
  const member = familyMembers.some(m => m.id === selectedMember) ? selectedMember : "all";
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyEvent>();
  const [newPlan, setNewPlan] = useState<{ date: string; member: MemberId }>();
  const openEvent = (event?: FamilyEvent) => { setEditing(event); setNewPlan(undefined); setEditorOpen(true); };
  const addPlan = (date: string, person: MemberId) => { setEditing(undefined); setNewPlan({ date, member: person }); setEditorOpen(true); };
  const navigateWeek = (days: number) => setParams({ week: addDays(start, days) });
  const visible = events.filter(e => e.date >= start && e.date < addDays(start, 7) && (calendar.view === "week" || !validDate || e.date === validDate) && (member === "all" || e.member === member));
  const people = familyMembers.filter(m => member === "all" || member === m.id);

  return <div className="planner-page calendar-page">
    <PageHeading eyebrow={t("MAKE ROOM FOR WHAT MATTERS")} title={t("Our week.")}><Button onClick={() => openEvent()}><Plus size={18} />{t("Add a plan")}</Button></PageHeading>
    <section className="glow-panel calendar-toolbar">
      <div className="calendar-pagination">
        <Button variant="outline" size="icon" aria-label={t("Previous week")} onClick={() => navigateWeek(-7)}><ChevronLeft /></Button>
        <h2>{dateLabel(start, { day: "numeric", month: "short" })} — {dateLabel(addDays(start, 6), { day: "numeric", month: "short", year: "numeric" })}</h2>
        <Button variant="outline" size="icon" aria-label={t("Next week")} onClick={() => navigateWeek(7)}><ChevronRight /></Button>
        <Button variant="ghost" onClick={() => setParams({})}>{calendar.startDay === "today" ? t("Next 7 days") : t("This week")}</Button>
      </div>
      <CalendarViewControls onChange={change => {
        if (change.startDay) setParams({});
        else if (change.view === "week" && validDate) setParams(start === calendarStart ? {} : { week: start });
      }} />
      {calendar.view === "people" && <div className="week-ribbon">{Array.from({ length: 7 }, (_, i) => addDays(start, i)).map(day => <button key={day} className={day === validDate ? "is-today" : day === today ? "today-outline" : ""} onClick={() => setParams(day === validDate ? { week: start } : { week: start, date: day })} aria-pressed={day === validDate}><small className="calendar-week-number">{(day === start || day === weekStart(day)) && t("Week {value1}", { value1: weekNumber(day) })}</small><span>{dateLabel(day, { weekday: "short" })}</span><strong>{day.slice(-2)}</strong><i className={events.some(e => e.date === day) ? "has-events" : ""} /></button>)}</div>}
      <div className="filter-row"><button aria-pressed={member === "all"} onClick={() => setMember("all")}>{t("All people")}</button>{familyMembers.map(m => <button key={m.id} aria-label={m.name} aria-pressed={member === m.id} onClick={() => setMember(m.id)}><MemberAvatar member={m.id} small />{m.name}</button>)}{calendar.view === "people" && validDate && <button onClick={() => setParams({ week: start })}>{t("Show whole week")}</button>}</div>
      <HomeAssistantCalendar data={data} />
    </section>
    {calendar.view === "week" ? <section className="glow-panel weekly-panel"><FamilyWeekGrid start={start} events={visible} members={people} onEdit={openEvent} onAdd={addPlan} /></section> :
      <div className="calendar-lanes">{people.map(person => {
        const personal = uniqueCalendarPlans(visible.filter(e => e.member === person.id));
        return <section className="glow-panel calendar-lane" style={{ "--member": person.color } as React.CSSProperties} key={person.id}><header><MemberAvatar member={person.id} /><div><h2>{person.name}</h2><p>{validDate ? t(personal.length === 1 ? "{count} plan on {day}" : "{count} plans on {day}", { count: personal.length, day: dateLabel(validDate, { weekday: "long" }) }) : t(personal.length === 1 ? "{count} plan in these 7 days" : "{count} plans in these 7 days", { count: personal.length })}</p></div></header>
          {personal.map(event => <EventButton key={event.id} event={event} showDate onClick={() => openEvent(event)} />)}
          {!personal.length && <div className="empty-note"><CalendarDays size={25} /><p>{connectedPlanner ? data.loading ? t("Loading plans…") : data.errors.length ? t("Some calendars could not be loaded.") : t("No plans yet.") : t("Some room to breathe.")}</p></div>}
        </section>;
      })}</div>}
    <EventEditor open={editorOpen} onOpenChange={setEditorOpen} onSaved={data.refresh} event={editing} date={newPlan?.date ?? validDate ?? today} member={newPlan?.member} />
  </div>;
}
