import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAppServer } from "./app.mjs";

const dataDir = resolve(process.env.DATA_DIR ?? "/data");
let options = {};
try { options = JSON.parse(await readFile(resolve(dataDir, "options.json"), "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw new Error("Cannot read the app options."); }
const server = await createAppServer({ dataDir, distDir: resolve("dist"), homeAssistantUrl: process.env.HOME_ASSISTANT_URL ?? options.home_assistant_url ?? "http://homeassistant:8123" });
server.listen(Number(process.env.PORT ?? 8099), "0.0.0.0", () => console.log("Home Harmony storage and web server ready."));
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
