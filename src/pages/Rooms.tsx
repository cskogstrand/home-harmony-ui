import { Link, useParams } from "react-router-dom";
import { DoorOpen, ArrowUpRight } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { EntityCard } from "@/components/devices/EntityCard";
export default function Rooms() {
  const { currentHome, haUrl } = useApp();
  const { roomId } = useParams();
  const room = currentHome.rooms.find(r => r.id === roomId);
  return <div className="planner-page"><PageHeading eyebrow="ROOM BY ROOM" title={roomId ? room?.name ?? "Room not found" : "Rooms"} description="Areas from Home Assistant. Entity areas take priority over their device’s area." />
    {roomId && <Link className="text-link" to="/rooms">Back to rooms</Link>}
    {haUrl && <a className="text-link" href={`${haUrl}/config/areas/dashboard`} target="_blank" rel="noreferrer">Manage areas in Home Assistant</a>}
    <div className="home-device-grid">{roomId ? room?.entities.map(entity => <EntityCard key={entity.entityId} entity={entity} />) : currentHome.rooms.map(room => <Link key={room.id} to={`/rooms/${room.id}`} className="glow-panel"><DoorOpen /><h2>{room.name}</h2><p>{room.entities.length} entities</p><ArrowUpRight /></Link>)}</div>
    {!currentHome.rooms.length && <p className="glow-panel empty-note">No areas loaded. Connect Home Assistant to see your rooms.</p>}
  </div>;
}
