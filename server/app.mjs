import { load, dump, JSON_SCHEMA } from "js-yaml";
import { dashboardAccess, attachHomeAssistantSocket } from "./home-assistant.mjs";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, realpath, rename, rm, stat, unlink } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { emptyConfiguration, instanceUrlSchema, MAX_CONFIG_BYTES, parseConfiguration } from "../shared/configuration.ts";
import { timetableImagePath } from "../shared/timetables.ts";
import { convertTimetable, darkTimetableImage } from "./timetables.mjs";

const revisionOf = config => createHash("sha256").update(JSON.stringify(config)).digest("hex");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".txt": "text/plain", ".json": "application/json", ".woff2": "font/woff2" };
const failure = (status, message) => Object.assign(new Error(message), { status });

export async function createAppHandler({ dataDir, distDir, homeAssistantUrl, homeAssistantToken, dashboardPassword, dashboardAuthDisabled }) {
  if (!homeAssistantUrl || !instanceUrlSchema.safeParse(homeAssistantUrl).success) throw new Error("Configure a valid Home Assistant origin.");
  const file = resolve(dataDir, "settings.yaml");
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  let config;
  try { config = parseConfiguration(JSON.stringify(load(await readFile(file, "utf8"), { schema: JSON_SCHEMA }))); }
  catch (error) {
    if (error.code !== "ENOENT") throw new Error("Cannot read settings.yaml. Restore a valid backup; the existing file has been kept.");
    config = emptyConfiguration();
  }
  let revision = revisionOf(config);
  let writes = Promise.resolve();
  let uploading = false;
  const root = await realpath(distDir);

  const authenticate = dashboardAccess(dashboardPassword, dashboardAuthDisabled);

  function save(change) {
    const write = writes.then(async () => {
      const next = change();
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        const handle = await open(temporary, "wx", 0o600);
        try { await handle.writeFile(dump(next, { noRefs: true, lineWidth: -1 })); await handle.sync(); } finally { await handle.close(); }
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
    return save(() => {
      if (request.headers["if-match"] !== `"${revision}"`) throw failure(409, "Another screen changed the configuration. Export your unsaved changes, then load the shared version before editing again.");
      return next;
    });
  }

  async function upload(request, url) {
    const member = url.searchParams.get("member");
    const entry = config.settings;
    const enabled = member && Object.hasOwn(entry.timetableEnabled, member) && entry.timetableEnabled[member];
    if (!enabled) throw failure(404, "Enable this person's timetable in Home settings before uploading.");
    if (uploading) throw failure(503, "Another timetable is uploading. Wait for it to finish, then try again.");
    uploading = true;
    let converted;
    try {
      const entityId = member.replace(/^home\|/, "");
      if (!/^person\.[a-z0-9_]+$/.test(entityId)) throw failure(400, "Choose a Home Assistant person for this timetable.");
      converted = await convertTimetable(request, dataDir, entityId.slice("person.".length));
      await save(() => {
        const current = config.settings;
        if (JSON.stringify(current.timetables[member]) !== JSON.stringify(entry.timetables[member]) || current.timetableEnabled[member] !== entry.timetableEnabled[member]) throw failure(409, "This timetable changed during upload. Review the current version before uploading again.");
        return parseConfiguration(JSON.stringify({ ...config, settings: { ...current, timetables: { ...current.timetables, [member]: converted.urls } } }));
      });
      // shortcut: retain old pages for settings-backup restores; add retention controls if storage grows.
      return { message: "Timetable uploaded. The dashboard will refresh shortly.", pages: converted.urls.length };
    } catch (error) {
      // A directory-sync failure can follow a committed rename; never remove referenced pages.
      if (converted && !converted.urls.some(url => config.settings.timetables[member]?.includes(url))) await rm(converted.directory, { recursive: true, force: true });
      throw error;
    } finally { uploading = false; }
  }

  return async (request, response) => {
    const json = (status, body) => { response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); response.end(JSON.stringify(body)); };
    try {
      authenticate(request);
      const url = new URL(request.url, "http://localhost");
      const pathname = url.pathname;
      if (pathname === "/api/runtime" && request.method === "GET") { json(200, { homeAssistantUrl }); return; }
      if (/^\/api\/calendars\/calendar\.[a-z0-9_]+$/.test(pathname) && request.method === "GET") {
        let result;
        try {
          result = await fetch(`${homeAssistantUrl}${pathname}${url.search}`, { headers: { Authorization: `Bearer ${homeAssistantToken}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
          if (!result.ok) throw new Error();
          json(200, await result.json());
        } catch { throw failure(502, "Home Assistant calendar unavailable. Check the server connection and token permissions."); }
        return;
      }
      if (pathname.startsWith("/api/")) {
        const image = pathname.match(timetableImagePath);
        if (!((pathname === "/api/config" && ["GET", "PUT"].includes(request.method)) || (pathname === "/api/timetables" && request.method === "POST") || (image && request.method === "GET"))) throw failure(404, "Not found.");
        if (pathname === "/api/timetables") { json(200, await upload(request, url)); return; }
        if (image) {
          let contents;
          const directory = resolve(dataDir, "timetables", image[1], image[2]);
          const dark = image[4] === "-dark.svg";
          try {
            try { contents = await readFile(join(directory, `${image[3]}${image[4]}`)); }
            catch (error) {
              if (!dark || error.code !== "ENOENT") throw error;
              // Older uploads have only PNGs; derive their dark variant without changing saved references.
              contents = darkTimetableImage(await readFile(join(directory, `${image[3]}.png`)));
            }
          }
          catch (error) { if (error.code === "ENOENT") throw failure(404, "Timetable page not found."); throw error; }
          response.writeHead(200, { "Content-Type": dark ? "image/svg+xml" : "image/png", "Content-Length": contents.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
          response.end(contents);
          return;
        }
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
    } catch (error) { if (error.status === 401) response.setHeader("WWW-Authenticate", 'Basic realm="Home Harmony", charset="UTF-8"'); json(error.status ?? 500, { error: error.status ? error.message : "Configuration storage is unavailable. Reload to check the last saved version before retrying." }); }
  };
}

export async function createAppServer(options) {
  const server = createServer({ requestTimeout: 15000, headersTimeout: 10000 }, await createAppHandler(options));
  const closeSockets = attachHomeAssistantSocket(server, options);
  const close = server.close.bind(server);
  server.close = callback => { closeSockets(); return close(callback); };
  return server;
}
