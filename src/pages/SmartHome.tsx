import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Thermometer, Lightbulb, ArrowUpRight, AlertCircle, PlugZap } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { SceneButtons, VehicleCard } from "@/components/HomePanels";
import { DeviceControl, deviceValue, DeviceIcon } from "@/components/devices/DeviceControl";
import { Button } from "@/components/ui/button";

export default function SmartHome() {
  const { currentHome, homeOnline, setConnectionStatus } = useApp();
  const [room, setRoom] = useState("all");
  if (!currentHome) return null;
  const devices = currentHome.rooms.flatMap(r => r.devices);
  const lights = devices.filter(d => d.type.toLowerCase().includes("light"));
  const thermostat = devices.find(d => d.type === "thermostat");
  return <div className="planner-page smart-page"><PageHeading eyebrow="A HOME THAT LOOKS AFTER YOU" title="Everything, just right." description="Set the mood. Find a room. Make yourself comfortable."><span className={`connection-pill ${homeOnline ? "" : "attention"}`}><i />{homeOnline ? `${devices.filter(d => d.online).length} devices online` : "Hub offline"}</span></PageHeading>
    <div className="smart-summary"><Link to="/devices"><Lightbulb /><span>Lighting<strong>{lights.filter(d => deviceValue(d, "isOn")).length} lights on</strong></span><ArrowUpRight size={18} /></Link><Link to={thermostat ? `/devices/${thermostat.id}` : "/rooms"}><Thermometer /><span>Climate<strong>{thermostat ? `${deviceValue(thermostat, "currentTemperature")}° inside` : "No thermostat"}</strong></span><ArrowUpRight size={18} /></Link><Link to="/alarm"><Shield /><span>Security<strong>{currentHome.activeProfile?.mode === "disarmed" ? "Alarm disarmed" : "Alarm armed"}</strong></span><ArrowUpRight size={18} /></Link></div>
    {currentHome.warnings.length > 0 && <Link to="/notifications" className="home-alert"><AlertCircle size={22} /><span><strong>One thing needs a little attention.</strong><small>The smoke detector is offline. Check its battery.</small></span><ArrowUpRight size={19} /></Link>}
    <section className="glow-panel"><PanelHeading title="A mood for every moment" to="/moods" label="Scenes" /><SceneButtons /></section>
    <section><div className="section-heading"><div><span className="eyebrow">ROOM BY ROOM</span><h2>Your home, at your fingertips.</h2></div><Link to="/rooms" className="text-link">Manage rooms<ArrowUpRight size={17} /></Link></div>
      <div className="filter-row"><button aria-pressed={room === "all"} onClick={() => setRoom("all")}>All rooms</button>{currentHome.rooms.map(r => <button key={r.id} aria-pressed={room === r.id} onClick={() => setRoom(r.id)}>{r.name}</button>)}</div>
      <div className="home-device-grid">{currentHome.rooms.filter(r => room === "all" || room === r.id).flatMap(r => r.devices.map(device => <article className="glow-panel home-device" key={device.id}><Link to={`/devices/${device.id}`} className="home-device-title"><span className="device-symbol"><DeviceIcon type={device.type} className="h-6 w-6" /></span><ArrowUpRight size={17} /><h3>{device.name}</h3><small>{r.name} · {!homeOnline ? "Last known" : device.online ? device.displayType : "Offline"}</small></Link><DeviceControl device={device} /></article>))}</div>
      {devices.length === 0 && <div className="glow-panel empty-note"><PlugZap size={32} /><p>No devices in this home yet.</p><Link className="text-link" to="/devices">Open device setup<ArrowUpRight size={17} /></Link></div>}
    </section>
    <div className="smart-bottom"><VehicleCard /><section className="glow-panel"><PanelHeading title="A little more behind the scenes" /><div className="home-shortcuts"><Link to="/automation">Routines & automation<ArrowUpRight size={18} /></Link><Link to="/history">Home activity<ArrowUpRight size={18} /></Link><Link to="/services">Connected services<ArrowUpRight size={18} /></Link><Link to="/settings">Hub, people & settings<ArrowUpRight size={18} /></Link></div><Button variant="outline" onClick={() => setConnectionStatus(homeOnline ? "offline" : "connected")}>{homeOnline ? "Preview hub offline" : "Reconnect demo hub"}</Button></section></div>
    <p className="page-note">Demo controls only · Device changes last for this session. Routines and integrations are not connected to a live home.</p>
  </div>;
}
