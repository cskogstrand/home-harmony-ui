import { resolve } from "node:path";
import { createAppServer } from "./app.mjs";
import { runtimeOptions } from "./runtime.mjs";

const options = await runtimeOptions();
const server = await createAppServer({ ...options, distDir: resolve("dist") });
server.listen(options.port, "0.0.0.0", () => console.log("Home Harmony storage and web server ready."));
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
