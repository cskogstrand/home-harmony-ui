import { useI18n } from "@/hooks/use-i18n";
import { entityDetailPath } from "@/lib/device-model";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { DeviceControl, DeviceIcon } from "./DeviceControl";
export function EntityCard({ entity, listSearch }: { entity: Entity; listSearch?: string }) {
  const { t } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const active = homeOnline && ["on", "heat", "cool", "heating", "cooling"].includes(entity.state);
  const area = currentHome.areas.find(r => r.id === entity.areaId);
  return <article aria-label={entity.name} className={`glow-panel home-device${active ? " is-active" : ""}`}><Link to={entityDetailPath(entity)} state={listSearch !== undefined ? { deviceList: listSearch } : undefined} className="home-device-title" aria-label={t("{name} details", { name: entity.name })}><span className="device-symbol"><DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-5 w-5" /></span><span className="device-name"><h3>{entity.name}</h3>{area && area.id !== "unassigned" && <small>{area.name}</small>}</span><ChevronRight size={16} /></Link><DeviceControl entity={entity} /></article>;
}
