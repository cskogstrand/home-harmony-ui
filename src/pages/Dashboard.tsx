import { useI18n } from "@/hooks/use-i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus, Sparkles } from "lucide-react";
import { useFamily, addDays, weekNumber, weekStart, type FamilyEvent, type MemberId } from "@/contexts/FamilyContext";
import { EventEditor, EventButton, MemberAvatar, SchoolPreview } from "@/components/FamilyPlanner";
import { ListPanel } from "@/components/FamilyLists";
import { CalendarViewControls, FamilyWeekGrid, HomeAssistantCalendar, uniqueCalendarPlans, useCalendarPlans } from "@/components/FamilyCalendar";
import { HomeFavorites, MorningSummary } from "@/components/HomePanels";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { t, dateLabel, eventTimeLabel } = useI18n();
  const { today, time, members, memberName, connectedPlanner, hasTimetable, calendar, calendarStart: start, calendarMembers, todoLists, timetables, timetableEnabled, homeEntities, selectedAlarm } = useFamily();
  const shared = useSharedConfiguration();
  const needsSetup = shared?.state.loaded && !Object.keys(calendarMembers).length && !Object.keys(todoLists).length
    && !Object.values(timetables).some(pages => pages.length) && !Object.values(timetableEnabled).some(Boolean) && homeEntities === undefined && !selectedAlarm;
  const data = useCalendarPlans(start, addDays(start, 7));
  const { events, people: familyMembers } = data;
  const schoolMembers = members.filter(m => hasTimetable(m.id));
  const [editing, setEditing] = useState<FamilyEvent>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [newPlan, setNewPlan] = useState<{ date: string; member: MemberId }>();
  const openEvent = (event?: FamilyEvent) => { setEditing(event); setNewPlan(undefined); setEditorOpen(true); };
  const addPlan = (date: string, member: MemberId) => { setEditing(undefined); setNewPlan({ date, member }); setEditorOpen(true); };
  const upcoming = events.filter(e => `${e.date}${e.time}` >= `${today}${time}` || e.date === today && (e.allDay || e.continues));
  const next = upcoming.find(e => !e.allDay);
  const weekEvents = events.filter(e => e.date >= start && e.date < addDays(start, 7));
  return <div className="portrait-board">
    <header className="ambient-heading"><div className="clock-block"><time className="ambient-clock">{time}</time><span>{dateLabel(today, { weekday: "long", day: "numeric", month: "long" })}</span></div>
      <div className="greeting"><span className="eyebrow">{t("YOUR FAMILY, A LITTLE MORE IN SYNC")}</span><h1>{t("Good to be home.")}</h1><div className="greeting-bottom"><div className="avatar-group">{members.map(m => <MemberAvatar member={m.id} key={m.id} small />)}</div>{needsSetup && <Button asChild><Link to="/onboarding">{t("Get started")}<ArrowUpRight size={17} /></Link></Button>}</div></div>
    </header>
    <MorningSummary />
    <section className="next-chapter" aria-label={t("Next family plan")}>
      {next ? <><button className="next-event" onClick={() => openEvent(next)}><span className="eyebrow"><span className="live-dot" />{t("UP NEXT · {value1}{value2}", { value1: memberName(next.member), value2: next.date !== today ? ` · ${dateLabel(next.date, { weekday: "short" })}` : "" })}</span><h2>{next.title}</h2><p>{next.location}{next.note && ` · ${next.note}`}</p><ArrowUpRight className="next-arrow" size={24} /></button><div className="next-event-time"><time className={next.endTime ? "event-time-range" : undefined}>{eventTimeLabel(next)}</time><span>{next.date === today ? t("Today") : dateLabel(next.date)}</span></div></> :
        <div className="next-event"><span className="eyebrow"><Sparkles size={15} />{t("YOUR FAMILY CALENDAR")}</span><h2>{data.loading ? t("Loading your calendar…") : t("No upcoming plans to display.")}</h2></div>}
      <button className="add-plan" onClick={() => openEvent()} aria-label={t("Add a family plan")}><Plus size={20} /></button>
    </section>
    <section className="glow-panel family-week">
      <div className="panel-heading calendar-panel-heading"><h2>{t("Everyone’s week")}</h2><CalendarViewControls /><Link to="/calendar" className="text-link">{t("Open calendar")}<ArrowUpRight size={17} /></Link></div>
      <HomeAssistantCalendar data={data} />
      {calendar.view === "week" ? <FamilyWeekGrid start={start} events={events} members={familyMembers} compact onEdit={openEvent} onAdd={addPlan} /> : <>
      <div className="week-ribbon">{Array.from({ length: 7 }, (_, i) => addDays(start, i)).map(day => <Link key={day} to={`/calendar?date=${day}&week=${start}`} className={day === today ? "is-today" : ""} aria-label={t("View {value1}, week {value2}", { value1: dateLabel(day), value2: weekNumber(day) })} aria-current={day === today ? "date" : undefined}><small className="calendar-week-number">{(day === start || day === weekStart(day)) && t("Week {value1}", { value1: weekNumber(day) })}</small><span>{dateLabel(day, { weekday: "short" })}</span><strong>{day.slice(-2)}</strong><i className={weekEvents.some(e => e.date === day) ? "has-events" : ""} /></Link>)}</div>
      <div className="family-lanes">{familyMembers.map(member => {
        const personal = weekEvents.filter(e => e.member === member.id);
        const future = personal.filter(e => `${e.date}${e.time}` >= `${today}${time}` || e.date === today && (e.allDay || e.continues));
        const remaining = future.length ? future : personal;
        const shown = uniqueCalendarPlans(remaining).slice(0, 2);
        return <div className="family-lane" style={{ "--member": member.color } as React.CSSProperties} key={member.id}><div className="lane-heading"><MemberAvatar member={member.id} small /><strong>{member.name}</strong><span>{t(uniqueCalendarPlans(personal).length === 1 ? "{count} plan" : "{count} plans", { count: uniqueCalendarPlans(personal).length })}</span></div>
          {shown.map(event => <EventButton key={event.id} event={event} showDate onClick={() => openEvent(event)} />)}
          {shown.length === 0 && <p className="empty-note">{connectedPlanner ? t("No plans yet.") : t("A lovely open week.")}</p>}
        </div>;
      })}</div></>}
    </section>
    <ListPanel kind="daily" limit={3} />
    <ListPanel kind="shopping" limit={3} />
    {!!schoolMembers.length && <section className="glow-panel school-strip"><div><span className="eyebrow">{t("READY FOR TOMORROW")}</span><h2>{t("School, sorted.")}</h2><Link to="/school" className="text-link">{t("School board")}<ArrowUpRight size={17} /></Link></div>{schoolMembers.map(m => <SchoolPreview key={m.id} child={m.id} />)}</section>}
    <HomeFavorites />
    <EventEditor open={editorOpen} onOpenChange={setEditorOpen} onSaved={data.refresh} event={editing} date={newPlan?.date} member={newPlan?.member} />
  </div>;
}
