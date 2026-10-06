import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Thermometer, Lightbulb, ArrowUpRight, PlugZap } from "lucide-react";
import { available, numberValue } from "@/lib/ha-model";
import { useApp } from "@/contexts/AppContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { SceneButtons, VehicleCard } from "@/components/HomePanels";
import { EntityCard } from "@/components/devices/EntityCard";
export default function SmartHome() {
  const { currentHome, homeOnline } = useApp();
  const [room, setRoom] = useState("all");
  const entities = currentHome.entities;
  const lights = entities.filter(e => e.domain === "light");
  const climate = entities.find(e => e.domain === "climate");
  const temperature = climate && available(climate) ? numberValue(climate.attributes.current_temperature) : undefined;
  const alarms = entities.filter(e => e.domain === "alarm_control_panel");
  return <div className="planner-page smart-page"><PageHeading eyebrow="A HOME THAT LOOKS AFTER YOU" title="Everything, just right." description="Set the mood. Find a room. Make yourself comfortable."><span className={`connection-pill ${homeOnline ? "" : "attention"}`}><i />{homeOnline ? `${entities.length} entities` : "Home Assistant offline"}</span></PageHeading>
    <div className="smart-summary"><Link to="/devices"><Lightbulb /><span>Lighting<strong>{homeOnline ? `${lights.filter(e => e.state === "on").length} lights on` : "Readings stale"}</strong></span><ArrowUpRight size={18} /></Link><Link to={climate ? `/devices/${climate.entityId}` : "/devices"}><Thermometer /><span>Climate<strong>{!homeOnline ? "Readings stale" : temperature !== undefined ? `${temperature} ${currentHome.temperatureUnit ?? ""} inside` : "Temperature not reported"}</strong></span><ArrowUpRight size={18} /></Link><Link to="/alarm"><Shield /><span>Security<strong>{alarms.length ? homeOnline ? alarms.map(e => e.state.replace(/_/g, " ")).join(" · ") : "Alarm state stale" : "No alarm configured"}</strong></span><ArrowUpRight size={18} /></Link></div>
    <section className="glow-panel"><PanelHeading title="A mood for every moment" to="/moods" label="Scenes" /><SceneButtons /></section>
    <section><div className="section-heading"><div><span className="eyebrow">ROOM BY ROOM</span><h2>Your home, at your fingertips.</h2></div><Link to="/rooms" className="text-link">View rooms<ArrowUpRight size={17} /></Link></div>
      <div className="filter-row"><button aria-pressed={room === "all"} onClick={() => setRoom("all")}>All rooms</button>{currentHome.rooms.map(r => <button key={r.id} aria-pressed={room === r.id} onClick={() => setRoom(r.id)}>{r.name}</button>)}</div>
      <div className="home-device-grid">{entities.filter(e => room === "all" || e.areaId === room).map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>
      {!entities.length && <div className="glow-panel empty-note"><PlugZap size={32} /><p>No Home Assistant entities loaded.</p><Link className="text-link" to="/settings">Configure Home Assistant<ArrowUpRight size={17} /></Link></div>}
    </section>
    <div className="smart-bottom"><VehicleCard /><section className="glow-panel"><PanelHeading title="A little more behind the scenes" /><div className="home-shortcuts"><Link to="/automation">Routines & automation<ArrowUpRight size={18} /></Link><Link to="/history">Home activity<ArrowUpRight size={18} /></Link><Link to="/services">Connected services<ArrowUpRight size={18} /></Link><Link to="/settings">Connection & settings<ArrowUpRight size={18} /></Link></div></section></div>
  </div>;
}
