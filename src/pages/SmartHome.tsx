import { NotificationList } from "@/components/NotificationCenter";
import { PanelTitle } from "@/components/PanelTitle";
import { useI18n } from "@/hooks/use-i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, PlugZap, PencilLine, Check, Layers3, Plus } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { SmartHomeCards } from "@/components/devices/SmartHomeCards";
import { Button } from "@/components/ui/button";
import { smartHomeCards } from "@/lib/smart-home-cards";
import { SettingsPopover } from "@/components/common/SettingsPopover";
import { PopoverClose } from "@/components/ui/popover";
import { RecentActivity } from "@/components/ActivityFeed";
export default function SmartHome() {
  const { t, message } = useI18n();
  const { currentHome, homeOnline, haUrl } = useApp();
  const { smartHome } = useFamily();
  const [area, setArea] = useState("all");
  const [editing, setEditing] = useState(false);
  const devices = smartHomeCards(currentHome.entities, smartHome);
  const areas = currentHome.areas.filter(room => devices.some(card => card.main?.areaId === room.id));
  if (area !== "all" && !areas.some(room => room.id === area)) setArea("all");
  const visibleDevices = devices.filter(card => area === "all" || card.main?.areaId === area);
  return <div className="planner-page smart-page"><PageHeading title={t("Smart home")}><div className="flex flex-wrap items-center gap-3"><span className={`connection-pill ${homeOnline ? "" : "attention"}`}><i />{homeOnline ? t("Connected") : t("Offline")}</span>
      {editing && <Button onClick={() => setEditing(false)}><Check size={17} aria-hidden="true" />{message("Done")}</Button>}
      <SettingsPopover label={t("Smart home settings")}>
        <PopoverClose asChild><Button variant="outline" aria-pressed={editing} onClick={() => setEditing(value => !value)}><PencilLine size={17} aria-hidden="true" />{message(editing ? "Done" : "Arrange cards")}</Button></PopoverClose>
        {[["/settings/smart-home", "Edit cards"], ["/automations", "Automations"], ["/settings/activity", "Activity"], ["/settings/connection", "Connection & settings"]].map(([to, label]) => <PopoverClose asChild key={to}><Link to={to} className="text-link min-h-11">{message(label)}<ArrowUpRight size={17} aria-hidden="true" /></Link></PopoverClose>)}
        {haUrl && <a className="text-link min-h-11" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">{t("Open Home Assistant integrations")}<ArrowUpRight size={17} aria-hidden="true" /></a>}
      </SettingsPopover>
    </div></PageHeading>
    <NotificationList compact />
    <section><div className="section-heading"><div><PanelTitle icon={Layers3}>{message("Your cards")}</PanelTitle></div><div className="flex flex-wrap items-center gap-3"><Link to="/areas" className="text-link">{t("View areas")}<ArrowUpRight size={17} /></Link>{!!devices.length && <Button asChild variant="outline"><Link to="/settings/smart-home?card=new"><Plus size={17} aria-hidden="true" />{t("Add card")}</Link></Button>}</div></div>
      {!!devices.length && <div className="filter-row"><button aria-pressed={area === "all"} onClick={() => setArea("all")}>{t("All areas")}</button>{areas.map(r => <button key={r.id} aria-pressed={area === r.id} onClick={() => setArea(r.id)}>{r.id === "unassigned" ? t("Unassigned") : r.name}</button>)}</div>}
      <SmartHomeCards key={area} cards={devices} area={area} editing={editing} />
      {!visibleDevices.length && <div className="glow-panel empty-note"><PlugZap size={32} aria-hidden="true" /><h3>{message(area === "all" ? "Make room for your home" : "No cards in this area")}</h3><p>{message("Choose a card type, then attach the entities you want to see.")}</p><Button asChild className="mt-4"><Link to="/settings/smart-home?card=new">{message("Add card")}</Link></Button></div>}
    </section>
    <RecentActivity />
  </div>;
}
