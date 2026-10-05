import { useState } from "react";
import { BookOpen, Link as LinkIcon, Save } from "lucide-react";
import { useFamily, memberName } from "@/contexts/FamilyContext";
import { PageHeading, SchoolPreview, MemberAvatar } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
function SchoolCard({ child }: { child: "emma" | "leo" }) {
  const { timetables, setTimetable } = useFamily();
  const [url, setUrl] = useState(timetables[child]);
  const [edit, setEdit] = useState(false);
  return <article className="glow-panel school-card"><div className="panel-heading"><div className="school-child"><MemberAvatar member={child} /><div><h2>{memberName(child)}’s school week</h2><p>{child === "emma" ? "Year 5 · Class 5B" : "Year 2 · Class 2A"}</p></div></div><BookOpen size={24} /></div>
    <SchoolPreview child={child} /><div className="school-reminder"><span className="eyebrow">IN THE SCHOOL BAG</span><p>{child === "emma" ? "Water bottle · Music book · Warm layers for forest day" : "Water bottle · Reading folder · PE kit"}</p></div>
    <button className="text-link" aria-expanded={edit} onClick={() => setEdit(!edit)}><LinkIcon size={16} />Change timetable image</button>
    {edit && <form className="planner-form" onSubmit={e => { e.preventDefault(); setTimetable(child, url.trim()); }}><label>Timetable image URL<input aria-label={`${memberName(child)} timetable image URL`} required value={url} onChange={e => setUrl(e.target.value)} placeholder="https://school.example/timetable.png" /></label><Button type="submit"><Save size={17} />Save image URL</Button><p className="muted">Use a direct image link that this screen can open. PNG, JPG and SVG work.</p></form>}
  </article>;
}
export default function School() {
  return <div className="planner-page"><PageHeading eyebrow="ONE LESS MORNING SCRAMBLE" title="School, sorted." description="The week ahead, straight from the school timetable." /><div className="school-cards"><SchoolCard child="emma" /><SchoolCard child="leo" /></div><p className="page-note">Sample timetable images for now. Tap either timetable to enlarge it.</p></div>;
}
