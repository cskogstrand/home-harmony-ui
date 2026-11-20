import { createHash } from "node:crypto";

export function configurationSnapshot(config) {
  const revision = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  return { revision, config: structuredClone(config) };
}
