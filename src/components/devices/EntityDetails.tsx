import type { Entity } from "@/types/api";

export function EntityDetails({ entity }: { entity: Entity }) {
  return <details className="device-details"><summary>Technical details</summary><dl className="device-readings">
    <div><dt>Entity ID</dt><dd>{entity.entityId}</dd></div>
    <div><dt>Last updated</dt><dd>{entity.lastUpdated ? new Date(entity.lastUpdated).toLocaleString() : "Not reported"}</dd></div>
    {Object.entries(entity.attributes).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, " ")}</dt><dd>{value == null ? "Not reported" : typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}
  </dl></details>;
}
