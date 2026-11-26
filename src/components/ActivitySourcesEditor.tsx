import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { CircleAlert, EyeOff, ListChecks, Pencil } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { activityIcons } from "@/components/activity-icons";
import { ActivitySourcesTable, type ActivitySourcesTableProps } from "@/components/ActivitySourcesTable";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { activityCategoryIcons, activityCategoryLabels, chosenSourceSummary, unsavedSourcesDescription } from "@/lib/activity-sources";

type ActivitySourcesEditorProps = Omit<ActivitySourcesTableProps, "onClose" | "onDirtyChange">;

/**
 * Settings → System → Activity → Activity sources: a summary of what Latest events follows (how many sources, split by event
 * type) and **Edit sources**, which opens the source tree in a full-screen dialog. Closing it with unsaved ticks asks first,
 * the same way leaving the page does, and focus returns to Edit sources.
 */
export function ActivitySourcesEditor(props: ActivitySourcesEditorProps) {
  const { candidates, saved, suggestions, personSensors, hidden } = props;
  const { t } = useI18n();
  const opener = useRef<HTMLButtonElement>(null);
  const { pathname, search } = useLocation();
  // Where the editor was opened. Leaving that page or settings section closes it, also when the section stays mounted
  // (hidden) behind the settings menu; a draft has already been confirmed away by the table's guard by then.
  const [openAt, setOpenAt] = useState<string>();
  const place = pathname + search;
  const open = openAt === place;
  const [draft, setDraft] = useState({ dirty: false, changes: 0 });
  const [asking, setAsking] = useState(false);
  const chosen = saved ?? suggestions;
  const cameras = useMemo(() => new Set(Object.keys(personSensors)), [personSensors]);
  const summary = useMemo(() => chosenSourceSummary(candidates, chosen, cameras), [candidates, chosen, cameras]);
  const total = summary.reduce((sum, { count }) => sum + count, 0);

  const close = useCallback(() => { setAsking(false); setOpenAt(undefined); setDraft({ dirty: false, changes: 0 }); }, []);
  const onDirtyChange = useCallback((dirty: boolean, changes: number) => setDraft({ dirty, changes }), []);
  useEffect(() => { if (openAt !== undefined && openAt !== place) close(); }, [openAt, place, close]);

  return <>
    <div className="activity-sources-summary">
      <p className="activity-sources-total">
        <strong>{t(total === 1 ? "1 source chosen" : "{count} sources chosen", { count: total })}</strong>
        <span>{saved ? t("of {count} entities that can report activity", { count: candidates.length }) : t("Following the suggestions")}</span>
      </p>
      {summary.length > 0 && <ul className="activity-sources-breakdown" aria-label={t("Chosen sources by type")}>
        {summary.map(({ category, count }) => {
          const Icon = category === "missing" ? CircleAlert : activityIcons[activityCategoryIcons[category]];
          const off = category !== "missing" && hidden.includes(category);
          return <li key={category} data-missing={category === "missing" || undefined}>
            <Icon size={18} aria-hidden="true" />
            <span>{t(category === "missing" ? "Unavailable sources" : activityCategoryLabels[category])}
              {off && <small><EyeOff size={14} aria-hidden="true" />{t("Hidden under Event types")}</small>}</span>
            <strong>{count}</strong>
          </li>;
        })}
      </ul>}
      <Button ref={opener} type="button" className="activity-sources-edit" onClick={() => setOpenAt(place)}><Pencil size={18} aria-hidden="true" />{t("Edit sources")}</Button>
    </div>
    <Dialog open={open} onOpenChange={value => { if (value) setOpenAt(place); else if (draft.dirty) setAsking(true); else close(); }}>
      <DialogContent variant="fullscreen" className="activity-sources-editor"
        onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}>
        <header className="activity-sources-editor-header">
          <DialogTitle className="activity-sources-editor-title"><ListChecks strokeWidth={1.8} aria-hidden="true" />{t("Activity sources")}</DialogTitle>
          <DialogDescription>{t("Tick what Latest events should follow, then save.")}</DialogDescription>
        </header>
        <ActivitySourcesTable {...props} onClose={close} onDirtyChange={onDirtyChange} />
      </DialogContent>
    </Dialog>
    {/* Escape, the close button and an outside press all ask here; links and the back button ask in the table's own guard. */}
    <ConfirmDialog open={asking} onOpenChange={setAsking} title="Discard unsaved sources?" description={unsavedSourcesDescription(draft.changes)}
      cancelLabel="Keep editing" confirmLabel="Discard changes" destructive onConfirm={close} />
  </>;
}
