import { useI18n } from "@/hooks/use-i18n";
import { useEffect, useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, usePresenceData, useReducedMotion } from "framer-motion";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { useFamily, itemIsDone, type MemberId, type ListKind, type ListItem } from "@/contexts/FamilyContext";
import { available, supportsAction } from "@/lib/ha-model";
import type { TodoAction, TodoItem } from "@/types/api";
import { MemberAvatar, MemberOptions, PanelHeading } from "./FamilyPlanner";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./common/ConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";

const listTitles = { daily: "Daily rhythm", shopping: "Shopping", tasks: "Family tasks" };
const itemName = (name: string) => name.trim().toLocaleLowerCase();
function CheckRow({ id, text, complete, member, disabled, removeDisabled, onToggle, onEdit, onRemove }: {
  id: string; text: string; complete: boolean; member?: MemberId; disabled?: boolean; removeDisabled?: boolean;
  onToggle: () => void; onEdit: () => void; onRemove?: () => void;
}) {
  const { t } = useI18n();
  const present = useIsPresent();
  const completedIds: string[] = usePresenceData() ?? [];
  const reduceMotion = useReducedMotion();
  const completing = !present && completedIds.includes(id);
  const animateCompletion = completing && !reduceMotion;
  return <motion.div className="check-row-shell" aria-hidden={!present || undefined} initial={complete ? { height: 0, opacity: 0 } : false}
    animate={{ height: "auto", opacity: 1 }}
    transition={{ duration: reduceMotion ? 0 : .48, ease: [.4, 0, .2, 1] }}
    exit={{ height: 0, opacity: 0, transition: {
      height: { delay: animateCompletion ? .08 : 0, duration: animateCompletion ? .4 : 0, ease: [.4, 0, .2, 1] },
      opacity: { delay: animateCompletion ? .16 : 0, duration: animateCompletion ? .24 : 0, ease: "easeOut" },
    } }}>
    <div className={`check-row ${complete || completing ? "complete" : ""} ${completing ? "completing" : ""}`}>
      <label><input type="checkbox" aria-label={text} checked={complete || completing} disabled={disabled || !present} onChange={onToggle} /><span className="check-mark" aria-hidden="true"><Check size={16} /></span></label>
      <button className="edit-item" aria-label={t("Edit {value1}", { value1: text })} disabled={disabled || !present} onClick={onEdit}><span className="check-text">{text}</span>{member && <MemberAvatar member={member} small />}</button>
      {onRemove && <button className="icon-button delete-item" disabled={removeDisabled || !present} aria-label={t("Remove {value1}", { value1: text })} onClick={onRemove}><X size={16} /></button>}
    </div>
  </motion.div>;
}
function ListEmptyNote({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className="list-empty-note" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .48, ease: [.4, 0, .2, 1] }}>
    <p className="empty-note">{text}</p>
  </motion.div>;
}
function CompletedItems({ count, children }: { count: number; children: ReactNode }) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const present = useIsPresent();
  return <motion.details className="completed-items" aria-hidden={!present || undefined} initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: "auto", opacity: 1, marginTop: 12 }} exit={{ height: 0, opacity: 0, marginTop: 0 }} transition={{ duration: reduceMotion ? 0 : .48, ease: [.4, 0, .2, 1] }}>
    <summary tabIndex={present ? undefined : -1}>{t("Completed ({value1})", { value1: count })}</summary><div className="checklist"><AnimatePresence initial={false} propagate>{children}</AnimatePresence></div>
  </motion.details>;
}
function ItemEditor({ text, kind, description, disabled, error, onSave, onClose }: {
  text: string; kind: ListKind; description: string; disabled?: boolean; error?: string;
  onSave: (text: string) => boolean | Promise<boolean>; onClose: () => void;
}) {
  const { t, message } = useI18n();
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (disabled || saving || !draft.trim()) return;
    setSaving(true);
    try { if (await onSave(draft.trim())) onClose(); }
    finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="planner-dialog">
    <DialogHeader><DialogTitle>{kind === "shopping" ? t("Edit item") : t("Edit task")}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
    <form onSubmit={event => { event.preventDefault(); void save(); }}><fieldset className="planner-form" disabled={saving} aria-busy={saving}>
      <label>{kind === "shopping" ? t("Item") : t("Task")}<input autoFocus required maxLength={120} value={draft} onChange={event => setDraft(event.target.value)} /></label>
      {error && <p role="alert">{message(error)}</p>}
      <div className="form-actions"><Button type="button" variant="outline" onClick={onClose}>{t("Cancel")}</Button><Button type="submit" disabled={disabled || !draft.trim()}>{saving ? t("Saving…") : t("Save changes")}</Button></div>
    </fieldset></form>
  </DialogContent></Dialog>;
}
function ItemSuggestions({ id, names, text, select }: { id: string; names: string[]; text: string; select: (name: string) => void }) {
  const { t } = useI18n();
  const matches = text.trim() ? [...new Set(names)].filter(name => itemName(name).includes(itemName(text))).slice(0, 6) : [];
  return !!matches.length && <div id={id} className="flex basis-full flex-wrap items-center gap-2 pb-2" role="group" aria-label={t("Existing items")}>
    <span className="text-xs text-muted-foreground">{t("Existing items")}</span>
    {matches.map(name => <button type="button" key={name} className="rounded-full bg-secondary px-3 py-1 text-xs" onClick={() => select(name)}>{name}</button>)}
  </div>;
}
export function ListPanel({ kind, limit }: { kind: ListKind; limit?: number }) {
  const { t, message } = useI18n();
  const { connectedPlanner, todoLists, compareMembers, isMemberVisible } = useFamily();
  const { haUrl, homeOnline } = useApp();
  if (!connectedPlanner) return <LocalListPanel kind={kind} limit={limit} />;
  const lists = Object.entries(todoLists).filter(([, assigned]) => assigned.kind === kind && isMemberVisible(assigned.member))
    .sort(([, a], [, b]) => compareMembers(a.member, b.member));
  return <article className={`glow-panel list-panel list-${kind}`}>
    <PanelHeading title={message(listTitles[kind])} to={limit ? `/lists?tab=${kind}` : undefined} label={kind === "shopping" ? t("Shopping") : t("Tasks")} />
    {!lists.length && <p className="empty-note">{homeOnline ? t("No lists selected.") : t("Lists unavailable while offline.")}</p>}
    {lists.map(([id, assigned]) => <HomeAssistantList key={`${haUrl}|${id}|${assigned.member}`} preferenceId={id} member={assigned.member} kind={kind} limit={limit} />)}
  </article>;
}

function HomeAssistantList({ preferenceId, member, kind, limit }: { preferenceId: string; member: MemberId; kind: ListKind; limit?: number }) {
  const { t, message } = useI18n();
  const { currentHome, haUrl, homeOnline, todoItems, command, commands, services } = useApp();
  const { memberName } = useFamily();
  const entity = currentHome.entities.find(e => e.domain === "todo" && e.preferenceId === preferenceId);
  const entityId = entity?.entityId;
  const online = homeOnline && !!entity && available(entity);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; entityId?: string; items: TodoItem[]; error?: string }>({ key: "", items: [] });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TodoItem>();
  const [removing, setRemoving] = useState<TodoItem>();
  const [text, setText] = useState("");
  const suggestionsId = useId();
  const requestKey = `${haUrl}|${entityId}|${entity?.lastUpdated}|${entity?.state}|${refresh}`;
  useEffect(() => {
    if (!online) { setResult({ key: "", items: [] }); return; }
    let active = true;
    void todoItems(entityId).then(items => {
      if (active) setResult({ key: requestKey, entityId, items });
    }).catch((error: Error) => {
      if (active) setResult({ key: requestKey, entityId, items: [], error: error.message });
    });
    return () => { active = false; };
  }, [online, entityId, requestKey, todoItems]);
  const loading = online && result.key !== requestKey;
  // Keep the last rows mounted during refresh so confirmed completions can animate out.
  const hasResult = result.entityId === entityId && !!result.key;
  const items = online && hasResult ? result.items : [];
  const status = commands[entityId];
  const can = (action: TodoAction) => online && !loading && !result.error && !status?.pending && supportsAction(entity, action, services);
  const change = async (action: TodoAction, value: { item: string; status?: string; rename?: string }) => {
    try {
      await command(entityId, action, value);
      setRefresh(n => n + 1);
      return true;
    } catch { return false; /* The shared command state displays failures without replaying writes. */ }
  };
  const add = async () => {
    if (!can("add_item") || !text.trim()) return;
    const matches = items.filter(item => itemName(item.summary) === itemName(text));
    const existing = matches.find(item => item.status !== "completed") ?? matches[0];
    if (existing?.status === "completed" && !can("update_item")) { toast.error(t("This list cannot reopen completed items.")); return; }
    if (existing && existing.status !== "completed") toast.info(t("This item is already on the list."));
    else if (!await change(existing ? "update_item" : "add_item", existing ? { item: existing.uid, status: "needs_action" } : { item: text })) return;
    setText(""); setAdding(false);
  };
  const completed = items.filter(item => item.status === "completed");
  const pending = items.filter(item => item.status !== "completed");
  const shown = limit ? pending.slice(0, limit) : pending;
  const row = (item: TodoItem) => <CheckRow key={item.uid} id={item.uid} text={item.summary} complete={item.status === "completed"}
    disabled={!can("update_item")} removeDisabled={!can("remove_item")}
    onToggle={() => void change("update_item", { item: item.uid, status: item.status === "completed" ? "needs_action" : "completed" })}
    onEdit={() => setEditing(item)} onRemove={!limit ? () => setRemoving(item) : undefined} />;
  return <section role="group" aria-label={t(kind === "daily" ? "{name} daily tasks" : kind === "shopping" ? "{name} shopping" : "{name} tasks", { name: memberName(member) })} className="household-list" aria-busy={loading || !!status?.pending}>
    <div className="flex items-center gap-2"><MemberAvatar member={member} small /><h3 className="font-semibold">{kind === "shopping" ? t("Shared shopping list") : memberName(member)}</h3><span className="text-xs text-muted-foreground">{entity?.name ?? t("List unavailable")}</span></div>
    {!online ? <p className="empty-note">{homeOnline ? t("This to-do list is unavailable. Check it in Home Assistant or select another list in Home settings.") : t("To-do lists are unavailable while offline. Connect to Home Assistant to view and update them.")}</p> : <>
      {loading && !hasResult && <p role="status" className="page-note">{t("Loading to-do items…")}</p>}
      {hasResult && (result.error ? <p role="alert">{message(result.error)}</p> : <>
        <div className="list-toolbar"><button className="text-link" disabled={!can("add_item")} aria-expanded={adding} onClick={() => setAdding(!adding)}><Plus size={17} />{t(kind === "shopping" ? "Add item" : "Add task")}</button><span>{t(kind === "shopping" ? "{done} of {total} picked up" : "{done} of {total} done", { done: completed.length, total: items.length })}</span></div>
        {adding && <form className="quick-add" onSubmit={event => { event.preventDefault(); void add(); }}>
          <input aria-label={t("New item in {value1}", { value1: entity.name })} aria-controls={suggestionsId} autoComplete="off" autoFocus required maxLength={120} disabled={!can("add_item")} value={text} onChange={event => setText(event.target.value)} placeholder={kind === "shopping" ? t("What do we need?") : t("What needs doing?")} />
          <Button type="submit" disabled={!can("add_item")} aria-label={t("Save item to {value1}", { value1: entity.name })}><Plus size={19} /></Button>
          <ItemSuggestions id={suggestionsId} names={items.map(item => item.summary)} text={text} select={setText} />
        </form>}
        <div className="checklist"><AnimatePresence initial={false} custom={completed.map(item => item.uid)}>{shown.map(row)}</AnimatePresence></div>
        <AnimatePresence initial={false}>{!pending.length && <ListEmptyNote key="empty" text={items.length ? t("All done.") : t("This list is empty.")} />}</AnimatePresence>
        <AnimatePresence initial={false}>{!!completed.length && <CompletedItems key="completed" count={completed.length}>{completed.map(row)}</CompletedItems>}</AnimatePresence>
        {!(["add_item", "update_item", "remove_item"] as TodoAction[]).some(action => supportsAction(entity, action, services)) && <p className="page-note">{t("This list is read-only.")}</p>}
      </>)}
      {status?.error && <p role="alert" className="page-note">{message(status.error)}</p>}
      <div className="list-refresh"><button className="text-link" disabled={loading || status?.pending} onClick={() => setRefresh(n => n + 1)}>{t("Refresh list")}</button><span role="status" className="page-note">{status?.pending ? t("Updating list…") : loading && hasResult ? t("Refreshing list…") : ""}</span></div>
    </>}
    {editing && <ItemEditor text={editing.summary} kind={kind} description={t("Saved to {value1} in Home Assistant.", { value1: entity?.name ?? t("your list") })} disabled={!can("update_item")} error={status?.error} onSave={text => can("update_item") ? change("update_item", { item: editing.uid, rename: text }) : false} onClose={() => setEditing(undefined)} />}
    {removing && <ConfirmDialog open onOpenChange={open => { if (!open) setRemoving(undefined); }} title={t("Remove item?")} description={t("Remove “{value1}” from {value2} in Home Assistant? This cannot be undone.", { value1: removing.summary, value2: entity?.name ?? t("this list") })} confirmLabel={t("Remove item")} pendingLabel={t("Removing…")} destructive disabled={!can("remove_item") || !items.some(item => item.uid === removing.uid)} onConfirm={async () => {
      await command(entityId, "remove_item", { item: removing.uid });
      setRefresh(n => n + 1);
    }} />}
  </section>;
}

function LocalListPanel({ kind, limit }: { kind: ListKind; limit?: number }) {
  const { t, message } = useI18n();
  const { items, today, toggleItem, addItem, renameItem, deleteItem, compareMembers, isMemberVisible } = useFamily();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ListItem>();
  const [removing, setRemoving] = useState<ListItem>();
  const [text, setText] = useState("");
  const [member, setMember] = useState<MemberId>("everyone");
  const suggestionsId = useId();
  const list = items.filter(i => i.kind === kind && isMemberVisible(i.member));
  if (kind !== "shopping") list.sort((a, b) => compareMembers(a.member, b.member));
  const completed = list.filter(i => itemIsDone(i, today));
  const pending = list.filter(i => !itemIsDone(i, today));
  const shown = limit ? pending.slice(0, limit) : pending;
  const add = () => {
    if (!text.trim()) return;
    const matches = list.filter(item => (kind === "shopping" || item.member === member) && itemName(item.text) === itemName(text));
    const existing = matches.find(item => !itemIsDone(item, today)) ?? matches[0];
    if (!existing) { if (!addItem(text, kind, member)) return; }
    else if (itemIsDone(existing, today)) { if (!toggleItem(existing.id)) return; }
    else toast.info(t("This item is already on the list."));
    setText(""); setAdding(false);
  };
  const row = (item: ListItem) => <CheckRow key={item.id} id={item.id} text={item.text} complete={itemIsDone(item, today)} member={kind !== "shopping" ? item.member : undefined}
    onToggle={() => toggleItem(item.id)} onEdit={() => setEditing(item)} onRemove={!limit ? () => setRemoving(item) : undefined} />;
  return <article className={`glow-panel list-panel list-${kind}`}>
    <PanelHeading title={message(listTitles[kind])} to={limit ? `/lists?tab=${kind}` : undefined} label={kind === "shopping" ? t("Shopping") : t("Tasks")} />
    <div className="list-toolbar"><button className="text-link" aria-expanded={adding} onClick={() => setAdding(!adding)}><Plus size={17} />{t(kind === "shopping" ? "Add item" : "Add task")}</button><span>{t(kind === "shopping" ? "{done} of {total} picked up" : "{done} of {total} done", { done: completed.length, total: list.length })}</span></div>
    {adding && <form className="quick-add" onSubmit={e => { e.preventDefault(); add(); }}>
      <input aria-label={kind === "shopping" ? t("New shopping item") : t(kind === "daily" ? "New daily task" : "New task")} aria-controls={suggestionsId} autoComplete="off" autoFocus required maxLength={120} value={text} onChange={e => setText(e.target.value)} placeholder={kind === "shopping" ? t("What do we need?") : t("What needs doing?")} />
      {kind !== "shopping" && <select aria-label={t("Assign task")} value={member} onChange={e => setMember(e.target.value as MemberId)}><MemberOptions /></select>}
      <Button type="submit" aria-label={t(kind === "shopping" ? "Save shopping item" : kind === "daily" ? "Save daily item" : "Save tasks item")}><Plus size={19} /></Button>
      <ItemSuggestions id={suggestionsId} names={list.filter(item => kind === "shopping" || item.member === member).map(item => item.text)} text={text} select={setText} />
    </form>}
    <div className="checklist"><AnimatePresence initial={false} custom={completed.map(item => item.id)}>{shown.map(row)}</AnimatePresence></div>
    <AnimatePresence initial={false}>{!pending.length && <ListEmptyNote key="empty" text={list.length ? t("All done.") : kind === "shopping" ? t("All stocked up. Add something when you need it.") : t("Nothing on the list. Enjoy the breathing room.")} />}</AnimatePresence>
    <AnimatePresence initial={false}>{!!completed.length && <CompletedItems key="completed" count={completed.length}>{completed.map(row)}</CompletedItems>}</AnimatePresence>
    {editing && <ItemEditor text={editing.text} kind={kind} description={t("Saved to the family planner.")} onSave={text => renameItem(editing.id, text)} onClose={() => setEditing(undefined)} />}
    {removing && <ConfirmDialog open onOpenChange={open => { if (!open) setRemoving(undefined); }} title={t("Remove item?")} description={t("Remove “{value1}” from the family planner? This cannot be undone.", { value1: removing.text })} confirmLabel={t("Remove item")} destructive onConfirm={() => deleteItem(removing.id)} />}
  </article>;
}
