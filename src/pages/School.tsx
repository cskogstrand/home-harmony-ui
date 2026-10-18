import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Link as LinkIcon, Save } from "lucide-react";
import { useFamily, type MemberId } from "@/contexts/FamilyContext";
import { PageHeading, SchoolPreview, MemberAvatar } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useApp } from "@/contexts/AppContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { MAX_TIMETABLE_BYTES, timetableUploadPath } from "../../shared/timetables";
function SchoolCard({ child }: { child: MemberId }) {
  const { timetables, setTimetable, memberName, connectedPlanner } = useFamily();
  const { storageRequest } = useApp();
  const shared = useSharedConfiguration();
  const savedUrls = (timetables[child] ?? []).join("\n");
  const [urls, setUrls] = useState(savedUrls);
  const [edit, setEdit] = useState(false);
  const [replacement, setReplacement] = useState<string[]>();
  const [pdf, setPdf] = useState<File>();
  const [uploadStatus, setUploadStatus] = useState("");
  const uploadPath = timetableUploadPath(child);
  const uploadReady = shared?.state.loaded && !shared.state.dirty && !shared.state.saving && !shared.state.error;
  useEffect(() => { if (!edit) setUrls(savedUrls); }, [savedUrls, edit]);
  const sampleChild = !connectedPlanner && ["emma", "leo"].includes(child);
  return <article className="glow-panel school-card"><div className="panel-heading"><div className="school-child"><MemberAvatar member={child} /><div><h2>{memberName(child)}’s school week</h2>{sampleChild && <p>{child === "emma" ? "Year 5 · Class 5B" : "Year 2 · Class 2A"}</p>}</div></div><BookOpen size={24} /></div>
    <SchoolPreview child={child} />{sampleChild && <div className="school-reminder"><span className="eyebrow">IN THE SCHOOL BAG</span><p>{child === "emma" ? "Water bottle · Music book · Warm layers for forest day" : "Water bottle · Reading folder · PE kit"}</p></div>}
    <div className="planner-form">
      <label>Upload PDF timetable<input aria-label={`Upload ${memberName(child)} timetable PDF`} type="file" accept="application/pdf,.pdf" disabled={!uploadReady} onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        setUploadStatus("");
        if (!file) return;
        if (!file.size || file.size > MAX_TIMETABLE_BYTES) { setUploadStatus("Choose a PDF between 1 byte and 10 MB."); return; }
        setPdf(file);
      }} /></label>
      <p className="muted">PDF · Up to 10 MB and 20 pages. Replaces this person’s timetable on every screen.</p>
      {!uploadReady && <p role="status">Wait for shared settings to finish saving before uploading.</p>}
      {uploadStatus && <p role="status">{uploadStatus}</p>}
      {shared?.state.loaded && <details><summary className="text-link">Share from iPhone</summary>
        <p>Install the PDF shortcut for {memberName(child)}. Copy the Upload URL below, then open the download in Shortcuts and tap Set Up Shortcut / Add Shortcut. iOS requires you to confirm the import.</p>
        <label>Upload URL<input aria-label={`${memberName(child)} upload URL`} readOnly value={new URL(uploadPath, window.location.origin).href} onFocus={event => event.target.select()} /></label>
        <Button asChild><a href="/shortcuts/Upload%20timetable.shortcut">Download iOS shortcut</a></Button>
        <p>During setup, paste this Upload URL and enter your dashboard password. Rename the shortcut to “Upload {memberName(child)}’s timetable” so you can tell people apart. If Safari saves a file, tap it in Downloads to open Shortcuts.</p>
        <p>Open one PDF, tap Share → your shortcut, then confirm the replacement. PDFs and Show in Share Sheet are already enabled. The shortcut shows the server’s response after uploading.</p>
        <p>Keep your configured shortcut private: its saved password grants access to the dashboard and home controls. Use a trusted HTTPS dashboard address, or your home network/VPN. After a timeout, check the dashboard before retrying.</p>
      </details>}
    </div>
    {pdf && <ConfirmDialog open onOpenChange={open => { if (!open) setPdf(undefined); }} title="Upload timetable?" description={`Upload “${pdf.name}” for ${memberName(child)}? Its pages will replace the current timetable on every screen.`} confirmLabel="Upload PDF" pendingLabel="Uploading…" disabled={!uploadReady} onConfirm={async () => {
      const response = await storageRequest(uploadPath, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: pdf });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The timetable could not be uploaded.");
      setUploadStatus(result.message);
      setEdit(false);
      await shared.store.refresh();
    }} />}
    <button className="text-link" aria-expanded={edit} onClick={() => setEdit(!edit)}><LinkIcon size={16} />{timetables[child]?.length ? "Change timetable images" : "Add timetable images"}</button>
    {edit && <form className="planner-form" onSubmit={e => {
      e.preventDefault();
      const pages = urls.split(/\r?\n/).map(url => url.trim()).filter(Boolean);
      if ((timetables[child] ?? []).some(url => !pages.includes(url))) setReplacement(pages);
      else setTimetable(child, pages);
    }}><label>Timetable image URLs<textarea aria-label={`${memberName(child)} timetable image URLs`} required rows={4} value={urls} onChange={e => setUrls(e.target.value)} placeholder={"https://school.example/timetable-1.png\nhttps://school.example/timetable-2.png"} /></label><Button type="submit"><Save size={17} />Save image URLs</Button><p className="muted">One image URL per line, in page order. PNG, JPG or SVG.</p></form>}
    {replacement && <ConfirmDialog open onOpenChange={open => { if (!open) setReplacement(undefined); }} title="Replace timetable images?" description={`Save these image URLs for ${memberName(child)}? Removed pages will no longer appear, and their saved links will be lost.`} confirmLabel="Replace images" destructive onConfirm={() => { setTimetable(child, replacement); }} />}
  </article>;
}
export default function School() {
  const { members, hasTimetable } = useFamily();
  const people = members.filter(m => hasTimetable(m.id));
  return <div className="planner-page"><PageHeading eyebrow="ONE LESS MORNING SCRAMBLE" title="School, sorted."><Button variant="outline" asChild><Link to="/settings#people-order">Manage people</Link></Button></PageHeading>
    {!people.length && <section className="glow-panel"><p>No timetables enabled.</p></section>}
    <div className="school-cards">{people.map(person => <SchoolCard key={person.id} child={person.id} />)}</div>
  </div>;
}
