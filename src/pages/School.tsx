import { useI18n } from "@/hooks/use-i18n";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Copy, Link as LinkIcon, Save } from "lucide-react";
import { toast } from "sonner";
import { useFamily, type MemberId } from "@/contexts/FamilyContext";
import { PageHeading, SchoolPreview, MemberAvatar } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useApp } from "@/contexts/AppContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { MAX_TIMETABLE_BYTES, timetableUploadPath } from "../../shared/timetables";
function SchoolCard({ child }: { child: MemberId }) {
  const { t, message } = useI18n();
  const { timetables, setTimetable, memberName, connectedPlanner } = useFamily();
  const { storageRequest } = useApp();
  const shared = useSharedConfiguration();
  const savedUrls = (timetables[child] ?? []).join("\n");
  const [urls, setUrls] = useState(savedUrls);
  const [edit, setEdit] = useState(false);
  const [replacement, setReplacement] = useState<string[]>();
  const [pdf, setPdf] = useState<File>();
  const [uploadStatus, setUploadStatus] = useState("");
  const uploadUrlInput = useRef<HTMLInputElement>(null);
  const uploadPath = timetableUploadPath(child);
  const uploadUrl = new URL(uploadPath, window.location.origin).href;
  const uploadReady = shared?.state.loaded && !shared.state.dirty && !shared.state.saving && !shared.state.error;
  useEffect(() => { if (!edit) setUrls(savedUrls); }, [savedUrls, edit]);
  const sampleChild = !connectedPlanner && ["emma", "leo"].includes(child);
  return <article className="glow-panel school-card"><div className="panel-heading"><div className="school-child"><MemberAvatar member={child} /><div><h2>{t("{value1}’s school week", { value1: memberName(child) })}</h2>{sampleChild && <p>{child === "emma" ? t("Year 5 · Class 5B") : t("Year 2 · Class 2A")}</p>}</div></div><BookOpen size={24} /></div>
    <SchoolPreview child={child} />{sampleChild && <div className="school-reminder"><span className="eyebrow">{t("IN THE SCHOOL BAG")}</span><p>{child === "emma" ? t("Water bottle · Music book · Warm layers for forest day") : t("Water bottle · Reading folder · PE kit")}</p></div>}
    <div className="planner-form">
      <label>{t("Upload PDF timetable")}<input aria-label={t("Upload {value1} timetable PDF", { value1: memberName(child) })} type="file" accept="application/pdf,.pdf" disabled={!uploadReady} onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        setUploadStatus("");
        if (!file) return;
        if (!file.size || file.size > MAX_TIMETABLE_BYTES) { setUploadStatus("Choose a PDF between 1 byte and 10 MB."); return; }
        setPdf(file);
      }} /></label>
      <p className="muted">{t("PDF · Up to 10 MB and 20 pages. Replaces this person’s timetable on every screen.")}</p>
      {!uploadReady && <p role="status">{t("Wait for shared settings to finish saving before uploading.")}</p>}
      {uploadStatus && <p role="status">{message(uploadStatus)}</p>}
      {shared?.state.loaded && <details><summary className="text-link">{t("Share from iPhone")}</summary>
        <p>{t("Install the PDF shortcut for {value1}. Copy the Upload URL below, then open the download in Shortcuts and tap Set Up Shortcut / Add Shortcut. iOS requires you to confirm the import.", { value1: memberName(child) })}</p>
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">{t("Upload URL")}<input ref={uploadUrlInput} aria-label={t("{value1} upload URL", { value1: memberName(child) })} readOnly value={uploadUrl} onFocus={event => event.target.select()} /></label>
          <Button type="button" variant="outline" className="h-12 shrink-0" aria-label={t("Copy {value1} upload URL", { value1: memberName(child) })} onClick={async () => {
            try {
              try { await navigator.clipboard.writeText(uploadUrl); }
              catch {
                // Local HTTP dashboards may not expose the Clipboard API.
                const input = uploadUrlInput.current!;
                input.focus();
                input.select();
                input.setSelectionRange(0, input.value.length);
                if (!document.execCommand("copy")) throw new Error("Copy failed");
              }
              toast.success(t("Upload URL copied"));
            } catch {
              toast.error(t("Could not copy. Select the Upload URL and copy it manually."));
            }
          }}><Copy size={16} aria-hidden="true" />{t("Copy")}</Button>
        </div>
        <Button asChild><a href="/shortcuts/Upload%20timetable.shortcut">{t("Download iOS shortcut")}</a></Button>
        <p>{t("During setup, paste this Upload URL and enter your dashboard password. Rename the shortcut to “Upload {value1}’s timetable” so you can tell people apart. If Safari saves a file, tap it in Downloads to open Shortcuts.", { value1: memberName(child) })}</p>
        <p>{t("Open one PDF, tap Share → your shortcut, then confirm the replacement. PDFs and Show in Share Sheet are already enabled. The shortcut finishes silently once the server receives the PDF and only shows upload errors. Conversion continues on the server; any conversion errors appear at the top of the app.")}</p>
        <p>{t("Keep your configured shortcut private: its saved password grants access to the dashboard and home controls. Use a trusted HTTPS dashboard address, or your home network/VPN. After a timeout, check the dashboard before retrying.")}</p>
      </details>}
    </div>
    {pdf && <ConfirmDialog open onOpenChange={open => { if (!open) setPdf(undefined); }} title={t("Upload timetable?")} description={t("Upload “{value1}” for {value2}? Its pages will replace the current timetable on every screen.", { value1: pdf.name, value2: memberName(child) })} confirmLabel={t("Upload PDF")} pendingLabel={t("Uploading…")} disabled={!uploadReady} onConfirm={async () => {
      const response = await storageRequest(uploadPath, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: pdf });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The timetable could not be uploaded.");
      setUploadStatus(result.message);
      setEdit(false);
      await shared.store.refresh();
    }} />}
    <button className="text-link" aria-expanded={edit} onClick={() => setEdit(!edit)}><LinkIcon size={16} />{timetables[child]?.length ? t("Change timetable images") : t("Add timetable images")}</button>
    {edit && <form className="planner-form" onSubmit={e => {
      e.preventDefault();
      const pages = urls.split(/\r?\n/).map(url => url.trim()).filter(Boolean);
      if ((timetables[child] ?? []).some(url => !pages.includes(url))) setReplacement(pages);
      else setTimetable(child, pages);
    }}><label>{t("Timetable image URLs")}<textarea aria-label={t("{value1} timetable image URLs", { value1: memberName(child) })} required rows={4} value={urls} onChange={e => setUrls(e.target.value)} placeholder={"https://school.example/timetable-1.png\nhttps://school.example/timetable-2.png"} /></label><Button type="submit"><Save size={17} />{t("Save image URLs")}</Button><p className="muted">{t("One image URL per line, in page order. PNG, JPG or SVG.")}</p></form>}
    {replacement && <ConfirmDialog open onOpenChange={open => { if (!open) setReplacement(undefined); }} title={t("Replace timetable images?")} description={t("Save these image URLs for {value1}? Removed pages will no longer appear, and their saved links will be lost.", { value1: memberName(child) })} confirmLabel={t("Replace images")} destructive onConfirm={() => { setTimetable(child, replacement); }} />}
  </article>;
}
export default function School() {
  const { t } = useI18n();
  const { members, hasTimetable } = useFamily();
  const people = members.filter(m => hasTimetable(m.id));
  return <div className="planner-page"><PageHeading title={t("School")}><Button variant="outline" asChild><Link to="/settings#people-order">{t("Manage people")}</Link></Button></PageHeading>
    {!people.length && <section className="glow-panel"><p>{t("No timetables enabled.")}</p></section>}
    <div className="school-cards">{people.map(person => <SchoolCard key={person.id} child={person.id} />)}</div>
  </div>;
}
