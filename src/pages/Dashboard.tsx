import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus, Sparkles } from "lucide-react";
import { useFamily, familyMembers, memberName, addDays, dateLabel, sortEvents, type FamilyEvent, type MemberId } from "@/contexts/FamilyContext";
import { EventEditor, EventButton, ListPanel, MemberAvatar, SchoolPreview } from "@/components/FamilyPlanner";
import { CalendarViewControls, FamilyWeekGrid, HomeAssistantCalendar } from "@/components/FamilyCalendar";
import { HomeFavorites, VehicleCard } from "@/components/HomePanels";

export default function Dashboard() {
  const { today, time, events, calendar, calendarStart: start } = useFamily();
  const [editing, setEditing] = useState<FamilyEvent>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [newPlan, setNewPlan] = useState<{ date: string; member: MemberId }>();
  const openEvent = (event?: FamilyEvent) => { setEditing(event); setNewPlan(undefined); setEditorOpen(true); };
  const addPlan = (date: string, member: MemberId) => { setEditing(undefined); setNewPlan({ date, member }); setEditorOpen(true); };
  const upcoming = events.filter(e => `${e.date}${e.time}` >= `${today}${time}`);
  const next = upcoming[0];
  const weekEvents = events.filter(e => e.date >= start && e.date < addDays(start, 7));
  return <div className="portrait-board">
    <header className="ambient-heading"><div className="clock-block"><time className="ambient-clock">{time}</time><span>{dateLabel(today, { weekday: "long", day: "numeric", month: "long" })}</span></div>
      <div className="greeting"><span className="eyebrow">YOUR FAMILY, A LITTLE MORE IN SYNC</span><h1>Good to be home.</h1><div className="greeting-bottom"><div className="avatar-group">{familyMembers.map(m => <MemberAvatar member={m.id} key={m.id} small />)}</div><span>A place for everyone.</span></div></div>
    </header>
    <section className="next-chapter" aria-label="Next family plan">
      {next ? <><button className="next-event" onClick={() => openEvent(next)}><span className="eyebrow"><span className="live-dot" />UP NEXT · {memberName(next.member)}{next.date !== today ? ` · ${dateLabel(next.date, { weekday: "short" })}` : ""}</span><h2>{next.title === "Football practice" ? "Boots on. It’s football." : next.title}</h2><p>{next.location}{next.note && ` · ${next.note}`}</p><ArrowUpRight className="next-arrow" size={24} /></button><div className="next-event-time"><time>{next.time}</time><span>{next.date === today ? "Today" : dateLabel(next.date)}</span></div></> :
        <div className="next-event"><span className="eyebrow"><Sparkles size={15} />A LITTLE BREATHING ROOM</span><h2>No more plans on the calendar.</h2><p>Enjoy the quiet, or make time for something good.</p></div>}
      <button className="add-plan" onClick={() => openEvent()} aria-label="Add a family plan"><Plus size={20} /></button>
    </section>
    <section className="glow-panel family-week">
      <div className="panel-heading calendar-panel-heading"><h2>Everyone’s week</h2><CalendarViewControls /><Link to="/calendar" className="text-link">Open calendar<ArrowUpRight size={17} /></Link></div>
      {calendar.view === "week" ? <FamilyWeekGrid start={start} events={events} compact onEdit={openEvent} onAdd={addPlan} /> : <>
      <div className="week-ribbon">{Array.from({ length: 7 }, (_, i) => addDays(start, i)).map(day => <Link key={day} to={`/calendar?date=${day}&week=${start}`} className={day === today ? "is-today" : ""} aria-label={`View ${dateLabel(day)}`} aria-current={day === today ? "date" : undefined}><span>{dateLabel(day, { weekday: "short" })}</span><strong>{day.slice(-2)}</strong><i className={weekEvents.some(e => e.date === day) ? "has-events" : ""} /></Link>)}</div>
      <div className="family-lanes">{familyMembers.map(member => {
        const personal = weekEvents.filter(e => e.member === member.id || e.member === "everyone");
        const future = personal.filter(e => `${e.date}${e.time}` >= `${today}${time}`);
        const remaining = future.length ? future : personal;
        const shown = sortEvents([...remaining.filter(e => e.member === member.id), ...remaining.filter(e => e.member === "everyone")].slice(0, 2));
        return <div className={`family-lane member-${member.id}`} key={member.id}><div className="lane-heading"><MemberAvatar member={member.id} small /><strong>{member.name}</strong><span>{personal.length} plans</span></div>
          {shown.map(event => <EventButton key={event.id} event={event} showDate onClick={() => openEvent(event)} />)}
          {shown.length === 0 && <p className="empty-note">A lovely open week.</p>}
        </div>;
      })}</div></>}
    </section>
    <HomeAssistantCalendar start={start} end={addDays(start, 7)} />
    <ListPanel kind="daily" limit={3} />
    <ListPanel kind="shopping" limit={3} />
    <section className="glow-panel school-strip"><div><span className="eyebrow">READY FOR TOMORROW</span><h2>School, sorted.</h2><p>Timetables at a glance.<br />Tap to take a closer look.</p><Link to="/school" className="text-link">School board<ArrowUpRight size={17} /></Link></div><SchoolPreview child="emma" /><SchoolPreview child="leo" /></section>
    <HomeFavorites />
    <VehicleCard />
    <EventEditor open={editorOpen} onOpenChange={setEditorOpen} event={editing} date={newPlan?.date} member={newPlan?.member} />
  </div>;
}
