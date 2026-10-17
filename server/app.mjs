import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, realpath, rename, stat, unlink } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { emptyConfiguration, instanceUrlSchema, MAX_CONFIG_BYTES, parseConfiguration } from "../shared/configuration.ts";

const revisionOf = config => createHash("sha256").update(JSON.stringify(config)).digest("hex");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".txt": "text/plain", ".json": "application/json", ".woff2": "font/woff2" };
const failure = (status, message) => Object.assign(new Error(message), { status });

export async function createAppServer({ dataDir, distDir, homeAssistantUrl }) {
  if (!homeAssistantUrl || !instanceUrlSchema.safeParse(homeAssistantUrl).success) throw new Error("Configure a valid Home Assistant origin.");
  const file = resolve(dataDir, "configuration.json");
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  let config;
  try { config = parseConfiguration(await readFile(file, "utf8")); }
  catch (error) {
    if (error.code !== "ENOENT") throw new Error("Cannot read configuration.json. Restore a valid backup; the existing file has been kept.");
    config = emptyConfiguration();
  }
  let revision = revisionOf(config);
  let writes = Promise.resolve();
  const root = await realpath(distDir);

  async function authenticate(request) {
    const authorization = request.headers.authorization;
    if (!authorization || !/^Bearer [A-Za-z0-9._~-]{1,4096}$/.test(authorization)) throw failure(401, "Sign in to Home Assistant to access shared configuration.");
    let response;
    try {
      response = await fetch(`${homeAssistantUrl}/api/`, { headers: { Authorization: authorization }, redirect: "error", signal: AbortSignal.timeout(5000) });
      if (response.status === 401 || response.status === 403) throw failure(401, "This login is not valid for the storage server's Home Assistant instance.");
      if (!response.ok || (await response.json()).message !== "API running.") throw new Error();
    } catch (error) {
      if (error.status === 401) throw error;
      throw failure(503, "Cannot verify your login. Check the app's Home Assistant URL and connection.");
    }
  }

  async function replace(request) {
    if (!request.headers["content-type"]?.startsWith("application/json")) throw failure(415, "Send a JSON configuration.");
    if (!request.headers["if-match"]) throw failure(428, "Reload the configuration before saving.");
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_CONFIG_BYTES) throw failure(413, "The configuration exceeds the 2 MB limit.");
      chunks.push(chunk);
    }
    let next;
    try { next = parseConfiguration(Buffer.concat(chunks).toString("utf8")); }
    catch { throw failure(400, "Invalid configuration backup. Nothing was replaced."); }
    const write = writes.then(async () => {
      if (request.headers["if-match"] !== `"${revision}"`) throw failure(409, "Another screen changed the configuration. Export your unsaved changes, then load the shared version before editing again.");
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        const handle = await open(temporary, "wx", 0o600);
        try { await handle.writeFile(JSON.stringify(next)); await handle.sync(); } finally { await handle.close(); }
        await rename(temporary, file);
        config = next;
        revision = revisionOf(config);
        const directory = await open(dataDir, "r");
        try { await directory.sync(); } finally { await directory.close(); }
      } finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
      return { revision, config };
    });
    writes = write.catch(() => {});
    return write;
  }

  return createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (request, response) => {
    const json = (status, body) => { response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); response.end(JSON.stringify(body)); };
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname.startsWith("/api/")) {
        if (pathname !== "/api/config" || !["GET", "PUT"].includes(request.method)) throw failure(404, "Not found.");
        await authenticate(request);
        json(200, request.method === "PUT" ? await replace(request) : { revision, config });
        return;
      }
      if (!["GET", "HEAD"].includes(request.method)) throw failure(405, "Method not allowed.");
      const decoded = decodeURIComponent(pathname);
      if (decoded.includes("\0") || decoded.split("/").some(part => part.startsWith("."))) throw failure(404, "Not found.");
      let asset = resolve(root, `.${decoded}`);
      if (asset !== root && !asset.startsWith(`${root}${sep}`)) throw failure(404, "Not found.");
      try { if (!(await stat(asset)).isFile()) throw failure(404, "Not found."); }
      catch (error) {
        if (pathname.startsWith("/assets/") || (error.code && error.code !== "ENOENT")) throw failure(404, "Not found.");
        asset = resolve(root, "index.html");
      }
      if (!(await realpath(asset)).startsWith(`${root}${sep}`)) throw failure(404, "Not found.");
      const contents = await readFile(asset);
      response.writeHead(200, { "Content-Type": mime[extname(asset)] ?? "application/octet-stream", "Content-Length": contents.length,
        "Cache-Control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache", "X-Content-Type-Options": "nosniff" });
      response.end(request.method === "HEAD" ? undefined : contents);
    } catch (error) { json(error.status ?? 500, { error: error.status ? error.message : "Configuration storage is unavailable. Reload to check the last saved version before retrying." }); }
  });
}
