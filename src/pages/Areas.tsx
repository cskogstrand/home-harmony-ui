import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { DoorOpen, ArrowUpRight } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { EntityCard } from "@/components/devices/EntityCard";
export default function Areas() {
  const { currentHome, haUrl } = useApp();
  const { areaId } = useParams();
  const { pathname } = useLocation();
  if (pathname.startsWith("/rooms/")) return <Navigate to={`/areas/${encodeURIComponent(areaId)}`} replace />;
  const area = currentHome.areas.find(a => a.id === areaId);
  return <div className="planner-page"><PageHeading eyebrow="AROUND YOUR HOME" title={areaId ? area?.name ?? "Area not found" : "Areas"} description="Find your controls, room by room." />
    {areaId && <Link className="text-link" to="/areas">Back to areas</Link>}
    {haUrl && <a className="text-link" href={`${haUrl}/config/areas/dashboard`} target="_blank" rel="noreferrer">Manage areas in Home Assistant</a>}
    <div className="home-device-grid">{areaId ? area?.entities.map(entity => <EntityCard key={entity.entityId} entity={entity} />) : currentHome.areas.map(area => <Link key={area.id} to={`/areas/${encodeURIComponent(area.id)}`} className="glow-panel space-y-3"><DoorOpen /><h2>{area.name}</h2><p>{area.entities.length} controls</p><ArrowUpRight /></Link>)}</div>
    {!currentHome.areas.length && <p className="glow-panel empty-note">No areas loaded. Connect Home Assistant to see your areas.</p>}
  </div>;
}
