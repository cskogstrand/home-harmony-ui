import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Trash2, ImageOff, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFamily, newPlannerId, dateLabel, type FamilyEvent, type MemberId } from "@/contexts/FamilyContext";
import { useApp } from "@/contexts/AppContext";

export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return <header className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{children}</header>;
}
export function MemberAvatar({ member, small = false }: { member: MemberId; small?: boolean }) {
  const { members, memberName } = useFamily();
  const person = members.find(m => m.id === member);
  return <span className={`member-avatar ${small ? "small" : ""}`} style={{ background: person?.color ?? "#c4d5a3" }} aria-label={memberName(member)}>{person?.initials ?? (member === "everyone" ? "All" : "?")}</span>;
}
export function MemberOptions() {
  const { members } = useFamily();
  return <><option value="everyone">Everyone</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</>;
}
export function PanelHeading({ title, to, label = "View all" }: { title: string; to?: string; label?: string }) {
  return <div className="panel-heading"><h2>{title}</h2>{to && <Link to={to} className="text-link">{label}<ArrowUpRight size={17} /></Link>}</div>;
}
export function EventButton({ event, onClick, showDate = false }: { event: FamilyEvent; onClick: () => void; showDate?: boolean }) {
  const { memberName } = useFamily();
  return <button className={`event-button member-${event.member}`} onClick={onClick}>
    <div className="event-time">{showDate && <span>{dateLabel(event.date, { weekday: "short", day: "numeric" })}</span>}<time>{event.allDay ? "All day" : event.continues ? "Continues" : event.time}</time></div>
    <div><strong>{event.title}</strong><small>{event.location || memberName(event.member)}{event.calendarId && " · Home Assistant"}</small></div><ArrowUpRight size={15} />
  </button>;
}
export function EventEditor({ open, onOpenChange, event, date, member = "everyone" }: { open: boolean; onOpenChange: (open: boolean) => void; event?: FamilyEvent; date?: string; member?: MemberId }) {
  const { today, saveEvent, deleteEvent, memberName, members } = useFamily();
  const { haUrl } = useApp();
  const [draft, setDraft] = useState<FamilyEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) { setDraft(event ?? { id: newPlannerId(), title: "", date: date ?? today, time: "16:00", member, location: "", note: "" }); setConfirmDelete(false); }
    wasOpen.current = open;
  }, [open, event, date, today, member]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="planner-dialog">
    <DialogHeader><DialogTitle>{event?.calendarId ? event.title : event ? "A moment in your week" : "Make a little plan"}</DialogTitle><DialogDescription>{event?.calendarId ? "Read-only Home Assistant event. Edit it in Home Assistant or the source calendar." : "Saved to the family calendar on this screen."}</DialogDescription></DialogHeader>
    {event?.calendarId ? <div className="space-y-3"><p>{dateLabel(event.date)} · {event.allDay ? "All day" : event.continues ? "Continues" : event.time} · {memberName(event.member)}</p>{event.location && <p>{event.location}</p>}{event.note && <p className="whitespace-pre-wrap">{event.note}</p>}<a className="text-link" href={`${haUrl}/calendar`} target="_blank" rel="noreferrer">Open calendar in Home Assistant</a></div> : draft && <form className="planner-form" onSubmit={e => { e.preventDefault(); if (!draft.title.trim()) return; saveEvent(draft); onOpenChange(false); }}>
      <label>What’s happening?<input autoFocus required maxLength={100} value={draft.title} placeholder="Dinner with grandparents" onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <div className="form-row"><label>Date<input type="date" required min="2000-01-01" max="2100-12-31" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
        <label>Time<input type="time" required value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} /></label></div>
      <label>Who’s going?<select value={draft.member} onChange={e => setDraft({ ...draft, member: e.target.value as MemberId })}><MemberOptions />{draft.member !== "everyone" && !members.some(m => m.id === draft.member) && <option value={draft.member}>Person unavailable</option>}</select></label>
      <label>Where?<input maxLength={150} value={draft.location} placeholder="Add a place" onChange={e => setDraft({ ...draft, location: e.target.value })} /></label>
      <label>A little reminder<input maxLength={200} value={draft.note} placeholder="Who’s driving? What should we bring?" onChange={e => setDraft({ ...draft, note: e.target.value })} /></label>
      <div className="form-actions">{event && <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Delete</Button>}
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">Save plan</Button></div>
      {confirmDelete && <div className="delete-confirm" role="alert"><p>Remove this event from the family calendar?</p><Button type="button" variant="destructive" onClick={() => { deleteEvent(draft.id); onOpenChange(false); }}>Remove event</Button></div>}
    </form>}
  </DialogContent></Dialog>;
}
export function TimetableImage({ child }: { child: MemberId }) {
  const { timetables, memberName } = useFamily();
  const [failed, setFailed] = useState(false);
  const imageUrl = timetables[child];
  useEffect(() => setFailed(false), [imageUrl]);
  return !imageUrl || failed ? <div className="image-unavailable" role="status"><ImageOff /><p>{imageUrl ? "The timetable image couldn’t load." : "Set up a school timetable in this app."}</p><small>{imageUrl ? "Check its URL in School." : "Add an image URL in School."}</small></div> :
    <img className="timetable-image" src={timetables[child]} alt={`${memberName(child)}’s school timetable`} onError={() => setFailed(true)} />;
}
export function SchoolPreview({ child }: { child: MemberId }) {
  const { memberName, connectedPlanner } = useFamily();
  const [open, setOpen] = useState(false);
  return <><button className="school-preview" onClick={() => setOpen(true)} aria-label={`Enlarge ${memberName(child)}’s timetable`}>
    <div><MemberAvatar member={child} small /><strong>{memberName(child)}</strong>{!connectedPlanner && ["emma", "leo"].includes(child) && <span>{child === "emma" ? "Year 5" : "Year 2"}</span>}<Maximize2 size={16} /></div>
    <TimetableImage child={child} />
  </button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="timetable-dialog"><DialogHeader><DialogTitle>{memberName(child)}’s school week</DialogTitle><DialogDescription>Timetable image saved on this screen. Change its URL in School.</DialogDescription></DialogHeader><TimetableImage child={child} /></DialogContent></Dialog></>;
}
