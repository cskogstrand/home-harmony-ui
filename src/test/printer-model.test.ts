import { describe, expect, it } from "vitest";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { isPrinterMainEntity, printerModel } from "@/lib/printer-model";
import { printerHome } from "./device-card-fixtures";
import { state } from "./ha-fixtures";

const now = Date.parse("2030-06-15T11:00:00Z");
const model = (...args: Parameters<typeof printerHome>) => {
  const home = printerHome(...args);
  return printerModel(home.devices[0], home.entities, now);
};

describe("printerModel", () => {
  it("reads progress, time, stage, temperatures, trays and media from a printing device", () => {
    const printer = model()!;
    expect(printer).toMatchObject({
      adapter: "bambu_lab", phase: "printing", progress: 42, remainingMinutes: 75, endTime: "2030-06-15T12:20:00+00:00",
      nozzle: { current: 219.6, target: 220, unit: "°C" }, bed: { current: 54.8, target: 55, unit: "°C" }, error: undefined,
    });
    expect(printer.main.entityId).toBe("sensor.workshop_printer_print_progress");
    expect(printer.stage?.entityId).toBe("sensor.workshop_printer_current_stage");
    expect(printer.media?.entityId).toBe("camera.workshop_printer_camera");
    // Filament unit trays come first in slot order, then the printer's external spool.
    expect(printer.trays.map(({ entity, color, type, active, empty }) => [entity.entityId, color, type, active, empty])).toEqual([
      ["sensor.filament_unit_tray_1", "#f4f1e8", "PLA", true, false],
      ["sensor.filament_unit_tray_2", "#d9482b", "PLA", false, false],
      ["sensor.filament_unit_tray_3", undefined, undefined, false, true],
      ["sensor.workshop_printer_external_spool", "#1f2a44", "PETG", false, false],
    ]);
  });

  it("detects the same printer from entity id suffixes when translation keys are missing", () => {
    const printer = model({}, { translationKeys: false })!;
    expect(printer.nozzle).toEqual({ current: 219.6, target: 220, unit: "°C" });
    expect(printer.stage?.entityId).toBe("sensor.workshop_printer_current_stage");
    expect(printer.trays).toHaveLength(4);
  });

  it("shows the cover image unless a print is running", () => {
    expect(model({ "sensor.workshop_printer_print_status": "finish" })!.media?.entityId).toBe("image.workshop_printer_cover_image");
    expect(model({ "sensor.workshop_printer_print_status": "pause" })!.media?.entityId).toBe("camera.workshop_printer_camera");
    expect(model({ "sensor.workshop_printer_print_status": "running", "camera.workshop_printer_camera": "unavailable" })!.media?.entityId).toBe("image.workshop_printer_cover_image");
  });

  it.each([
    ["finish", "finished"], ["failed", "failed"], ["idle", "idle"], ["pause", "paused"], ["prepare", "printing"], ["offline", "unavailable"],
  ])("maps the %s status to the %s phase", (status, phase) => {
    expect(model({ "sensor.workshop_printer_print_status": status })!.phase).toBe(phase);
  });

  it("separates an unavailable printer from an idle one", () => {
    const offline = { "sensor.workshop_printer_print_status": "unavailable", "sensor.workshop_printer_current_stage": "unavailable", "sensor.workshop_printer_print_progress": "unavailable" };
    expect(model(offline)!.phase).toBe("unavailable");
    expect(model({ "sensor.workshop_printer_print_status": "idle", "sensor.workshop_printer_print_progress": "0" })!.phase).toBe("idle");
  });

  it("reports the print error text first, then the first HMS message", () => {
    const hms = { "binary_sensor.workshop_printer_hms_errors": { state: "on", attributes: { Count: 1, "1-Error": "Example filament runout." } } };
    expect(model(hms)!.error).toBe("Example filament runout.");
    expect(model({ ...hms, "binary_sensor.workshop_printer_print_error": { state: "on", attributes: { code: 1, error: "Example nozzle clog." } } })!.error).toBe("Example nozzle clog.");
  });

  it("falls back to the finish time and converts remaining time units", () => {
    expect(model({ "sensor.workshop_printer_remaining_time": "unavailable" })!.remainingMinutes).toBe(80);
    expect(model({ "sensor.workshop_printer_remaining_time": { state: "95", attributes: { unit_of_measurement: "min" } } })!.remainingMinutes).toBe(95);
  });

  it("does not treat other devices as printers", () => {
    const home = printerHome();
    expect(printerModel(home.devices[1], home.entities, now)).toBeUndefined();
    const noTime = printerHome({}).entities.filter(entity => !/remaining_time|end_time/.test(entity.entityId));
    expect(printerModel(home.devices[0], noTime, now)).toBeUndefined();
    const plain = mapHome({ "sensor.washer_progress": state("sensor.washer_progress", "40", { unit_of_measurement: "%" }) }, {
      ...emptyRegistries, devices: [{ id: "washer" }], entities: [{ id: "w", entity_id: "sensor.washer_progress", device_id: "washer", platform: "example" }],
    }, "example");
    expect(printerModel(plain.devices[0], plain.entities, now)).toBeUndefined();
  });

  it("offers only printer progress, status and stage sensors as a card's main entity", () => {
    const entities = printerHome().entities;
    expect(entities.filter(isPrinterMainEntity).map(entity => entity.entityId)).toEqual([
      "sensor.workshop_printer_print_progress", "sensor.workshop_printer_print_status", "sensor.workshop_printer_current_stage",
    ]);
  });
});
