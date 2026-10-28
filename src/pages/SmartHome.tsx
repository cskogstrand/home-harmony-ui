import { PanelTitle } from "@/components/PanelTitle";
import { useI18n } from "@/hooks/use-i18n";
import { entityDetailPath, smartHomeEntities } from "@/lib/device-model";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Thermometer, Lightbulb, ArrowUpRight, PlugZap, PencilLine, Check, Layers3 } from "lucide-react";
import { available, entityStateLabel, numberValue } from "@/lib/ha-model";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { SmartHomeCards } from "@/components/devices/SmartHomeCards";
import { Button } from "@/components/ui/button";
import { smartHomeCards } from "@/lib/smart-home-cards";
import { SettingsPopover } from "@/components/common/SettingsPopover";
import { PopoverClose } from "@/components/ui/popover";
export default function SmartHome() {
  const { t, message, language } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const { smartHome } = useFamily();
  const [area, setArea] = useState("all");
  const [editing, setEditing] = useState(false);
  const entities = smartHomeEntities(currentHome.entities, smartHome);
  const devices = smartHomeCards(currentHome.entities, smartHome);
  const areas = currentHome.areas.filter(room => devices.some(card => card.main?.areaId === room.id));
  if (area !== "all" && !areas.some(room => room.id === area)) setArea("all");
  const visibleDevices = devices.filter(card => area === "all" || card.main?.areaId === area);
  const lights = entities.filter(e => e.domain === "light");
  const lightsOn = lights.filter(e => e.state === "on").length;
  const climate = entities.find(e => e.domain === "climate");
  const temperature = climate && available(climate) ? numberValue(climate.attributes.current_temperature) : undefined;
  const alarms = entities.filter(e => e.domain === "alarm_control_panel");
  return <div className="planner-page smart-page"><PageHeading title={t("Smart home")}><div className="flex flex-wrap items-center gap-3"><span className={`connection-pill ${homeOnline ? "" : "attention"}`}><i />{homeOnline ? t("Connected") : t("Offline")}</span>
      {editing && <Button onClick={() => setEditing(false)}><Check size={17} aria-hidden="true" />{message("Done")}</Button>}
      <SettingsPopover label={t("Smart home settings")}>
        <PopoverClose asChild><Button variant="outline" aria-pressed={editing} onClick={() => setEditing(value => !value)}><PencilLine size={17} aria-hidden="true" />{message(editing ? "Done" : "Configure")}</Button></PopoverClose>
        {[["/settings/smart-home", "Manage cards"], ["/automations", "Automations"], ["/history", "Home activity"], ["/integrations", "Integrations"], ["/settings/connection", "Connection & settings"]].map(([to, label]) => <PopoverClose asChild key={to}><Link to={to} className="text-link min-h-11">{message(label)}<ArrowUpRight size={17} aria-hidden="true" /></Link></PopoverClose>)}
      </SettingsPopover>
    </div></PageHeading>
    {!!devices.length && <div className="smart-summary"><Link to="/devices"><Lightbulb /><span>{t("Lighting")}<strong>{homeOnline ? t(lightsOn === 1 ? "{count} visible light on" : "{count} visible lights on", { count: lightsOn }) : t("Offline")}</strong></span><ArrowUpRight size={18} /></Link><Link to={climate ? entityDetailPath(climate) : "/devices"}><Thermometer /><span>{t("Climate")}<strong>{!homeOnline ? t("Offline") : temperature !== undefined ? t("{temperature} {unit} inside", { temperature, unit: currentHome.temperatureUnit ?? "" }) : t(climate ? "No reading" : "No visible climate device")}</strong></span><ArrowUpRight size={18} /></Link><Link to="/alarm"><Shield /><span>{t("Security")}<strong>{!homeOnline ? t("Offline") : alarms.length ? alarms.map(alarm => entityStateLabel(alarm, language)).join(" · ") : t("No visible alarm")}</strong></span><ArrowUpRight size={18} /></Link></div>}
    <section><div className="section-heading"><div><PanelTitle icon={Layers3}>{message("Your cards")}</PanelTitle></div><Link to="/areas" className="text-link">{t("View areas")}<ArrowUpRight size={17} /></Link></div>
      {!!devices.length && <div className="filter-row"><button aria-pressed={area === "all"} onClick={() => setArea("all")}>{t("All areas")}</button>{areas.map(r => <button key={r.id} aria-pressed={area === r.id} onClick={() => setArea(r.id)}>{r.id === "unassigned" ? t("Unassigned") : r.name}</button>)}</div>}
      <SmartHomeCards key={area} cards={devices} area={area} editing={editing} />
      {!visibleDevices.length && <div className="glow-panel empty-note"><PlugZap size={32} aria-hidden="true" /><h3>{message(area === "all" ? "Make room for your home" : "No cards in this area")}</h3><p>{message("Choose a card type, then attach the entities you want to see.")}</p><Button asChild className="mt-4"><Link to="/settings/smart-home?card=new">{message("Add card")}</Link></Button></div>}
    </section>
  </div>;
}
