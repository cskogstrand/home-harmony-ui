import { cleanup, render, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VehicleSystemPanel } from "@/components/VehicleSystems";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { createI18n, type Language } from "@/lib/i18n";
import { tyreCondition, tyreFault, tyreWheels, wheelPosition } from "@/lib/vehicles";
import type { EntityRegistryEntry } from "@/types/api";
import { state } from "./ha-fixtures";

const data = vi.hoisted(() => ({ language: "en" as Language }));
vi.mock("@/contexts/AppContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/AppContext")>(),
  useApp: () => ({ currentHome: { timeZone: "Europe/Oslo", entities: [] }, homeOnline: true, command: vi.fn(), services: {} }) }));
vi.mock("@/hooks/use-i18n", () => ({ useI18n: () => createI18n(data.language) }));
afterEach(() => { cleanup(); data.language = "en"; });

// A fictional car: pressures and status sensors arrive in no particular order, as Home Assistant lists them.
const bar = { device_class: "pressure", unit_of_measurement: "bar" };
const problem = { device_class: "problem" };
const fixtures = [
  state("binary_sensor.example_tire_warning_rear_right", "off", problem),
  state("sensor.example_tire_pressure_front_right", "2.95", bar),
  state("binary_sensor.example_tire_warning_front_left", "off", problem),
  state("sensor.example_tire_pressure_rear_left", "2.4", bar),
  state("binary_sensor.example_tire_warning_front_right", "on", problem),
  state("sensor.example_tire_pressure_front_left", "3.1", bar),
  state("binary_sensor.example_tire_warning_rear_left", "unavailable", problem),
  state("sensor.example_tire_pressure_rear_right", "2.8", bar),
];
const car = (readings = fixtures, entries: EntityRegistryEntry[] = []) =>
  mapHome(Object.fromEntries(readings.map(r => [r.entity_id, r])), { ...emptyRegistries, entities: entries }, "home").entities;
const panel = (readings = fixtures, entries: EntityRegistryEntry[] = []) =>
  render(<VehicleSystemPanel system="Tyre pressure" entities={car(readings, entries)} />).container;
const wheel = (view: HTMLElement, position: string) => view.querySelector<HTMLElement>(`.vehicle-wheels > [data-position="${position}"]`)!;

it("pairs each wheel's pressure with its status sensor by position, in a fixed order", () => {
  const { wheels, unplaced } = tyreWheels(car());
  expect(wheels.map(w => [w.position, w.pressure?.entityId, w.status?.entityId, w.condition])).toEqual([
    ["Front left", "sensor.example_tire_pressure_front_left", "binary_sensor.example_tire_warning_front_left", "ok"],
    ["Front right", "sensor.example_tire_pressure_front_right", "binary_sensor.example_tire_warning_front_right", "fault"],
    ["Rear left", "sensor.example_tire_pressure_rear_left", "binary_sensor.example_tire_warning_rear_left", "unknown"],
    ["Rear right", "sensor.example_tire_pressure_rear_right", "binary_sensor.example_tire_warning_rear_right", "ok"],
  ]);
  expect(wheels.every(w => w.other.length === 0)).toBe(true);
  expect(unplaced).toEqual([]);
});

it("finds positions in the name or unique ID and reads text, enum and psi readings without a fixed integration", () => {
  const readings = [
    state("sensor.example_tpms_a", "42", { unit_of_measurement: "psi", friendly_name: "Tyre pressure RL" }),
    state("sensor.example_tpms_b", "Low", { friendly_name: "Tyre status rear left" }),
    state("sensor.example_wheel_one", "40.6", { unit_of_measurement: "psi" }),
    state("sensor.example_wheel_two", "normal", { device_class: "enum", options: ["normal", "warning"] }),
    state("sensor.example_tpms_fl_status", "Warning"),
  ];
  const entries = [
    { id: "one", entity_id: "sensor.example_wheel_one", unique_id: "vin_tyre_pressure_right_front", platform: "example" },
    { id: "two", entity_id: "sensor.example_wheel_two", unique_id: "vin_tyre_state_right_front", platform: "example" },
  ];
  const entities = car(readings, entries);
  expect(entities.map(wheelPosition)).toEqual(["Rear left", "Rear left", "Front right", "Front right", "Front left"]);
  const { wheels } = tyreWheels(entities);
  expect(wheels.map(w => [w.pressure?.entityId, w.status?.entityId, w.condition])).toEqual([
    [undefined, "sensor.example_tpms_fl_status", "fault"],
    ["sensor.example_wheel_one", "sensor.example_wheel_two", "ok"],
    ["sensor.example_tpms_a", "sensor.example_tpms_b", "fault"],
    [undefined, undefined, undefined],
  ]);
  expect(tyreFault(wheels[2].status!)).toBe("Low pressure");
  expect(tyreFault(wheels[0].status!)).toBeUndefined();
});

it.each([
  ["binary_sensor", "on", "fault"], ["binary_sensor", "off", "ok"], ["binary_sensor", "unknown", "unknown"],
  ["sensor", "OK", "ok"], ["sensor", "Normal", "ok"], ["sensor", "low", "fault"], ["sensor", "unavailable", "unknown"], ["sensor", " ", "unknown"],
])("reads a %s status of %j as %s", (domain, value, condition) => {
  const [status] = car([state(`${domain}.example_tpms_status_fl`, value, domain === "binary_sensor" ? problem : {})]);
  expect(tyreCondition(status)).toBe(condition);
});

it("shows only the pressure on each wheel, in the fixed order around the car", () => {
  const view = panel();
  const wheels = [...view.querySelectorAll<HTMLElement>(".vehicle-wheels > [data-position]")];
  expect(wheels.map(w => w.dataset.position)).toEqual(["Front left", "Front right", "Rear left", "Rear right"]);
  expect(wheels.map(w => w.querySelectorAll("details").length)).toEqual([1, 1, 1, 1]);
  expect(wheels.map(w => w.querySelector("summary strong")?.textContent)).toEqual(["3.1\u00a0bar", "3.0\u00a0bar", "2.4\u00a0bar", "2.8\u00a0bar"]);
  // The status shows as a reading nowhere: only a fault or an unknown status adds a note under the pressure.
  expect(wheels.map(w => w.querySelector(".vehicle-wheel-note")?.textContent ?? null)).toEqual([null, "Tyre warning", "Tyre status unknown", null]);
  // Nothing disappears: the status sensor is listed in the wheel's details.
  expect(within(wheel(view, "Front left")).getByText("binary_sensor.example_tire_warning_front_left")).toBeInTheDocument();
});

it("marks a faulty wheel with words and includes the status in each wheel's accessible name", () => {
  const view = panel();
  const faulty = wheel(view, "Front right");
  expect(faulty).toHaveAttribute("data-condition", "fault");
  expect(faulty.querySelector(".vehicle-wheel-note")).toHaveTextContent("Tyre warning");
  expect(faulty.querySelector("summary")).toHaveTextContent("Front right3.0 barTyre warning");
  const fine = wheel(view, "Front left");
  expect(fine).toHaveAttribute("data-condition", "ok");
  expect(fine.querySelector(".vehicle-wheel-note")).toBeNull();
  expect(fine.querySelector("summary .sr-only")).toHaveTextContent("Tyre status: OK");
});

it("gives an unknown status a neutral note instead of the fault treatment", () => {
  const view = panel();
  const unknown = wheel(view, "Rear left");
  expect(unknown).toHaveAttribute("data-condition", "unknown");
  expect(unknown.querySelector(".vehicle-wheel-note")).toHaveTextContent("Tyre status unknown");
  expect(unknown.querySelector(".vehicle-wheel-note svg")).toBeNull();
  expect(view.querySelectorAll('[data-condition="fault"]')).toHaveLength(1);
});

it("uses the translated status text and Norwegian notes", () => {
  data.language = "nb";
  const readings = [
    state("sensor.example_tpms_front_left", "40.6", { unit_of_measurement: "psi" }), state("sensor.example_tpms_front_left_status", "low"),
    state("sensor.example_tpms_front_right", "41", { unit_of_measurement: "psi" }), state("sensor.example_tpms_front_right_status", "Sensor fault"),
  ];
  const view = panel(readings);
  expect(wheel(view, "Front left").querySelector("summary strong")).toHaveTextContent("2,8 bar");
  expect(wheel(view, "Front left").querySelector(".vehicle-wheel-note")).toHaveTextContent("Lavt trykk");
  expect(wheel(view, "Front right").querySelector(".vehicle-wheel-note")).toHaveTextContent("Sensor fault");
});

it("keeps a lone status or a lone pressure, and a dash for a wheel without readings", () => {
  const readings = [
    state("binary_sensor.example_tire_warning_front_left", "on", problem),
    state("sensor.example_tire_pressure_front_right", "2.9", bar),
  ];
  const view = panel(readings);
  const lone = wheel(view, "Front left");
  expect(lone.querySelector("summary strong")).toHaveTextContent("Problem");
  expect(lone).not.toHaveAttribute("data-condition");
  const plain = wheel(view, "Front right");
  expect(plain).not.toHaveAttribute("data-condition");
  expect(plain.querySelector("summary")).toHaveTextContent(/^Front right2.9 bar$/);
  expect(wheel(view, "Rear left")).toHaveTextContent("Rear left—");
});
