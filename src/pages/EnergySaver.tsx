import { Link } from "react-router-dom";
import { Zap, Leaf, ArrowUpRight } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { VehicleCard } from "@/components/HomePanels";
import { DeviceControl } from "@/components/devices/DeviceControl";
export default function EnergySaver() {
  const { currentHome } = useApp();
  const devices = currentHome?.rooms.flatMap(r => r.devices).filter(d => d.eligibleForEnergySaver && d.type !== "evCharger") ?? [];
  const usage = [18, 12, 10, 14, 16, 29, 54, 72, 55, 38, 28, 32, 43, 35, 41, 65, 90, 78, 53, 45, 38, 24, 20, 14];
  return <div className="planner-page energy-page"><PageHeading eyebrow="TAKE CARE OF TOMORROW" title="Home, charged & ready." description="The family car and the energy that keeps everything going." /><div className="energy-layout"><VehicleCard detailed /><section className="glow-panel"><PanelHeading title="A gentler energy day" /><div className="energy-stats"><div><Zap size={22} /><strong>18.6 <small>kWh</small></strong><span>Sample usage today</span></div><div><Leaf size={22} /><strong>0.85 <small>NOK</small></strong><span>Sample price / kWh</span></div></div><div className="energy-bars" role="img" aria-label="Illustrative hourly energy consumption, with morning and evening peaks">{usage.map((value, i) => <span key={i} style={{ height: `${value}%` }} />)}</div><div className="chart-labels"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div><p className="page-note">Illustrative readings · Live energy data is not connected.</p></section></div>
    <section className="glow-panel"><PanelHeading title="Keep things comfortable" to="/home" label="Smart home" /><div className="energy-devices">{devices.map(device => <div key={device.id}><Link to={`/devices/${device.id}`}>{device.name}<ArrowUpRight size={16} /></Link><DeviceControl device={device} /></div>)}{devices.length === 0 && <p className="muted">No energy-saving devices in this home.</p>}</div></section></div>;
}
