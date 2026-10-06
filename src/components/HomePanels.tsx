import { Link } from "react-router-dom";
import { CarFront, Sparkles, ArrowUpRight } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { available, supportsAction } from "@/lib/ha-model";
import { DeviceControl, DeviceIcon, CommandFeedback } from "@/components/devices/DeviceControl";
import { PanelHeading } from "./FamilyPlanner";
export function SceneButtons() {
  const { currentHome, command, commands, homeOnline, services } = useApp();
  const scenes = currentHome.entities.filter(e => e.domain === "scene");
  return <><div className="scene-buttons">{scenes.map(scene => <div key={scene.entityId}><button className="w-full" disabled={!homeOnline || !available(scene) || !supportsAction(scene, "turn_on", services) || commands[scene.entityId]?.pending} onClick={() => { void command(scene.entityId, "turn_on").catch(() => {}); }}><Sparkles size={20} /><span>{scene.name}</span></button><CommandFeedback entityId={scene.entityId} /></div>)}</div>{!scenes.length && <p className="empty-note">No scenes loaded from Home Assistant.</p>}</>;
}
export function HomeFavorites() {
  const { currentHome, homeOnline } = useApp();
  const entities = currentHome.entities.filter(e => ["light", "climate", "switch"].includes(e.domain)).slice(0, 3);
  return <article className="glow-panel home-favorites"><PanelHeading title="Just right at home" to="/home" label="All controls" /><div className="favorite-devices">{entities.map(entity => <div key={entity.entityId} className="favorite-device"><Link to={`/devices/${entity.entityId}`} aria-label={entity.name}><DeviceIcon type={entity.domain} className="h-5 w-5" /><span>{entity.name}</span><ArrowUpRight size={14} /></Link><DeviceControl entity={entity} compact /></div>)}</div>{!entities.length && <Link className="text-link" to="/settings">Connect Home Assistant to see your home.</Link>}<SceneButtons />{!homeOnline && <p className="muted">Home controls are paused while Home Assistant is offline.</p>}</article>;
}
export function VehicleCard() {
  return <article className="glow-panel vehicle-panel"><PanelHeading title="Ready for the road" /><CarFront size={32} /><p className="muted">Connect your charger in Home Assistant to see its sensors and supported controls alongside your other devices.</p><Link className="text-link" to="/devices">Browse charging entities<ArrowUpRight size={17} /></Link></article>;
}
