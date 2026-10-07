import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily, itemIsDone, type MemberId, type ListKind } from "@/contexts/FamilyContext";
import { available, supportsAction } from "@/lib/ha-model";
import type { TodoAction, TodoItem } from "@/types/api";
import { MemberAvatar, MemberOptions, PanelHeading } from "./FamilyPlanner";
import { Button } from "./ui/button";

const listTitles = { daily: "Before we settle in", shopping: "Pick up on the way", tasks: "The bigger things" };
const listDescriptions = { daily: "A little help from everyone", shopping: "One list for the whole family", tasks: "Things to remember, without the rush" };
export function ListPanel({ kind, limit }: { kind: ListKind; limit?: number }) {
  const { connectedPlanner, todoLists, memberName } = useFamily();
  const { haUrl, homeOnline, currentHome } = useApp();
  if (!connectedPlanner) return <LocalListPanel kind={kind} limit={limit} />;
  const lists = Object.entries(todoLists).filter(([, assigned]) => assigned.kind === kind)
    .sort(([, a], [, b]) => Number(b.member === "everyone") - Number(a.member === "everyone") || memberName(a.member).localeCompare(memberName(b.member)));
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
      if (action === "add_item") { setText(""); setAdding(false); }
      setRefresh(n => n + 1);
    } catch { /* The shared command state displays failures without replaying writes. */ }
  };
  const done = items.filter(item => item.status === "completed").length;
  const shown = limit ? [...items].sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed")).slice(0, limit) : items;
  return <section role="group" aria-label={`${memberName(member)} ${kind === "daily" ? "daily tasks" : kind === "shopping" ? "shopping" : "tasks"}`} className="border-t pt-3 mt-3" aria-busy={loading || !!status?.pending}>
    <div className="flex items-center gap-2"><MemberAvatar member={member} small /><h3 className="font-semibold">{kind === "shopping" ? "Shared shopping list" : memberName(member)}</h3><span className="text-xs text-muted-foreground">{entity?.name ?? "List unavailable"}</span></div>
    {!online ? <p className="empty-note">{homeOnline ? "This to-do list is unavailable. Check it in Home Assistant or select another list in Home settings." : "To-do lists are unavailable while offline. Connect to Home Assistant to view and update them."}</p> : <>
      {loading ? <p role="status" className="page-note">Loading to-do items…</p> : result.error ? <p role="alert">{result.error}</p> : <>
        <div className="checklist">{shown.map(item => <div key={item.uid} className={`check-row ${item.status === "completed" ? "complete" : ""}`}>
          <label><input type="checkbox" checked={item.status === "completed"} disabled={!can("update_item")} onChange={() => void change("update_item", { item: item.uid, status: item.status === "completed" ? "needs_action" : "completed" })} /><span className="check-mark"><Check size={16} /></span><span className="check-text">{item.summary}</span></label>
          {!limit && <button className="icon-button delete-item" disabled={!can("remove_item")} aria-label={`Remove ${item.summary}`} onClick={() => void change("remove_item", { item: item.uid })}><X size={16} /></button>}
        </div>)}</div>
        {!items.length && <p className="empty-note">This list is empty.</p>}
        {!(["add_item", "update_item", "remove_item"] as TodoAction[]).some(action => supportsAction(entity, action, services)) && <p className="page-note">This list is read-only.</p>}
        <div className="list-footer"><span>{done} of {items.length} {kind === "shopping" ? "picked up" : "done"}</span><button className="text-link" disabled={!can("add_item")} aria-expanded={adding} onClick={() => setAdding(!adding)}><Plus size={17} />Add {kind === "shopping" ? "item" : "task"}</button></div>
        {adding && <form className="quick-add" onSubmit={event => { event.preventDefault(); if (can("add_item") && text.trim()) void change("add_item", { item: text }); }}>
          <input aria-label={`New item in ${entity.name}`} autoFocus required maxLength={120} disabled={!can("add_item")} value={text} onChange={event => setText(event.target.value)} placeholder="What needs doing?" />
          <Button type="submit" disabled={!can("add_item")} aria-label={`Save item to ${entity.name}`}><Plus size={19} /></Button>
        </form>}
      </>}
      {status?.error && <p role="alert" className="page-note">{status.error}</p>}
      {status?.pending && <p role="status" className="page-note">Updating list…</p>}
      <button className="text-link mt-2" disabled={loading || status?.pending} onClick={() => setRefresh(n => n + 1)}>Refresh list</button>
    </>}
  </section>;
}

function LocalListPanel({ kind, limit }: { kind: ListKind; limit?: number }) {
  const { items, today, toggleItem, addItem, deleteItem } = useFamily();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [member, setMember] = useState<MemberId>("everyone");
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
