import { useState } from "react";
import type { Device } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { PinPadModal } from "./PinPadModal";
import { Lock, Unlock, Minus, Plus, PlugZap, Lightbulb, Thermometer, Eye, Flame, Droplets, Plug, Radio, Blinds } from "lucide-react";

const sensorTypes = new Set([
  "sensorMotion", "motionDetector", "sensorPresence", "sensorContact", "sensorContactDoor",
  "sensorContactWindow", "magnetContact", "smokeDetector", "sensorFire", "fireDetector",
  "sensorWater", "waterDetector", "sensorCarbonMonoxide", "sensorVibration",
  "vibrationMovementSensor", "sensorGlassBreakage", "temperatureSensor", "airQualitySensor",
]);
export const isSensorDevice = (type: string) => sensorTypes.has(type);
export const deviceValue = (device: Device, name: string) => device.attributes.find(a => a.name === name)?.value;

export function DeviceIcon({ type, className }: { type: string; className?: string }) {
  const Icon = type.toLowerCase().includes("light") ? Lightbulb : ({ thermostat: Thermometer, doorLock: Lock, sensorMotion: Eye, motionDetector: Eye, smokeDetector: Flame, waterValve: Droplets, socketSingle: Plug, evCharger: PlugZap, coverWindow: Blinds })[type] ?? Radio;
  return <Icon className={className} />;
}

export function DeviceControl({ device, compact = false }: { device: Device; compact?: boolean }) {
  const { homeOnline, updateDeviceAttribute } = useApp();
  const [pinOpen, setPinOpen] = useState(false);
  const [lockAction, setLockAction] = useState("locked");
  const disabled = !homeOnline || !device.online;
  const get = (name: string) => deviceValue(device, name);
  const update = (name: string, value: unknown) => updateDeviceAttribute(device.id, name, value);
  const range = (name: string, label: string, min: number, max: number, unit: string) => (
    <label className="device-range"><span>{label}<strong>{String(get(name))}{unit}</strong></span>
      <input type="range" aria-label={`${device.name} ${label.toLowerCase()}`} min={min} max={max} value={Number(get(name))}
        disabled={disabled} onChange={e => update(name, Number(e.target.value))} />
    </label>
  );
  if (isSensorDevice(device.type)) {
    const reading = device.attributes.find(a => ["motion", "contact", "smoke", "water"].includes(a.name));
    const alert = reading && (reading.name === "contact" ? !reading.value : !!reading.value);
    return <span className={`sensor-state ${alert ? "attention" : ""}`}>{disabled ? "Offline · reading unavailable" : reading ?
      ({ motion: alert ? "Motion detected" : "No motion", contact: alert ? "Open" : "Closed", smoke: alert ? "Smoke detected" : "Clear", water: alert ? "Water detected" : "Dry" })[reading.name] : "Online"}</span>;
  }
  if (device.type === "doorLock") return <>
    <Button variant={get("lockState") === "locked" ? "secondary" : "outline"} disabled={disabled}
      aria-label={`${get("lockState") === "locked" ? "Unlock" : "Lock"} ${device.name}`}
      onClick={() => { setLockAction(get("lockState") === "locked" ? "unlocked" : "locked"); setPinOpen(true); }}>
      {get("lockState") === "locked" ? <Lock size={16} /> : <Unlock size={16} />}
      {!compact && (disabled ? "Unavailable" : String(get("lockState")))}
    </Button>
    <PinPadModal open={pinOpen} onOpenChange={setPinOpen} title={lockAction === "unlocked" ? "Unlock door" : "Lock door"}
      description={`Enter the demo PIN for ${device.name}.`} variant={lockAction === "unlocked" ? "unlock" : "lock"}
      onSubmit={() => update("lockState", lockAction)} />
  </>;
  if (device.type === "thermostat") {
    const target = device.attributes.find(a => a.name === "targetTemperature");
    if (!target) return <span className="muted">No temperature control available</span>;
    const min = Number(target.minValue ?? 5), max = Number(target.maxValue ?? 30), step = target.step ?? 0.5;
    return <div className="temperature-control">
    <Button size="icon" variant="outline" disabled={disabled || Number(target.value) <= min} aria-label={`Lower ${device.name}`}
      onClick={() => update("targetTemperature", Math.max(min, Number(target.value) - step))}><Minus size={16} /></Button>
    <span><strong>{String(get("targetTemperature"))}°</strong>{!compact && <small>Target · {String(get("currentTemperature"))}° now</small>}</span>
    <Button size="icon" variant="outline" disabled={disabled || Number(target.value) >= max} aria-label={`Raise ${device.name}`}
      onClick={() => update("targetTemperature", Math.min(max, Number(target.value) + step))}><Plus size={16} /></Button>
  </div>;
  }
  if (device.type === "evCharger" || device.type === "evChargingStation") return <div className="control-stack">
    <Button variant="secondary" disabled={disabled} onClick={() => update("charging", !get("charging"))}><PlugZap size={17} />{get("charging") ? "Pause charging" : "Start charging"}</Button>
    {!compact && range("chargeLimit", "Charge limit", 50, 100, "%")}
  </div>;
  if (device.type === "coverWindow") return range("position", "Open", 0, 100, "%");
  const attribute = device.attributes.find(a => a.name === "isOn" || a.name === "isOpen");
  if (attribute) return <div className="control-stack">
    <div className="toggle-line"><span>{attribute.name === "isOpen" ? (attribute.value ? "Water on" : "Water off") : (attribute.value ? "On" : "Off")}</span>
      <Switch checked={!!attribute.value} disabled={disabled} aria-label={`Toggle ${device.name}`} onCheckedChange={value => update(attribute.name, value)} />
    </div>
    {!compact && get("brightness") !== undefined && !!attribute.value && range("brightness", "Brightness", 0, 100, "%")}
  </div>;
  return <span className="muted">{disabled ? "Offline" : "No adjustable settings"}</span>;
}
