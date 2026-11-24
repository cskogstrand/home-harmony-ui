import { expect, it } from "vitest";
import type { PhysicalDevice } from "@/types/api";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { accessStatus, cabinClimate, cabinState, driveStatus, teslaVehicles, tyrePressureBar, vehicleCommandReport, vehicleGroup, vehicleSummary, vehicleTrip } from "@/lib/vehicles";
import { config, state } from "./ha-fixtures";

it("observes the requested setpoint when exposed and scopes the default for new actions to fresh readings from the chosen car", () => {
  const devices = [{ id: "first" }, { id: "other" }];
  const entries = [
    ["sensor.setpoint", "first", "driver_temp_setting"], ["sensor.battery", "first", "battery_level"], ["sensor.other", "other", "battery_level"],
  ].map(([id, device_id, original_name]) => ({ id, entity_id: id, device_id, original_name, platform: "teslamate" }));
  const home = (setpoint: string, battery: string, other: string) => mapHome({
    "sensor.setpoint": state("sensor.setpoint", setpoint, { unit_of_measurement: "°F" }),
    "sensor.battery": state("sensor.battery", battery), "sensor.other": state("sensor.other", other),
  }, { ...emptyRegistries, devices, entities: entries }, "home", config);
  const before = home("77", "15", "24");
  const temperature = vehicleCommandReport(before, "teslamate:first", "climate.example", "temperature", 20);
  expect(temperature(home("77", "16", "25"))).toBe(false);
  expect(temperature(home("70", "16", "25"))).toBe(false);
  expect(temperature(home("68", "16", "25"))).toBe(true);
  const nextReport = vehicleCommandReport(before, "teslamate:first", "button.example", "press", undefined);
  expect(nextReport(home("77", "15", "25"))).toBe(false);
  expect(nextReport(home("77", "unavailable", "25"))).toBe(false);
  expect(nextReport(home("77", "16", "25"))).toBe(true);
});

it("discovers each TeslaMate car from MQTT registry metadata and ignores unrelated MQTT devices", () => {
  const devices: PhysicalDevice[] = [
    { id: "first", identifiers: [["mqtt", "teslamate_car_1"]] },
    { id: "second", identifiers: [["mqtt", "teslamate_demo_2_car_1"]] },
    { id: "third", identifiers: [["mqtt", "teslamate/cars/3"]] },
    { id: "other", model: "Model 3" },
  ];
  const entities = devices.map(device => ({
    id: device.id, device_id: device.id, entity_id: `device_tracker.${device.id}`, platform: "mqtt",
  }));
  const cars = teslaVehicles(mapHome({}, { ...emptyRegistries, entities, devices }, "home"));
  expect(cars.map(car => [car.id, car.entities.map(e => e.entityId)])).toEqual([
    ["teslamate:first", ["device_tracker.first"]], ["teslamate:second", ["device_tracker.second"]], ["teslamate:third", ["device_tracker.third"]],
  ]);
});

it("keeps TeslaMate's charge limit and projected arrival level out of the current battery reading", () => {
  const readings = ["active_route_energy_at_arrival", "charge_limit_soc", "usable_battery_level", "battery_level"]
    .map((key, i) => state(`sensor.example_${key}`, String(10 * i), { device_class: "battery", unit_of_measurement: "%" }));
  const car = mapHome(Object.fromEntries(readings.map(r => [r.entity_id, r])), emptyRegistries, "home");
  expect(vehicleSummary(car.entities).battery?.state).toBe("30");
  expect(vehicleSummary(car.entities.slice(0, 3)).battery?.state).toBe("20");
  expect(vehicleSummary(car.entities.slice(0, 2)).battery).toBeUndefined();
});

it("anchors Fleet charge duration to its reading and clears the estimate when charging stops", () => {
  const remaining = state("sensor.example_time_to_full_charge", "1.5", { unit_of_measurement: "h" });
  const charging = state("sensor.example_charging_state", "charging");
  const target = state("number.example_charge_limit", "101", { unit_of_measurement: "%" });
  const summary = () => vehicleSummary(mapHome({
    [remaining.entity_id]: remaining, [charging.entity_id]: charging, [target.entity_id]: target,
  }, emptyRegistries, "home").entities);

  expect(summary().finish).toBe(Date.parse(remaining.last_updated) + 90 * 60000);
  expect(summary().limit).toBeUndefined();
  charging.state = "disconnected";
  expect(summary().finish).toBeNaN();
  charging.state = "charging";
  remaining.attributes.unit_of_measurement = "unknown";
  expect(summary().finish).toBeNaN();
});

it("keeps the cabin, closures and active destination distinct from the charge port and parked car", () => {
  const readings = [
    state("lock.example_charge_port_latch", "unlocked"), state("lock.example_doors", "locked"),
    state("binary_sensor.example_windows", "on", { device_class: "window", friendly_name: "Windows", "Driver Front": "Closed", "Passenger Rear": "Open" }),
    state("cover.example_windows", "open", { friendly_name: "Windows" }), state("cover.example_frunk", "closed"),
    state("cover.example_charger_door", "open"), state("climate.example_hvac", "unavailable"),
    state("device_tracker.example_destination", "not_home", { latitude: 11, longitude: 21 }),
    state("device_tracker.example_location", "home", { latitude: 0, longitude: 0 }),
    state("sensor.example_arrival_time", "2030-04-09T10:00:00Z", { Destination: "Example park" }),
    state("sensor.example_tpms_front_left", "41"), state("select.example_heated_seat_rear_left", "low"),
  ];
  const entities = mapHome(Object.fromEntries(readings.map(r => [r.entity_id, r])), emptyRegistries, "home").entities;
  const protection = state("climate.example_cabin_overheat_protection", "off");
  const cabin = state("climate.example_climate", "heat_cool");
  const climates = mapHome({ [protection.entity_id]: protection, [cabin.entity_id]: cabin }, emptyRegistries, "home").entities;
  expect(cabinClimate(climates)?.entityId).toBe(cabin.entity_id);
  expect(cabinClimate(climates.filter(e => e.entityId === protection.entity_id))).toBeUndefined();
  const access = accessStatus(entities);
  expect(access.lock?.state).toBe("locked");
  expect(access.open).toEqual([{ name: "Windows", position: "Passenger Rear" }]);
  expect(cabinState(entities.find(e => e.domain === "climate"))).toBeUndefined();
  expect(vehicleTrip(entities, new Date("2030-04-09T09:00:00Z"))).toMatchObject({ coordinates: { lat: 0, lon: 0 }, destination: "Example park", eta: new Date("2030-04-09T10:00:00Z") });
  expect(vehicleTrip(entities, new Date("2030-04-09T11:00:00Z"))).toMatchObject({ destination: undefined, eta: undefined });
  expect(entities.slice(-2).map(vehicleGroup)).toEqual(["Wheel pressures", "Seat heating"]);
});

it.each([["psi", "40.6", "2.8"], ["bar", "3", "3.0"], ["kPa", "294", "2.9"], ["MPa", "0.25", "2.5"], ["psi", "0", "0.0"], ["unknown", "42", undefined], ["psi", "unavailable", undefined]])("normalizes wheel pressure %s %s to bar", (unit, value, result) => {
  const reading = state("sensor.example_tpms_front_left", value, { unit_of_measurement: unit });
  const [wheel] = mapHome({ [reading.entity_id]: reading }, emptyRegistries, "home").entities;
  expect(tyrePressureBar(wheel)?.toFixed(1)).toBe(result);
});

it("resolves the car's address and driving readings independently of its route and other cars", () => {
  const sensors = [
    state("sensor.car_destination_address", "Example destination"),
    state("sensor.car_ip_address", "192.0.2.1"),
    state("sensor.car_geocoded_location", "Example road"),
    state("sensor.car_fan_speed", "2", { unit_of_measurement: "%" }),
    state("sensor.car_speed", "unavailable", { unit_of_measurement: "km/h" }),
    state("sensor.car_heading", "-1"), state("sensor.car_gear", "REVERSE"),
    state("device_tracker.car", "Example zone", { heading: 0, speed: 10, speed_unit: "mph" }),
    state("zone.example", "0", { friendly_name: "Example zone" }),
    state("sensor.other_address", "Other road"),
  ];
  const home = mapHome(Object.fromEntries(sensors.map(s => [s.entity_id, s])), emptyRegistries, "home");
  const car = home.entities.filter(e => !e.entityId.startsWith("sensor.other") && e.domain !== "zone");
  const trip = () => vehicleTrip(car, new Date(), home.entities);
  expect(trip()).toMatchObject({ address: "Example road", zone: { name: "Example zone" }, coordinates: undefined,
    speed: { value: 10, unit: "mph" }, heading: 0, gear: "R" });
  car.find(e => e.entityId === "sensor.car_geocoded_location").state = "unknown";
  const tracker = car.find(e => e.domain === "device_tracker");
  tracker.state = "not_home";
  tracker.attributes.speed = -1;
  tracker.attributes.heading = 361;
  expect(trip()).toMatchObject({ zone: undefined, address: undefined, speed: undefined, heading: undefined });
});

it.each([
  ["P", "off", 0, "Parked"], ["D", "off", 0, "Drive gear"], ["D", "off", 12, "Driving"],
  ["R", "off", 0, "Reverse gear"], ["N", "off", 0, "Neutral gear"],
  ["unknown", "on", -1, "Parked"], ["unknown", "off", 0, "Stationary"], ["unknown", "off", -1, "Drive status unknown"],
])("reports gear %s with brake %s and speed %s", (gear, brake, speed, label) => {
  const readings = [state("sensor.example_shift_state", String(gear)), state("binary_sensor.example_parking_brake", String(brake)), state("device_tracker.example", "home", { speed })];
  const car = mapHome(Object.fromEntries(readings.map(r => [r.entity_id, r])), emptyRegistries, "home");
  expect(driveStatus(car.entities).label).toBe(label);
});

it("follows TeslaMate's reported state even while the last gear remains parked", () => {
  const values = [state("sensor.renamed", "online"), state("sensor.example_gear", "P")];
  const home = mapHome(Object.fromEntries(values.map(e => [e.entity_id, e])), { ...emptyRegistries,
    entities: [{ id: "status", entity_id: "sensor.renamed", unique_id: "teslamate_demo_2_1_state", platform: "mqtt" }],
  }, "home");
  const sensor = home.entities.find(e => e.entityId === "sensor.renamed");
  for (const [value, label] of Object.entries({ online: "Parked", driving: "Driving", charging: "state.charging",
    suspended: "Polling paused", asleep: "Asleep", offline: "Offline", updating: "Updating", start: "Starting" })) {
    sensor.state = value;
    expect(driveStatus(home.entities).label).toBe(label);
  }
});

it("distinguishes Tesla sleep reports from loss of connectivity and ignores a disconnected charge cable", () => {
  const values = [state("binary_sensor.example_status", "off", { device_class: "connectivity" }),
    state("binary_sensor.example_asleep", "off"), state("binary_sensor.example_charge_cable", "off", { device_class: "connectivity" }),
    state("sensor.example_gear", "D")];
  const { entities } = mapHome(Object.fromEntries(values.map(e => [e.entity_id, e])), { ...emptyRegistries,
    entities: [{ id: "connection", entity_id: "binary_sensor.example_status", translation_key: "state", platform: "tesla_fleet" }],
  }, "home");
  const [online, sleep] = entities;
  expect(driveStatus(entities).label).toBe("Offline");
  sleep.state = "on";
  expect(driveStatus(entities).label).toBe("Asleep");
  sleep.state = "unavailable";
  online.attributes.state = "asleep";
  expect(driveStatus(entities).label).toBe("Asleep");
  online.state = "on";
  online.attributes.state = "online";
  expect(driveStatus(entities).label).toBe("Drive gear");
  online.state = "unavailable";
  expect(driveStatus(entities).label).toBe("Drive gear");
});
