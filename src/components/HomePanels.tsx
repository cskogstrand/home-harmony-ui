import { useState } from "react";
import { Link } from "react-router-dom";
import { CarFront, Sparkles, ArrowUpRight, SlidersHorizontal, Search } from "lucide-react";
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
export function SceneButtons({ entities }: { entities?: Entity[] }) {
  const { currentHome, command, commands, homeOnline, services } = useApp();
  const [sceneId, setSceneId] = useState<string>();
  const scenes = entities ?? currentHome.entities.filter(e => e.domain === "scene");
  const selectedScene = scenes.find(scene => scene.entityId === sceneId);
  return <><div className="scene-buttons">{scenes.map(scene => <div key={scene.entityId} className="command-controller" aria-busy={!!commands[scene.entityId]?.pending}><button className="w-full" aria-label={`Activate ${scene.name}`} disabled={!homeOnline || !available(scene) || !supportsAction(scene, "turn_on", services) || commands[scene.entityId]?.pending} onClick={() => setSceneId(scene.entityId)}><Sparkles size={20} aria-hidden="true" /><span>{scene.name}</span></button><CommandFeedback entityId={scene.entityId} /></div>)}</div>{!scenes.length && <p className="empty-note">No scenes yet.</p>}
    {sceneId && <ConfirmDialog open onOpenChange={open => { if (!open) setSceneId(undefined); }} title="Activate scene?" description={`Activate “${selectedScene?.name ?? sceneId}”? This applies its configured device changes in Home Assistant.`} confirmLabel="Activate scene" disabled={!homeOnline || !selectedScene || !available(selectedScene) || !supportsAction(selectedScene, "turn_on", services) || commands[sceneId]?.pending} onConfirm={() => command(sceneId, "turn_on")} />}
  </>;
}
export function HomeFavorites() {
  const { currentHome, haUrl } = useApp();
  const { homeEntities, setHomeEntities } = useFamily();
  const [open, setOpen] = useState(false);
  const defaults = [...currentHome.entities.filter(e => ["light", "climate", "switch"].includes(e.domain)).slice(0, 3), ...currentHome.entities.filter(e => e.domain === "scene").slice(0, 4)].map(e => e.preferenceId);
  const selected = homeEntities ?? defaults;
  const entities = selected.flatMap(id => currentHome.entities.find(e => e.preferenceId === id) ?? []);
  const [sceneId, setSceneId] = useState<string>();
  const scenes = entities.filter(e => e.domain === "scene");
  const missing = selected.length - entities.length;
  return <section className="glow-panel home-favorites" aria-label="Home favorites">
    <div className="panel-heading"><h2>Just right at home</h2><div className="favorite-heading-actions"><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button className="text-link" disabled={!haUrl}><SlidersHorizontal size={16} />Customize</button></DialogTrigger><DialogContent className="favorites-dialog"><DialogHeader><DialogTitle>Make home yours</DialogTitle><DialogDescription>Choose your dashboard favorites.</DialogDescription></DialogHeader>{open && <FavoritePicker key={haUrl} selected={selected} onSave={ids => { if (setHomeEntities(ids)) setOpen(false); }} onCancel={() => setOpen(false)} />}</DialogContent></Dialog><Link className="text-link" to="/home">All controls<ArrowUpRight size={16} /></Link></div></div>
    {!!entities.length && <div className="favorite-devices">{entities.filter(e => e.domain !== "scene").map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>}
    {!!scenes.length && <SceneButtons entities={scenes} />}
    {!selected.length && haUrl && <p className="empty-note">No favorites selected.</p>}
    {!!missing && <p className="muted">{missing} saved {missing === 1 ? "favorite is" : "favorites are"} unavailable.</p>}
  </section>;
}
function FavoritePicker({ selected, onSave, onCancel }: { selected: string[]; onSave: (ids: string[]) => void; onCancel: () => void }) {
  const { currentHome } = useApp();
  const [draft, setDraft] = useState(selected);
  const [search, setSearch] = useState("");
  const [removal, setRemoval] = useState<{ ids: string[]; description: string }>();
  const areaName = (entity: Entity) => currentHome.areas.find(a => a.id === entity.areaId && a.id !== "unassigned")?.name ?? "";
  const matches = currentHome.entities.filter(e => `${e.name} ${areaName(e)} ${e.entityId}`.toLowerCase().includes(search.toLowerCase()));
  const missing = draft.filter(id => !currentHome.entities.some(e => e.preferenceId === id));
  return <>
    <div className="favorite-search"><Search size={17} aria-hidden="true" /><Input aria-label="Search favorites" placeholder="Search devices, rooms or scenes…" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <div className="favorite-picker" aria-label="Available favorites">{matches.map(entity => <label className="favorite-option" key={entity.preferenceId}><DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-5 w-5" /><span><strong>{entity.name}</strong><small>{[areaName(entity), ({ binary_sensor: "Sensor", alarm_control_panel: "Alarm", cover: "Blinds", climate: "Thermostat" })[entity.domain] ?? humanizeState(entity.domain)].filter(Boolean).join(" · ")}</small></span><input type="checkbox" aria-label={entity.name} checked={draft.includes(entity.preferenceId)} onChange={e => e.target.checked ? setDraft(ids => [...ids, entity.preferenceId]) : setRemoval({ ids: draft.filter(id => id !== entity.preferenceId), description: `Remove “${entity.name}” from your favorites selection? Save favorites to apply this change.` })} /></label>)}
      {!matches.length && <p className="empty-note">{currentHome.entities.length ? "No matches. Try another name or room." : "Connect your home to load devices."}</p>}
      {missing.map(id => <label className="favorite-option" key={id}><span><strong>Unavailable favorite</strong><small>{id.slice(id.indexOf("|") + 1)}</small></span><input type="checkbox" aria-label={`Remove unavailable favorite ${id}`} checked onChange={() => setRemoval({ ids: draft.filter(value => value !== id), description: `Remove unavailable favorite “${id.slice(id.indexOf("|") + 1)}” from your selection? Save favorites to apply this change.` })} /></label>)}
    </div>
    <div className="favorite-picker-footer"><span>{draft.length} selected</span><Button variant="ghost" disabled={!draft.length} onClick={() => setRemoval({ ids: [], description: "Clear all favorites from your selection? Save favorites to apply this change to the dashboard." })}>Clear all</Button><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button onClick={() => onSave(draft)}>Save favorites</Button></div>
    {removal && <ConfirmDialog open onOpenChange={open => { if (!open) setRemoval(undefined); }} title="Remove favorites?" description={removal.description} confirmLabel="Remove favorites" destructive onConfirm={() => setDraft(removal.ids)} />}
  </>;
}
export function VehicleCard() {
  return <article className="glow-panel vehicle-panel"><PanelHeading title="Ready for the road" /><CarFront size={32} /><Link className="text-link" to="/devices">Browse devices<ArrowUpRight size={17} /></Link></article>;
}
