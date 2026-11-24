import type { ConfiguredCamera } from "../../shared/cameras";
import type { Entity } from "@/types/api";

// Snapshot images can persist for days. Only a live occupancy sensor reports a person now.
export function cameraPersonSensors(cameras: ConfiguredCamera[], entities: Entity[]) {
  const result = new Map<string, Entity>();
  if (!cameras.length) return result;
  const byPreference = new Map<string, Entity>();
  const byId = new Map<string, Entity>();
  for (const entity of entities) {
    if (entity.domain === "binary_sensor") byPreference.set(entity.preferenceId, entity);
    if (entity.integration === "frigate") byId.set(entity.entityId, entity);
  }
  for (const camera of cameras) {
    const frigateName = camera.frigatePreview?.camera ?? (camera.personSnapshot.type === "frigate" ? camera.personSnapshot.camera : undefined)
      ?? (camera.connectionId === "home-assistant" && byId.has(camera.source) ? camera.source.slice("camera.".length) : undefined);
    const sensor = camera.personDetectionEntity ? byPreference.get(camera.personDetectionEntity)
      : frigateName && byId.get(`binary_sensor.${frigateName.toLowerCase().replace(/[^a-z0-9_]/g, "_")}_person_occupancy`);
    if (sensor) result.set(camera.id, sensor);
  }
  return result;
}
