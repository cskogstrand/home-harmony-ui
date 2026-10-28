import { calendarRange, moveCalendarDate, uniqueCalendarPlans, type CalendarView } from "@/lib/family-calendar";
import { useCalendarPlans } from "@/hooks/use-calendar-plans";
import { useI18n } from "@/hooks/use-i18n";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useApp } from "@/contexts/AppContext";
import { useFamily, isPlannerDate, weekStart, weekNumber, addDays, type FamilyEvent, type MemberId } from "@/contexts/FamilyContext";
import { PageHeading, MemberAvatar, EventButton, EventEditor } from "@/components/FamilyPlanner";
import { CalendarViewControls, FamilyWeekGrid, HomeAssistantCalendar } from "@/components/FamilyCalendar";
import { CalendarDay, CalendarMonth } from "@/components/CalendarViews";
import "./calendar.css";

const views = { month: "Month", week: "Week", day: "Day" } as const;
const previousLabels = { month: "Previous month", week: "Previous week", day: "Previous day" } as const;
const nextLabels = { month: "Next month", week: "Next week", day: "Next day" } as const;

export default function Calendar() {
  const { t, dateLabel } = useI18n();
  const { homeOnline, currentHome } = useApp();
  const { today, calendar, calendarMembers } = useFamily();
  const [params, setParams] = useSearchParams();
  const selected = params.get("date"), selectedWeek = params.get("week"), selectedView = params.get("view");
  const validDate = isPlannerDate(selected) ? selected : null;
  const view: CalendarView = selectedView === "month" || selectedView === "day" || selectedView === "week" ? selectedView : validDate ? "day" : "week";
  const date = validDate ?? (isPlannerDate(selectedWeek) ? selectedWeek : today);
  const { start, end } = calendarRange(date, view, isPlannerDate(selectedWeek) ? "today" : calendar.startDay);
  const data = useCalendarPlans(start, end);
  const { events, people: familyMembers } = data;
  const [selectedMember, setMember] = useState<MemberId | "all">("all");
  const member = familyMembers.some(m => m.id === selectedMember) ? selectedMember : "all";
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyEvent>();
  const [newPlan, setNewPlan] = useState<{ date: string; member: MemberId }>();
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpDate, setJumpDate] = useState(date);
  const openEvent = (event?: FamilyEvent) => { setEditing(event); setNewPlan(undefined); setEditorOpen(true); };
  const addPlan = (date: string, person: MemberId) => { setEditing(undefined); setNewPlan({ date, member: person }); setEditorOpen(true); };
  const navigate = (date: string, nextView = view) => setParams(previous => {
    const next = new URLSearchParams(previous);
    next.delete("week"); next.set("date", date); next.set("view", nextView);
    return next;
  });
  const openDay = (day: string) => navigate(day, "day");
  const visible = events.filter(e => e.date >= start && e.date < end && (member === "all" || e.member === member));
  const people = familyMembers.filter(m => member === "all" || member === m.id);
  const calendars = Object.entries(calendarMembers).filter(([, id]) => people.some(person => person.id === id));
  const missing = calendars.some(([id]) => !currentHome.entities.some(entity => entity.preferenceId === id));
  const unavailable = !homeOnline ? t("Calendars unavailable while offline.") : !calendars.length ? t("No calendars selected")
    : data.loading ? t("Loading plans…") : data.errors.length || missing ? t("Some calendars could not be loaded.") : undefined;
  const period = view === "month" ? dateLabel(date, { month: "long", year: "numeric" }) : view === "day" ? dateLabel(date, { day: "numeric", month: "long", year: "numeric" })
    : `${dateLabel(start, { day: "numeric", month: "short" })} — ${dateLabel(addDays(end, -1), { day: "numeric", month: "short", year: "numeric" })}`;

  return <div className="planner-page calendar-page">
    <PageHeading title={t("Calendar")}><Button className="mobile-icon-button" onClick={() => openEvent()}><Plus size={18} aria-hidden="true" /><span className="max-[700px]:sr-only">{t("Add a plan")}</span></Button></PageHeading>
    <section className="glow-panel calendar-toolbar" aria-label={t("Calendar navigation")}>
      <div className="calendar-navigation">
        <div className="calendar-date-navigation">
          <Button variant="ghost" size="icon" aria-label={t(previousLabels[view])} onClick={() => navigate(moveCalendarDate(date, view, -1))}><ChevronLeft /></Button>
          <Popover open={jumpOpen} onOpenChange={open => { setJumpDate(date); setJumpOpen(open); }}>
            <h2 className="calendar-period-heading" aria-label={period}><PopoverTrigger asChild><Button variant="ghost" className="calendar-period" aria-label={`${t("Jump to date")}: ${period}`}><span aria-live="polite">{period}</span><ChevronDown size={16} aria-hidden="true" /></Button></PopoverTrigger></h2>
            <PopoverContent aria-label={t("Jump to date")}>
              <form className="planner-form" onSubmit={event => { event.preventDefault(); if (isPlannerDate(jumpDate)) { navigate(jumpDate); setJumpOpen(false); } }}>
                <label>{t("Jump to date")}<input type="date" required value={jumpDate} onChange={event => setJumpDate(event.target.value)} /></label>
                <Button type="submit" disabled={!isPlannerDate(jumpDate)}>{t("Go to date")}</Button>
              </form>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" aria-label={t(nextLabels[view])} onClick={() => navigate(moveCalendarDate(date, view, 1))}><ChevronRight /></Button>
        </div>
        <Button variant="outline" className="calendar-today" onClick={() => navigate(today)}>{t("Today")}</Button>
        <div className="calendar-segment calendar-view-switch" role="group" aria-label={t("Calendar view")}>
          {(Object.keys(views) as CalendarView[]).map(mode => <button key={mode} aria-pressed={view === mode} onClick={() => navigate(date, mode)}>{t(views[mode])}</button>)}
        </div>
      </div>
      <div className="calendar-filter-bar">
        <div className="filter-row" role="group" aria-label={t("Filter by person")}><button aria-pressed={member === "all"} onClick={() => setMember("all")}>{t("All people")}</button>{familyMembers.map(m => <button key={m.id} className="calendar-member-filter" aria-label={m.name} aria-pressed={member === m.id} onClick={() => setMember(m.id)}><MemberAvatar member={m.id} /><span>{m.name}</span></button>)}</div>
        {view === "week" && <CalendarViewControls onChange={change => {
          if (change.startDay) setParams({});
        }} />}
      </div>
      {view === "week" && calendar.view === "people" && <div className="week-ribbon">{Array.from({ length: 7 }, (_, i) => addDays(start, i)).map(day => <button key={day} className={day === today ? "today-outline" : ""} onClick={() => openDay(day)} aria-label={dateLabel(day, { weekday: "long", day: "numeric", month: "long" })}><small className="calendar-week-number">{(day === start || day === weekStart(day)) && t("Week {value1}", { value1: weekNumber(day) })}</small><span>{dateLabel(day, { weekday: "short" })}</span><strong>{day.slice(-2)}</strong><i className={visible.some(e => e.date === day) ? "has-events" : ""} /></button>)}</div>}
      <HomeAssistantCalendar data={data} />
      {homeOnline && !data.loading && !data.errors.length && unavailable && <p className="page-note" role="status">{unavailable}</p>}
    </section>
    {view === "month" ? <CalendarMonth date={date} start={start} end={end} events={visible} unavailable={unavailable} onDay={openDay} onEdit={openEvent} /> :
      view === "day" ? <CalendarDay date={date} events={visible} unavailable={unavailable} onEdit={openEvent} /> :
      calendar.view === "week" ? <section className="glow-panel weekly-panel"><FamilyWeekGrid start={start} events={visible} members={people} onEdit={openEvent} onAdd={addPlan} onDay={openDay} /></section> :
        <div className="calendar-lanes">{people.map(person => {
          const personal = uniqueCalendarPlans(visible.filter(e => e.member === person.id));
          return <section className="glow-panel calendar-lane" style={{ "--member": person.color } as React.CSSProperties} key={person.id}><header><MemberAvatar member={person.id} /><div><h2>{person.name}</h2><p>{t(personal.length === 1 ? "{count} plan in these 7 days" : "{count} plans in these 7 days", { count: personal.length })}</p></div></header>
            {personal.map(event => <EventButton key={event.id} event={event} showDate onClick={() => openEvent(event)} />)}
            {!personal.length && <div className="empty-note"><CalendarDays size={25} aria-hidden="true" /><p>{unavailable || t("No plans yet.")}</p></div>}
          </section>;
        })}</div>}
    <EventEditor open={editorOpen} onOpenChange={setEditorOpen} onSaved={data.refresh} event={editing} date={newPlan?.date ?? date} member={newPlan?.member ?? (member === "all" ? undefined : member)} />
  </div>;
}
