import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { Input } from "@/components/ui/input";
import { EntityCard } from "@/components/devices/EntityCard";
export default function Devices() {
  const { currentHome, haUrl } = useApp();
  const [search, setSearch] = useState("");
  const entities = currentHome.entities.filter(e => `${e.name} ${e.entityId} ${currentHome.areas.find(a => a.id === e.areaId)?.name ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="planner-page"><PageHeading eyebrow="YOUR CONNECTED HOME" title="Devices" description="Your everyday controls, all in one place." />
    <Input aria-label="Search devices" placeholder="Search devices or rooms…" value={search} onChange={e => setSearch(e.target.value)} />
    {haUrl && <a className="text-link" href={`${haUrl}/config/devices/dashboard`} target="_blank" rel="noreferrer">Manage devices in Home Assistant</a>}
    <div className="home-device-grid">{entities.map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>
    {!entities.length && <p className="glow-panel empty-note">No devices found. Try another search or connect your home in Settings.</p>}
  </div>;
}
