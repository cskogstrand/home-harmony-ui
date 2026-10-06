import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export default function HomeSettings() {
  const { haUrl, connect, disconnect, logout, connectionStatus, connectionError, currentHome, currentUser, metadataWarnings } = useApp();
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
      {metadataWarnings.map(warning => <p key={warning} role="alert">{warning}</p>)}
      <p className="page-note">Sign in on Home Assistant’s own page. Tokens stay in memory; reloading this screen requires Connect again. Only the instance URL is saved.</p>
      <p className="page-note">Use HTTP with WS on your local network, or HTTPS with WSS and a certificate trusted by this browser. An HTTPS dashboard cannot connect to HTTP Home Assistant. Calendar reads also require this dashboard’s exact origin in HA’s CORS configuration.</p>
    </section>
    <section className="glow-panel"><PanelHeading title="Your instance" /><dl className="device-readings"><div><dt>Name</dt><dd>{currentHome.name}</dd></div><div><dt>Signed in as</dt><dd>{currentUser?.name ?? "Not signed in"}</dd></div><div><dt>HA access</dt><dd>{currentUser ? currentUser.is_owner ? "Owner" : currentUser.is_admin ? "Administrator" : "User" : "—"}</dd></div><div><dt>Physical devices</dt><dd>{currentHome.devices.length}</dd></div><div><dt>Entities</dt><dd>{currentHome.entities.length}</dd></div></dl><p className="page-note">Home Assistant enforces permissions. Manage integrations, devices, areas, alarm settings and users there.</p>{haUrl && <a className="text-link" href={`${haUrl}/config`} target="_blank" rel="noreferrer">Open Home Assistant settings</a>}</section>
  </div>;
}
