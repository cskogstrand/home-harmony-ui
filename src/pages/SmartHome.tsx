import { useI18n } from "@/hooks/use-i18n";
import { entityDetailPath, smartHomeEntities } from "@/lib/device-model";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Thermometer, Lightbulb, ArrowUpRight, PlugZap, PencilLine, Check } from "lucide-react";
import { available, entityStateLabel, numberValue } from "@/lib/ha-model";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { SceneButtons } from "@/components/HomePanels";
import { SmartHomeCards } from "@/components/devices/SmartHomeCards";
import { Button } from "@/components/ui/button";
import { smartHomeCards } from "@/lib/smart-home-cards";
export default function SmartHome() {
  const { t, message, language } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const { smartHome } = useFamily();
  const [area, setArea] = useState("all");
  const [editing, setEditing] = useState(false);
  const entities = smartHomeEntities(currentHome.entities, smartHome);
  const devices = smartHomeCards(currentHome.entities, smartHome);
  const areas = currentHome.areas.filter(room => devices.some(card => card.main.areaId === room.id));
  if (area !== "all" && !areas.some(room => room.id === area)) setArea("all");
  const hasDevices = smartHomeEntities(currentHome.entities).some(e => e.domain !== "scene");
  const visibleDevices = devices.filter(card => area === "all" || card.main.areaId === area);
  const scenes = entities.filter(e => e.domain === "scene");
  const lights = entities.filter(e => e.domain === "light");
  const lightsOn = lights.filter(e => e.state === "on").length;
  const climate = entities.find(e => e.domain === "climate");
  const temperature = climate && available(climate) ? numberValue(climate.attributes.current_temperature) : undefined;
  const alarms = entities.filter(e => e.domain === "alarm_control_panel");
  return <div className="planner-page smart-page"><PageHeading title={t("Smart home")}><div className="flex flex-wrap items-center gap-3"><span className={`connection-pill ${homeOnline ? "" : "attention"}`}><i />{homeOnline ? t("Connected") : t("Offline")}</span><Button variant={editing ? "default" : "outline"} aria-pressed={editing} onClick={() => setEditing(value => !value)}>{editing ? <Check size={17} /> : <PencilLine size={17} />}{message(editing ? "Done" : "Configure")}</Button></div></PageHeading>
    <div className="smart-summary"><Link to="/devices"><Lightbulb /><span>{t("Lighting")}<strong>{homeOnline ? t(lightsOn === 1 ? "{count} visible light on" : "{count} visible lights on", { count: lightsOn }) : t("Offline")}</strong></span><ArrowUpRight size={18} /></Link><Link to={climate ? entityDetailPath(climate) : "/devices"}><Thermometer /><span>{t("Climate")}<strong>{!homeOnline ? t("Offline") : temperature !== undefined ? t("{temperature} {unit} inside", { temperature, unit: currentHome.temperatureUnit ?? "" }) : t(climate ? "No reading" : "No visible climate device")}</strong></span><ArrowUpRight size={18} /></Link><Link to="/alarm"><Shield /><span>{t("Security")}<strong>{!homeOnline ? t("Offline") : alarms.length ? alarms.map(alarm => entityStateLabel(alarm, language)).join(" · ") : t("No visible alarm")}</strong></span><ArrowUpRight size={18} /></Link></div>
    {!!scenes.length && <section className="glow-panel"><PanelHeading title={t("Set the mood")} to="/moods" label={t("Scenes")} /><SceneButtons entities={scenes} /></section>}
    <section><div className="section-heading"><div><h2>{t("Your devices")}</h2></div><div className="flex flex-wrap gap-4"><Link to="/settings#smart-home-visibility" className="text-link">{t("Choose visible devices")}<ArrowUpRight size={17} /></Link><Link to="/areas" className="text-link">{t("View areas")}<ArrowUpRight size={17} /></Link></div></div>
      <div className="filter-row"><button aria-pressed={area === "all"} onClick={() => setArea("all")}>{t("All areas")}</button>{areas.map(r => <button key={r.id} aria-pressed={area === r.id} onClick={() => setArea(r.id)}>{r.id === "unassigned" ? t("Unassigned") : r.name}</button>)}</div>
      <SmartHomeCards key={area} cards={devices} area={area} editing={editing} />
      {!visibleDevices.length && <div className="glow-panel empty-note"><PlugZap size={32} /><p>{t(!hasDevices ? "No devices available." : area === "all" ? "No devices visible on Smart home." : "No visible devices in this area.")}</p><Link className="text-link" to={hasDevices ? "/settings#smart-home-visibility" : "/settings#connection"}>{t(hasDevices ? "Choose visible devices" : "Configure Home Assistant")}<ArrowUpRight size={17} /></Link></div>}
    </section>
    <div><section className="glow-panel"><PanelHeading title={t("Home settings")} /><div className="home-shortcuts"><Link to="/automations">{t("Automations")}<ArrowUpRight size={18} /></Link><Link to="/history">{t("Home activity")}<ArrowUpRight size={18} /></Link><Link to="/integrations">{t("Integrations")}<ArrowUpRight size={18} /></Link><Link to="/settings">{t("Connection & settings")}<ArrowUpRight size={18} /></Link></div></section></div>
  </div>;
}
