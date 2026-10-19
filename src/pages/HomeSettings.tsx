import { msg, type Message } from "@/lib/i18n";
import { useI18n } from "@/hooks/use-i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily, type ListKind } from "@/contexts/FamilyContext";
import { MemberAvatar, PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { MemberColorPicker } from "@/components/MemberColorPicker";
export default function HomeSettings() {
  const { t, message } = useI18n();
  const { haUrl, connect, disconnect, connectionStatus, connectionError, currentHome, currentUser, metadataWarnings, homeOnline } = useApp();
  const { allMembers: members, memberName, memberColor, moveMember, compareMembers, isMemberVisible, setMemberVisible, hasTimetable, setTimetableEnabled, calendarMembers, setCalendarMember, todoLists, setTodoList } = useFamily();
  const calendars = currentHome.entities.filter(e => e.domain === "calendar");
  const lists = currentHome.entities.filter(e => e.domain === "todo");
  const listPeople = [{ id: "everyone", name: t("Everyone") }, ...members, ...[...new Set(Object.values(todoLists).map(assigned => assigned.member))]
    .filter(id => id !== "everyone" && !members.some(person => person.id === id)).map(id => ({ id, name: t("Person unavailable") }))].sort((a, b) => compareMembers(a.id, b.id));
  const [confirmation, setConfirmation] = useState<{ title: Message; description: Message; confirmLabel: Message; onConfirm: () => void | Promise<void>; requiresConnection?: boolean }>();
  const busy = ["connecting", "syncing"].includes(connectionStatus);
  const listLabels = { tasks: "Tasks", daily: "Daily tasks", shopping: "Shared shopping list" } as const;
  const memberMessage = (id: string) => id === "everyone" ? msg("Everyone") : members.find(person => person.id === id)?.name ?? msg("Person unavailable");
  const changeList = (kind: ListKind, person: { id: string; name: string }, list: string, selected: string) => {
    if (list === selected) return;
    const assigned = todoLists[list];
    const onConfirm = () => setTodoList(kind, person.id, list);
    if (!selected && !assigned) { onConfirm(); return; }
    const listName = (id: string) => lists.find(item => item.preferenceId === id)?.name ?? msg("Unavailable list");
    setConfirmation({ title: list ? msg("Change to-do list?") : msg("Unlink to-do list?"), confirmLabel: list ? msg("Change list") : msg("Unlink list"), requiresConnection: true, onConfirm,
      description: msg("{value1}{value2}Items stay in Home Assistant.", { value1: selected ? msg("Unlink “{value1}” from {value2} ({value3}). ", { value1: listName(selected), value2: memberMessage(person.id), value3: msg(listLabels[kind]) }) : "", value2: assigned ? msg("Move “{value1}” from {value2} ({value3}) to {value4} ({value5}). ", { value1: listName(list), value2: memberMessage(assigned.member), value3: msg(listLabels[assigned.kind]), value4: memberMessage(person.id), value5: msg(listLabels[kind]) }) : list ? msg("Use “{value1}” for {value2} ({value3}). ", { value1: listName(list), value2: memberMessage(person.id), value3: msg(listLabels[kind]) }) : "" }) });
  };
  const changeCalendar = (id: string, member: string) => {
    const previous = calendarMembers[id];
    if (!previous) { setCalendarMember(id, member); return; }
    const name = calendars.find(calendar => calendar.preferenceId === id)?.name ?? msg("Calendar");
    setConfirmation({ title: member ? msg("Move calendar?") : msg("Unlink calendar?"), confirmLabel: member ? msg("Move calendar") : msg("Unlink calendar"), requiresConnection: true,
      description: msg("{value1} “{value2}” from {value3}{value4}? Events stay in the source calendar.", { value1: member ? msg("Move") : msg("Unlink"), value2: name, value3: memberMessage(previous), value4: member ? msg(" to {name}", { name: memberMessage(member) }) : "" }), onConfirm: () => setCalendarMember(id, member) });
  };
  const listSelector = (kind: ListKind, person: { id: string; name: string }) => {
    const selected = Object.keys(todoLists).find(id => todoLists[id].kind === kind && todoLists[id].member === person.id) ?? "";
    return <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm"><span>{t(listLabels[kind])}</span>
      <select aria-label={t("{list} for {name}", { list: msg(listLabels[kind]), name: person.name })} className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm disabled:opacity-60" value={selected} disabled={!homeOnline} onChange={event => changeList(kind, person, event.target.value, selected)}>
        <option value="">{t("No list selected")}</option>
        {selected && !lists.some(list => list.preferenceId === selected) && <option value={selected}>{t("List unavailable")}</option>}
        {lists.map(list => {
          const assigned = todoLists[list.preferenceId];
          return <option key={list.preferenceId} value={list.preferenceId}>{list.name}{assigned && list.preferenceId !== selected ? t(" — move from {value1} ({value2})", { value1: memberName(assigned.member), value2: msg(listLabels[assigned.kind]) }) : ""}</option>;
        })}
      </select>
    </label>;
  };
  return <div className="planner-page"><PageHeading title={t("Home settings")}><Button variant="outline" asChild><Link to="/onboarding">{t("Get started")}</Link></Button></PageHeading>
    <section className="glow-panel" id="connection"><PanelHeading title={t("Home Assistant connection")} />
      <p>{t("Home Assistant: {value1}", { value1: haUrl || t("Loading server configuration…") })}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void connect()}>{busy ? t("Connecting…") : t("Reconnect")}</Button><Button variant="outline" onClick={() => setConfirmation({ title: msg("Disconnect Home Assistant?"), description: msg("Pause live controls in this tab until you reconnect or reload? Shared settings remain available."), confirmLabel: msg("Disconnect"), onConfirm: disconnect })}>{t("Disconnect")}</Button></div>
      <p role="status" className="page-note">{t("Connection: {value1}", { value1: message(connectionStatus) })}</p>
      {connectionError && <p role="alert" className="text-destructive">{message(connectionError)}</p>}
      {metadataWarnings.map(warning => <p key={warning} role="alert">{message(warning)}</p>)}
    </section>
    <section className="glow-panel" id="people-order"><PanelHeading title={t("People, colors and timetables")} />
      <p className="page-note">{t("Person colors appear in calendars, lists and timetables on every screen.")}</p>
      <div className="flex items-center gap-3 border-b py-3">
        <MemberAvatar member="everyone" small /><span className="min-w-0 flex-1 break-words font-medium">{t("Everyone")}</span>
        <MemberColorPicker person={{ id: "everyone", name: t("Everyone"), initials: t("All"), color: memberColor("everyone") }} />
      </div>
      {!members.length && <p className="empty-note">{t("No people available.")}</p>}
      <ol aria-label={t("People order")}>{members.map((person, index) => <li key={person.id} className="flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
        <MemberAvatar member={person.id} small /><span className="min-w-0 flex-1 break-words font-medium">{person.name}</span>
        <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
          <label className="flex items-center gap-2 text-sm">{t("Visible")}<Switch aria-label={t("Show {value1} in family planner", { value1: person.name })} checked={isMemberVisible(person.id)} onCheckedChange={visible => setMemberVisible(person.id, visible)} /></label>
          <label className="mr-auto flex items-center gap-2 text-sm sm:mr-0">{t("Timetable")}<Switch aria-label={t("Timetable for {value1}", { value1: person.name })} checked={hasTimetable(person.id)} onCheckedChange={enabled => enabled ? setTimetableEnabled(person.id, true) : setConfirmation({ title: msg("Hide timetable?"), description: msg("Hide {name}’s timetable from School and the dashboard? Saved image URLs will be kept.", { name: person.name }), confirmLabel: msg("Hide timetable"), onConfirm: () => setTimetableEnabled(person.id, false) })} /></label>
          <Button type="button" variant="outline" size="icon" disabled={index === 0} aria-label={t("Move {value1} up", { value1: person.name })} onClick={() => moveMember(person.id, -1)}><ArrowUp size={18} aria-hidden="true" /></Button>
          <Button type="button" variant="outline" size="icon" disabled={index === members.length - 1} aria-label={t("Move {value1} down", { value1: person.name })} onClick={() => moveMember(person.id, 1)}><ArrowDown size={18} aria-hidden="true" /></Button>
          <MemberColorPicker person={person} />
        </div>
      </li>)}</ol>
    </section>
    <section className="glow-panel" id="family-calendar"><PanelHeading title={t("People and calendars")} />
      {!homeOnline && <p role="status">{t("Calendars unavailable while offline.")}</p>}
      {homeOnline && !calendars.length && <p className="empty-note">{t("No calendars available.")}</p>}
      {!!calendars.length && <div className="mt-3">{[{ id: "everyone", name: t("Everyone") }, ...members].map(person => {
        const selected = calendars.filter(calendar => calendarMembers[calendar.preferenceId] === person.id);
        const available = calendars.filter(calendar => calendarMembers[calendar.preferenceId] !== person.id);
        return <div key={person.id} role="group" aria-label={person.name} className="flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
          <span className="w-28 shrink-0 break-words font-medium">{person.name}</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {selected.map(calendar => <span key={calendar.preferenceId} className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm">
              <span className="min-w-0 break-words">{calendar.name}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full" disabled={!homeOnline} aria-label={t("Remove {value1} from {value2}", { value1: calendar.name, value2: memberMessage(person.id) })} onClick={() => changeCalendar(calendar.preferenceId, "")}><X size={14} aria-hidden="true" /></Button>
            </span>)}
            {!selected.length && <span className="text-sm text-muted-foreground">{t("No calendars selected")}</span>}
          </div>
          <select aria-label={t("Add calendar for {value1}", { value1: person.name })} className="h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-60 sm:w-56" value="" disabled={!homeOnline || !available.length} onChange={e => { if (e.target.value) changeCalendar(e.target.value, person.id); }}>
            <option value="" disabled>{available.length ? t("Add calendar…") : t("All calendars selected")}</option>
            {available.map(calendar => <option key={calendar.preferenceId} value={calendar.preferenceId}>{calendar.name}{calendarMembers[calendar.preferenceId] ? t(" — move from {value1}", { value1: memberName(calendarMembers[calendar.preferenceId]) }) : ""}</option>)}
          </select>
        </div>;
      })}</div>}
    </section>
    <section className="glow-panel" id="family-lists"><PanelHeading title={t("People and to-do lists")} />
      {!homeOnline && <p role="status">{t("Lists unavailable while offline.")}</p>}
      {homeOnline && !lists.length && <p className="empty-note">{t("No to-do lists available.")}</p>}
      {listPeople.map(person => <div key={person.id} role="group" aria-label={t("To-do lists for {value1}", { value1: person.name })} className="flex flex-wrap items-center gap-3 border-b py-3">
        <span className="w-28 shrink-0 break-words font-medium">{person.name}</span>
        <div className="flex w-full min-w-0 flex-wrap gap-3 sm:w-auto sm:flex-1">{listSelector("tasks", person)}{listSelector("daily", person)}</div>
      </div>)}
      <div className="mt-3 max-w-md">{listSelector("shopping", { id: "everyone", name: t("Everyone") })}</div>
    </section>
    <section className="glow-panel"><PanelHeading title={t("Your instance")} /><dl className="device-readings"><div><dt>{t("Name")}</dt><dd>{currentHome.name}</dd></div><div><dt>{t("Signed in as")}</dt><dd>{currentUser?.name ?? t("Not signed in")}</dd></div><div><dt>{t("HA access")}</dt><dd>{currentUser ? currentUser.is_owner ? t("Owner") : currentUser.is_admin ? t("Administrator") : t("User") : "—"}</dd></div><div><dt>{t("Physical devices")}</dt><dd>{currentHome.devices.length}</dd></div><div><dt>{t("Entities")}</dt><dd>{currentHome.entities.length}</dd></div></dl>{haUrl && <a className="text-link" href={`${haUrl}/config`} target="_blank" rel="noreferrer">{t("Open Home Assistant settings")}</a>}</section>
    {confirmation && <ConfirmDialog open onOpenChange={open => { if (!open) setConfirmation(undefined); }} {...confirmation} destructive disabled={confirmation.requiresConnection && !homeOnline} />}
  </div>;
}
