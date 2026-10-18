import { useSearchParams } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { Input } from "@/components/ui/input";
import { EntityCard } from "@/components/devices/EntityCard";
import { DeviceCard } from "@/components/devices/DeviceCard";
import { deviceGroups, deviceName, deviceSections, deviceType, type DeviceGrouping } from "@/lib/device-model";
export default function Devices() {
  const { currentHome, haUrl, connectionStatus, metadataWarnings } = useApp();
  const [params, setParams] = useSearchParams();
  const selected = params.get("group");
  const grouping = selected === "type" || selected === "none" ? selected : "room";
  const search = params.get("q") ?? "";
  const setView = (group: DeviceGrouping, q: string) => setParams({ group, ...(q ? { q } : {}) }, { replace: true });
  const listSearch = new URLSearchParams({ group: grouping, ...(search ? { q: search } : {}) }).toString();
  const query = search.trim().toLowerCase();
  const areaName = (id?: string) => currentHome.areas.find(area => area.id === id)?.name ?? "Unassigned";
  const entityMatches = (entity: typeof currentHome.entities[number]) => `${entity.name} ${entity.entityId} ${areaName(entity.areaId)}`.toLowerCase().includes(query);
  const devices = deviceGroups(currentHome).filter(({ device, entities }) =>
    `${deviceName(device)} ${device.manufacturer ?? ""} ${device.model ?? ""} ${areaName(device.area_id)} ${deviceType(entities)}`.toLowerCase().includes(query) || entities.some(entityMatches));
  const sections = deviceSections(devices, currentHome.areas, grouping);
  const other = currentHome.entities.filter(entity => !entity.device && entityMatches(entity));
  const loading = ["connecting", "syncing", "reconnecting"].includes(connectionStatus);
  return <div className="planner-page"><PageHeading eyebrow="YOUR CONNECTED HOME" title="Devices" />
    <div className="device-toolbar">
      <Input aria-label="Search devices" placeholder="Search devices, rooms or types…" value={search} onChange={e => setView(grouping, e.target.value)} />
      <fieldset className="device-grouping"><legend>Group by</legend><div className="filter-row">
        {([ ["room", "Room"], ["type", "Device type"], ["none", "None"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={grouping === value} onClick={() => setView(value, search)}>{label}</button>)}
      </div></fieldset>
    </div>
    {haUrl && <a className="text-link" href={`${haUrl}/config/devices/dashboard`} target="_blank" rel="noreferrer">Manage devices in Home Assistant</a>}
    {!!metadataWarnings.length && <p className="page-note" role="status">Device information may be incomplete. {metadataWarnings.join(" ")}</p>}
    {sections.map(section => <section key={section.id} className="device-group" aria-label={section.name}>
      <div className="panel-heading"><h2>{section.name}</h2><span>{section.devices.length} {section.devices.length === 1 ? "device" : "devices"}</span></div>
      <div className="device-list">{section.devices.map(({ device, entities }) => <DeviceCard key={device.id} device={device} entities={entities} listSearch={listSearch} />)}</div>
    </section>)}
    {!devices.length && <p className="glow-panel empty-note">{loading ? "Loading devices…" : query ? "No devices match your search." : metadataWarnings.length ? "Device information is unavailable. Check your Home Assistant connection and permissions." : haUrl ? "No registered devices found in this home." : "Connect your home in Settings to see your devices."}</p>}
    {!!other.length && <details key={query ? "search" : "browse"} open={query ? true : undefined} className="glow-panel device-details other-controls"><summary>Other controls ({other.length})</summary>
      <p className="page-note">Controls without an associated device.</p>
      <div className="home-device-grid">{other.map(entity => <EntityCard key={entity.entityId} entity={entity} listSearch={listSearch} />)}</div>
    </details>}
  </div>;
}
