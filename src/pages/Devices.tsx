import { useApp } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StateWrapper } from "@/components/common/StateWrapper";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  Lightbulb, Thermometer, Lock, Eye, Flame, Droplets, Plug, Radio,
  ChevronRight, Search, AlertTriangle, Zap,
} from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import type { Device, DeviceType } from "@/types/api";

const deviceIcons: Partial<Record<DeviceType, React.ElementType>> = {
  light: Lightbulb, lightBulb: Lightbulb, dimmableLight: Lightbulb, colorLight: Lightbulb,
  thermostat: Thermometer, doorLock: Lock,
  sensorMotion: Eye, motionDetector: Eye, sensorPresence: Eye,
  smokeDetector: Flame, sensorFire: Flame, fireDetector: Flame,
  waterValve: Droplets, sensorWater: Droplets, waterDetector: Droplets,
  socketSingle: Plug, socketDouble: Plug,
  evCharger: Zap, evChargingStation: Zap,
  sensorContactDoor: Radio, sensorContactWindow: Radio, magnetContact: Radio,
};

function getDeviceIcon(type: DeviceType): React.ElementType {
  return deviceIcons[type] ?? Radio;
}

export default function DevicesPage() {
  const { currentHome } = useApp();
  const [search, setSearch] = useState("");

  if (!currentHome) return <StateWrapper state="loading"><div /></StateWrapper>;

  const allDevices = currentHome.rooms.flatMap(r => r.devices);
  const filtered = search
    ? allDevices.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.displayType.toLowerCase().includes(search.toLowerCase()))
    : allDevices;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Devices</h1>
        <StatusBadge variant={allDevices.filter(d => !d.online).length > 0 ? "warning" : "online"}>
          {allDevices.filter(d => d.online).length}/{allDevices.length} online
        </StatusBadge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search devices…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Search devices"
        />
      </div>

      <StateWrapper state={filtered.length === 0 ? "empty" : "success"}
        emptyTitle="No devices found" emptyDescription={search ? "Try a different search term." : "Add devices through your gateway."}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((device, i) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <DeviceCard device={device} />
            </motion.div>
          ))}
        </div>
      </StateWrapper>
    </div>
  );
}

function DeviceCard({ device }: { device: Device }) {
  const Icon = getDeviceIcon(device.type);
  const hasWarning = !!device.troubleshooting || !device.online;
  const hasUpdate = !!device.softwareUpdate;

  // Get primary value to display
  const primaryAttr = device.attributes.find(a =>
    ["isOn", "brightness", "currentTemperature", "targetTemperature", "lockState", "contact", "chargingState"].includes(a.name)
  );

  return (
    <Link to={`/devices/${device.id}`}>
      <Card className={`hover:shadow-card-hover transition-all cursor-pointer group ${
        hasWarning ? "border-warning/40" : ""
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`flex items-center justify-center h-9 w-9 rounded-lg ${
                device.online ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-medium truncate max-w-[140px]">{device.name}</p>
                <p className="text-2xs text-muted-foreground">{device.displayType}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge variant={device.online ? "online" : "offline"}>
              {device.online ? "Online" : "Offline"}
            </StatusBadge>
            {hasUpdate && (
              <StatusBadge variant="info">Update</StatusBadge>
            )}
            {device.alarmDevice && (
              <StatusBadge variant="safety">Security</StatusBadge>
            )}
            {device.energySaverEnabled && (
              <StatusBadge variant="pending">Energy</StatusBadge>
            )}
          </div>

          {primaryAttr && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-2xs">{primaryAttr.name}</span>
                <span className="font-medium">
                  {typeof primaryAttr.value === "boolean"
                    ? primaryAttr.value ? "On" : "Off"
                    : String(primaryAttr.value)}{primaryAttr.unit ?? ""}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
