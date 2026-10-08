import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily, type ListKind } from "@/contexts/FamilyContext";
import { MemberAvatar, PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
export default function HomeSettings() {
  const { haUrl, connect, disconnect, logout, connectionStatus, connectionError, currentHome, currentUser, metadataWarnings, sessionWarning, homeOnline } = useApp();
  const { members, memberName, moveMember, compareMembers, hasTimetable, setTimetableEnabled, calendarMembers, setCalendarMember, todoLists, setTodoList } = useFamily();
  const calendars = currentHome.entities.filter(e => e.domain === "calendar");
  const lists = currentHome.entities.filter(e => e.domain === "todo");
  const listPeople = [{ id: "everyone", name: "Everyone" }, ...members, ...[...new Set(Object.values(todoLists).map(assigned => assigned.member))]
    .filter(id => id !== "everyone" && !members.some(person => person.id === id)).map(id => ({ id, name: "Person unavailable" }))].sort((a, b) => compareMembers(a.id, b.id));
  const [url, setUrl] = useState(haUrl);
  const busy = ["connecting", "syncing"].includes(connectionStatus);
  const listLabels = { tasks: "Tasks", daily: "Daily tasks", shopping: "Shared shopping list" };
  const listSelector = (kind: ListKind, person: { id: string; name: string }) => {
    const selected = Object.keys(todoLists).find(id => todoLists[id].kind === kind && todoLists[id].member === person.id) ?? "";
    return <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm"><span>{listLabels[kind]}</span>
      <select aria-label={`${listLabels[kind]} for ${person.name}`} className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm disabled:opacity-60" value={selected} disabled={!homeOnline} onChange={event => setTodoList(kind, person.id, event.target.value)}>
        <option value="">No list selected</option>
        {selected && !lists.some(list => list.preferenceId === selected) && <option value={selected}>List unavailable</option>}
        {lists.map(list => {
          const assigned = todoLists[list.preferenceId];
          return <option key={list.preferenceId} value={list.preferenceId}>{list.name}{assigned && list.preferenceId !== selected ? ` — move from ${memberName(assigned.member)} (${listLabels[assigned.kind]})` : ""}</option>;
        })}
      </select>
    </label>;
  };
  return <div className="planner-page"><PageHeading eyebrow="CONNECTED AT HOME" title="Home settings" description="Connect this screen directly to your local Home Assistant." />
    <section className="glow-panel"><PanelHeading title="Home Assistant connection" />
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void connect(url); }}>
        <label className="block space-y-2"><span>Home Assistant URL</span><Input type="url" required placeholder="http://homeassistant.local:8123" value={url} onChange={event => setUrl(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{busy ? "Connecting…" : "Connect"}</Button><Button type="button" variant="outline" onClick={disconnect}>Disconnect</Button><Button type="button" variant="outline" onClick={() => void logout()}>Log out</Button></div>
      </form>
      <p role="status" className="page-note">Connection: {connectionStatus}</p>
      {connectionError && <p role="alert" className="text-destructive">{connectionError}</p>}
      {sessionWarning && <p role="alert">{sessionWarning}</p>}
      {metadataWarnings.map(warning => <p key={warning} role="alert">{warning}</p>)}
      <p className="page-note">Sign in on Home Assistant’s own page. This browser remembers your login across refreshes, closed tabs and browser restarts. Disconnect pauses this tab; Connect resumes it. Log out clears the browser login, disconnects other open tabs and revokes this HA session.</p>
      <p className="page-note">Login is saved in this browser profile for this dashboard address, accessible to scripts from this app. Use a trusted device and Log out when finished. Private browsing, clearing site data or revoked credentials require signing in again.</p>
      <p className="page-note">Use HTTP with WS on your local network, or HTTPS with WSS and a certificate trusted by this browser. An HTTPS dashboard cannot connect to HTTP Home Assistant. Calendar reads also require this dashboard’s exact origin in HA’s CORS configuration.</p>
    </section>
    <section className="glow-panel" id="people-order"><PanelHeading title="People order and timetables" />
      <p className="page-note">Set the order used throughout the app: calendars, tasks, daily tasks, school timetables and person selectors. Everyone stays first; new people appear at the end.</p>
      <p className="page-note">Turn on Timetable for people who need a school card and dashboard preview. Turning it off keeps their saved image URLs.</p>
      {!members.length && <p className="empty-note">Connect to Home Assistant and set up people there to arrange them here.</p>}
      <ol aria-label="People order">{members.map((person, index) => <li key={person.id} className="flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
        <MemberAvatar member={person.id} small /><span className="min-w-0 flex-1 break-words font-medium">{person.name}</span>
        <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
          <label className="mr-auto flex items-center gap-2 text-sm sm:mr-0">Timetable<Switch aria-label={`Timetable for ${person.name}`} checked={hasTimetable(person.id)} onCheckedChange={enabled => setTimetableEnabled(person.id, enabled)} /></label>
          <Button type="button" variant="outline" size="icon" disabled={index === 0} aria-label={`Move ${person.name} up`} onClick={() => moveMember(person.id, -1)}><ArrowUp size={18} aria-hidden="true" /></Button>
          <Button type="button" variant="outline" size="icon" disabled={index === members.length - 1} aria-label={`Move ${person.name} down`} onClick={() => moveMember(person.id, 1)}><ArrowDown size={18} aria-hidden="true" /></Button>
        </div>
      </li>)}</ol>
      <p className="page-note">These settings are saved automatically for this household and planner in this browser.</p>
    </section>
    <section className="glow-panel" id="family-calendar"><PanelHeading title="People and calendars" />
      <p className="page-note">Add calendars to each person, or Everyone for shared plans. Choosing an assigned calendar moves it here.</p>
      {!homeOnline && <p role="status">Connect to Home Assistant to set up people and calendars.</p>}
      {homeOnline && !members.length && <p className="empty-note">Set up people in Home Assistant → Settings → People.</p>}
      {homeOnline && !calendars.length && <p className="empty-note">Set up a calendar integration in Home Assistant, then return here to assign it.</p>}
      {!!calendars.length && <div className="mt-3">{[{ id: "everyone", name: "Everyone" }, ...members].map(person => {
        const selected = calendars.filter(calendar => calendarMembers[calendar.preferenceId] === person.id);
        const available = calendars.filter(calendar => calendarMembers[calendar.preferenceId] !== person.id);
        return <div key={person.id} role="group" aria-label={person.name} className="flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
          <span className="w-28 shrink-0 break-words font-medium">{person.name}</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {selected.map(calendar => <span key={calendar.preferenceId} className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm">
              <span className="min-w-0 break-words">{calendar.name}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full" disabled={!homeOnline} aria-label={`Remove ${calendar.name} from ${person.name}`} onClick={() => setCalendarMember(calendar.preferenceId, "")}><X size={14} aria-hidden="true" /></Button>
            </span>)}
            {!selected.length && <span className="text-sm text-muted-foreground">No calendars selected</span>}
          </div>
          <select aria-label={`Add calendar for ${person.name}`} className="h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-60 sm:w-56" value="" disabled={!homeOnline || !available.length} onChange={e => { if (e.target.value) setCalendarMember(e.target.value, person.id); }}>
            <option value="" disabled>{available.length ? "Add calendar…" : "All calendars selected"}</option>
            {available.map(calendar => <option key={calendar.preferenceId} value={calendar.preferenceId}>{calendar.name}{calendarMembers[calendar.preferenceId] ? ` — move from ${memberName(calendarMembers[calendar.preferenceId])}` : ""}</option>)}
          </select>
        </div>;
      })}</div>}
      {haUrl && <div className="flex flex-wrap gap-4 mt-4"><a className="text-link" href={`${haUrl}/config/person`} target="_blank" rel="noreferrer">Manage people in Home Assistant</a><a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">Set up calendar integrations</a><a className="text-link" href={`${haUrl}/calendar`} target="_blank" rel="noreferrer">Open Home Assistant calendar</a></div>}
      <p className="page-note">Calendar selections are saved for this instance and planner on this browser. Home Assistant events are read-only here. Add local plans and school timetable images in this app.</p>
    </section>
    <section className="glow-panel" id="family-lists"><PanelHeading title="People and to-do lists" />
      <p className="page-note">Choose a task list and a daily task list for each person. Everyone’s lists are shared. Choosing an assigned list moves it here.</p>
      {!homeOnline && <p role="status">Connect to Home Assistant to set up to-do lists.</p>}
      {homeOnline && !lists.length && <p className="empty-note">Set up a Local to-do or Shopping list integration in Home Assistant, then select its lists here. To-do lists require Home Assistant 2023.11 or newer.</p>}
      {listPeople.map(person => <div key={person.id} role="group" aria-label={`To-do lists for ${person.name}`} className="flex flex-wrap items-center gap-3 border-b py-3">
        <span className="w-28 shrink-0 break-words font-medium">{person.name}</span>
        <div className="flex w-full min-w-0 flex-wrap gap-3 sm:w-auto sm:flex-1">{listSelector("tasks", person)}{listSelector("daily", person)}</div>
      </div>)}
      <div className="mt-3 max-w-md">{listSelector("shopping", { id: "everyone", name: "Everyone" })}</div>
      <p className="page-note">Adding, completing and removing items updates Home Assistant. Daily task lists need a Home Assistant automation to reset them each morning. Selections are saved for this instance and planner on this browser.</p>
      {haUrl && <div className="mt-3 flex flex-wrap gap-4"><a className="text-link" href={`${haUrl}/todo`} target="_blank" rel="noreferrer">Open to-do lists in Home Assistant</a><a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">Set up to-do integrations</a></div>}
    </section>
    <section className="glow-panel"><PanelHeading title="Your instance" /><dl className="device-readings"><div><dt>Name</dt><dd>{currentHome.name}</dd></div><div><dt>Signed in as</dt><dd>{currentUser?.name ?? "Not signed in"}</dd></div><div><dt>HA access</dt><dd>{currentUser ? currentUser.is_owner ? "Owner" : currentUser.is_admin ? "Administrator" : "User" : "—"}</dd></div><div><dt>Physical devices</dt><dd>{currentHome.devices.length}</dd></div><div><dt>Entities</dt><dd>{currentHome.entities.length}</dd></div></dl><p className="page-note">Home Assistant enforces permissions. Manage integrations, devices, areas, alarm settings and users there.</p>{haUrl && <a className="text-link" href={`${haUrl}/config`} target="_blank" rel="noreferrer">Open Home Assistant settings</a>}</section>
  </div>;
}
