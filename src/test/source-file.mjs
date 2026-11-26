import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/** Reads a file under src/ as text, for contracts that live in stylesheets Vitest leaves out of the module graph. */
export function sourceFile(path) {
  return readFileSync(resolve(process.cwd(), "src", path), "utf8");
}

/** Lists the test files and helpers directly under src/test/ that end with one of the extensions, as paths relative to src/. */
export function testSourceFiles(extensions) {
  return readdirSync(resolve(process.cwd(), "src", "test"))
    .filter(name => extensions.some(extension => name.endsWith(extension)))
    .map(name => join("test", name));
}

/** Lists app source files under src/ (tests excluded) that end with the extension, as paths relative to src/. */
export function sourceFiles(extension, directory = resolve(process.cwd(), "src")) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "test" ? [] : sourceFiles(extension, path);
    return entry.name.endsWith(extension) ? [relative(resolve(process.cwd(), "src"), path)] : [];
  });
}
