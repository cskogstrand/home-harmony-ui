import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Reads a file under src/ as text, for contracts that live in stylesheets Vitest leaves out of the module graph. */
export function sourceFile(path) {
  return readFileSync(resolve(process.cwd(), "src", path), "utf8");
}
