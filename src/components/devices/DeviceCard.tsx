import { Link } from "react-router-dom";
import { Blinds, Bot, Camera, ChevronRight, Cpu, Droplets, Fan, Layers, Lightbulb, Lock, Play, Plug, Radio, Shield, Thermometer } from "lucide-react";
import type { Entity, PhysicalDevice } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { deviceName, deviceReadingsLabel, deviceType } from "@/lib/device-model";

export function PhysicalDeviceIcon({ entities, className }: { entities: Entity[]; className?: string }) {
  const Icon = ({
    Lights: Lightbulb, Climate: Thermometer, "Blinds & doors": Blinds, Locks: Lock, Alarms: Shield,
    "Media players": Play, Cameras: Camera, Fans: Fan, Vacuums: Bot, Switches: Plug, Valves: Droplets,
    Sensors: Radio, "Multi-function": Layers,
  })[deviceType(entities)] ?? Cpu;
  return <Icon className={className} aria-hidden="true" />;
}

export function DeviceCard({ device, entities, listSearch }: { device: PhysicalDevice; entities: Entity[]; listSearch: string }) {
  const { currentHome, homeOnline } = useApp();
  const area = currentHome.areas.find(area => area.id === device.area_id);
  return <Link to={`/devices/${encodeURIComponent(device.id)}`} state={{ deviceList: listSearch }} className="physical-device" aria-label={`${deviceName(device)} details`}>
    <div className="home-device-title"><span className="device-symbol"><PhysicalDeviceIcon entities={entities} className="h-4 w-4" /></span><div className="device-name"><h3>{deviceName(device)}</h3><small>{area?.name ?? "Unassigned"}</small></div></div>
    <p className="device-model">{[device.manufacturer, device.model].filter(Boolean).join(" · ") || "Connected device"}</p>
    <span className="device-availability">{deviceReadingsLabel(entities, homeOnline)}</span>
    <ChevronRight className="device-row-chevron" size={16} aria-hidden="true" />
  </Link>;
}
