import { useState } from "react";
import { BookOpen, Link as LinkIcon, Save } from "lucide-react";
import { useFamily, type MemberId } from "@/contexts/FamilyContext";
import { PageHeading, SchoolPreview, MemberAvatar } from "@/components/FamilyPlanner";
import { CalendarSetupNotice } from "@/components/FamilyCalendar";
import { Button } from "@/components/ui/button";
function SchoolCard({ child }: { child: MemberId }) {
  const { timetables, setTimetable, memberName, connectedPlanner } = useFamily();
  const [url, setUrl] = useState(timetables[child] ?? "");
  const [edit, setEdit] = useState(false);
  return <article className="glow-panel school-card"><div className="panel-heading"><div className="school-child"><MemberAvatar member={child} /><div><h2>{memberName(child)}’s school week</h2>{!connectedPlanner && <p>{child === "emma" ? "Year 5 · Class 5B" : "Year 2 · Class 2A"}</p>}</div></div><BookOpen size={24} /></div>
    <SchoolPreview child={child} />{!connectedPlanner && <div className="school-reminder"><span className="eyebrow">IN THE SCHOOL BAG</span><p>{child === "emma" ? "Water bottle · Music book · Warm layers for forest day" : "Water bottle · Reading folder · PE kit"}</p></div>}
    <button className="text-link" aria-expanded={edit} onClick={() => setEdit(!edit)}><LinkIcon size={16} />{timetables[child] ? "Change timetable image" : "Set up timetable image"}</button>
    {edit && <form className="planner-form" onSubmit={e => { e.preventDefault(); setTimetable(child, url.trim()); }}><label>Timetable image URL<input aria-label={`${memberName(child)} timetable image URL`} required value={url} onChange={e => setUrl(e.target.value)} placeholder="https://school.example/timetable.png" /></label><Button type="submit"><Save size={17} />Save image URL</Button><p className="muted">Use a direct image link that this screen can open. PNG, JPG and SVG work.</p></form>}
  </article>;
}
export default function School() {
  const { members, connectedPlanner } = useFamily();
  const people = connectedPlanner ? members : members.filter(m => ["emma", "leo"].includes(m.id));
  return <div className="planner-page"><PageHeading eyebrow="ONE LESS MORNING SCRAMBLE" title="School, sorted." description="The week ahead, straight from the school timetable." />
    {!people.length && <section className="glow-panel"><p>Set up people in Home Assistant, then add their timetable images here.</p><CalendarSetupNotice /></section>}
    <div className="school-cards">{people.map(person => <SchoolCard key={person.id} child={person.id} />)}</div>
    <p className="page-note">{connectedPlanner ? "Set up school timetables in this app using image URLs. Images are saved on this screen." : "Sample timetable images for now. Tap either timetable to enlarge it."}</p>
  </div>;
}
