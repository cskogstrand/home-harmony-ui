// ============================================================
// Eva Smart Home – API Type Definitions
// Based on the Onics Cloud Platform High Level App API
// ============================================================

// ---- Address ------------------------------------------------
export interface Address {
  street: string;
  propertyUnitNumber?: string | null;
  postalCode?: string | null;
  city: string;
  countryCode: string;
  longitude: number;
  latitude: number;
}

// ---- Gateway ------------------------------------------------
export interface Gateway {
  id: string;
  name: string;
  online: boolean;
  troubleshooting: string | null;
  lastActivityAt: string;
  vendor: string;
  model: string;
  softwareVersion: string;
  hardwareVersion: string | null;
  setupState: string | null;
  softwareUpdate?: SoftwareUpdate | null;
}

export interface SoftwareUpdate {
  status: "available" | "assigned" | "inProgress";
  version: string;
  progress: number | null;
}

// ---- Device -------------------------------------------------
export type DeviceType =
  // Lights
  | "light"
  | "lightBulb"
  | "dimmableLight"
  | "colorLight"
  | "colorTemperatureLight"
  // Dimmers
  | "dimmer"
  | "dimmerRemote"
  | "dimmerSwitch"
  // Climate
  | "thermostat"
  // Locks
  | "doorLock"
  // Contact / door-window sensors
  | "magnetContact"
  | "sensorContact"
  | "sensorContactDoor"
  | "sensorContactWindow"
  // Motion & presence
  | "motionDetector"
  | "sensorMotion"
  | "sensorPresence"
  // Safety sensors
  | "sensorFire"
  | "fireDetector"
  | "smokeDetector"
  | "sensorWater"
  | "waterDetector"
  | "sensorCarbonMonoxide"
  | "sensorVibration"
  | "vibrationMovementSensor"
  | "sensorGlassBreakage"
  // Water
  | "waterValve"
  | "waterMeter"
  // Plugs
  | "socketSingle"
  | "socketDouble"
  // Covers
  | "coverWindow"
  // EV Charging
  | "evCharger"
  | "evChargingStation"
  // Metering
  | "electricityMeter"
  // Temperature sensors
  | "temperatureSensor"
  // Stove guard
  | "stoveGuard"
  // Sirens
  | "siren"
  | "sirenAc"
  // Switches & remotes
  | "moodSwitch"
  | "keyPad"
  | "keyFob"
  | "panicButton"
  | "remoteControl"
  | "personalEmergencyDevice"
  // Air quality
  | "airQualitySensor"
  // Vehicle
  | "vehicle"
  // Unknown
  | "unknown"
  | string;

export interface DeviceAttribute {
  name: string;
  value: unknown;
  updatedAt?: string;
  minValue?: unknown;
  maxValue?: unknown;
  options?: unknown[];
  preview?: string;
  unit?: string;
  step?: number;
  groupDivergence?: boolean;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  displayType: string;
  online: boolean;
  icon: string;
  iconOptions: string[];
  troubleshooting: string | null;
  lastActivityAt: string;
  alarmDevice?: boolean;
  profiles?: string[] | null;
  location: string | null;
  vendor: string;
  model: string;
  softwareVersion: string;
  softwareUpdate: SoftwareUpdate | null;
  hardwareVersion: string | null;
  ignoreInMoods: boolean;
  supportsGroups: boolean;
  supportsIdentify: boolean;
  external?: boolean;
  energySaverEnabled: boolean;
  eligibleForEnergySaver?: boolean;
  externalDeviceId?: string;
  energySaverOverrideUntil?: string | null;
  attributes: DeviceAttribute[];
}

// ---- Group --------------------------------------------------
export interface Group {
  id: string;
  name: string;
  roomId?: string;
  deviceIds: string[];
  attributes: DeviceAttribute[];
}

// ---- Room ---------------------------------------------------
export interface Room {
  id: string;
  name: string;
  icon: string;
  devices: Device[];
  moods?: Mood[];
  groups?: Group[];
  rules?: Rule[];
}

// ---- Mood ---------------------------------------------------
export interface MoodDevice {
  deviceId: string;
  attributes: DeviceAttribute[];
}

export interface Mood {
  id: string;
  name: string;
  icon?: string;
  active?: boolean;
  roomId?: string;
  devices?: MoodDevice[];
}

// ---- Rule ---------------------------------------------------
export interface RuleCondition {
  type: string;
  [key: string]: unknown;
}

export interface RuleAction {
  type: string;
  [key: string]: unknown;
}

export interface Rule {
  id: string;
  name?: string;
  enabled?: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

// ---- User ---------------------------------------------------
export interface HomeUser {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: "master" | "user" | "guest";
  expiresAt: string | null;
}

// ---- Alarm --------------------------------------------------
export type AlarmMode = "disarmed" | "dayArmed" | "nightArmed" | "armed";

export interface ActiveProfile {
  mode: AlarmMode;
  modeChangedAt: string;
  modeChangedBy: string;
  previousMode: AlarmMode | null;
}

export interface AlarmProfileSettings {
  entryDuration: number;
  exitDuration: number;
}

export interface AlarmProfiles {
  armed?: AlarmProfileSettings;
  dayArmed?: AlarmProfileSettings;
  nightArmed?: AlarmProfileSettings;
}

// ---- Warning ------------------------------------------------
export interface Warning {
  id: string;
  type: string;
  message: string;
  deviceId?: string;
  deviceName?: string;
  createdAt: string;
}

// ---- Event Log ----------------------------------------------
export type EventIconType =
  | "unknown"
  | "info"
  | "gatewayOnline"
  | "gatewayOffline"
  | "deviceOnline"
  | "deviceOffline"
  | "opened"
  | "closed"
  | "warning"
  | "warningCleared"
  | "batteryOk"
  | "batteryLow"
  | "moodActivated"
  | "doorBoltOk"
  | "doorBoltJammed"
  | "alarmArmed"
  | "alarmDayArmed"
  | "alarmNightArmed"
  | "alarmDisarmed"
  | string;

export interface EventLogEntry {
  id: string;
  timestamp: string;
  iconType: EventIconType;
  title: string;
  bodyText: string;
}

// ---- Energy Saver -------------------------------------------
export interface EnergySaverAway {
  enabled?: boolean;
  validFrom: string | null;
  validTo: string | null;
}

export interface EnergySaver {
  away: EnergySaverAway;
}

// ---- Settings -----------------------------------------------
export interface ElectricityPriceSettings {
  location: string;
  currency: string;
  useHomeSpecificPrices?: boolean;
  energyPrice?: {
    type: "SPOT" | "FIXED" | "NORGESPRIS";
    fixedPrice: number | null;
    supplierMarkup: number;
  };
  gridPrice?: {
    type: "FIXED" | "VARIABLE";
    fixedPrice: number | null;
    simpleVariablePrice?: {
      dayStartsAt: string;
      dayPrice: number;
      nightStartsAt: string;
      nightPrice: number;
      weekendPrice: number;
    };
  };
}

export interface HomeSettings {
  electricityPrice?: ElectricityPriceSettings | null;
  alarm?: { pinRequired: boolean };
  electricityMainCircuitBreaker?: { value: number };
  electricityGridTariffLevel?: { value: number };
  arcSettings?: { testModeUntil: string | null };
}

// ---- Home ---------------------------------------------------
export interface Home {
  id: string;
  name: string;
  address: Address | null;
  timeZone: string;
  gateway: Gateway;
  rooms: Room[];
  moods?: Mood[];
  rules: Rule[];
  groups: Group[];
  settings?: HomeSettings;
  users: HomeUser[];
  warnings: Warning[];
  recentEvents: EventLogEntry[];
  energySaver?: EnergySaver;
  activeProfile?: ActiveProfile;
  profiles?: AlarmProfiles;
}

// ---- SSE Events ---------------------------------------------
export interface SSEEvent {
  eventType: string;
  id?: string;
  timestamp?: string;
  actionId?: string;
  home?: Home;
  deviceId?: string;
  deviceName?: string;
  name?: string;
  value?: unknown;
  preview?: string;
  moodId?: string;
  activeMoods?: string[];
  groupId?: string;
  roomId?: string;
  ruleId?: string;
  activeProfile?: ActiveProfile;
  warnings?: Warning[];
  softwareUpdate?: SoftwareUpdate;
  error?: string;
  progress?: number;
  [key: string]: unknown;
}

// ---- Electricity Prices -------------------------------------
export interface ElectricityPrice {
  startTime: string;
  value: number;
  level?: string;
}

// ---- Measurements -------------------------------------------
export interface Measurement {
  groupKey: string;
  time: string;
  value: number;
}

// ---- API Responses ------------------------------------------
export interface ActionResponse {
  actionId: string;
  targetStatus?: string;
}
