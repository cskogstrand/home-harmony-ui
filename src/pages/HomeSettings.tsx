import { useState } from "react";
import { X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export default function HomeSettings() {
  const { haUrl, connect, disconnect, logout, connectionStatus, connectionError, currentHome, currentUser, metadataWarnings, sessionWarning, homeOnline } = useApp();
  const { members, memberName, calendarMembers, setCalendarMember } = useFamily();
  const calendars = currentHome.entities.filter(e => e.domain === "calendar");
  const [url, setUrl] = useState(haUrl);
  const busy = ["connecting", "syncing"].includes(connectionStatus);
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
    <section className="glow-panel" id="family-calendar"><PanelHeading title="People and calendars" />
      <p className="page-note">Add calendars to each person, or Everyone for shared plans. Choosing an assigned calendar moves it here.</p>
      {!homeOnline && <p role="status">Connect to Home Assistant to set up people and calendars.</p>}
      {homeOnline && !members.length && <p className="empty-note">Set up people in Home Assistant → Settings → People.</p>}
      {homeOnline && !calendars.length && <p className="empty-note">Set up a calendar integration in Home Assistant, then return here to assign it.</p>}
      {!!calendars.length && <div className="mt-3">{[...members, { id: "everyone", name: "Everyone" }].map(person => {
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
      <p className="page-note">Calendar selections are saved for this instance and planner on this browser. Home Assistant events are read-only here. Add local plans, lists and school timetable images in this app.</p>
    </section>
    <section className="glow-panel"><PanelHeading title="Your instance" /><dl className="device-readings"><div><dt>Name</dt><dd>{currentHome.name}</dd></div><div><dt>Signed in as</dt><dd>{currentUser?.name ?? "Not signed in"}</dd></div><div><dt>HA access</dt><dd>{currentUser ? currentUser.is_owner ? "Owner" : currentUser.is_admin ? "Administrator" : "User" : "—"}</dd></div><div><dt>Physical devices</dt><dd>{currentHome.devices.length}</dd></div><div><dt>Entities</dt><dd>{currentHome.entities.length}</dd></div></dl><p className="page-note">Home Assistant enforces permissions. Manage integrations, devices, areas, alarm settings and users there.</p>{haUrl && <a className="text-link" href={`${haUrl}/config`} target="_blank" rel="noreferrer">Open Home Assistant settings</a>}</section>
  </div>;
}
