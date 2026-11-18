import { expect, it } from "vitest";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { accessStatus, cabinState, driveStatus, tyrePressureBar, vehicleGroup, vehicleSummary, vehicleTrip } from "@/lib/vehicles";
import { state } from "./ha-fixtures";

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

it.each([
  ["P", "off", 0, "Parked"], ["D", "off", 0, "Drive gear"], ["D", "off", 12, "Driving"],
  ["R", "off", 0, "Reverse gear"], ["N", "off", 0, "Neutral gear"],
  ["unknown", "on", -1, "Parked"], ["unknown", "off", 0, "Stationary"], ["unknown", "off", -1, "Drive status unknown"],
])("reports gear %s with brake %s and speed %s", (gear, brake, speed, label) => {
  const readings = [state("sensor.example_shift_state", String(gear)), state("binary_sensor.example_parking_brake", String(brake)), state("device_tracker.example", "home", { speed })];
  const car = mapHome(Object.fromEntries(readings.map(r => [r.entity_id, r])), emptyRegistries, "home");
  expect(driveStatus(car.entities).label).toBe(label);
});
