import { useI18n } from "@/hooks/use-i18n";
import { useListItemFeedback, type ItemFeedback } from "@/hooks/use-list-item-feedback";
import { forwardRef, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useIsPresent, usePresenceData, useReducedMotion } from "framer-motion";
import { Check, LoaderCircle, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { useFamily, itemIsDone, type MemberId, type ListKind, type ListItem, type TodoListKind } from "@/contexts/FamilyContext";
import { available, supportsAction } from "@/lib/ha-model";
import type { Entity, TodoAction, TodoItem } from "@/types/api";
import { todoDetailChanges, todoDueInput, todoDueTimestamp, type TodoDetails } from "@/lib/todo-items";
import { TodoDueLabel, TodoItemFields } from "./TodoItemDetails";
import { MemberAvatar, MemberOptions, PanelHeading } from "./FamilyPlanner";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./common/ConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { defaultTodoDisplay } from "../../shared/configuration";
import { TodoCelebration } from "./TodoCelebration";

const listTitles = { daily: "Daily rhythm", shopping: "Shopping", tasks: "Family tasks", homework: "Homework" };
const itemName = (name: string) => name.trim().toLocaleLowerCase();
const rowTransition = { duration: .8, ease: [.77, 0, .175, 1] } as const;
type ListPresence = { itemIds: string[]; completedIds: string[] };
function ListPanelSurface() {
  const reduceMotion = useReducedMotion();
  return <motion.div className="list-panel-surface" aria-hidden="true" layout={!reduceMotion}
    style={{ borderRadius: 24 }} transition={reduceMotion ? { duration: 0 } : rowTransition} />;
}
const CheckRow = forwardRef<HTMLDivElement, {
  id: string; text: string; complete: boolean; member?: MemberId; disabled?: boolean; removeDisabled?: boolean;
  feedback?: ItemFeedback; pending?: boolean; due?: TodoItem["due"]; description?: TodoItem["description"];
  onToggle: (checkbox: HTMLInputElement) => void; onEdit?: () => void; onRemove?: () => void;
}>(function CheckRow({ id, text, complete, member, feedback, pending, disabled, removeDisabled, due, description, onToggle, onEdit, onRemove }, ref) {
  const { t } = useI18n();
  const descriptionId = useId();
  const present = useIsPresent();
  const presence: ListPresence | undefined = usePresenceData();
  const reduceMotion = useReducedMotion();
  const completing = !present && presence?.completedIds.includes(id);
  const deleting = !present && presence && !presence.itemIds.includes(id);
  const exiting = completing || deleting;
  const entering = feedback === "added" || feedback === "reopened";
  const busy = !!pending && present;
  const content = <span className="check-content"><span className="check-text">{text}</span>{description && <span id={descriptionId} className="check-description">{description}</span>}</span>;
  return <motion.div ref={ref} className="check-row-shell" aria-hidden={!present || undefined}
    initial={entering && !reduceMotion ? { opacity: 0, transform: "translateX(24px) scale(.97)" } : false}
    layout={reduceMotion ? false : "position"} animate={{ opacity: 1, transform: "translateX(0px) scale(1)" }}
    transition={reduceMotion ? { duration: 0 } : rowTransition}
    exit={{ opacity: 0, transform: exiting && !reduceMotion ? "translateX(24px) scale(.97)" : "translateX(0px) scale(1)",
      transition: { duration: exiting ? reduceMotion ? .16 : .7 : 0, ease: [.23, 1, .32, 1] } }}>
    <motion.div className={`check-row ${complete || completing ? "complete" : ""} ${completing ? "completing" : ""}`} data-feedback={feedback}
      initial={false} animate={{ transform: feedback === "edited" && !reduceMotion ? "translateX(12px)" : "translateX(0px)" }}
      transition={reduceMotion ? { duration: 0 } : rowTransition}>
      <label><input type="checkbox" aria-label={text} aria-describedby={description ? descriptionId : undefined} aria-busy={busy} checked={complete || completing} disabled={disabled || busy || !present} onChange={event => onToggle(event.currentTarget)} /><span className="check-mark" aria-hidden="true"><Check size={16} className="check-icon" />{busy && <LoaderCircle size={16} className="motion-safe:animate-spin" />}</span></label>
      {onEdit ? <button className="edit-item" aria-label={t("Edit {value1}", { value1: text })} aria-describedby={description ? descriptionId : undefined} disabled={disabled || !present} onClick={onEdit}>{content}{member && <MemberAvatar member={member} small />}</button>
        : <span className="edit-item">{content}</span>}
      {due && <TodoDueLabel due={due} complete={complete || !!completing} />}
      {onRemove && <button className="icon-button delete-item" disabled={removeDisabled || !present} aria-label={t("Remove {value1}", { value1: text })} onClick={onRemove}><X size={16} /></button>}
    </motion.div>
  </motion.div>;
});
const ListEmptyNote = forwardRef<HTMLDivElement, { text: string }>(function ListEmptyNote({ text }, ref) {
  const reduceMotion = useReducedMotion();
  return <motion.div ref={ref} className="list-empty-note" layout={reduceMotion ? false : "position"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduceMotion ? { duration: 0 } : rowTransition}>
    <p className="empty-note">{text}</p>
  </motion.div>;
});
const CompletedItems = forwardRef<HTMLDetailsElement, { count: number; presence: ListPresence; children: ReactNode }>(function CompletedItems({ count, presence, children }, ref) {
  const { t } = useI18n();
  // Presence data updates on exit; live sections need current IDs from props.
  const exitPresence: ListPresence | undefined = usePresenceData();
  const reduceMotion = useReducedMotion();
  const present = useIsPresent();
  return <motion.details ref={ref} open className="completed-items" aria-hidden={!present || undefined} layout={reduceMotion ? false : "position"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduceMotion ? { duration: 0 } : rowTransition}>
    <summary tabIndex={present ? undefined : -1}>{t("Completed ({value1})", { value1: count })}</summary><div className="checklist"><AnimatePresence initial={false} mode="popLayout" custom={present ? presence : exitPresence} propagate>{children}</AnimatePresence></div>
  </motion.details>;
});
function ItemEditor({ text, kind, description, disabled, error, onSave, onClose, item, entity, timeZone }: {
  text: string; kind: TodoListKind; description: string; disabled?: boolean; error?: string;
  item?: TodoItem; entity?: Entity; timeZone?: string;
  onSave: (text: string, details: TodoDetails) => boolean | Promise<boolean>; onClose: () => void;
}) {
  const { t, message } = useI18n();
  const [draft, setDraft] = useState(text);
  const [details, setDetails] = useState({ due: todoDueInput(item?.due, timeZone), description: item?.description ?? "" });
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (disabled || saving || !draft.trim()) return;
    setSaving(true);
    try { setSaveError(""); if (await onSave(draft.trim(), details)) onClose(); }
    catch (error) { setSaveError(error instanceof Error ? error.message : t("Configuration could not be saved.")); }
    finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle>{kind === "shopping" ? t("Edit item") : t("Edit task")}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
    <form onSubmit={event => { event.preventDefault(); void save(); }}><fieldset className="planner-form" disabled={saving} aria-busy={saving}>
      <div className="planner-form dialog-form-body"><label>{kind === "shopping" ? t("Item") : t("Task")}<input autoFocus required maxLength={120} value={draft} onChange={event => setDraft(event.target.value)} /></label>
      {entity && <TodoItemFields entity={entity} value={details} onChange={setDetails} disabled={disabled} />}
      {(saveError || error) && <p role="alert">{message(saveError || error)}</p>}
      </div>
      <div className="form-actions"><Button type="button" variant="ghost" onClick={onClose}>{t("Cancel")}</Button><Button type="submit" disabled={disabled || !draft.trim()}>{saving ? t("Saving…") : t("Save changes")}</Button></div>
    </fieldset></form>
  </DialogContent></Dialog>;
}
function ItemSuggestions({ id, names, text, select, isDisabled }: { id: string; names: string[]; text: string; select: (name: string) => void | Promise<void>; isDisabled: (name: string) => boolean }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string>();
  const matches = text.trim() ? [...new Set(names)].filter(name => itemName(name).includes(itemName(text))).slice(0, 6) : [];
  return !!matches.length && <div id={id} className="item-suggestions flex basis-full flex-wrap items-center gap-2 pb-2" role="group" aria-label={t("Existing items")}>
    <span className="text-xs text-muted-foreground">{t("Existing items")}</span>
    {matches.map(name => <button type="button" key={name} className="item-suggestion rounded-full bg-secondary px-3 py-1 text-xs" disabled={!!selected || isDisabled(name)} aria-busy={selected === name} onClick={async () => {
      setSelected(name);
      try { await select(name); } finally { setSelected(undefined); }
    }}><span className={selected === name ? "opacity-0" : undefined}>{name}</span>{selected === name && <LoaderCircle size={16} className="suggestion-spinner motion-safe:animate-spin" aria-hidden="true" />}</button>)}
  </div>;
}
export function ListPanel({ kind, limit }: { kind: TodoListKind; limit?: number }) {
  const { t, message } = useI18n();
  const { connectedPlanner, todoLists, compareMembers, isMemberVisible } = useFamily();
  const { haUrl, homeOnline } = useApp();
  if (!connectedPlanner && kind !== "homework") return <LayoutGroup><LocalListPanel kind={kind} limit={limit} /></LayoutGroup>;
  const lists = Object.entries(todoLists).filter(([, assigned]) => assigned.kind === kind && (kind === "shopping" || isMemberVisible(assigned.member)))
    .sort(([, a], [, b]) => compareMembers(a.member, b.member));
  return <LayoutGroup><article className={`glow-panel list-panel list-${kind}`}>
    <ListPanelSurface />
    <PanelHeading title={message(listTitles[kind])} to={limit ? `/lists?tab=${kind}` : undefined} label={kind === "shopping" ? t("Shopping") : t("Tasks")} />
    {!lists.length && <p className="empty-note">{homeOnline ? t("No lists selected.") : t("Lists unavailable while offline.")}</p>}
    {lists.map(([id, assigned]) => <HomeAssistantList key={`${haUrl}|${id}|${assigned.member}`} preferenceId={id} member={assigned.member} kind={kind} limit={limit} />)}
  </article></LayoutGroup>;
}

export function HomeAssistantList({ preferenceId, member, kind, limit, school = false }: { preferenceId: string; member: MemberId; kind: TodoListKind; limit?: number; school?: boolean }) {
  const { t, message, locale } = useI18n();
  const { currentHome, haUrl, homeOnline, todoItems, command, commands, services } = useApp();
  const { memberName, todoLists } = useFamily();
  const display = todoLists[preferenceId]?.display ?? defaultTodoDisplay;
  const entity = currentHome.entities.find(e => e.domain === "todo" && e.preferenceId === preferenceId);
  const entityId = entity?.entityId;
  const online = homeOnline && !!entity && available(entity);
  const [refresh, setRefresh] = useState(0);
  const [pendingToggle, setPendingToggle] = useState<{ id: string; refresh: number }>();
  const [heldCompletion, setHeldCompletion] = useState<{ id: string; index: number }>();
  const completionTarget = useRef<{ id: string; refresh: number; checkbox: HTMLInputElement; x: number; y: number }>();
  const [celebration, setCelebration] = useState<{ x: number; y: number }>();
  const endCelebration = useCallback(() => { setCelebration(undefined); setHeldCompletion(undefined); }, []);
  const [result, setResult] = useState<{ key: string; entityId?: string; items: TodoItem[]; error?: string }>({ key: "", items: [] });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TodoItem>();
  const [removing, setRemoving] = useState<TodoItem>();
  const [text, setText] = useState("");
  const [details, setDetails] = useState<TodoDetails>({ due: "", description: "" });
  const [addError, setAddError] = useState("");
  const formId = useId();
  const suggestionsId = `${formId}-suggestions`;
  const requestKey = `${haUrl}|${entityId}|${entity?.lastUpdated}|${entity?.state}|${refresh}`;
  useEffect(() => {
    if (!online) { setResult({ key: "", items: [] }); setPendingToggle(undefined); completionTarget.current = undefined; endCelebration(); return; }
    let active = true;
    void todoItems(entityId).then(items => {
      if (active) {
        const target = completionTarget.current;
        if (target?.refresh === refresh) {
          completionTarget.current = undefined;
          if (display.celebrate && items.some(item => item.uid === target.id && item.status === "completed")) {
            const rect = target.checkbox.isConnected ? target.checkbox.nextElementSibling.getBoundingClientRect() : undefined;
            setCelebration(rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : { x: target.x, y: target.y });
          } else setHeldCompletion(undefined);
        }
        setResult({ key: requestKey, entityId, items });
      }
    }).catch((error: Error) => {
      if (active) setResult({ key: requestKey, entityId, items: [], error: error.message });
    }).finally(() => {
      // Only the refresh after this command can finish its checkbox feedback.
      if (active) setPendingToggle(pending => pending?.refresh === refresh ? undefined : pending);
      if (active && completionTarget.current?.refresh === refresh) { completionTarget.current = undefined; setHeldCompletion(undefined); }
    });
    return () => { active = false; };
  }, [online, entityId, requestKey, refresh, todoItems, display.celebrate, endCelebration]);
  const loading = online && result.key !== requestKey;
  // Keep the last rows mounted during refresh so confirmed changes can animate out.
  const hasResult = result.entityId === entityId && !!result.key;
  const items = online && hasResult ? result.items : [];
  const feedback = useListItemFeedback(online && hasResult && !result.error
    ? items.map(item => ({ id: item.uid, text: item.summary, complete: item.status === "completed" })) : null);
  const status = commands[entityId];
  const can = (action: TodoAction) => online && !loading && !result.error && !status?.pending && !pendingToggle && !heldCompletion && supportsAction(entity, action, services);
  const change = async (action: TodoAction, value: { item: string; status?: string; rename?: string; due_date?: string | null; due_datetime?: string | null; description?: string }) => {
    try {
      await command(entityId, action, value);
      setRefresh(n => n + 1);
      return true;
    } catch { return false; /* The shared command state displays failures without replaying writes. */ }
  };
  const toggle = async (item: TodoItem, checkbox: HTMLInputElement) => {
    if (!can("update_item")) return;
    completionTarget.current = undefined;
    if (display.celebrate && item.status !== "completed" && document.documentElement.dataset.motionInput !== "keyboard") {
      const rect = checkbox.nextElementSibling.getBoundingClientRect();
      completionTarget.current = { id: item.uid, refresh: refresh + 1, checkbox, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      setHeldCompletion({ id: item.uid, index: shown.findIndex(row => row.uid === item.uid) });
    }
    setPendingToggle({ id: item.uid, refresh: refresh + 1 });
    if (!await change("update_item", { item: item.uid, status: item.status === "completed" ? "needs_action" : "completed" })) { setPendingToggle(undefined); completionTarget.current = undefined; setHeldCompletion(undefined); }
  };
  const add = async (name = text) => {
    if (!can("add_item") || !name.trim()) return;
    const matches = items.filter(item => itemName(item.summary) === itemName(name));
    const existing = matches.find(item => item.status !== "completed") ?? matches[0];
    if (existing?.status === "completed" && !can("update_item")) { toast.error(t("This list cannot reopen completed items.")); return; }
    if (existing && existing.status !== "completed") toast.info(t("This item is already on the list."));
    else {
      setAddError("");
      try {
        const changes = todoDetailChanges(existing ?? {}, details, entity, currentHome.timeZone);
        // Reopening a suggestion keeps its existing details unless the draft supplies replacements.
        if (existing && !details.due) { delete changes.due_date; delete changes.due_datetime; }
        if (existing && !details.description) delete changes.description;
        if (!await change(existing ? "update_item" : "add_item", { item: existing?.uid ?? name, ...(existing ? { status: "needs_action" } : {}), ...changes })) return;
      } catch (error) { setAddError(error instanceof Error ? error.message : t("Configuration could not be saved.")); return; }
    }
    setText(""); setDetails({ due: "", description: "" }); setAdding(false);
  };
  const sorted = [...items];
  if (display.sort === "alphabetical") sorted.sort((a, b) => a.summary.localeCompare(b.summary, locale));
  if (display.sort === "due-date") sorted.sort((a, b) => todoDueTimestamp(a.due, currentHome.timeZone) - todoDueTimestamp(b.due, currentHome.timeZone) || a.summary.localeCompare(b.summary, locale));
  const completed = sorted.filter(item => item.status === "completed");
  const completedBelow = completed.filter(item => item.uid !== heldCompletion?.id);
  const presence: ListPresence = { itemIds: items.map(item => item.uid), completedIds: completed.map(item => item.uid) };
  const pending = sorted.filter(item => item.status !== "completed");
  const ordered = (display.completed === "inline" ? sorted : pending).filter(item => item.uid !== heldCompletion?.id);
  const heldItem = items.find(item => item.uid === heldCompletion?.id);
  // Keep the clicked row in place even if Home Assistant moves completed items first.
  if (heldItem) ordered.splice(heldCompletion.index, 0, heldItem);
  const shown = limit ? ordered.slice(0, limit) : ordered;
  const row = (item: TodoItem) => <CheckRow key={item.uid} id={item.uid} text={item.summary} due={display.showDueDate ? item.due : undefined} description={display.showDetails ? item.description : undefined} complete={item.status === "completed"} feedback={feedback.get(item.uid)}
    pending={pendingToggle?.id === item.uid} disabled={!can("update_item")} removeDisabled={!can("remove_item")}
    onToggle={checkbox => void toggle(item, checkbox)}
    onEdit={!school ? () => setEditing(item) : undefined} onRemove={!limit && !school ? () => setRemoving(item) : undefined} />;
  return <section role="group" aria-label={kind === "shopping" ? t("Shared shopping list") : t(kind === "homework" ? "{name} homework" : kind === "daily" ? "{name} daily tasks" : "{name} tasks", { name: memberName(member) })} className={school ? "household-list homework-list" : "household-list"} aria-busy={loading || !!status?.pending}>
    {celebration && <TodoCelebration origin={celebration} onComplete={endCelebration} />}
    {school ? <div className="panel-heading"><h3>{t("Homework")}</h3>{online && hasResult && !result.error && <span className="list-progress" aria-label={t("{count} open items", { count: pending.length })}>{pending.length}</span>}{online && <Button variant="ghost" size="icon" aria-label={t("Refresh list")} disabled={loading || status?.pending || !!pendingToggle} onClick={() => setRefresh(n => n + 1)}><RefreshCw size={18} aria-hidden="true" /></Button>}</div> : <div className="list-composer">
      <div className="list-action-bar flex-wrap">
        <div className="list-identity flex-1 basis-32">{kind !== "shopping" && <MemberAvatar member={member} small />}<div><h3>{kind === "shopping" ? t("Shared shopping list") : memberName(member)}</h3><span>{entity?.name ?? t("List unavailable")}</span></div></div>
        <div className="ml-auto flex items-center gap-1">
          <Button className="list-add-button" variant={adding ? "outline" : "default"} disabled={adding ? !!status?.pending : !can("add_item")} aria-expanded={adding} aria-controls={formId} onClick={() => setAdding(!adding)}>{adding ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}{t(adding ? "Cancel" : kind === "shopping" ? "Add item" : "Add task")}</Button>
          {online && <Button variant="ghost" size="icon" aria-label={t("Refresh list")} title={t("Refresh list")} aria-busy={loading}
            disabled={loading || status?.pending || !!pendingToggle} onClick={() => setRefresh(n => n + 1)}><RefreshCw aria-hidden="true" className={loading ? "motion-safe:animate-spin" : undefined} /></Button>}
        </div>
      </div>
      {adding && <form id={formId} className="quick-add" onSubmit={event => { event.preventDefault(); void add(); }}>
        <label className="quick-add-field"><span>{t(kind === "shopping" ? "Item" : "Task")}</span><input aria-label={t("New item in {value1}", { value1: entity?.name ?? t("List unavailable") })} aria-controls={suggestionsId} autoComplete="off" autoFocus required maxLength={120} disabled={!can("add_item")} value={text} onChange={event => setText(event.target.value)} placeholder={kind === "shopping" ? t("What do we need?") : t("What needs doing?")} /></label>
        <Button type="submit" disabled={!can("add_item") || !text.trim()} aria-label={t("Save item to {value1}", { value1: entity?.name ?? t("List unavailable") })}>{status?.pending ? t("Saving…") : t("Add")}</Button>
        <details className="todo-add-details"><summary>{t("Due date and description")}</summary>{entity && <TodoItemFields entity={entity} value={details} onChange={setDetails} disabled={!can("add_item")} />}</details>
        {addError && <p role="alert">{message(addError)}</p>}
        <ItemSuggestions id={suggestionsId} names={items.map(item => item.summary)} text={text} select={add} isDisabled={name => !can("add_item") || !can("update_item") || pending.some(item => itemName(item.summary) === itemName(name))} />
      </form>}
    </div>}
    {!online ? <p className="empty-note">{homeOnline ? t("This to-do list is unavailable. Check it in Home Assistant or select another list in Home settings.") : t("To-do lists are unavailable while offline. Connect to Home Assistant to view and update them.")}</p> : <>
      {loading && !hasResult && <p role="status" className="page-note">{t("Loading to-do items…")}</p>}
      {hasResult && (result.error ? <p role="alert">{message(result.error)}</p> : <>
        {!school && <p className="list-progress">{t(kind === "shopping" ? "{done} of {total} picked up" : "{done} of {total} done", { done: completed.length, total: items.length })}</p>}
        <div className="checklist"><AnimatePresence initial={false} mode="popLayout" custom={presence}>{shown.map(row)}</AnimatePresence></div>
        <AnimatePresence initial={false} mode="popLayout">{!pending.length && !heldCompletion && <ListEmptyNote key="empty" text={kind === "homework" ? t("No homework.") : items.length ? t("All done.") : t("This list is empty.")} />}</AnimatePresence>
        <AnimatePresence initial={false} mode="popLayout" custom={presence}>{display.completed === "under" && !!completedBelow.length && <CompletedItems key="completed" count={completedBelow.length} presence={presence}>{completedBelow.map(row)}</CompletedItems>}</AnimatePresence>
        {!(["add_item", "update_item", "remove_item"] as TodoAction[]).some(action => supportsAction(entity, action, services)) && <p className="page-note">{t("This list is read-only.")}</p>}
      </>)}
      {status?.error && <p role="alert" className="page-note">{message(status.error)}</p>}
      <span role="status" className="page-note">{status?.pending ? t("Updating list…") : loading && hasResult ? t("Refreshing list…") : ""}</span>
    </>}
    {editing && <ItemEditor text={editing.summary} kind={kind} description={t("Saved to {value1} in Home Assistant.", { value1: entity?.name ?? t("your list") })} disabled={!can("update_item")} error={status?.error} item={editing} entity={entity} timeZone={currentHome.timeZone} onSave={(text, details) => can("update_item") ? change("update_item", { item: editing.uid, rename: text, ...todoDetailChanges(editing, details, entity, currentHome.timeZone) }) : false} onClose={() => setEditing(undefined)} />}
    {removing && <ConfirmDialog open onOpenChange={open => { if (!open) setRemoving(undefined); }} title={t("Remove item?")} description={t("Remove “{value1}” from {value2} in Home Assistant? This cannot be undone.", { value1: removing.summary, value2: entity?.name ?? t("this list") })} confirmLabel={t("Remove item")} pendingLabel={t("Removing…")} destructive disabled={!can("remove_item") || !items.some(item => item.uid === removing.uid)} onConfirm={async () => {
      await command(entityId, "remove_item", { item: removing.uid });
      setRefresh(n => n + 1);
    }} />}
  </section>;
}

function LocalListPanel({ kind, limit }: { kind: ListKind; limit?: number }) {
  const { t, message } = useI18n();
  const { items, today, toggleItem, addItem, renameItem, deleteItem, compareMembers, isMemberVisible, members } = useFamily();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ListItem>();
  const [removing, setRemoving] = useState<ListItem>();
  const [text, setText] = useState("");
  const [member, setMember] = useState<MemberId>(members[0]?.id ?? "");
  const formId = useId();
  const suggestionsId = `${formId}-suggestions`;
  const feedback = useListItemFeedback(items.map(item => ({ id: item.id, text: item.text, complete: itemIsDone(item, today) })));
  const list = items.filter(i => i.kind === kind && (kind === "shopping" || isMemberVisible(i.member)));
  if (kind !== "shopping") list.sort((a, b) => compareMembers(a.member, b.member));
  const completed = list.filter(i => itemIsDone(i, today));
  const presence: ListPresence = { itemIds: items.map(item => item.id), completedIds: completed.map(item => item.id) };
  const pending = list.filter(i => !itemIsDone(i, today));
  const shown = limit ? pending.slice(0, limit) : pending;
  const add = (name = text) => {
    if (!name.trim() || kind !== "shopping" && !member) return;
    const matches = list.filter(item => (kind === "shopping" || item.member === member) && itemName(item.text) === itemName(name));
    const existing = matches.find(item => !itemIsDone(item, today)) ?? matches[0];
    if (!existing) { if (!addItem(name, kind, member)) return; }
    else if (itemIsDone(existing, today)) { if (!toggleItem(existing.id)) return; }
    else toast.info(t("This item is already on the list."));
    setText(""); setAdding(false);
  };
  const row = (item: ListItem) => <CheckRow key={item.id} id={item.id} text={item.text} complete={itemIsDone(item, today)} member={kind !== "shopping" ? item.member : undefined} feedback={feedback.get(item.id)}
    onToggle={() => toggleItem(item.id)} onEdit={() => setEditing(item)} onRemove={!limit ? () => setRemoving(item) : undefined} />;
  return <article className={`glow-panel list-panel list-${kind}`}>
    <ListPanelSurface />
    <div className="list-composer">
      <PanelHeading title={message(listTitles[kind])} to={limit ? `/lists?tab=${kind}` : undefined} label={kind === "shopping" ? t("Shopping") : t("Tasks")} />
      <div className="list-action-bar"><span className="list-progress">{t(kind === "shopping" ? "{done} of {total} picked up" : "{done} of {total} done", { done: completed.length, total: list.length })}</span><Button className="list-add-button" variant={adding ? "outline" : "default"} aria-expanded={adding} aria-controls={formId} onClick={() => setAdding(!adding)}>{adding ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}{t(adding ? "Cancel" : kind === "shopping" ? "Add item" : "Add task")}</Button></div>
      {adding && <form id={formId} className="quick-add" onSubmit={e => { e.preventDefault(); add(); }}>
        <label className="quick-add-field"><span>{t(kind === "shopping" ? "Item" : "Task")}</span><input aria-label={kind === "shopping" ? t("New shopping item") : t(kind === "daily" ? "New daily task" : "New task")} aria-controls={suggestionsId} autoComplete="off" autoFocus required maxLength={120} value={text} onChange={e => setText(e.target.value)} placeholder={kind === "shopping" ? t("What do we need?") : t("What needs doing?")} /></label>
        {kind !== "shopping" && <select aria-label={t("Assign task")} value={member} onChange={e => setMember(e.target.value as MemberId)}><MemberOptions /></select>}
        <Button type="submit" disabled={!text.trim() || kind !== "shopping" && !member} aria-label={t(kind === "shopping" ? "Save shopping item" : kind === "daily" ? "Save daily item" : "Save tasks item")}>{t("Add")}</Button>
        <ItemSuggestions id={suggestionsId} names={list.filter(item => kind === "shopping" || item.member === member).map(item => item.text)} text={text} select={add} isDisabled={name => pending.some(item => (kind === "shopping" || item.member === member) && itemName(item.text) === itemName(name))} />
      </form>}
    </div>
    <div className="checklist"><AnimatePresence initial={false} mode="popLayout" custom={presence}>{shown.map(row)}</AnimatePresence></div>
    <AnimatePresence initial={false} mode="popLayout">{!pending.length && <ListEmptyNote key="empty" text={list.length ? t("All done.") : kind === "shopping" ? t("All stocked up. Add something when you need it.") : t("Nothing on the list. Enjoy the breathing room.")} />}</AnimatePresence>
    <AnimatePresence initial={false} mode="popLayout" custom={presence}>{!!completed.length && <CompletedItems key="completed" count={completed.length} presence={presence}>{completed.map(row)}</CompletedItems>}</AnimatePresence>
    {editing && <ItemEditor text={editing.text} kind={kind} description={t("Saved to the family planner.")} onSave={text => renameItem(editing.id, text)} onClose={() => setEditing(undefined)} />}
    {removing && <ConfirmDialog open onOpenChange={open => { if (!open) setRemoving(undefined); }} title={t("Remove item?")} description={t("Remove “{value1}” from the family planner? This cannot be undone.", { value1: removing.text })} confirmLabel={t("Remove item")} destructive onConfirm={() => deleteItem(removing.id)} />}
  </article>;
}
