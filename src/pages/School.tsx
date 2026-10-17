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
      <p className="muted">Up to 10 MB and 20 pages. All pages replace this person’s current timetable on every screen.</p>
      {!uploadReady && <p role="status">Wait for shared settings to finish saving before uploading.</p>}
      {uploadStatus && <p role="status">{uploadStatus}</p>}
      {shared?.state.loaded && <details><summary className="text-link">Share from iPhone</summary>
        <p>Create a shortcut for {memberName(child)} with Show in Share Sheet enabled and PDFs as input.</p>
        <label>Upload URL<input aria-label={`${memberName(child)} upload URL`} readOnly value={new URL(uploadPath, window.location.origin).href} onFocus={event => event.target.select()} /></label>
        <p>Use Get Contents of URL with POST, Request Body: File → Shortcut Input. Add headers Content-Type: application/pdf and Authorization: Basic followed by the Base64 encoding of dashboard:YOUR_DASHBOARD_PASSWORD.</p>
        <p>Add Show Alert before the upload to confirm replacement, then Show Result after it. Keep the shortcut private: its password grants access to the dashboard and home controls. Use a trusted HTTPS dashboard address, or your home network/VPN.</p>
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
    <button className="text-link" aria-expanded={edit} onClick={() => setEdit(!edit)}><LinkIcon size={16} />{timetables[child]?.length ? "Change timetable images" : "Set up timetable images"}</button>
    {edit && <form className="planner-form" onSubmit={e => {
      e.preventDefault();
      const pages = urls.split(/\r?\n/).map(url => url.trim()).filter(Boolean);
      if ((timetables[child] ?? []).some(url => !pages.includes(url))) setReplacement(pages);
      else setTimetable(child, pages);
    }}><label>Timetable image URLs<textarea aria-label={`${memberName(child)} timetable image URLs`} required rows={4} value={urls} onChange={e => setUrls(e.target.value)} placeholder={"https://school.example/timetable-1.png\nhttps://school.example/timetable-2.png"} /></label><Button type="submit"><Save size={17} />Save image URLs</Button><p className="muted">Add one direct image link per line, in page order. PNG, JPG and SVG work. Remove or reorder lines to change the pages.</p></form>}
    {replacement && <ConfirmDialog open onOpenChange={open => { if (!open) setReplacement(undefined); }} title="Replace timetable images?" description={`Save these image URLs for ${memberName(child)}? Removed pages will no longer appear, and their saved links will be lost.`} confirmLabel="Replace images" destructive onConfirm={() => { setTimetable(child, replacement); }} />}
  </article>;
}
export default function School() {
  const { members, hasTimetable } = useFamily();
  const people = members.filter(m => hasTimetable(m.id));
  return <div className="planner-page"><PageHeading eyebrow="ONE LESS MORNING SCRAMBLE" title="School, sorted." description="The week ahead, straight from the school timetable." />
    {!people.length && <section className="glow-panel"><p>No timetables enabled. Choose who has a timetable in Home settings.</p></section>}
    <div className="school-cards">{people.map(person => <SchoolCard key={person.id} child={person.id} />)}</div>
    <p className="page-note"><Link className="text-link" to="/settings#people-order">Choose people with timetables</Link>. Swipe between pages or use the arrows, then tap a page to enlarge it. PDF uploads use shared storage; image URLs are shared across screens too.</p>
  </div>;
}
