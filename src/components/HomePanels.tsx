import { msg, type Message } from "@/lib/i18n";
import { useI18n } from "@/hooks/use-i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CarFront, Sparkles, ArrowUpRight, SlidersHorizontal, Search, Volume2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { available, humanizeState, supportsAction } from "@/lib/ha-model";
import type { Entity } from "@/types/api";
import { DeviceIcon, CommandFeedback } from "@/components/devices/DeviceControl";
import { EntityCard } from "@/components/devices/EntityCard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PanelHeading } from "./FamilyPlanner";
export function MorningSummary() {
  const { t } = useI18n();
  const { currentHome, homeOnline, command, commands, services } = useApp();
  const { today } = useFamily();
  const summary = currentHome.entities.find(entity => entity.entityId === "sensor.afterglow_morning_summary");
  const scriptId = "script.morning_summary_voice";
  const script = currentHome.entities.find(entity => entity.entityId === scriptId);
  const running = script?.state === "on" || !!commands[scriptId]?.pending;
  const message = summary?.attributes.message;
  if (summary?.state !== today || typeof message !== "string" || !message.trim()) return null;
  return <section className="glow-panel col-span-full" aria-label={t("Morning summary")}>
    <div className="panel-heading">
      <h2>{t("Morning summary")}</h2>
      <div className="command-controller shrink-0" aria-busy={running}>
        <Button variant="outline" size="sm" title={running ? t("Preparing summary…") : t("Play summary")} disabled={!homeOnline || !script || !available(script) || !supportsAction(script, "turn_on", services) || running} onClick={() => { void command(scriptId, "turn_on").catch(() => {}); }}>
          <Volume2 size={16} aria-hidden="true" /><span className="sr-only sm:not-sr-only">{running ? t("Preparing summary…") : t("Play summary")}</span>
        </Button>
        {!commands[scriptId]?.error && <CommandFeedback entityId={scriptId} />}
      </div>
    </div>
    <p className="whitespace-pre-wrap break-words leading-relaxed">{message}</p>
    {commands[scriptId]?.error && <CommandFeedback entityId={scriptId} />}
    {!homeOnline && <p className="page-note">{t("Cached summary · Home Assistant is offline.")}</p>}
  </section>;
}
export function SceneButtons({ entities }: { entities?: Entity[] }) {
  const { t } = useI18n();
  const { currentHome, command, commands, homeOnline, services } = useApp();
  const [sceneId, setSceneId] = useState<string>();
  const scenes = entities ?? currentHome.entities.filter(e => e.domain === "scene");
  const selectedScene = scenes.find(scene => scene.entityId === sceneId);
  return <><div className="scene-buttons">{scenes.map(scene => <div key={scene.entityId} className="command-controller" aria-busy={!!commands[scene.entityId]?.pending}><button className="w-full" aria-label={t("Activate {value1}", { value1: scene.name })} disabled={!homeOnline || !available(scene) || !supportsAction(scene, "turn_on", services) || commands[scene.entityId]?.pending} onClick={() => setSceneId(scene.entityId)}><Sparkles size={20} aria-hidden="true" /><span>{scene.name}</span></button><CommandFeedback entityId={scene.entityId} /></div>)}</div>{!scenes.length && <p className="empty-note">{t("No scenes yet.")}</p>}
    {sceneId && <ConfirmDialog open onOpenChange={open => { if (!open) setSceneId(undefined); }} title={t("Activate scene?")} description={t("Activate “{value1}”? This applies its configured device changes in Home Assistant.", { value1: selectedScene?.name ?? sceneId })} confirmLabel={t("Activate scene")} disabled={!homeOnline || !selectedScene || !available(selectedScene) || !supportsAction(selectedScene, "turn_on", services) || commands[sceneId]?.pending} onConfirm={() => command(sceneId, "turn_on")} />}
  </>;
}
export function HomeFavorites() {
  const { t } = useI18n();
  const { currentHome, haUrl } = useApp();
  const { homeEntities, setHomeEntities } = useFamily();
  const [open, setOpen] = useState(false);
  const defaults = [...currentHome.entities.filter(e => ["light", "climate", "switch"].includes(e.domain)).slice(0, 3), ...currentHome.entities.filter(e => e.domain === "scene").slice(0, 4)].map(e => e.preferenceId);
  const selected = homeEntities ?? defaults;
  const entities = selected.flatMap(id => currentHome.entities.find(e => e.preferenceId === id) ?? []);
  const [sceneId, setSceneId] = useState<string>();
  const scenes = entities.filter(e => e.domain === "scene");
  const missing = selected.length - entities.length;
  return <section className="glow-panel home-favorites" aria-label={t("Home favorites")}>
    <div className="panel-heading"><h2>{t("Just right at home")}</h2><div className="favorite-heading-actions"><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button className="text-link" disabled={!haUrl}><SlidersHorizontal size={16} />{t("Customize")}</button></DialogTrigger><DialogContent className="favorites-dialog"><DialogHeader><DialogTitle>{t("Make home yours")}</DialogTitle><DialogDescription>{t("Choose your dashboard favorites.")}</DialogDescription></DialogHeader>{open && <FavoritePicker key={haUrl} selected={selected} onSave={ids => { if (setHomeEntities(ids)) setOpen(false); }} onCancel={() => setOpen(false)} />}</DialogContent></Dialog><Link className="text-link" to="/home">{t("All controls")}<ArrowUpRight size={16} /></Link></div></div>
    {!!entities.length && <div className="favorite-devices">{entities.filter(e => e.domain !== "scene").map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>}
    {!!scenes.length && <SceneButtons entities={scenes} />}
    {!selected.length && haUrl && <p className="empty-note">{t("No favorites selected.")}</p>}
    {!!missing && <p className="muted">{t(missing === 1 ? "{count} saved favorite is unavailable." : "{count} saved favorites are unavailable.", { count: missing })}</p>}
  </section>;
}
function FavoritePicker({ selected, onSave, onCancel }: { selected: string[]; onSave: (ids: string[]) => void; onCancel: () => void }) {
  const { t, message } = useI18n();
  const { currentHome } = useApp();
  const [draft, setDraft] = useState(selected);
  const [search, setSearch] = useState("");
  const [removal, setRemoval] = useState<{ ids: string[]; description: Message }>();
  const areaName = (entity: Entity) => currentHome.areas.find(a => a.id === entity.areaId && a.id !== "unassigned")?.name ?? "";
  const matches = currentHome.entities.filter(e => `${e.name} ${areaName(e)} ${e.entityId}`.toLowerCase().includes(search.toLowerCase()));
  const missing = draft.filter(id => !currentHome.entities.some(e => e.preferenceId === id));
  return <>
    <div className="favorite-search"><Search size={17} aria-hidden="true" /><Input aria-label={t("Search favorites")} placeholder={t("Search devices, rooms or scenes…")} value={search} onChange={e => setSearch(e.target.value)} /></div>
    <div className="favorite-picker" aria-label={t("Available favorites")}>{matches.map(entity => <label className="favorite-option" key={entity.preferenceId}><DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-5 w-5" /><span><strong>{entity.name}</strong><small>{[areaName(entity), ({ binary_sensor: t("Sensor"), alarm_control_panel: t("Alarm"), cover: t("Blinds"), climate: t("Thermostat") })[entity.domain] ?? message(humanizeState(entity.domain))].filter(Boolean).join(" · ")}</small></span><input type="checkbox" aria-label={entity.name} checked={draft.includes(entity.preferenceId)} onChange={e => e.target.checked ? setDraft(ids => [...ids, entity.preferenceId]) : setRemoval({ ids: draft.filter(id => id !== entity.preferenceId), description: msg("Remove “{name}” from your favorites selection? Save favorites to apply this change.", { name: entity.name }) })} /></label>)}
      {!matches.length && <p className="empty-note">{currentHome.entities.length ? t("No matches. Try another name or room.") : t("Connect your home to load devices.")}</p>}
      {missing.map(id => <label className="favorite-option" key={id}><span><strong>{t("Unavailable favorite")}</strong><small>{id.slice(id.indexOf("|") + 1)}</small></span><input type="checkbox" aria-label={t("Remove unavailable favorite {value1}", { value1: id })} checked onChange={() => setRemoval({ ids: draft.filter(value => value !== id), description: msg("Remove unavailable favorite “{name}” from your selection? Save favorites to apply this change.", { name: id.slice(id.indexOf("|") + 1) }) })} /></label>)}
    </div>
    <div className="favorite-picker-footer"><span>{t("{count} selected", { count: draft.length })}</span><Button variant="ghost" disabled={!draft.length} onClick={() => setRemoval({ ids: [], description: msg("Clear all favorites from your selection? Save favorites to apply this change to the dashboard.") })}>{t("Clear all")}</Button><Button variant="ghost" onClick={onCancel}>{t("Cancel")}</Button><Button onClick={() => onSave(draft)}>{t("Save favorites")}</Button></div>
    {removal && <ConfirmDialog open onOpenChange={open => { if (!open) setRemoval(undefined); }} title={t("Remove favorites?")} description={removal.description} confirmLabel={t("Remove favorites")} destructive onConfirm={() => setDraft(removal.ids)} />}
  </>;
}
export function VehicleCard() {
  const { t } = useI18n();
  return <article className="glow-panel vehicle-panel"><PanelHeading title={t("Ready for the road")} /><CarFront size={32} /><Link className="text-link" to="/devices">{t("Browse devices")}<ArrowUpRight size={17} /></Link></article>;
}
