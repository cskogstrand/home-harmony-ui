import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Link as LinkIcon, Save } from "lucide-react";
import { useFamily, type MemberId } from "@/contexts/FamilyContext";
import { PageHeading, SchoolPreview, MemberAvatar } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
function SchoolCard({ child }: { child: MemberId }) {
  const { timetables, setTimetable, memberName, connectedPlanner } = useFamily();
  const [urls, setUrls] = useState((timetables[child] ?? []).join("\n"));
  const [edit, setEdit] = useState(false);
  const sampleChild = !connectedPlanner && ["emma", "leo"].includes(child);
  return <article className="glow-panel school-card"><div className="panel-heading"><div className="school-child"><MemberAvatar member={child} /><div><h2>{memberName(child)}’s school week</h2>{sampleChild && <p>{child === "emma" ? "Year 5 · Class 5B" : "Year 2 · Class 2A"}</p>}</div></div><BookOpen size={24} /></div>
    <SchoolPreview child={child} />{sampleChild && <div className="school-reminder"><span className="eyebrow">IN THE SCHOOL BAG</span><p>{child === "emma" ? "Water bottle · Music book · Warm layers for forest day" : "Water bottle · Reading folder · PE kit"}</p></div>}
    <button className="text-link" aria-expanded={edit} onClick={() => setEdit(!edit)}><LinkIcon size={16} />{timetables[child]?.length ? "Change timetable images" : "Set up timetable images"}</button>
    {edit && <form className="planner-form" onSubmit={e => { e.preventDefault(); setTimetable(child, urls.split(/\r?\n/)); }}><label>Timetable image URLs<textarea aria-label={`${memberName(child)} timetable image URLs`} required rows={4} value={urls} onChange={e => setUrls(e.target.value)} placeholder={"https://school.example/timetable-1.png\nhttps://school.example/timetable-2.png"} /></label><Button type="submit"><Save size={17} />Save image URLs</Button><p className="muted">Add one direct image link per line, in page order. PNG, JPG and SVG work. Remove or reorder lines to change the pages.</p></form>}
  </article>;
}
export default function School() {
  const { members, hasTimetable } = useFamily();
  const people = members.filter(m => hasTimetable(m.id));
  return <div className="planner-page"><PageHeading eyebrow="ONE LESS MORNING SCRAMBLE" title="School, sorted." description="The week ahead, straight from the school timetable." />
    {!people.length && <section className="glow-panel"><p>No timetables enabled. Choose who has a timetable in Home settings.</p></section>}
    <div className="school-cards">{people.map(person => <SchoolCard key={person.id} child={person.id} />)}</div>
    <p className="page-note"><Link className="text-link" to="/settings#people-order">Choose people with timetables</Link>. Swipe between pages or use the arrows, then tap a page to enlarge it. Image URLs are saved on this screen.</p>
  </div>;
}
