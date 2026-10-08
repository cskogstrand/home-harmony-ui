import { entityDetailPath } from "@/lib/device-model";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Thermometer, Lightbulb, ArrowUpRight, PlugZap } from "lucide-react";
import { available, entityStateLabel, numberValue } from "@/lib/ha-model";
import { useApp } from "@/contexts/AppContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { SceneButtons } from "@/components/HomePanels";
import { EntityCard } from "@/components/devices/EntityCard";
export default function SmartHome() {
  const { currentHome, homeOnline } = useApp();
  const [area, setArea] = useState("all");
  const entities = currentHome.entities;
  const lights = entities.filter(e => e.domain === "light");
  const climate = entities.find(e => e.domain === "climate");
  const temperature = climate && available(climate) ? numberValue(climate.attributes.current_temperature) : undefined;
  const alarms = entities.filter(e => e.domain === "alarm_control_panel");
  return <div className="planner-page smart-page"><PageHeading eyebrow="A HOME THAT LOOKS AFTER YOU" title="Everything, just right."><span className={`connection-pill ${homeOnline ? "" : "attention"}`}><i />{homeOnline ? "Connected" : "Offline"}</span></PageHeading>
    <div className="smart-summary"><Link to="/devices"><Lightbulb /><span>Lighting<strong>{homeOnline ? `${lights.filter(e => e.state === "on").length} lights on` : "Offline"}</strong></span><ArrowUpRight size={18} /></Link><Link to={climate ? entityDetailPath(climate) : "/devices"}><Thermometer /><span>Climate<strong>{!homeOnline ? "Offline" : temperature !== undefined ? `${temperature} ${currentHome.temperatureUnit ?? ""} inside` : "No reading"}</strong></span><ArrowUpRight size={18} /></Link><Link to="/alarm"><Shield /><span>Security<strong>{alarms.length ? homeOnline ? alarms.map(entityStateLabel).join(" · ") : "Offline" : "No alarm"}</strong></span><ArrowUpRight size={18} /></Link></div>
    {entities.some(e => e.domain === "scene") && <section className="glow-panel"><PanelHeading title="Set the mood" to="/moods" label="Scenes" /><SceneButtons /></section>}
    <section><div className="section-heading"><div><span className="eyebrow">AROUND YOUR HOME</span><h2>Your devices</h2></div><Link to="/areas" className="text-link">View areas<ArrowUpRight size={17} /></Link></div>
      <div className="filter-row"><button aria-pressed={area === "all"} onClick={() => setArea("all")}>All areas</button>{currentHome.areas.map(r => <button key={r.id} aria-pressed={area === r.id} onClick={() => setArea(r.id)}>{r.name}</button>)}</div>
      <div className="home-device-grid">{entities.filter(e => e.domain !== "scene" && (area === "all" || e.areaId === area)).map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>
      {!entities.length && <div className="glow-panel empty-note"><PlugZap size={32} /><p>Connect your home to get started.</p><Link className="text-link" to="/settings">Configure Home Assistant<ArrowUpRight size={17} /></Link></div>}
    </section>
    <div><section className="glow-panel"><PanelHeading title="Home settings" /><div className="home-shortcuts"><Link to="/automations">Automations<ArrowUpRight size={18} /></Link><Link to="/history">Home activity<ArrowUpRight size={18} /></Link><Link to="/integrations">Integrations<ArrowUpRight size={18} /></Link><Link to="/settings">Connection & settings<ArrowUpRight size={18} /></Link></div></section></div>
  </div>;
}
