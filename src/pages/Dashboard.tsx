import { PanelTitle } from "@/components/PanelTitle";
import { uniqueCalendarPlans } from "@/lib/family-calendar";
import { useCalendarPlans } from "@/hooks/use-calendar-plans";
import { useI18n } from "@/hooks/use-i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus, CalendarDays, CalendarClock, BookOpen } from "lucide-react";
import { useFamily, addDays, weekNumber, weekStart, type FamilyEvent, type MemberId } from "@/contexts/FamilyContext";
import { EventEditor, EventButton, MemberAvatar, SchoolPreview } from "@/components/FamilyPlanner";
import { ListPanel } from "@/components/FamilyLists";
import { CalendarRefreshButton, CalendarViewControls, FamilyWeekGrid, HomeAssistantCalendar } from "@/components/FamilyCalendar";
import { HomeFavorites, MorningSummary } from "@/components/HomePanels";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { DashboardSettings } from "@/components/DashboardSettings";
import { FamilyDay } from "@/components/FamilyDay";
import { WeatherWidget } from "@/components/WeatherWidget";
import { WasteCollection } from "@/components/WasteCollection";

export default function Dashboard() {
  const { t, dateLabel, eventTimeLabel } = useI18n();
  const { homeOnline } = useApp();
  const { today, time, members, memberName, connectedPlanner, hasTimetable, calendar, calendarStart: start, calendarMembers, todoLists, timetables, timetableEnabled, timetableSettings, homeEntities, selectedAlarm, dashboard } = useFamily();
  const shared = useSharedConfiguration();
  const needsSetup = shared?.state.loaded && !Object.keys(calendarMembers).length && !Object.keys(todoLists).length
    && !Object.values(timetables).some(pages => pages.length) && !Object.values(timetableEnabled).some(Boolean) && !Object.values(timetableSettings).some(settings => settings.type === "calendar") && homeEntities === undefined && !selectedAlarm;
  const weekEnd = addDays(start, 7);
  const planDays = dashboard.nextPlanDays === "auto" ? dashboard.showTomorrow ? 1 : 0 : dashboard.nextPlanDays;
  const planEnd = addDays(today, planDays + 1);
  const upcomingEnd = addDays(today, dashboard.nextPlan ? Math.max(7, planDays + 1) : dashboard.day && dashboard.showTomorrow ? 2 : 0);
  const data = useCalendarPlans(start, upcomingEnd > weekEnd ? upcomingEnd : weekEnd);
  const { events, people: familyMembers } = data;
  const schoolMembers = members.filter(m => hasTimetable(m.id));
  const [editing, setEditing] = useState<FamilyEvent>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [newPlan, setNewPlan] = useState<{ date: string; member: MemberId }>();
  const openEvent = (event?: FamilyEvent) => { setEditing(event); setNewPlan(undefined); setEditorOpen(true); };
  const addPlan = (date: string, member: MemberId) => { setEditing(undefined); setNewPlan({ date, member }); setEditorOpen(true); };
  const upcoming = events.filter(e => `${e.date}${e.time}` >= `${today}${time}` || e.date === today && (e.allDay || e.continues));
  const next = upcoming.find(e => !e.allDay);
  const quietDays = !data.loading && !data.errors.length && (!connectedPlanner || homeOnline)
    && !events.some(e => !e.allDay && e.date >= today && e.date < planEnd
      && (e.date > today || e.continues || (e.endTime ?? e.time) >= time));
  const weekEvents = events.filter(e => e.date >= start && e.date < weekEnd);
  const quietSummary = t(planDays === 0 ? "No more plans today." : planDays === 1 ? "No plans today or tomorrow." : "No plans in the next {days} days.", { days: planDays });
  return <div className="portrait-board">
    <header className="ambient-heading">
      <div className="greeting"><h1>{t("Good to be home.")}</h1><p>{dateLabel(today, { weekday: "long", day: "numeric", month: "long" })}</p><div className="greeting-bottom"><div className="avatar-group">{members.map(m => <MemberAvatar member={m.id} key={m.id} small />)}</div>{needsSetup && <Button asChild><Link to="/onboarding">{t("Get started")}<ArrowUpRight size={17} /></Link></Button>}<DashboardSettings /></div></div>
      <div className="ambient-glance"><time className="ambient-clock">{time}</time><WeatherWidget placement="today" /></div>
    </header>
    {!Object.entries(dashboard).some(([key, visible]) => key !== "showTomorrow" && visible === true) && <p className="col-span-full text-muted-foreground">{t("All sections are hidden. Use the settings cog to show them again.")}</p>}
    {dashboard.morningSummary && <MorningSummary />}
    {dashboard.wasteCollection && <WasteCollection />}
    {dashboard.nextPlan && <section className="glow-panel next-chapter" aria-label={t("Next family plan")}>
      <div className="panel-heading"><PanelTitle icon={CalendarClock}>{t("Next family plan")}</PanelTitle><Button className="add-plan mobile-icon-button" onClick={() => openEvent()} aria-label={t("Add a family plan")} disabled={connectedPlanner && !homeOnline}><Plus size={20} aria-hidden="true" /><span className="max-[700px]:sr-only">{t("Add a plan")}</span></Button></div>
      <div className="next-plan-content">
      {next && quietDays && <p className="next-plan-summary">{quietSummary} {t("Next up is {day}.", { day: dateLabel(next.date, next.date < addDays(today, 7) ? { weekday: "long" } : { weekday: "long", day: "numeric", month: "long" }) })}</p>}
      {next ? <><button className="next-event" onClick={() => openEvent(next)}><h3>{next.title}</h3><p className="next-label">{t("Up next · {name}", { name: memberName(next.member) })}</p><p>{[next.location, next.note].filter(Boolean).join(" · ")}</p><ArrowUpRight className="next-arrow" size={24} aria-hidden="true" /></button><div className="next-event-time"><time className={next.endTime ? "event-time-range" : undefined}>{eventTimeLabel(next)}</time><span>{next.date === today ? t("Today") : dateLabel(next.date)}</span></div></> :
        <p className="muted">{connectedPlanner && !homeOnline ? t("Calendars unavailable while offline.") : data.loading ? t("Loading your calendar…") : data.errors.length ? t("Some calendars could not be loaded.") : quietDays ? quietSummary : t("No upcoming plans to display.")}</p>}
      </div>
    </section>}
    {dashboard.day && <FamilyDay data={data} onEdit={openEvent} />}
    {dashboard.week && <section className="glow-panel family-week" aria-label={t("Everyone’s week")}>
      <div className="panel-heading calendar-panel-heading"><PanelTitle icon={CalendarDays}>{t("Everyone’s week")}</PanelTitle><div className="calendar-heading-actions"><CalendarViewControls /><CalendarRefreshButton data={data} /></div></div>
      <HomeAssistantCalendar data={data} />
      {calendar.view === "week" ? <FamilyWeekGrid start={start} events={events} members={familyMembers} compact onEdit={openEvent} onAdd={addPlan} /> : <>
      <div className="week-ribbon">{Array.from({ length: 7 }, (_, i) => addDays(start, i)).map(day => <Link key={day} to={`/calendar?date=${day}&week=${start}`} className={day === today ? "is-today" : ""} aria-label={t("View {value1}, week {value2}", { value1: dateLabel(day), value2: weekNumber(day) })} aria-current={day === today ? "date" : undefined}><small className="calendar-week-number">{(day === start || day === weekStart(day)) && t("Week {value1}", { value1: weekNumber(day) })}</small><span>{dateLabel(day, { weekday: "short" })}</span><strong>{day.slice(-2)}</strong><i className={weekEvents.some(e => e.date === day) ? "has-events" : ""} /></Link>)}</div>
      <div className="family-lanes">{familyMembers.map(member => {
        const personal = weekEvents.filter(e => e.member === member.id);
        const future = personal.filter(e => `${e.date}${e.time}` >= `${today}${time}` || e.date === today && (e.allDay || e.continues));
        const remaining = future.length ? future : personal;
        const shown = uniqueCalendarPlans(remaining).slice(0, 2);
        return <div className="family-lane" style={{ "--member": member.color } as React.CSSProperties} key={member.id}><div className="lane-heading"><MemberAvatar member={member.id} /><strong>{member.name}</strong><span>{t(uniqueCalendarPlans(personal).length === 1 ? "{count} plan" : "{count} plans", { count: uniqueCalendarPlans(personal).length })}</span></div>
          {shown.map(event => <EventButton key={event.id} event={event} showDate onClick={() => openEvent(event)} />)}
          {shown.length === 0 && <p className="empty-note">{connectedPlanner ? t("No plans yet.") : t("A lovely open week.")}</p>}
        </div>;
      })}</div></>}
    </section>}
    {dashboard.daily && <ListPanel kind="daily" limit={3} />}
    {dashboard.shopping && <ListPanel kind="shopping" limit={3} />}
    {dashboard.school && !!schoolMembers.length && <section className="glow-panel school-strip"><div><PanelTitle icon={BookOpen}>{t("School")}</PanelTitle><Link to="/school" className="text-link">{t("School board")}<ArrowUpRight size={17} /></Link></div>{schoolMembers.map(m => <SchoolPreview key={m.id} child={m.id} />)}</section>}
    {dashboard.home && <HomeFavorites />}
    <EventEditor open={editorOpen} onOpenChange={setEditorOpen} onSaved={data.refresh} event={editing} date={newPlan?.date} member={newPlan?.member} />
  </div>;
}
