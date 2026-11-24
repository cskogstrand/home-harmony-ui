import type { ConfiguredCamera } from "../../shared/cameras";
import type { Entity } from "@/types/api";

const frigateSource = (camera: ConfiguredCamera) => camera.frigatePreview ?? (camera.personSnapshot.type === "frigate" ? camera.personSnapshot : undefined);
const occupancyId = (name: string) => `binary_sensor.${name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}_person_occupancy`;

// Snapshot images can persist for days. Only a live occupancy sensor reports a person now.
export function cameraPersonSensors(cameras: ConfiguredCamera[], entities: Entity[]) {
  const result = new Map<string, Entity>();
  if (!cameras.length) return result;
  const byPreference = new Map<string, Entity>();
  const frigateEntities = new Map<string, Entity>();
  const ambiguous = new Set<string>();
  for (const entity of entities) {
    if (entity.domain === "binary_sensor") byPreference.set(entity.preferenceId, entity);
    if (entity.integration !== "frigate") continue;
    frigateEntities.set(entity.entityId, entity);
    // HA appends a numeric suffix when integrations claim the same entity ID.
    if (entity.domain === "binary_sensor" && /_person_occupancy_\d+$/.test(entity.entityId)) ambiguous.add(entity.entityId.replace(/_\d+$/, ""));
  }
  const connections = new Map<string, string>();
  for (const camera of cameras) {
    const source = frigateSource(camera);
    if (!source) continue;
    const id = occupancyId(source.camera);
    if (connections.has(id) && connections.get(id) !== source.connectionId) ambiguous.add(id);
    connections.set(id, source.connectionId);
  }
  for (const camera of cameras) {
    const name = frigateSource(camera)?.camera
      ?? (camera.connectionId === "home-assistant" && frigateEntities.has(camera.source) ? camera.source.slice("camera.".length) : undefined);
    const id = name && occupancyId(name);
    const sensor = camera.personDetectionEntity ? byPreference.get(camera.personDetectionEntity)
      : id && !ambiguous.has(id) && frigateEntities.get(id);
    if (sensor) result.set(camera.id, sensor);
  }
  return result;
}
