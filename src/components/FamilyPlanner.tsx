import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus, Trash2, ImageOff, Maximize2, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { familyMembers, useFamily, newPlannerId, memberName, dateLabel, itemIsDone, type FamilyEvent, type MemberId, type ListKind } from "@/contexts/FamilyContext";

export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return <header className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{children}</header>;
}
export function MemberAvatar({ member, small = false }: { member: MemberId; small?: boolean }) {
  const person = familyMembers.find(m => m.id === member);
  return <span className={`member-avatar ${small ? "small" : ""}`} style={{ background: person?.color ?? "#c4d5a3" }} aria-label={memberName(member)}>{person?.initials ?? "All"}</span>;
}
export function MemberOptions() {
  return <><option value="everyone">Everyone</option>{familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</>;
}
export function PanelHeading({ title, to, label = "View all" }: { title: string; to?: string; label?: string }) {
  return <div className="panel-heading"><h2>{title}</h2>{to && <Link to={to} className="text-link">{label}<ArrowUpRight size={17} /></Link>}</div>;
}
export function EventButton({ event, onClick, showDate = false }: { event: FamilyEvent; onClick: () => void; showDate?: boolean }) {
  return <button className={`event-button member-${event.member}`} onClick={onClick}>
    <div className="event-time">{showDate && <span>{dateLabel(event.date, { weekday: "short", day: "numeric" })}</span>}<time>{event.time}</time></div>
    <div><strong>{event.title}</strong><small>{event.location || memberName(event.member)}</small></div><ArrowUpRight size={15} />
  </button>;
}
export function EventEditor({ open, onOpenChange, event, date }: { open: boolean; onOpenChange: (open: boolean) => void; event?: FamilyEvent; date?: string }) {
  const { today, saveEvent, deleteEvent } = useFamily();
  const [draft, setDraft] = useState<FamilyEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) { setDraft(event ?? { id: newPlannerId(), title: "", date: date ?? today, time: "16:00", member: "everyone", location: "", note: "" }); setConfirmDelete(false); }
    wasOpen.current = open;
  }, [open, event, date, today]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="planner-dialog">
    <DialogHeader><DialogTitle>{event ? "A moment in your week" : "Make a little plan"}</DialogTitle><DialogDescription>Saved to the family calendar on this screen.</DialogDescription></DialogHeader>
    {draft && <form className="planner-form" onSubmit={e => { e.preventDefault(); if (!draft.title.trim()) return; saveEvent(draft); onOpenChange(false); }}>
      <label>What’s happening?<input autoFocus required maxLength={100} value={draft.title} placeholder="Dinner with grandparents" onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <div className="form-row"><label>Date<input type="date" required min="2000-01-01" max="2100-12-31" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
        <label>Time<input type="time" required value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} /></label></div>
      <label>Who’s going?<select value={draft.member} onChange={e => setDraft({ ...draft, member: e.target.value as MemberId })}><MemberOptions /></select></label>
      <label>Where?<input maxLength={150} value={draft.location} placeholder="Add a place" onChange={e => setDraft({ ...draft, location: e.target.value })} /></label>
      <label>A little reminder<input maxLength={200} value={draft.note} placeholder="Who’s driving? What should we bring?" onChange={e => setDraft({ ...draft, note: e.target.value })} /></label>
      <div className="form-actions">{event && <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Delete</Button>}
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">Save plan</Button></div>
      {confirmDelete && <div className="delete-confirm" role="alert"><p>Remove this event from the family calendar?</p><Button type="button" variant="destructive" onClick={() => { deleteEvent(draft.id); onOpenChange(false); }}>Remove event</Button></div>}
    </form>}
  </DialogContent></Dialog>;
}
const listTitles = { daily: "Before we settle in", shopping: "Pick up on the way", tasks: "The bigger things" };
const listDescriptions = { daily: "A little help from everyone", shopping: "One list for the whole family", tasks: "Things to remember, without the rush" };
export function ListPanel({ kind, limit }: { kind: ListKind; limit?: number }) {
  const { items, today, toggleItem, addItem, deleteItem } = useFamily();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [member, setMember] = useState<MemberId>(kind === "daily" ? "leo" : "everyone");
  const list = items.filter(i => i.kind === kind);
  const done = list.filter(i => itemIsDone(i, today)).length;
  const shown = limit ? [...list].sort((a, b) => Number(itemIsDone(a, today)) - Number(itemIsDone(b, today))).slice(0, limit) : list;
  return <article className={`glow-panel list-panel list-${kind}`}>
    <PanelHeading title={listTitles[kind]} to={limit ? `/lists?tab=${kind}` : undefined} label={kind === "shopping" ? "Shopping" : "Tasks"} />
    {!limit && <p className="muted">{listDescriptions[kind]}{kind === "daily" ? " · Resets each day" : ""}</p>}
    <div className="checklist">{shown.map(item => <div key={item.id} className={`check-row ${itemIsDone(item, today) ? "complete" : ""}`}>
      <label><input type="checkbox" checked={itemIsDone(item, today)} onChange={() => toggleItem(item.id)} /><span className="check-mark"><Check size={16} /></span><span className="check-text">{item.text}</span></label>
      {kind !== "shopping" && <MemberAvatar member={item.member} small />}
      {!limit && <button className="icon-button delete-item" aria-label={`Remove ${item.text}`} onClick={() => deleteItem(item.id)}><X size={16} /></button>}
    </div>)}</div>
    {list.length === 0 && <p className="empty-note">{kind === "shopping" ? "All stocked up. Add something when you need it." : "Nothing on the list. Enjoy the breathing room."}</p>}
    <div className="list-footer"><span>{done} of {list.length} {kind === "shopping" ? "picked up" : "done"}</span><button className="text-link" aria-expanded={adding} onClick={() => setAdding(!adding)}><Plus size={17} />Add {kind === "shopping" ? "item" : "task"}</button></div>
    {adding && <form className="quick-add" onSubmit={e => { e.preventDefault(); if (!text.trim()) return; addItem(text, kind, member); setText(""); setAdding(false); }}>
      <input aria-label={kind === "shopping" ? "New shopping item" : `New ${kind} task`} autoFocus required maxLength={120} value={text} onChange={e => setText(e.target.value)} placeholder={kind === "shopping" ? "What do we need?" : "What needs doing?"} />
      {kind !== "shopping" && <select aria-label="Assign task" value={member} onChange={e => setMember(e.target.value as MemberId)}><MemberOptions /></select>}
      <Button type="submit" aria-label={`Save ${kind} item`}><Plus size={19} /></Button>
    </form>}
  </article>;
}
export function TimetableImage({ child }: { child: "emma" | "leo" }) {
  const { timetables } = useFamily();
  const [failed, setFailed] = useState(false);
  const imageUrl = timetables[child];
  useEffect(() => setFailed(false), [imageUrl]);
  return failed ? <div className="image-unavailable" role="status"><ImageOff /><p>The timetable image couldn’t load.</p><small>Check its URL in School.</small></div> :
    <img className="timetable-image" src={timetables[child]} alt={`${memberName(child)}’s school timetable`} onError={() => setFailed(true)} />;
}
export function SchoolPreview({ child }: { child: "emma" | "leo" }) {
  const [open, setOpen] = useState(false);
  return <><button className="school-preview" onClick={() => setOpen(true)} aria-label={`Enlarge ${memberName(child)}’s timetable`}>
    <div><MemberAvatar member={child} small /><strong>{memberName(child)}</strong><span>{child === "emma" ? "Year 5" : "Year 2"}</span><Maximize2 size={16} /></div>
    <TimetableImage child={child} />
  </button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="timetable-dialog"><DialogHeader><DialogTitle>{memberName(child)}’s school week</DialogTitle><DialogDescription>Sample timetable · Replace the image URL in School.</DialogDescription></DialogHeader><TimetableImage child={child} /></DialogContent></Dialog></>;
}
