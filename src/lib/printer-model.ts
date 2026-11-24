import type { Entity, PhysicalDevice } from "@/types/api";
import { available } from "./ha-model";

type Role = "progress" | "status" | "stage" | "remaining" | "end" | "nozzle" | "nozzleTarget" | "bed" | "bedTarget"
  | "tray" | "printError" | "hms" | "camera" | "cover";

/**
 * One printer integration: the registry translation keys (or entity id suffixes) of its entities and how its
 * status sensor names each phase. Add another integration as a second entry in `printerAdapters`.
 */
export interface PrinterAdapter {
  id: string;
  keys: Record<Role, { domains: string[]; keys: string[] }>;
  /** Status sensor states per phase; "offline" counts as unavailable. */
  phases: Partial<Record<Exclude<PrinterPhase, "unavailable"> | "offline", string[]>>;
}

// Keys verified against the Bambu Lab integration (ha-bambulab, custom_components/bambu_lab/definitions.py).
// Older installations named the stage sensor `current_stage`; its translation key is `stage`.
// Filament trays sit on the AMS devices linked to the printer; the external spool sits on the printer itself.
const bambuLab: PrinterAdapter = {
  id: "bambu_lab",
  keys: {
    progress: { domains: ["sensor"], keys: ["print_progress"] },
    status: { domains: ["sensor"], keys: ["print_status"] },
    stage: { domains: ["sensor"], keys: ["stage", "current_stage"] },
    remaining: { domains: ["sensor"], keys: ["remaining_time"] },
    end: { domains: ["sensor"], keys: ["end_time"] },
    nozzle: { domains: ["sensor"], keys: ["nozzle_temp"] },
    nozzleTarget: { domains: ["sensor"], keys: ["target_nozzle_temp"] },
    bed: { domains: ["sensor"], keys: ["bed_temp"] },
    bedTarget: { domains: ["sensor"], keys: ["target_bed_temp"] },
    tray: { domains: ["sensor"], keys: ["tray", "external_spool"] },
    printError: { domains: ["binary_sensor"], keys: ["print_error"] },
    hms: { domains: ["binary_sensor"], keys: ["hms_errors"] },
    camera: { domains: ["camera", "image"], keys: ["camera", "p1p_camera"] },
    cover: { domains: ["image"], keys: ["cover_image"] },
  },
  phases: { printing: ["running", "prepare", "slicing", "init"], paused: ["pause"], finished: ["finish"], failed: ["failed"], idle: ["idle"], offline: ["offline"] },
};
export const printerAdapters: PrinterAdapter[] = [bambuLab];

export type PrinterPhase = "printing" | "paused" | "finished" | "failed" | "idle" | "unavailable";
export interface PrinterTemperature { current?: number; target?: number; unit?: string }
export interface PrinterTray { entity: Entity; name: string; color?: string; type?: string; active: boolean; empty: boolean }
export interface PrinterModel {
  adapter: string;
  phase: PrinterPhase;
  /** The entity a printer card is saved against: progress first, then status and stage. */
  main: Entity;
  status?: Entity;
  stage?: Entity;
  progress?: number;
  remainingMinutes?: number;
  /** ISO time the current or last print finishes or finished, when reported. */
  endTime?: string;
  nozzle: PrinterTemperature;
  bed: PrinterTemperature;
  trays: PrinterTray[];
  error?: string;
  camera?: Entity;
  cover?: Entity;
  /** Camera while a print runs, the model's cover image otherwise. */
  media?: Entity;
  entities: Entity[];
}

const objectId = (entity: Entity) => entity.entityId.slice(entity.entityId.indexOf(".") + 1);
// The registry translation key wins; otherwise the longest matching entity id suffix ("target_nozzle_temp" over "nozzle_temp").
function roleOf(entity: Entity, adapter: PrinterAdapter): Role | undefined {
  let best: { role: Role; length: number } | undefined;
  for (const [role, { domains, keys }] of Object.entries(adapter.keys) as [Role, PrinterAdapter["keys"][Role]][]) {
    if (!domains.includes(entity.domain)) continue;
    if (entity.registryName && keys.includes(entity.registryName)) return role;
    const id = objectId(entity);
    for (const key of keys) {
      const match = id === key || id.endsWith(`_${key}`) || (role === "tray" && new RegExp(`(?:^|_)${key}_\\d+$`).test(id));
      if (match && (!best || key.length > best.length)) best = { role, length: key.length };
    }
  }
  return best?.role;
}

/** A sensor that can carry a printer card: its device's progress, status or stage reading. */
export const isPrinterMainEntity = (entity: Entity) => printerAdapters.some(adapter => ["progress", "status", "stage"].includes(roleOf(entity, adapter) ?? ""));

const minutesPerUnit: Record<string, number> = { s: 1 / 60, min: 1, h: 60, d: 1440 };
const number = (entity?: Entity) => entity && available(entity) && entity.state.trim() && Number.isFinite(Number(entity.state)) ? Number(entity.state) : undefined;
const temperature = (current?: Entity, target?: Entity): PrinterTemperature => ({
  current: number(current), target: number(target),
  unit: [current, target].map(entity => entity?.attributes.unit_of_measurement).find((unit): unit is string => typeof unit === "string"),
});
// Bambu reports "#RRGGBBAA"; a fully transparent colour means no filament colour is known.
function trayColor(value: unknown) {
  const match = typeof value === "string" ? /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value.trim()) : null;
  return match && match[2]?.toLowerCase() !== "00" ? `#${match[1].toLowerCase()}` : undefined;
}
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * Describes a 3D printer from its device's entities, or returns undefined when the device is not a printer.
 * `entities` may hold the whole home: entities of devices linked through the printer (filament units) are included.
 */
export function printerModel(device: PhysicalDevice, entities: Entity[], now = Date.now()): PrinterModel | undefined {
  const own = entities.filter(entity => entity.device?.id === device.id || entity.device?.via_device_id === device.id);
  for (const adapter of printerAdapters) {
    const roles = new Map<Role, Entity[]>();
    for (const entity of own) {
      const role = roleOf(entity, adapter);
      if (role && (role === "tray" || entity.device?.id === device.id)) roles.set(role, [...roles.get(role) ?? [], entity]);
    }
    const first = (role: Role) => roles.get(role)?.[0];
    const main = first("progress") ?? first("status") ?? first("stage");
    if (!main || !(first("remaining") || first("end"))) continue;

    const status = first("status"), stage = first("stage"), progressEntity = first("progress");
    const core = [status, stage, progressEntity].filter((entity): entity is Entity => !!entity);
    const phaseOf = (state: string) => (Object.entries(adapter.phases) as [PrinterPhase | "offline", string[]][]).find(([, values]) => values.includes(state))?.[0];
    const reported = status && available(status) ? phaseOf(status.state) : undefined;
    const reading = number(progressEntity);
    const progress = reading === undefined ? undefined : Math.min(100, Math.max(0, reading));
    const phase: PrinterPhase = !core.some(available) || reported === "offline" ? "unavailable"
      : reported ?? (progress !== undefined && progress > 0 && progress < 100 ? "printing" : "idle");

    const remaining = first("remaining"), end = first("end");
    const remainingValue = number(remaining);
    const unit = minutesPerUnit[String(remaining?.attributes.unit_of_measurement ?? "min")];
    const endTime = end && available(end) && Number.isFinite(Date.parse(end.state)) ? end.state : undefined;
    const remainingMinutes = remainingValue !== undefined && unit ? Math.max(0, Math.ceil(remainingValue * unit))
      : endTime ? Math.max(0, Math.ceil((Date.parse(endTime) - now) / 60000)) : undefined;

    const printError = first("printError"), hms = first("hms");
    const error = (printError?.state === "on" ? text(printError.attributes.error) : undefined)
      ?? (hms?.state === "on" ? text(hms.attributes["1-Error"]) : undefined);

    const trays = (roles.get("tray") ?? []).filter(available)
      .sort((a, b) => Number(a.device?.id === device.id) - Number(b.device?.id === device.id) || a.entityId.localeCompare(b.entityId, undefined, { numeric: true }))
      .map(entity => ({ entity, name: entity.name, color: trayColor(entity.attributes.color), type: text(entity.attributes.type),
        active: entity.attributes.active === true, empty: entity.attributes.empty === true || (!text(entity.attributes.type) && !trayColor(entity.attributes.color)) }));

    const camera = roles.get("camera")?.find(available) ?? first("camera");
    const cover = first("cover");
    const running = phase === "printing" || phase === "paused";
    const media = [running ? camera : cover, running ? cover : camera].find(entity => entity && available(entity)) ?? (running ? camera : cover) ?? camera;

    return {
      adapter: adapter.id, phase, main, status, stage, progress, remainingMinutes, endTime,
      nozzle: temperature(first("nozzle"), first("nozzleTarget")), bed: temperature(first("bed"), first("bedTarget")),
      trays, error, camera, cover, media, entities: [...roles.values()].flat(),
    };
  }
}

/** The printer an entity belongs to, for cards saved against one of its sensors. */
export function entityPrinter(entity: Entity | undefined, entities: Entity[], now?: number) {
  return entity?.device ? printerModel(entity.device, entities, now) : undefined;
}
