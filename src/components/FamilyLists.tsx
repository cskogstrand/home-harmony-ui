import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { useFamily, itemIsDone, type MemberId, type ListKind } from "@/contexts/FamilyContext";
import { available, supportsAction } from "@/lib/ha-model";
import type { TodoAction, TodoItem } from "@/types/api";
import { MemberAvatar, MemberOptions, PanelHeading } from "./FamilyPlanner";
import { Button } from "./ui/button";

const listTitles = { daily: "Before we settle in", shopping: "Pick up on the way", tasks: "The bigger things" };
const listDescriptions = { daily: "A little help from everyone", shopping: "One list for the whole family", tasks: "Things to remember, without the rush" };
const itemName = (name: string) => name.trim().toLocaleLowerCase();
function ItemSuggestions({ id, names, text, select }: { id: string; names: string[]; text: string; select: (name: string) => void }) {
  const matches = text.trim() ? [...new Set(names)].filter(name => itemName(name).includes(itemName(text))).slice(0, 6) : [];
  return !!matches.length && <div id={id} className="flex basis-full flex-wrap items-center gap-2 pb-2" role="group" aria-label="Existing items">
    <span className="text-xs text-muted-foreground">Existing items</span>
    {matches.map(name => <button type="button" key={name} className="rounded-full bg-secondary px-3 py-1 text-xs" onClick={() => select(name)}>{name}</button>)}
  </div>;
}
export function ListPanel({ kind, limit }: { kind: ListKind; limit?: number }) {
  const { connectedPlanner, todoLists, compareMembers } = useFamily();
  const { haUrl, homeOnline, currentHome } = useApp();
  if (!connectedPlanner) return <LocalListPanel kind={kind} limit={limit} />;
  const lists = Object.entries(todoLists).filter(([, assigned]) => assigned.kind === kind)
    .sort(([, a], [, b]) => compareMembers(a.member, b.member));
  return <article className={`glow-panel list-panel list-${kind}`}>
    <PanelHeading title={listTitles[kind]} to={limit ? `/lists?tab=${kind}` : undefined} label={kind === "shopping" ? "Shopping" : "Tasks"} />
    {!lists.length && <p className="empty-note">{!homeOnline ? "Connect to Home Assistant to load your to-do lists." : currentHome.entities.some(e => e.domain === "todo") ? `Select ${kind === "shopping" ? "a shared shopping list" : kind === "daily" ? "daily task lists for your family" : "task lists for your family"} in Home settings.` : "Set up to-do lists in Home Assistant, then select them in Home settings."}</p>}
    {lists.map(([id, assigned]) => <HomeAssistantList key={`${haUrl}|${id}|${assigned.member}`} preferenceId={id} member={assigned.member} kind={kind} limit={limit} />)}
    <p className="page-note"><Link className="text-link" to="/settings#family-lists">Set up to-do lists</Link>{kind === "daily" && " · Daily resets are managed in Home Assistant."}</p>
  </article>;
}

function HomeAssistantList({ preferenceId, member, kind, limit }: { preferenceId: string; member: MemberId; kind: ListKind; limit?: number }) {
  const { currentHome, haUrl, homeOnline, todoItems, command, commands, services } = useApp();
  const { memberName } = useFamily();
  const entity = currentHome.entities.find(e => e.domain === "todo" && e.preferenceId === preferenceId);
  const entityId = entity?.entityId;
  const online = homeOnline && !!entity && available(entity);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; items: TodoItem[]; error?: string }>({ key: "", items: [] });
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const suggestionsId = useId();
  const requestKey = `${haUrl}|${entityId}|${entity?.lastUpdated}|${entity?.state}|${refresh}`;
  useEffect(() => {
    if (!online) { setResult({ key: "", items: [] }); return; }
    let active = true;
    void todoItems(entityId).then(items => {
      if (active) setResult({ key: requestKey, items });
    }).catch((error: Error) => {
      if (active) setResult({ key: requestKey, items: [], error: error.message });
    });
    return () => { active = false; };
  }, [online, entityId, requestKey, todoItems]);
  const loading = online && result.key !== requestKey;
  const items = online && !loading ? result.items : [];
  const status = commands[entityId];
  const can = (action: TodoAction) => online && !loading && !result.error && !status?.pending && supportsAction(entity, action, services);
  const change = async (action: TodoAction, value: { item: string; status?: string }) => {
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
    if (existing?.status === "completed" && !can("update_item")) { toast.error("This list cannot reopen completed items."); return; }
    if (existing && existing.status !== "completed") toast.info("This item is already on the list.");
    else if (!await change(existing ? "update_item" : "add_item", existing ? { item: existing.uid, status: "needs_action" } : { item: text })) return;
    setText(""); setAdding(false);
  };
  const completed = items.filter(item => item.status === "completed");
  const pending = items.filter(item => item.status !== "completed");
  const shown = limit ? pending.slice(0, limit) : pending;
  const row = (item: TodoItem) => <div key={item.uid} className={`check-row ${item.status === "completed" ? "complete" : ""}`}>
    <label><input type="checkbox" checked={item.status === "completed"} disabled={!can("update_item")} onChange={() => void change("update_item", { item: item.uid, status: item.status === "completed" ? "needs_action" : "completed" })} /><span className="check-mark"><Check size={16} /></span><span className="check-text">{item.summary}</span></label>
    {!limit && <button className="icon-button delete-item" disabled={!can("remove_item")} aria-label={`Remove ${item.summary}`} onClick={() => void change("remove_item", { item: item.uid })}><X size={16} /></button>}
  </div>;
  return <section role="group" aria-label={`${memberName(member)} ${kind === "daily" ? "daily tasks" : kind === "shopping" ? "shopping" : "tasks"}`} className="border-t pt-3 mt-3" aria-busy={loading || !!status?.pending}>
    <div className="flex items-center gap-2"><MemberAvatar member={member} small /><h3 className="font-semibold">{kind === "shopping" ? "Shared shopping list" : memberName(member)}</h3><span className="text-xs text-muted-foreground">{entity?.name ?? "List unavailable"}</span></div>
    {!online ? <p className="empty-note">{homeOnline ? "This to-do list is unavailable. Check it in Home Assistant or select another list in Home settings." : "To-do lists are unavailable while offline. Connect to Home Assistant to view and update them."}</p> : <>
      {loading ? <p role="status" className="page-note">Loading to-do items…</p> : result.error ? <p role="alert">{result.error}</p> : <>
        <div className="list-toolbar"><button className="text-link" disabled={!can("add_item")} aria-expanded={adding} onClick={() => setAdding(!adding)}><Plus size={17} />Add {kind === "shopping" ? "item" : "task"}</button><span>{completed.length} of {items.length} {kind === "shopping" ? "picked up" : "done"}</span></div>
        {adding && <form className="quick-add" onSubmit={event => { event.preventDefault(); void add(); }}>
          <input aria-label={`New item in ${entity.name}`} aria-controls={suggestionsId} autoComplete="off" autoFocus required maxLength={120} disabled={!can("add_item")} value={text} onChange={event => setText(event.target.value)} placeholder={kind === "shopping" ? "What do we need?" : "What needs doing?"} />
          <Button type="submit" disabled={!can("add_item")} aria-label={`Save item to ${entity.name}`}><Plus size={19} /></Button>
          <ItemSuggestions id={suggestionsId} names={items.map(item => item.summary)} text={text} select={setText} />
        </form>}
        <div className="checklist">{shown.map(row)}</div>
        {!pending.length && <p className="empty-note">{items.length ? "All done." : "This list is empty."}</p>}
        {!!completed.length && <details className="completed-items"><summary>Completed ({completed.length})</summary><div className="checklist">{completed.map(row)}</div></details>}
        {!(["add_item", "update_item", "remove_item"] as TodoAction[]).some(action => supportsAction(entity, action, services)) && <p className="page-note">This list is read-only.</p>}
      </>}
      {status?.error && <p role="alert" className="page-note">{status.error}</p>}
      {status?.pending && <p role="status" className="page-note">Updating list…</p>}
      <button className="text-link mt-2" disabled={loading || status?.pending} onClick={() => setRefresh(n => n + 1)}>Refresh list</button>
    </>}
  </section>;
}

function LocalListPanel({ kind, limit }: { kind: ListKind; limit?: number }) {
  const { items, today, toggleItem, addItem, deleteItem, compareMembers } = useFamily();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [member, setMember] = useState<MemberId>("everyone");
  const suggestionsId = useId();
  const list = items.filter(i => i.kind === kind);
  if (kind !== "shopping") list.sort((a, b) => compareMembers(a.member, b.member));
  const completed = list.filter(i => itemIsDone(i, today));
  const pending = list.filter(i => !itemIsDone(i, today));
  const shown = limit ? pending.slice(0, limit) : pending;
  const add = () => {
    if (!text.trim()) return;
    const matches = list.filter(item => (kind === "shopping" || item.member === member) && itemName(item.text) === itemName(text));
    const existing = matches.find(item => !itemIsDone(item, today)) ?? matches[0];
    if (!existing) addItem(text, kind, member);
    else if (itemIsDone(existing, today)) toggleItem(existing.id);
    else toast.info("This item is already on the list.");
    setText(""); setAdding(false);
  };
  const row = (item: (typeof list)[number]) => <div key={item.id} className={`check-row ${itemIsDone(item, today) ? "complete" : ""}`}>
    <label><input type="checkbox" checked={itemIsDone(item, today)} onChange={() => toggleItem(item.id)} /><span className="check-mark"><Check size={16} /></span><span className="check-text">{item.text}</span></label>
    {kind !== "shopping" && <MemberAvatar member={item.member} small />}
    {!limit && <button className="icon-button delete-item" aria-label={`Remove ${item.text}`} onClick={() => deleteItem(item.id)}><X size={16} /></button>}
  </div>;
  return <article className={`glow-panel list-panel list-${kind}`}>
    <PanelHeading title={listTitles[kind]} to={limit ? `/lists?tab=${kind}` : undefined} label={kind === "shopping" ? "Shopping" : "Tasks"} />
    {!limit && <p className="muted">{listDescriptions[kind]}{kind === "daily" ? " · Resets each day" : ""}</p>}
    <div className="list-toolbar"><button className="text-link" aria-expanded={adding} onClick={() => setAdding(!adding)}><Plus size={17} />Add {kind === "shopping" ? "item" : "task"}</button><span>{completed.length} of {list.length} {kind === "shopping" ? "picked up" : "done"}</span></div>
    {adding && <form className="quick-add" onSubmit={e => { e.preventDefault(); add(); }}>
      <input aria-label={kind === "shopping" ? "New shopping item" : `New ${kind} task`} aria-controls={suggestionsId} autoComplete="off" autoFocus required maxLength={120} value={text} onChange={e => setText(e.target.value)} placeholder={kind === "shopping" ? "What do we need?" : "What needs doing?"} />
      {kind !== "shopping" && <select aria-label="Assign task" value={member} onChange={e => setMember(e.target.value as MemberId)}><MemberOptions /></select>}
      <Button type="submit" aria-label={`Save ${kind} item`}><Plus size={19} /></Button>
      <ItemSuggestions id={suggestionsId} names={list.filter(item => kind === "shopping" || item.member === member).map(item => item.text)} text={text} select={setText} />
    </form>}
    <div className="checklist">{shown.map(row)}</div>
    {!pending.length && <p className="empty-note">{list.length ? "All done." : kind === "shopping" ? "All stocked up. Add something when you need it." : "Nothing on the list. Enjoy the breathing room."}</p>}
    {!!completed.length && <details className="completed-items"><summary>Completed ({completed.length})</summary><div className="checklist">{completed.map(row)}</div></details>}
  </article>;
}
