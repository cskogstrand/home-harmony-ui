import { useState, useCallback } from "react";
import type { Device } from "@/types/api";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PinPadModal } from "./PinPadModal";
import { Lock, Unlock, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Determine if this device type is a sensor (no controls, just state)
const sensorTypes = new Set([
  "sensorMotion", "motionDetector", "sensorPresence",
  "sensorContact", "sensorContactDoor", "sensorContactWindow", "magnetContact",
  "smokeDetector", "sensorFire", "fireDetector",
  "sensorWater", "waterDetector", "sensorCarbonMonoxide",
  "sensorVibration", "vibrationMovementSensor", "sensorGlassBreakage",
  "temperatureSensor", "airQualitySensor",
]);

export function isSensorDevice(type: string): boolean {
  return sensorTypes.has(type);
}

function getSensorStateDisplay(device: Device): { label: string; variant: "online" | "warning" | "safety" | "offline" | "info" } {
  const motion = device.attributes.find(a => a.name === "motion");
  if (motion) return { label: motion.value ? "Motion detected" : "No motion", variant: motion.value ? "warning" : "online" };

  const contact = device.attributes.find(a => a.name === "contact");
  if (contact) return { label: contact.value ? "Closed" : "Open", variant: contact.value ? "online" : "warning" };

  const smoke = device.attributes.find(a => a.name === "smoke");
  if (smoke) return { label: smoke.value ? "Smoke detected!" : "Clear", variant: smoke.value ? "safety" : "online" };

  const water = device.attributes.find(a => a.name === "water");
  if (water) return { label: water.value ? "Water detected!" : "Dry", variant: water.value ? "safety" : "online" };

  return { label: device.online ? "OK" : "Offline", variant: device.online ? "online" : "offline" };
}

interface DeviceControlProps {
  device: Device;
  compact?: boolean;
  onAttributeChange?: (deviceId: string, attrName: string, value: unknown) => void;
}

export function DeviceControl({ device, compact = false, onAttributeChange }: DeviceControlProps) {
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingLockAction, setPendingLockAction] = useState<"locked" | "unlocked">("locked");

  const getAttr = (name: string) => device.attributes.find(a => a.name === name);
  const updateAttr = useCallback((name: string, value: unknown) => {
    onAttributeChange?.(device.id, name, value);
    toast.success(`${device.name}: ${name} → ${String(value)}`);
  }, [device.id, device.name, onAttributeChange]);

  // Sensor — show state badge only
  if (isSensorDevice(device.type)) {
    const state = getSensorStateDisplay(device);
    return (
      <Badge variant="outline" className={cn("text-xs",
        state.variant === "online" && "border-success/40 text-success",
        state.variant === "warning" && "border-warning/40 text-warning",
        state.variant === "safety" && "border-safety/40 text-safety",
        state.variant === "offline" && "border-muted-foreground/40 text-muted-foreground",
      )}>
        {state.label}
      </Badge>
    );
  }

  // Door Lock
  if (device.type === "doorLock") {
    const lockState = getAttr("lockState");
    const isLocked = lockState?.value === "locked";
    return (
      <>
        <Button
          size={compact ? "sm" : "default"}
          variant={isLocked ? "default" : "outline"}
          className={cn("gap-1.5", isLocked ? "" : "border-warning/50 text-warning hover:bg-warning/10")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPendingLockAction(isLocked ? "unlocked" : "locked");
            setPinOpen(true);
          }}
        >
          {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          {!compact && (isLocked ? "Locked" : "Unlocked")}
        </Button>
        <PinPadModal
          open={pinOpen}
          onOpenChange={setPinOpen}
          title={pendingLockAction === "unlocked" ? "Unlock Door" : "Lock Door"}
          description={`Enter PIN to ${pendingLockAction === "unlocked" ? "unlock" : "lock"} ${device.name}`}
          variant={pendingLockAction === "unlocked" ? "unlock" : "lock"}
          onSubmit={() => updateAttr("lockState", pendingLockAction)}
        />
      </>
    );
  }

  // Light / dimmable light
  const isOn = getAttr("isOn");
  const brightness = getAttr("brightness");

  if (isOn && device.type?.toLowerCase().includes("light")) {
    return (
      <div className={cn("flex items-center gap-3", compact ? "" : "w-full")} onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
        <Switch
          checked={!!isOn.value}
          onCheckedChange={v => updateAttr("isOn", v)}
          aria-label={`Toggle ${device.name}`}
        />
        {brightness && !!isOn.value && !compact && (
          <Slider
            value={[Number(brightness.value)]}
            min={Number(brightness.minValue ?? 0)}
            max={Number(brightness.maxValue ?? 100)}
            step={brightness.step ?? 1}
            onValueChange={v => updateAttr("brightness", v[0])}
            className="flex-1"
            aria-label="Brightness"
          />
        )}
        {brightness && !!isOn.value && (
          <span className="text-2xs text-muted-foreground font-medium w-8 text-right">{String(brightness.value)}%</span>
        )}
      </div>
    );
  }

  // Thermostat
  if (device.type === "thermostat") {
    const target = getAttr("targetTemperature");
    const current = getAttr("currentTemperature");
    if (target) {
      const val = Number(target.value);
      const step = target.step ?? 0.5;
      return (
        <div className="flex items-center gap-2" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
          {current && <span className="text-2xs text-muted-foreground">{String(current.value)}°</span>}
          <Button size="icon" variant="outline" className="h-7 w-7"
            onClick={() => updateAttr("targetTemperature", Math.max(Number(target.minValue ?? 5), val - step))}>
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-sm font-bold w-12 text-center">{val}°C</span>
          <Button size="icon" variant="outline" className="h-7 w-7"
            onClick={() => updateAttr("targetTemperature", Math.min(Number(target.maxValue ?? 30), val + step))}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      );
    }
  }

  // Smart plug / water valve — simple toggle
  if (isOn || getAttr("isOpen")) {
    const attr = isOn ?? getAttr("isOpen")!;
    const attrName = isOn ? "isOn" : "isOpen";
    return (
      <div onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
        <Switch
          checked={!!attr.value}
          onCheckedChange={v => updateAttr(attrName, v)}
          aria-label={`Toggle ${device.name}`}
        />
      </div>
    );
  }

  // Fallback — no control
  return null;
}
