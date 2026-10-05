import { Link } from "react-router-dom";
import { CarFront, PlugZap, Film, Sunrise, Moon, ArrowUpRight, Plane, AlertCircle } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { DeviceControl, deviceValue, DeviceIcon } from "@/components/devices/DeviceControl";
import { PanelHeading } from "./FamilyPlanner";

export function SceneButtons() {
  const { currentHome, activateMood, homeOnline } = useApp();
  const icons = { sunrise: Sunrise, film: Film, moon: Moon, plane: Plane };
  return <div className="scene-buttons">{currentHome?.moods?.map(mood => {
    const Icon = icons[mood.icon as keyof typeof icons] ?? Moon;
    return <button key={mood.id} disabled={!homeOnline} aria-pressed={!!mood.active} onClick={() => activateMood(mood.id)}><Icon size={20} /><span>{mood.name}</span></button>;
  })}</div>;
}
export function HomeFavorites() {
  const { currentHome, homeOnline } = useApp();
  const devices = currentHome?.rooms.flatMap(r => r.devices).filter(d => ["dev-1", "dev-2", "dev-3"].includes(d.id)) ?? [];
  return <article className="glow-panel home-favorites">
    <PanelHeading title="Just right at home" to="/home" label="All controls" />
    <div className="favorite-devices">{devices.map(device => <div key={device.id} className="favorite-device">
      <Link to={`/devices/${device.id}`} aria-label={device.name}><DeviceIcon type={device.type} className="h-5 w-5" /><span>{device.name.replace(" Thermostat", "").replace(" Light", "").replace(" Lock", "")}</span><ArrowUpRight size={14} /></Link>
      <DeviceControl device={device} compact />
    </div>)}</div>
    {devices.length === 0 && <p className="empty-note">No devices in this home yet.</p>}
    {devices.length > 0 && <SceneButtons />}
    {currentHome?.warnings.length > 0 && <Link to="/notifications" className="attention-link"><AlertCircle size={16} />Smoke detector needs attention<ArrowUpRight size={15} /></Link>}
    {!homeOnline && <p className="muted">Home controls are paused while the hub is offline.</p>}
  </article>;
}
export function VehicleCard({ detailed = false }: { detailed?: boolean }) {
  const { currentHome, homeOnline } = useApp();
  const charger = currentHome?.rooms.flatMap(r => r.devices).find(d => d.type === "evCharger");
  if (!charger) return <article className="glow-panel vehicle-panel"><PanelHeading title="Ready for the road" /><CarFront size={32} /><p className="muted">No vehicle charger in this home.</p></article>;
  const get = (name: string) => deviceValue(charger, name);
  return <article className={`glow-panel vehicle-panel ${detailed ? "detailed" : ""}`}>
    <PanelHeading title="Ready for the road" to={detailed ? undefined : "/energy"} label="Vehicle" />
    <div className="vehicle-main"><div><span className="eyebrow">FAMILY CAR</span><div className="battery-number">{String(get("batteryLevel"))}<span>%</span></div><p>{String(get("range"))} km range</p></div>
      <svg className="car-drawing" viewBox="0 0 300 125" fill="none" aria-hidden="true"><path d="m25 76 12-25 49-10 33-23h76l39 28 37 12 11 26-8 15H23Z" fill="currentColor" fillOpacity=".1" stroke="currentColor" strokeWidth="2" /><path d="m95 43 29-19h66l28 22-123-3ZM159 26v18M41 61l29-4M243 64l27 5M111 61h15M186 62h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M75 99h154" stroke="currentColor" strokeWidth="2" /><circle cx="69" cy="98" r="20" fill="var(--car-fill)" stroke="currentColor" strokeWidth="2" /><circle cx="69" cy="98" r="10" stroke="currentColor" /><circle cx="237" cy="98" r="20" fill="var(--car-fill)" stroke="currentColor" strokeWidth="2" /><circle cx="237" cy="98" r="10" stroke="currentColor" /></svg>
    </div>
    <div className="battery-track" role="meter" aria-label="Car battery" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(get("batteryLevel"))}><span style={{ width: `${get("batteryLevel")}%` }} /></div>
    <div className="charge-status"><span><PlugZap size={16} />{!homeOnline ? "Last known · Hub offline" : get("charging") ? `Charging · ${get("currentPower")} kW` : "Charging paused"}</span><span>Target {String(get("chargeLimit"))}%</span></div>
    {detailed && <DeviceControl device={charger} />}
  </article>;
}
