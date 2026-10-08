import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { Input } from "@/components/ui/input";
import { EntityCard } from "@/components/devices/EntityCard";
import { DeviceCard } from "@/components/devices/DeviceCard";
import { deviceGroups, deviceName } from "@/lib/device-model";
export default function Devices() {
  const { currentHome, haUrl, connectionStatus, metadataWarnings } = useApp();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const areaName = (id?: string) => currentHome.areas.find(area => area.id === id)?.name ?? "Unassigned";
  const entityMatches = (entity: typeof currentHome.entities[number]) => `${entity.name} ${entity.entityId} ${areaName(entity.areaId)}`.toLowerCase().includes(query);
  const devices = deviceGroups(currentHome).filter(({ device, entities }) =>
    `${deviceName(device)} ${device.manufacturer ?? ""} ${device.model ?? ""} ${areaName(device.area_id)}`.toLowerCase().includes(query) || entities.some(entityMatches));
  const other = currentHome.entities.filter(entity => !entity.device && entityMatches(entity));
  const loading = ["connecting", "syncing", "reconnecting"].includes(connectionStatus);
  return <div className="planner-page"><PageHeading eyebrow="YOUR CONNECTED HOME" title="Devices" description="Find a device, then explore its controls and readings." />
    <Input aria-label="Search devices" placeholder="Search devices or rooms…" value={search} onChange={e => setSearch(e.target.value)} />
    {haUrl && <a className="text-link" href={`${haUrl}/config/devices/dashboard`} target="_blank" rel="noreferrer">Manage devices in Home Assistant</a>}
    {!!metadataWarnings.length && <p className="page-note" role="status">Device information may be incomplete. {metadataWarnings.join(" ")}</p>}
    <div className="home-device-grid">{devices.map(({ device, entities }) => <DeviceCard key={device.id} device={device} entities={entities} />)}</div>
    {!devices.length && <p className="glow-panel empty-note">{loading ? "Loading devices…" : query ? "No devices match your search." : metadataWarnings.length ? "Device information is unavailable. Check your Home Assistant connection and permissions." : haUrl ? "No registered devices found in this home." : "Connect your home in Settings to see your devices."}</p>}
    {!!other.length && <details key={query ? "search" : "browse"} open={query ? true : undefined} className="glow-panel device-details other-controls"><summary>Other controls ({other.length})</summary>
      <p className="page-note">These controls and readings have no associated device in the loaded home information.</p>
      <div className="home-device-grid">{other.map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>
    </details>}
  </div>;
}
