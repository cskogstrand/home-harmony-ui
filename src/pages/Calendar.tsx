import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFamily, familyMembers, isPlannerDate, weekStart, addDays, dateLabel, type FamilyEvent, type MemberId } from "@/contexts/FamilyContext";
import { PageHeading, MemberAvatar, EventButton, EventEditor } from "@/components/FamilyPlanner";

export default function Calendar() {
  const { today, events } = useFamily();
  const [params, setParams] = useSearchParams();
  const selected = params.get("date");
  const validDate = isPlannerDate(selected) ? selected : null;
  const selectedWeek = params.get("week");
  const start = weekStart(validDate ?? (isPlannerDate(selectedWeek) ? selectedWeek : today));
  const [member, setMember] = useState<MemberId | "all">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyEvent>();
  const openEvent = (event?: FamilyEvent) => { setEditing(event); setEditorOpen(true); };
  const navigateWeek = (days: number) => setParams({ week: addDays(start, days) });
  const visible = events.filter(e => e.date >= start && e.date < addDays(start, 7) && (!validDate || e.date === validDate) && (member === "all" || e.member === member || e.member === "everyone"));
  return <div className="planner-page calendar-page">
    <PageHeading eyebrow="MAKE ROOM FOR WHAT MATTERS" title="Our week." description="Different plans. One family calendar."><Button onClick={() => openEvent()}><Plus size={18} />Add a plan</Button></PageHeading>
    <section className="glow-panel calendar-toolbar"><div className="calendar-pagination"><Button variant="outline" size="icon" aria-label="Previous week" onClick={() => navigateWeek(-7)}><ChevronLeft /></Button><h2>{dateLabel(start, { day: "numeric", month: "short" })} — {dateLabel(addDays(start, 6), { day: "numeric", month: "short", year: "numeric" })}</h2><Button variant="outline" size="icon" aria-label="Next week" onClick={() => navigateWeek(7)}><ChevronRight /></Button><Button variant="ghost" onClick={() => setParams({})}>This week</Button></div>
      <div className="week-ribbon">{Array.from({ length: 7 }, (_, i) => addDays(start, i)).map(day => <button key={day} className={day === validDate ? "is-today" : day === today ? "today-outline" : ""} onClick={() => setParams(day === validDate ? { week: start } : { date: day })} aria-pressed={day === validDate}><span>{dateLabel(day, { weekday: "short" })}</span><strong>{day.slice(-2)}</strong><i className={events.some(e => e.date === day) ? "has-events" : ""} /></button>)}</div>
      <div className="filter-row"><button aria-pressed={member === "all"} onClick={() => setMember("all")}>Everyone</button>{familyMembers.map(m => <button key={m.id} aria-pressed={member === m.id} onClick={() => setMember(m.id)}><MemberAvatar member={m.id} small />{m.name}</button>)}{validDate && <button onClick={() => setParams({ week: start })}>Show whole week</button>}</div>
    </section>
    <div className="calendar-lanes">{familyMembers.filter(m => member === "all" || member === m.id).map(person => {
      const personal = visible.filter(e => e.member === person.id || e.member === "everyone");
      return <section className={`glow-panel calendar-lane member-${person.id}`} key={person.id}><header><MemberAvatar member={person.id} /><div><h2>{person.name}</h2><p>{personal.length} plans {validDate ? `on ${dateLabel(validDate, { weekday: "long" })}` : "this week"}</p></div></header>
        {personal.map(event => <EventButton key={event.id} event={event} showDate onClick={() => openEvent(event)} />)}
        {!personal.length && <div className="empty-note"><CalendarDays size={25} /><p>Some room to breathe.</p></div>}
      </section>;
    })}</div>
    <p className="page-note">Tap a plan to edit it. Plans for everyone appear in each person’s week.</p>
    <EventEditor open={editorOpen} onOpenChange={setEditorOpen} event={editing} date={validDate ?? today} />
  </div>;
}
