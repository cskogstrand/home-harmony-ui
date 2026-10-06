import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { DeviceControl, DeviceIcon } from "./DeviceControl";
export function EntityCard({ entity }: { entity: Entity }) {
  const { currentHome } = useApp();
  return <article className="glow-panel home-device"><Link to={`/devices/${entity.entityId}`} className="home-device-title"><span className="device-symbol"><DeviceIcon type={entity.domain} className="h-6 w-6" /></span><ArrowUpRight size={17} /><h3>{entity.name}</h3><small>{currentHome.areas.find(r => r.id === entity.areaId)?.name} · {entity.domain}</small></Link><DeviceControl entity={entity} /></article>;
}
