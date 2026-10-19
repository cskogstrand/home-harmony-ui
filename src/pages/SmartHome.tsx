import { useI18n } from "@/hooks/use-i18n";
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
  const { t, language } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const [area, setArea] = useState("all");
  const entities = currentHome.entities;
  const devices = entities.filter(e => !["scene", "person", "calendar", "todo", "zone"].includes(e.domain));
  const lights = entities.filter(e => e.domain === "light");
  const climate = entities.find(e => e.domain === "climate");
  const temperature = climate && available(climate) ? numberValue(climate.attributes.current_temperature) : undefined;
  const alarms = entities.filter(e => e.domain === "alarm_control_panel");
  return <div className="planner-page smart-page"><PageHeading title={t("Smart home")}><span className={`connection-pill ${homeOnline ? "" : "attention"}`}><i />{homeOnline ? t("Connected") : t("Offline")}</span></PageHeading>
    <div className="smart-summary"><Link to="/devices"><Lightbulb /><span>{t("Lighting")}<strong>{homeOnline ? t("{value1} lights on", { value1: lights.filter(e => e.state === "on").length }) : t("Offline")}</strong></span><ArrowUpRight size={18} /></Link><Link to={climate ? entityDetailPath(climate) : "/devices"}><Thermometer /><span>{t("Climate")}<strong>{!homeOnline ? t("Offline") : temperature !== undefined ? t("{temperature} {unit} inside", { temperature, unit: currentHome.temperatureUnit ?? "" }) : t("No reading")}</strong></span><ArrowUpRight size={18} /></Link><Link to="/alarm"><Shield /><span>{t("Security")}<strong>{!homeOnline ? t("Offline") : alarms.length ? alarms.map(alarm => entityStateLabel(alarm, language)).join(" · ") : t("No alarm")}</strong></span><ArrowUpRight size={18} /></Link></div>
    {entities.some(e => e.domain === "scene") && <section className="glow-panel"><PanelHeading title={t("Set the mood")} to="/moods" label={t("Scenes")} /><SceneButtons /></section>}
    <section><div className="section-heading"><div><h2>{t("Your devices")}</h2></div><Link to="/areas" className="text-link">{t("View areas")}<ArrowUpRight size={17} /></Link></div>
      <div className="filter-row"><button aria-pressed={area === "all"} onClick={() => setArea("all")}>{t("All areas")}</button>{currentHome.areas.map(r => <button key={r.id} aria-pressed={area === r.id} onClick={() => setArea(r.id)}>{r.id === "unassigned" ? t("Unassigned") : r.name}</button>)}</div>
      <div className="home-device-grid">{devices.filter(e => area === "all" || e.areaId === area).map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>
      {!devices.length && <div className="glow-panel empty-note"><PlugZap size={32} /><p>{t("No devices available.")}</p><Link className="text-link" to="/settings">{t("Configure Home Assistant")}<ArrowUpRight size={17} /></Link></div>}
    </section>
    <div><section className="glow-panel"><PanelHeading title={t("Home settings")} /><div className="home-shortcuts"><Link to="/automations">{t("Automations")}<ArrowUpRight size={18} /></Link><Link to="/history">{t("Home activity")}<ArrowUpRight size={18} /></Link><Link to="/integrations">{t("Integrations")}<ArrowUpRight size={18} /></Link><Link to="/settings">{t("Connection & settings")}<ArrowUpRight size={18} /></Link></div></section></div>
  </div>;
}
