import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Trash2, ImageOff, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { useFamily, newPlannerId, dateLabel, eventTimeLabel, addDays, type FamilyEvent, type MemberId } from "@/contexts/FamilyContext";
import { useApp } from "@/contexts/AppContext";
import { available, calendarTimeInput, calendarTimeValue, supportsAction } from "@/lib/ha-model";

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
export function EventButton({ event, onClick, showDate = false, continuesBefore = false, continuesAfter = false }: { event: FamilyEvent; onClick: () => void; showDate?: boolean; continuesBefore?: boolean; continuesAfter?: boolean }) {
  const { memberName } = useFamily();
  const span = event.calendarSpan;
  const dates = span && span.firstDay !== span.lastDay ? `${dateLabel(span.firstDay)} – ${dateLabel(span.lastDay)}` : dateLabel(event.date, { weekday: "short", day: "numeric" });
  return <button className={`event-button member-${event.member}${continuesBefore ? " event-continues-before" : ""}${continuesAfter ? " event-continues-after" : ""}`} onClick={onClick}>
    <div className="event-time"><span className={showDate ? undefined : "sr-only"}>{dates}</span><time>{eventTimeLabel(event)}</time></div>
    <div><strong>{continuesBefore && <span aria-hidden="true">← </span>}{event.title}{continuesAfter && <span aria-hidden="true"> →</span>}</strong><small>{event.location || memberName(event.member)}{event.calendarId && " · Home Assistant"}</small></div>
    {continuesBefore && <span className="sr-only">Starts before this week.</span>}{continuesAfter && <span className="sr-only">Ends after this week.</span>}<ArrowUpRight size={15} />
  </button>;
}
export function EventEditor({ open, onOpenChange, onSaved, event, date, member = "everyone" }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void; event?: FamilyEvent; date?: string; member?: MemberId }) {
  const { today, saveEvent, deleteEvent, memberName, members, calendarMembers } = useFamily();
  const { haUrl, currentHome, homeOnline, services, command, commands } = useApp();
  const [draft, setDraft] = useState<FamilyEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [calendarId, setCalendarId] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("17:00");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = saving || deleting;
  const [error, setError] = useState("");
  const wasOpen = useRef(false);
  const source = event?.calendarEvent;
  const editingRemote = !!event?.calendarId;
  useEffect(() => {
    if (open && !wasOpen.current) {
      const start = source && calendarTimeInput(source.start, currentHome.timeZone);
      const end = source && calendarTimeInput(source.end, currentHome.timeZone);
      setDraft(event ? { ...event, ...(start && { date: start.slice(0, 10), time: start.slice(11) || "00:00" }) } : { id: newPlannerId(), title: "", date: date ?? today, time: "16:00", member, location: "", note: "" });
      setConfirmDelete(false); setCalendarId(""); setEndDate(end ? event.allDay ? addDays(end, -1) : end.slice(0, 10) : date ?? today); setEndTime(end?.slice(11) || event?.endTime || (!event && haUrl ? "17:00" : "")); setError("");
    }
    wasOpen.current = open;
  }, [open, event, source, date, today, member, currentHome.timeZone, haUrl]);
  const remote = editingRemote || !!haUrl && !event;
  const calendars = currentHome.entities.filter(e => e.domain === "calendar" && calendarMembers[e.preferenceId] === draft?.member);
  const writable = calendars.filter(e => available(e) && supportsAction(e, "create_event", services));
  const calendar = editingRemote ? currentHome.entities.find(e => e.entityId === event.calendarId) : calendars.find(e => e.preferenceId === calendarId) ?? (!calendarId && writable.length === 1 ? writable[0] : undefined);
  // ponytail: change individual occurrences; series edits/deletions need an explicit scope selector.
  const readOnlyReason = !editingRemote ? ""
    : !calendar ? "This calendar is no longer available in Home Assistant."
    : !supportsAction(calendar, "update_event", services) ? "Home Assistant’s integration for this calendar does not support editing existing events. Edit them in the source calendar."
    : !source?.uid ? "Home Assistant did not provide the event ID needed to save changes. Edit this event in the source calendar."
    : source.rrule && !source.recurrence_id ? "Home Assistant did not identify this occurrence of the recurring event. Edit it in the source calendar."
    : "";
  const readOnly = !!readOnlyReason;
  const deletable = !!event && (!editingRemote || !!calendar && supportsAction(calendar, "delete_event", services) && !!source?.uid && (!source.rrule || !!source.recurrence_id));
  const canDelete = deletable && !busy && (!editingRemote || homeOnline && available(calendar) && !commands[calendar.entityId]?.pending);
  const canSave = !busy && !confirmDelete && !readOnly && (!remote || homeOnline && !!calendar && available(calendar) && (editingRemote || writable.includes(calendar)) && !commands[calendar.entityId]?.pending);
  const save = async () => {
    if (!draft?.title.trim() || !canSave) return;
    setError("");
    if (!remote) {
      if (endTime && endTime <= draft.time) { setError("End time must be after the start time."); return; }
      saveEvent({ ...draft, endTime: endTime || undefined }); onOpenChange(false); return;
    }
    setSaving(true);
    try {
      if (editingRemote) await command(calendar.entityId, "update_event", {
        uid: source.uid, ...(source.recurrence_id && { recurrence_id: source.recurrence_id }),
        event: {
          summary: draft.title, location: draft.location, description: draft.note,
          dtstart: calendarTimeValue(source.start, draft.allDay ? draft.date : `${draft.date}T${draft.time}`, currentHome.timeZone),
          dtend: calendarTimeValue(source.end, draft.allDay ? addDays(endDate, 1) : `${endDate}T${endTime}`, currentHome.timeZone),
        },
      });
      else await command(calendar.entityId, "create_event", {
        summary: draft.title, start_date_time: `${draft.date}T${draft.time}:00`, end_date_time: `${endDate}T${endTime}:00`,
        location: draft.location, description: draft.note,
      });
      onSaved();
      onOpenChange(false);
    } catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!confirmDelete || !canDelete) return false;
    setError("");
    if (!editingRemote) { deleteEvent(event.id); onOpenChange(false); return; }
    setDeleting(true);
    try {
      await command(calendar.entityId, "delete_event", { uid: source.uid, ...(source.recurrence_id && { recurrence_id: source.recurrence_id }) });
      onSaved();
      onOpenChange(false);
    }
    finally { setDeleting(false); }
  };
  const deleteButton = deletable && <Button type="button" variant="ghost" disabled={!canDelete || confirmDelete} onClick={() => { setError(""); setConfirmDelete(true); }}><Trash2 size={16} />Delete</Button>;
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}><DialogContent className="planner-dialog max-h-[90dvh] overflow-y-auto">
    <DialogHeader><DialogTitle>{editingRemote ? event.title : event ? "A moment in your week" : "Make a little plan"}</DialogTitle><DialogDescription>{readOnlyReason || (remote ? "Save to Home Assistant and its connected calendar. Times use " + currentHome.timeZone + "." : "Saved to the family calendar on this screen.")}</DialogDescription></DialogHeader>
    {readOnly ? <div className="space-y-3"><p>{dateLabel(event.date)} · {eventTimeLabel(event)} · {memberName(event.member)}</p>{event.location && <p>{event.location}</p>}{event.note && <p className="whitespace-pre-wrap">{event.note}</p>}<a className="text-link" href={`${haUrl}/calendar`} target="_blank" rel="noreferrer">Open calendar in Home Assistant</a><div className="form-actions">{deleteButton}</div></div> : draft && <form onSubmit={e => { e.preventDefault(); void save(); }}><fieldset className="planner-form" disabled={busy} aria-busy={busy}>
      {source?.recurrence_id && <p>Only this occurrence will be changed.</p>}
      {draft.allDay && <p>All-day event. End date is the last day included.</p>}
      <label>What’s happening?<input autoFocus required maxLength={editingRemote ? undefined : 100} value={draft.title} placeholder="Dinner with grandparents" onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <div className="form-row"><label>Date<input type="date" required min="2000-01-01" max="2100-12-31" value={draft.date} onChange={e => { if (endDate === draft.date) setEndDate(e.target.value); setDraft({ ...draft, date: e.target.value }); }} /></label>
        {!draft.allDay && <label>Time<input type="time" required step={editingRemote ? 1 : 60} value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} /></label>}</div>
      <div className="form-row">{remote && <label>End date<input type="date" required min={draft.date} max="2100-12-31" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>}{!draft.allDay && <label>End time{!remote && " (optional)"}<input type="time" required={remote} step={editingRemote ? 1 : 60} value={endTime} onChange={e => setEndTime(e.target.value)} /></label>}</div>
      <label>Who’s going?<select disabled={editingRemote} value={draft.member} onChange={e => { setDraft({ ...draft, member: e.target.value as MemberId }); setCalendarId(""); setError(""); }}><MemberOptions />{draft.member !== "everyone" && !members.some(m => m.id === draft.member) && <option value={draft.member}>Person unavailable</option>}</select></label>
      {editingRemote && <><p>Calendar: {calendar?.name}</p>{!homeOnline && <p role="status">Connect to Home Assistant to save this plan.</p>}</>}
      {remote && !editingRemote && <><label>Calendar<select required value={calendar?.preferenceId ?? ""} onChange={e => { setCalendarId(e.target.value); setError(""); }}><option value="">Choose a calendar</option>{calendars.map(e => <option key={e.preferenceId} value={e.preferenceId} disabled={!writable.includes(e)}>{e.name}{!writable.includes(e) && " · Read-only or unavailable"}</option>)}</select></label>
        {!homeOnline ? <p role="status">Connect to Home Assistant to save this plan.</p> : !writable.length && <p role="status">No writable calendar is available for {memberName(draft.member)}. Assign a calendar that supports creating events in <Link className="text-link" to="/settings#family-calendar">Home settings</Link>.</p>}</>}
      <label>Where?<input maxLength={editingRemote ? undefined : 150} value={draft.location} placeholder="Add a place" onChange={e => setDraft({ ...draft, location: e.target.value })} /></label>
      <label>A little reminder<textarea maxLength={editingRemote ? undefined : 200} value={draft.note} placeholder="Who’s driving? What should we bring?" onChange={e => setDraft({ ...draft, note: e.target.value })} /></label>
      <div className="form-actions">{deleteButton}
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!canSave}>{saving ? "Saving…" : "Save plan"}</Button></div>
    </fieldset></form>}
    {confirmDelete && <ConfirmDialog open onOpenChange={setConfirmDelete} title="Confirm event deletion" description={editingRemote ? source.recurrence_id ? `Remove only this occurrence of “${event.title}” from ${calendar?.name} and its source calendar? Other occurrences will stay.` : `Remove “${event.title}” from ${calendar?.name} and its source calendar? This cannot be undone.` : `Remove “${event.title}” from the family calendar? This cannot be undone.`} cancelLabel="Keep event" confirmLabel="Remove event" pendingLabel="Deleting…" destructive disabled={!canDelete} onConfirm={remove} />}
    {error && <p role="alert">{error}</p>}
  </DialogContent></Dialog>;
}
function TimetableImage({ imageUrl, alt }: { imageUrl?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);
  return !imageUrl || failed ? <div className="image-unavailable" role="status"><ImageOff /><p>{imageUrl ? "The timetable image couldn’t load." : "Set up a school timetable in this app."}</p><small>{imageUrl ? "Check its URL in School." : "Add an image URL in School."}</small></div> :
    <img className="timetable-image" src={imageUrl} alt={alt} draggable={false} onError={() => setFailed(true)} />;
}
function TimetablePages({ child, startIndex = 0, onEnlarge }: { child: MemberId; startIndex?: number; onEnlarge?: (page: number) => void }) {
  const { timetables, memberName } = useFamily();
  const pages = timetables[child] ?? [];
  const carousel = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [page, setPage] = useState(startIndex);
  useEffect(() => {
    if (!api) return;
    const updatePage = () => {
      if (carousel.current?.contains(document.activeElement)) carousel.current.focus({ preventScroll: true });
      setPage(api.selectedScrollSnap());
    };
    updatePage();
    api.on("select", updatePage).on("reInit", updatePage);
    return () => { api.off("select", updatePage).off("reInit", updatePage); };
  }, [api]);
  const renderPage = (url: string | undefined, index: number) => {
    const pageLabel = pages.length > 1 ? `, page ${index + 1} of ${pages.length}` : "";
    const image = <TimetableImage imageUrl={url} alt={`${memberName(child)}’s school timetable${pageLabel}`} />;
    return onEnlarge ? <button className="timetable-page" onClick={() => onEnlarge(index)} tabIndex={pages.length <= 1 || page === index ? 0 : -1} aria-label={`Enlarge ${memberName(child)}’s timetable${pageLabel}`}>{image}</button> : image;
  };
  if (pages.length <= 1) return renderPage(pages[0], 0);
  return <Carousel ref={carousel} tabIndex={0} className="timetable-carousel" aria-label={`${memberName(child)}’s timetable pages`} opts={{ startIndex }} setApi={setApi}>
    <CarouselContent className="timetable-pages">{pages.map((url, index) => <CarouselItem key={index} aria-label={`Page ${index + 1} of ${pages.length}`} aria-hidden={page !== index}>{renderPage(url, index)}</CarouselItem>)}</CarouselContent>
    <div className="timetable-controls"><CarouselPrevious className="static translate-y-0" aria-label="Previous timetable page" /><span aria-live="polite" aria-atomic="true">Page {page + 1} of {pages.length}</span><CarouselNext className="static translate-y-0" aria-label="Next timetable page" /></div>
  </Carousel>;
}
export function SchoolPreview({ child }: { child: MemberId }) {
  const { memberName, connectedPlanner } = useFamily();
  const [openPage, setOpenPage] = useState<number | null>(null);
  return <><div className="school-preview">
    <div><MemberAvatar member={child} small /><strong>{memberName(child)}</strong>{!connectedPlanner && ["emma", "leo"].includes(child) && <span>{child === "emma" ? "Year 5" : "Year 2"}</span>}<Maximize2 size={16} /></div>
    <TimetablePages child={child} onEnlarge={setOpenPage} />
  </div><Dialog open={openPage !== null} onOpenChange={open => { if (!open) setOpenPage(null); }}><DialogContent className="timetable-dialog"><DialogHeader><DialogTitle>{memberName(child)}’s school week</DialogTitle><DialogDescription>Timetable pages saved on this screen. Change their URLs in School.</DialogDescription></DialogHeader><TimetablePages child={child} startIndex={openPage ?? 0} /></DialogContent></Dialog></>;
}
