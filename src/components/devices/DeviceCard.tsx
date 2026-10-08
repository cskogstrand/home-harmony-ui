import { Link } from "react-router-dom";
import { ChevronRight, Cpu } from "lucide-react";
import type { Entity, PhysicalDevice } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { deviceName, deviceReadingsLabel } from "@/lib/device-model";

export function DeviceCard({ device, entities }: { device: PhysicalDevice; entities: Entity[] }) {
  const { currentHome, homeOnline } = useApp();
  const area = currentHome.areas.find(area => area.id === device.area_id);
  return <Link to={`/devices/${encodeURIComponent(device.id)}`} className="glow-panel home-device physical-device" aria-label={`${deviceName(device)} details`}>
    <div className="home-device-title"><span className="device-symbol"><Cpu className="h-5 w-5" aria-hidden="true" /></span><div className="device-name"><h2>{deviceName(device)}</h2><small>{area?.name ?? "Unassigned"}</small></div><ChevronRight size={16} aria-hidden="true" /></div>
    <p className="device-model">{[device.manufacturer, device.model].filter(Boolean).join(" · ") || "Connected device"}</p>
    <span className="device-availability">{deviceReadingsLabel(entities, homeOnline)}</span>
  </Link>;
}
