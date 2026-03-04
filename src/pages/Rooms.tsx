import { useApp } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { StateWrapper } from "@/components/common/StateWrapper";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, DoorOpen, Sofa, BedDouble, CookingPot, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";
import type { Device } from "@/types/api";
import { DeviceControl, isSensorDevice } from "@/components/devices/DeviceControl";
import {
  Lightbulb, Thermometer, Lock, Eye, Flame, Droplets, Plug, Radio, Zap,
} from "lucide-react";
import type { DeviceType } from "@/types/api";

const roomIcons: Record<string, React.ElementType> = {
  sofa: Sofa, bed: BedDouble, door: DoorOpen, utensils: CookingPot,
};

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

export default function RoomsPage() {
  const { currentHome, currentUser } = useApp();
  const { roomId } = useParams();

  if (!currentHome) return <StateWrapper state="loading"><div /></StateWrapper>;

  if (roomId) {
    const room = currentHome.rooms.find(r => r.id === roomId);
    if (!room) return <StateWrapper state="empty" emptyTitle="Room not found" emptyDescription="This room doesn't exist."><div /></StateWrapper>;
    return <RoomDetail room={room} />;
  }

  const isMaster = currentUser.role === "master" || currentUser.role === "admin";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Rooms</h1>
        {isMaster && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.info("TODO: Create room flow")}>
            <Plus className="h-4 w-4" /> Add Room
          </Button>
        )}
      </div>

      <StateWrapper state={currentHome.rooms.length === 0 ? "empty" : "success"}
        emptyTitle="No rooms yet" emptyDescription="Organize your devices into rooms for easier control.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentHome.rooms.map((room, i) => {
            const RoomIcon = roomIcons[room.icon] ?? DoorOpen;
            const onlineCount = room.devices.filter(d => d.online).length;
            return (
              <motion.div key={room.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}>
                <Link to={`/rooms/${room.id}`}>
                  <Card className="hover:shadow-card-hover transition-shadow cursor-pointer group">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
                            <RoomIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{room.name}</p>
                            <p className="text-2xs text-muted-foreground">
                              {room.devices.length} device{room.devices.length !== 1 ? "s" : ""} · {onlineCount} online
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </StateWrapper>
    </div>
  );
}

function RoomDetail({ room }: { room: { id: string; name: string; icon: string; devices: Device[] } }) {
  const RoomIcon = roomIcons[room.icon] ?? DoorOpen;
  const [deviceOverrides, setDeviceOverrides] = useState<Record<string, Record<string, unknown>>>({});
  const onlineCount = room.devices.filter(d => d.online).length;

  const getDevice = (device: Device): Device => {
    const overrides = deviceOverrides[device.id];
    if (!overrides) return device;
    return {
      ...device,
      attributes: device.attributes.map(a => overrides[a.name] !== undefined ? { ...a, value: overrides[a.name] } : a),
    };
  };

  const handleAttrChange = (deviceId: string, attrName: string, value: unknown) => {
    setDeviceOverrides(prev => ({
      ...prev,
      [deviceId]: { ...(prev[deviceId] ?? {}), [attrName]: value },
    }));
  };

  // Aggregate sensor data
  const tempDevices = room.devices.filter(d => d.attributes.some(a => a.name === "currentTemperature"));
  const avgTemp = tempDevices.length > 0
    ? (tempDevices.reduce((sum, d) => sum + Number(d.attributes.find(a => a.name === "currentTemperature")?.value ?? 0), 0) / tempDevices.length).toFixed(1)
    : null;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/rooms">
          <Button size="icon" variant="ghost"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <RoomIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{room.name}</h1>
            <p className="text-2xs text-muted-foreground">
              {room.devices.length} device{room.devices.length !== 1 ? "s" : ""} · {onlineCount} online
            </p>
          </div>
        </div>
      </div>

      {/* Room summary cards */}
      {avgTemp && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Thermometer className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold">{avgTemp}°C</p>
                <p className="text-2xs text-muted-foreground">Avg temperature</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <StatusBadge variant={onlineCount === room.devices.length ? "online" : "warning"}>
                {onlineCount}/{room.devices.length} online
              </StatusBadge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Devices in room */}
      <h2 className="text-sm font-semibold">Devices</h2>
      <StateWrapper state={room.devices.length === 0 ? "empty" : "success"}
        emptyTitle="No devices" emptyDescription="Add devices to this room.">
        <div className="space-y-2">
          {room.devices.map((rawDevice, i) => {
            const device = getDevice(rawDevice);
            const Icon = getDeviceIcon(device.type);
            return (
              <motion.div key={device.id}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Link to={`/devices/${device.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                          device.online ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{device.name}</p>
                          <p className="text-2xs text-muted-foreground">{device.displayType}</p>
                        </div>
                      </Link>
                      <div className="shrink-0 ml-3">
                        {device.online ? (
                          <DeviceControl device={device} compact onAttributeChange={handleAttrChange} />
                        ) : (
                          <StatusBadge variant="offline">Offline</StatusBadge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </StateWrapper>
    </div>
  );
}
