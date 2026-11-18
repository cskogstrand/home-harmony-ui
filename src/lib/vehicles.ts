import { available, humanizeState } from "./ha-model";
import type { Entity, Home, PhysicalDevice } from "@/types/api";

const teslaPlatforms = new Set(["tesla_fleet", "tesla_custom", "tesla", "teslemetry", "tessie"]);
export type Vehicle = { device: PhysicalDevice; entities: Entity[] };

// Fleet supplies stable translation keys. Tesla Custom supplies original English entity names.
export const metricKey = (entity: Entity) => (entity.registryName || entity.entityId.split(".")[1]).toLowerCase().replace(/[\s-]+/g, "_");
const rangeKey = /(?:^|_)range$/;

function durationEnd(entity?: Entity) {
  if (!entity?.lastUpdated || !Number.isFinite(Number(entity.state)) || Number(entity.state) <= 0) return NaN;
  const unitMs = { h: 3600000, min: 60000, s: 1000 }[String(entity.attributes.unit_of_measurement)];
  return unitMs ? Date.parse(entity.lastUpdated) + Number(entity.state) * unitMs : NaN;
}

export const teslaModelVariant = (model?: string) => model?.match(/\bmodel\s+(3|s)\b/i)?.[1].toLowerCase();

export function teslaVehicles(home: Home) {
  const groups = new Map<string, Vehicle>();
  for (const entity of home.entities) {
    const { device } = entity;
    if (!device || !teslaPlatforms.has(entity.integration) || entity.attributes.mode === "password") continue;
    const group = groups.get(device.id) ?? { device, entities: [] };
    group.entities.push(entity);
    groups.set(device.id, group);
  }
  // The same integrations also register Powerwalls, wall connectors and energy sites.
  return [...groups.values()].filter(({ device, entities }) =>
    /\b(?:model [s3xy]|cybertruck|roadster|semi)\b/i.test(device.model ?? "") ||
    entities.some(e => e.domain === "device_tracker" || (e.domain === "sensor" && rangeKey.test(metricKey(e)))));
}

export function vehicleSummary(entities: Entity[]) {
  const live = entities.filter(available);
  const sensors = live.filter(e => e.domain === "sensor");
  const validNumber = (e: Entity) => e.state.trim() !== "" && Number.isFinite(Number(e.state));
  const batteries = sensors.filter(e => validNumber(e) && e.attributes.device_class === "battery"
    && e.attributes.unit_of_measurement === "%" && Number(e.state) >= 0 && Number(e.state) <= 100);
  const battery = batteries.find(e => !metricKey(e).includes("usable")) ?? batteries[0];
  const ranges = sensors.filter(e => rangeKey.test(metricKey(e)) && validNumber(e) && Number(e.state) >= 0 && e.attributes.unit_of_measurement);
  const range = ranges.find(e => !/(?:est|estimated|ideal)_/.test(metricKey(e))) ?? ranges[0];
  const chargeSensor = sensors.find(e => /(?:^|_)charging(?:_state)?$/.test(metricKey(e)));
  const plug = live.find(e => e.domain === "binary_sensor" && e.attributes.device_class === "plug");
  const chargingFlag = live.find(e => e.domain === "binary_sensor" && e.attributes.device_class === "battery_charging");
  const reported = chargeSensor?.state ?? plug?.attributes.charging_state;
  let charge: string | undefined;
  if (typeof reported === "string" && reported.trim()) charge = reported === "NoPower" ? "No power" : humanizeState(reported.trim().toLowerCase());
  else if (chargingFlag?.state === "on") charge = "Charging";
  else if (plug?.state === "on") charge = "Plugged in";
  else if (plug?.state === "off") charge = "Unplugged";
  else if (chargingFlag?.state === "off") charge = "Not charging";
  const limit = live.find(e => ["number", "sensor"].includes(e.domain) && /(?:^|_)charge_limit(?:_soc)?$/.test(metricKey(e))
    && e.attributes.unit_of_measurement === "%" && validNumber(e) && Number(e.state) >= 0 && Number(e.state) <= 100);
  const power = sensors.find(e => /(?:^|_)charger_power$/.test(metricKey(e)) && validNumber(e) && e.attributes.unit_of_measurement);
  const charging = charge === "Charging" || charge === "Starting";
  const finishSensor = charging && sensors.find(e => /(?:^|_)time_charge_complete$/.test(metricKey(e)) && e.attributes.device_class === "timestamp");
  let finish = finishSensor ? Date.parse(finishSensor.state) : NaN;
  if (charging && !Number.isFinite(finish)) {
    const duration = sensors.find(e => /(?:^|_)(?:time|minutes)_to_full_charge$/.test(metricKey(e)) && validNumber(e));
    finish = durationEnd(duration);
  }
  const plugged = plug?.state === "on" ? true : plug?.state === "off" ? false
    : charge === "Complete" || charge === "Plugged in" ? true : charge === "Disconnected" || charge === "Unplugged" ? false : undefined;
  return { battery, range, charge, charging, plugged, limit, power, finish };
}

// Each entity has one home, including switches and command timestamps exposed by Tesla Custom.
export const vehicleSystems = {
  "Battery & charging": ["Battery and range", "Charge session", "Charge port", "Charge schedule"],
  "Cabin & seats": ["Cabin temperature", "Seat heating", "Cabin protection"],
  "Doors & security": ["Locks", "Doors and windows", "Luggage compartments", "Security modes"],
  "Trip & position": ["Navigation", "On the road", "Departure schedule"],
  "Tyre pressure": ["Wheel pressures"],
  "Vehicle & service": ["Software", "Vehicle connection", "Last commands", "Vehicle information"],
} as const;
export type VehicleSystem = keyof typeof vehicleSystems;
type VehicleGroup = (typeof vehicleSystems)[VehicleSystem][number];

export function vehicleGroup(entity: Entity): VehicleGroup {
  const key = metricKey(entity);
  if (/tpms|tire_pressure|tyre_pressure/.test(key)) return "Wheel pressures";
  if (/scheduled_departure|scheduled.*depart|preconditioning_time/.test(key)) return "Departure schedule";
  if (/schedul.*charg|off_peak/.test(key)) return "Charge schedule";
  if (/charge_port|charger_door/.test(key)) return "Charge port";
  if (/seat.*heat|heat.*seat/.test(key)) return "Seat heating";
  if (/overheat|heated_steering|steering_wheel|defrost|keeper/.test(key)) return "Cabin protection";
  if (entity.domain === "climate" || /temp|climate|hvac/.test(key)) return "Cabin temperature";
  if (/arrival|destination|active_route/.test(key) || entity.domain === "device_tracker") return "Navigation";
  if (/frunk|trunk|liftgate/.test(key)) return "Luggage compartments";
  if (entity.domain === "lock" || /(?:^|_)locked$/.test(key)) return "Locks";
  if (entity.domain === "cover" || /door|window|sunroof/.test(key)) return "Doors and windows";
  if (/sentry|valet|user_present|presence|alarm/.test(key)) return "Security modes";
  if (/odometer|shift_state|speed|brake|drive_state|gear|heading/.test(key)) return "On the road";
  if (/battery|range/.test(key) && !/charg.*rate|energy_added/.test(key)) return "Battery and range";
  if (/charg|cable|energy_added/.test(key)) return "Charge session";
  if (entity.domain === "button") return "Last commands";
  if (entity.domain === "update" || /software|firmware/.test(key)) return "Software";
  if (/online|connect|asleep|polling|last_update/.test(key)) return "Vehicle connection";
  return "Vehicle information";
}

export const readingName = (entity: Entity) => {
  const prefix = [entity.device?.name_by_user, entity.device?.name].find(name => name && entity.name.startsWith(name + " "));
  return prefix ? entity.name.slice(prefix.length + 1) : entity.name;
};

export function cabinClimate(entities: Entity[]) {
  const climates = entities.filter(e => e.domain === "climate");
  return climates.find(e => /hvac|climate_system/.test(metricKey(e))) ?? climates[0];
}

export function cabinState(entity?: Entity) {
  if (!entity || !available(entity)) return undefined;
  if (entity.state === "off") return false;
  if (["heat_cool", "auto", "heat", "cool", "fan_only", "dry", "on"].includes(entity.state)) return true;
  return undefined;
}

export function driveStatus(entities: Entity[]) {
  const live = entities.filter(available);
  const shift = live.find(e => e.domain === "sensor" && /(?:^|_)(?:shift_state|gear|gear_position)$/.test(metricKey(e)));
  const gear = shift?.state.trim().toUpperCase();
  const speedSensor = live.find(e => e.domain === "sensor" && /(?:^|_)(?:vehicle_|drive_state_)?speed$/.test(metricKey(e)) && !/charg|fan|limit/.test(metricKey(e)));
  const tracker = live.find(e => e.domain === "device_tracker" && !/destination|route/.test(metricKey(e)));
  const speed = speedSensor?.state ?? tracker?.attributes.speed;
  const moving = speed != null && Number(speed) > 0;
  if (gear === "P" || gear === "PARK") return { symbol: "P", label: "Parked" } as const;
  if (gear === "R" || gear === "REVERSE") return { symbol: "R", label: "Reverse gear" } as const;
  if (gear === "N" || gear === "NEUTRAL") return { symbol: "N", label: "Neutral gear" } as const;
  if (gear === "D" || gear === "DRIVE") return { symbol: "D", label: moving ? "Driving" : "Drive gear" } as const;
  if (moving) return { symbol: "↗", label: "Driving" } as const;
  if (live.some(e => e.domain === "binary_sensor" && /(?:^|_)parking_brake$/.test(metricKey(e)) && e.state === "on")) return { symbol: "P", label: "Parked" } as const;
  if (speed != null && String(speed).trim() && Number(speed) === 0) return { symbol: "0", label: "Stationary" } as const;
  return { symbol: "—", label: "Drive status unknown" } as const;
}

export function tyrePressureBar(entity: Entity) {
  const unit = String(entity.attributes.unit_of_measurement).trim().toLowerCase();
  const factor = { bar: 1, psi: 0.0689475729, kpa: 0.01, mpa: 10, hpa: 0.001, mbar: 0.001, pa: 0.00001 }[unit];
  const value = Number(entity.state);
  return available(entity) && entity.state.trim() && Number.isFinite(value) && value >= 0 && factor ? value * factor : undefined;
}

export function accessStatus(entities: Entity[]) {
  const openings = entities.filter(e => ["cover", "binary_sensor"].includes(e.domain)
    && ["Doors and windows", "Luggage compartments"].includes(vehicleGroup(e)));
  const lock = entities.find(e => e.domain === "lock" && vehicleGroup(e) === "Locks");
  const open: { name: string; position?: string }[] = [];
  let unknown = false;
  // Some cars publish both a window cover and an aggregate sensor with individual positions.
  const aggregateOpen = new Set<string>();
  for (const e of openings) {
    if (!available(e) || !["on", "off", "open", "closed", "opening", "closing"].includes(e.state)) { unknown = true; continue; }
    if (!["open", "on", "opening", "closing"].includes(e.state)) continue;
    const name = readingName(e);
    const positions = Object.entries(e.attributes).filter(([k,v]) =>
      /^(driver|passenger)[ _](front|rear)$/i.test(k) && /^(open|opened|ajar|vented|true|1)$/i.test(String(v)));
    if (positions.length) {
      for (const [position] of positions) open.push({ name, position });
    } else if (!aggregateOpen.has(name)) {
      open.push({ name });
    }
    aggregateOpen.add(name);
  }
  return { lock, open: open.filter(item => item.position || !open.some(other => other.name === item.name && other.position)),
    closed: openings.length > 0 && !unknown && open.length === 0 };
}

export function vehicleTrip(entities: Entity[], now: Date) {
  const live = entities.filter(available);
  const location = live.find(e => e.domain === "device_tracker" && !/destination|route/.test(metricKey(e)));
  const arrival = live.find(e => e.domain === "sensor" && /(?:arrival_time|time_of_arrival|route_arrival)$/.test(metricKey(e)));
  const reportedFinish = arrival?.attributes.device_class === "timestamp" || (arrival && /^\d{4}-\d{2}-\d{2}T/.test(arrival.state)) ? Date.parse(arrival.state) : NaN;
  const finish = Number.isFinite(reportedFinish) ? reportedFinish : durationEnd(live.find(e => e.domain === "sensor" && /(?:time|minutes)_to_arrival$/.test(metricKey(e))));
  const eta = Number.isFinite(finish) && finish >= now.getTime() ? new Date(finish) : undefined;
  const destinationSensor = live.find(e => e.domain === "sensor" && /(?:^|_)destination$/.test(metricKey(e)));
  const destination = arrival?.attributes.Destination ?? destinationSensor?.state;
  const lat = location?.attributes.latitude, lon = location?.attributes.longitude;
  const coordinates = typeof lat === "number" && Math.abs(lat) <= 90 && typeof lon === "number" && Math.abs(lon) <= 180 ? { lat, lon } : undefined;
  return { location, coordinates, eta, destination: (eta || !Number.isFinite(finish)) && typeof destination === "string" && destination.trim() ? destination : undefined };
}
