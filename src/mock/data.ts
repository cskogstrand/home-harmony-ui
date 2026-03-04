import type {
  Home, Room, Device, Gateway, HomeUser, Warning, EventLogEntry,
  Mood, Rule, Group, ActiveProfile, AlarmProfiles, HomeSettings,
  DeviceAttribute, EnergySaver,
} from "@/types/api";

// ---- Helpers ------------------------------------------------
const now = new Date().toISOString();
const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

const attr = (name: string, value: unknown, unit?: string, extras?: Partial<DeviceAttribute>): DeviceAttribute => ({
  name, value, updatedAt: ago(Math.random() * 60), unit, ...extras,
});

// ---- Devices ------------------------------------------------
export const mockDevices: Device[] = [
  {
    id: "dev-1", name: "Living Room Light", type: "dimmableLight", displayType: "Dimmable Light",
    online: true, icon: "lightBulb", iconOptions: ["lightBulb"], troubleshooting: null,
    lastActivityAt: ago(2), vendor: "IKEA", model: "TRADFRI", softwareVersion: "2.3.093",
    softwareUpdate: null, hardwareVersion: "1.0", ignoreInMoods: false,
    supportsGroups: true, supportsIdentify: true, energySaverEnabled: false,
    alarmDevice: false, profiles: null, location: "room-1",
    attributes: [
      attr("isOn", true), attr("brightness", 75, "%", { minValue: 0, maxValue: 100, step: 1 }),
    ],
  },
  {
    id: "dev-2", name: "Bedroom Thermostat", type: "thermostat", displayType: "Thermostat",
    online: true, icon: "thermostat", iconOptions: ["thermostat"], troubleshooting: null,
    lastActivityAt: ago(5), vendor: "Danfoss", model: "Ally", softwareVersion: "1.0.4",
    softwareUpdate: { status: "available", version: "1.0.5", progress: null },
    hardwareVersion: "2.0", ignoreInMoods: false,
    supportsGroups: true, supportsIdentify: false, energySaverEnabled: true,
    eligibleForEnergySaver: true, alarmDevice: false, profiles: null, location: "room-2",
    attributes: [
      attr("currentTemperature", 21.5, "°C"), attr("targetTemperature", 22, "°C", { minValue: 5, maxValue: 30, step: 0.5 }),
    ],
  },
  {
    id: "dev-3", name: "Front Door Lock", type: "doorLock", displayType: "Door Lock",
    online: true, icon: "doorLock", iconOptions: ["doorLock"], troubleshooting: null,
    lastActivityAt: ago(15), vendor: "Yale", model: "Doorman V2N", softwareVersion: "3.1.0",
    softwareUpdate: null, hardwareVersion: "2.1", ignoreInMoods: true,
    supportsGroups: false, supportsIdentify: false, energySaverEnabled: false,
    alarmDevice: true, profiles: ["armed", "nightArmed"], location: "room-3",
    attributes: [
      attr("lockState", "locked"), attr("batteryLevel", 82, "%"),
    ],
  },
  {
    id: "dev-4", name: "Kitchen Motion Sensor", type: "sensorMotion", displayType: "Motion Sensor",
    online: true, icon: "motionDetector", iconOptions: ["motionDetector"], troubleshooting: null,
    lastActivityAt: ago(1), vendor: "Aqara", model: "RTCGQ11LM", softwareVersion: "1.2.0",
    softwareUpdate: null, hardwareVersion: "1.0", ignoreInMoods: true,
    supportsGroups: false, supportsIdentify: false, energySaverEnabled: false,
    alarmDevice: true, profiles: ["armed", "dayArmed"], location: "room-4",
    attributes: [
      attr("motion", false), attr("batteryLevel", 95, "%"), attr("lux", 340, "lx"),
    ],
  },
  {
    id: "dev-5", name: "Front Door Sensor", type: "sensorContactDoor", displayType: "Door Sensor",
    online: true, icon: "magnetContact", iconOptions: ["magnetContact"], troubleshooting: null,
    lastActivityAt: ago(30), vendor: "Aqara", model: "MCCGQ11LM", softwareVersion: "1.0.1",
    softwareUpdate: null, hardwareVersion: "1.0", ignoreInMoods: true,
    supportsGroups: false, supportsIdentify: false, energySaverEnabled: false,
    alarmDevice: true, profiles: ["armed", "nightArmed"], location: "room-3",
    attributes: [attr("contact", true), attr("batteryLevel", 88, "%")],
  },
  {
    id: "dev-6", name: "Smoke Detector", type: "smokeDetector", displayType: "Smoke Detector",
    online: false, icon: "smokeDetector", iconOptions: ["smokeDetector"],
    troubleshooting: "Device has been offline for 2 hours. Check battery.",
    lastActivityAt: ago(120), vendor: "Heiman", model: "HS1SA", softwareVersion: "1.0.0",
    softwareUpdate: null, hardwareVersion: "1.0", ignoreInMoods: true,
    supportsGroups: false, supportsIdentify: false, energySaverEnabled: false,
    alarmDevice: true, profiles: null, location: "room-1",
    attributes: [attr("smoke", false), attr("batteryLevel", 12, "%")],
  },
  {
    id: "dev-7", name: "Water Valve", type: "waterValve", displayType: "Water Valve",
    online: true, icon: "waterValve", iconOptions: ["waterValve"], troubleshooting: null,
    lastActivityAt: ago(8), vendor: "Onics", model: "WV-1", softwareVersion: "2.0.1",
    softwareUpdate: null, hardwareVersion: "1.0", ignoreInMoods: false,
    supportsGroups: false, supportsIdentify: false, energySaverEnabled: false,
    alarmDevice: false, profiles: null, location: null,
    attributes: [attr("isOpen", true)],
  },
  {
    id: "dev-8", name: "EV Charger", type: "evCharger", displayType: "EV Charger",
    online: true, icon: "evCharger", iconOptions: ["evCharger"], troubleshooting: null,
    lastActivityAt: ago(3), vendor: "Easee", model: "Home", softwareVersion: "4.2.0",
    softwareUpdate: null, hardwareVersion: "3.0", ignoreInMoods: true,
    supportsGroups: false, supportsIdentify: false, energySaverEnabled: true,
    eligibleForEnergySaver: true, external: true, externalDeviceId: "ext-ev-1",
    alarmDevice: false, profiles: null, location: null,
    attributes: [
      attr("chargingState", "idle"), attr("currentPower", 0, "kW"),
      attr("sessionEnergy", 0, "kWh"),
    ],
  },
  {
    id: "dev-9", name: "Kitchen Smart Plug", type: "socketSingle", displayType: "Smart Plug",
    online: true, icon: "socketSingle", iconOptions: ["socketSingle"], troubleshooting: null,
    lastActivityAt: ago(10), vendor: "IKEA", model: "TRETAKT", softwareVersion: "1.0.2",
    softwareUpdate: null, hardwareVersion: "1.0", ignoreInMoods: false,
    supportsGroups: true, supportsIdentify: true, energySaverEnabled: false,
    alarmDevice: false, profiles: null, location: "room-4",
    attributes: [attr("isOn", true)],
  },
];

// ---- Rooms --------------------------------------------------
export const mockRooms: Room[] = [
  { id: "room-1", name: "Living Room", icon: "sofa", devices: mockDevices.filter(d => d.location === "room-1") },
  { id: "room-2", name: "Bedroom", icon: "bed", devices: mockDevices.filter(d => d.location === "room-2") },
  { id: "room-3", name: "Hallway", icon: "door", devices: mockDevices.filter(d => d.location === "room-3") },
  { id: "room-4", name: "Kitchen", icon: "utensils", devices: mockDevices.filter(d => d.location === "room-4") },
];

// ---- Gateway ------------------------------------------------
export const mockGateway: Gateway = {
  id: "gw-abc123", name: "Home Hub", online: true, troubleshooting: null,
  lastActivityAt: ago(0), vendor: "Onics", model: "Hub Pro",
  softwareVersion: "5.2.1", hardwareVersion: "3.0", setupState: null,
  softwareUpdate: null,
};

// ---- Users --------------------------------------------------
export const mockUsers: HomeUser[] = [
  { email: "anna@example.com", name: "Anna Lindqvist", firstName: "Anna", lastName: "Lindqvist", role: "master", expiresAt: null },
  { email: "erik@example.com", name: "Erik Lindqvist", firstName: "Erik", lastName: "Lindqvist", role: "user", expiresAt: null },
  { email: "guest@example.com", name: "Marie Svensson", firstName: "Marie", lastName: "Svensson", role: "guest", expiresAt: "2026-04-01T00:00:00Z" },
];

// ---- Moods --------------------------------------------------
export const mockMoods: Mood[] = [
  { id: "mood-1", name: "Good Morning", icon: "sunrise", active: false, roomId: undefined,
    devices: [{ deviceId: "dev-1", attributes: [attr("isOn", true), attr("brightness", 60, "%")] }] },
  { id: "mood-2", name: "Movie Night", icon: "film", active: false, roomId: "room-1",
    devices: [{ deviceId: "dev-1", attributes: [attr("isOn", true), attr("brightness", 20, "%")] }] },
  { id: "mood-3", name: "Away", icon: "plane", active: false, roomId: undefined, devices: [] },
  { id: "mood-4", name: "Good Night", icon: "moon", active: true, roomId: undefined, devices: [] },
];

// ---- Rules --------------------------------------------------
export const mockRules: Rule[] = [
  { id: "rule-1", name: "Turn off lights at midnight", enabled: true,
    conditions: [{ type: "time", time: "00:00" }],
    actions: [{ type: "deviceControl", deviceId: "dev-1", attribute: "isOn", value: false }] },
  { id: "rule-2", name: "Lock door when armed", enabled: true,
    conditions: [{ type: "alarmMode", mode: "armed" }],
    actions: [{ type: "deviceControl", deviceId: "dev-3", attribute: "lockState", value: "locked" }] },
  { id: "rule-3", name: "Kitchen light on motion", enabled: false,
    conditions: [{ type: "deviceAttribute", deviceId: "dev-4", attribute: "motion", value: true }],
    actions: [{ type: "deviceControl", deviceId: "dev-1", attribute: "isOn", value: true }] },
];

// ---- Groups -------------------------------------------------
export const mockGroups: Group[] = [
  { id: "grp-1", name: "All Lights", deviceIds: ["dev-1"], attributes: [attr("isOn", true), attr("brightness", 75, "%")] },
];

// ---- Warnings -----------------------------------------------
export const mockWarnings: Warning[] = [
  { id: "warn-1", type: "deviceOffline", message: "Smoke Detector has been offline for 2 hours",
    deviceId: "dev-6", deviceName: "Smoke Detector", createdAt: ago(120) },
  { id: "warn-2", type: "batteryLow", message: "Smoke Detector battery is critically low (12%)",
    deviceId: "dev-6", deviceName: "Smoke Detector", createdAt: ago(90) },
];

// ---- Events -------------------------------------------------
export const mockEvents: EventLogEntry[] = [
  { id: "evt-1", timestamp: ago(1), iconType: "closed", title: "Front Door Sensor", bodyText: "Contact closed" },
  { id: "evt-2", timestamp: ago(5), iconType: "alarmDisarmed", title: "Alarm", bodyText: "Disarmed by Anna" },
  { id: "evt-3", timestamp: ago(15), iconType: "moodActivated", title: "Good Night", bodyText: "Mood activated" },
  { id: "evt-4", timestamp: ago(30), iconType: "deviceOffline", title: "Smoke Detector", bodyText: "Device went offline" },
  { id: "evt-5", timestamp: ago(45), iconType: "opened", title: "Front Door Sensor", bodyText: "Contact opened" },
  { id: "evt-6", timestamp: ago(60), iconType: "alarmArmed", title: "Alarm", bodyText: "Armed by Anna" },
  { id: "evt-7", timestamp: ago(90), iconType: "batteryLow", title: "Smoke Detector", bodyText: "Battery low (12%)" },
  { id: "evt-8", timestamp: ago(120), iconType: "gatewayOnline", title: "Home Hub", bodyText: "Gateway came online" },
];

// ---- Active Profile -----------------------------------------
export const mockActiveProfile: ActiveProfile = {
  mode: "disarmed", modeChangedAt: ago(5), modeChangedBy: "anna@example.com", previousMode: "armed",
};

export const mockAlarmProfiles: AlarmProfiles = {
  armed: { entryDuration: 30, exitDuration: 30 },
  dayArmed: { entryDuration: 15, exitDuration: 15 },
  nightArmed: { entryDuration: 20, exitDuration: 20 },
};

// ---- Settings -----------------------------------------------
export const mockSettings: HomeSettings = {
  electricityPrice: {
    location: "NO1", currency: "NOK", useHomeSpecificPrices: false,
    energyPrice: { type: "SPOT", fixedPrice: null, supplierMarkup: 0.05 },
    gridPrice: { type: "VARIABLE", fixedPrice: null,
      simpleVariablePrice: { dayStartsAt: "06:00", dayPrice: 0.45, nightStartsAt: "22:00", nightPrice: 0.25, weekendPrice: 0.25 } },
  },
  alarm: { pinRequired: true },
  electricityMainCircuitBreaker: { value: 25 },
  electricityGridTariffLevel: { value: 3 },
};

export const mockEnergySaver: EnergySaver = {
  away: { enabled: false, validFrom: null, validTo: null },
};

// ---- Assembled Home -----------------------------------------
export const mockHome: Home = {
  id: "home-1",
  name: "Lindqvist Home",
  address: {
    street: "Storgatan 12", propertyUnitNumber: "A",
    postalCode: "11122", city: "Stockholm", countryCode: "SE",
    longitude: 18.0686, latitude: 59.3293,
  },
  timeZone: "Europe/Stockholm",
  gateway: mockGateway,
  rooms: mockRooms,
  moods: mockMoods,
  rules: mockRules,
  groups: mockGroups,
  settings: mockSettings,
  users: mockUsers,
  warnings: mockWarnings,
  recentEvents: mockEvents,
  energySaver: mockEnergySaver,
  activeProfile: mockActiveProfile,
  profiles: mockAlarmProfiles,
};

export const mockHomes: Home[] = [
  mockHome,
  {
    ...mockHome,
    id: "home-2",
    name: "Mountain Cabin",
    address: { street: "Fjellveien 8", city: "Hemsedal", countryCode: "NO", postalCode: "3560", longitude: 8.3948, latitude: 60.8609 },
    rooms: [],
    warnings: [],
    recentEvents: [],
    gateway: { ...mockGateway, id: "gw-xyz789", name: "Cabin Hub", online: false, troubleshooting: "Gateway offline since last power outage" },
  },
];

// ---- Current user context -----------------------------------
export type UserRole = "user" | "master" | "support" | "admin";

export interface AppUser {
  email: string;
  name: string;
  role: UserRole;
}

export const mockCurrentUser: AppUser = {
  email: "anna@example.com",
  name: "Anna Lindqvist",
  role: "master",
};
