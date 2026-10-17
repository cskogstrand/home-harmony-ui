import { load } from "js-yaml";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { createAppHandler, createAppServer } from "./app.mjs";
import { createServer as createViteServer, preview } from "vite";
import { emptyConfiguration, emptyPlanner, MAX_CONFIG_BYTES } from "../shared/configuration.ts";
import { MAX_TIMETABLE_BYTES, timetableUploadPath } from "../shared/timetables.ts";

const listen = server => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`));
});
const close = server => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "home-harmony-storage-"));
  const distDir = join(dir, "dist"), dataDir = join(dir, "data");
  await mkdir(distDir);
  await writeFile(join(distDir, "index.html"), "<html>Afterglow</html>");
  let authStatus = 200;
  const ha = createServer((req, res) => {
    res.writeHead(req.headers.authorization === "Bearer fixture-valid-token" ? authStatus : 401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "API running." }));
  });
  const homeAssistantUrl = await listen(ha);
  let server = await createAppServer({ dataDir, distDir, homeAssistantUrl, homeAssistantToken: "fixture-ha-token", dashboardPassword: "fixture-valid-token" });
  let url = await listen(server);
  t.after(async () => { await close(server); await close(ha); await rm(dir, { recursive: true, force: true }); });
  return {
    dir, dataDir, distDir, homeAssistantUrl, homeAssistantToken: "fixture-ha-token", dashboardPassword: "fixture-valid-token",
    authStatus: status => { authStatus = status; },
    request: (method = "GET", config, revision, token = "fixture-valid-token", headers = {}) => fetch(`${url}/api/config`, { method,
      headers: { ...(token ? { Authorization: `Basic ${Buffer.from(`dashboard:${token}`).toString("base64")}` } : {}), ...(config !== undefined ? { "Content-Type": "application/json" } : {}), ...(revision ? { "If-Match": `"${revision}"` } : {}), ...headers },
      body: config === undefined ? undefined : typeof config === "string" ? config : JSON.stringify(config) }),
    page: path => fetch(`${url}${path}`, { headers: { Authorization: `Basic ${Buffer.from("dashboard:fixture-valid-token").toString("base64")}` } }),
    api: (path, options = {}, token = "fixture-valid-token") => fetch(`${url}${path}`, { ...options, headers: { ...(token ? { Authorization: `Basic ${Buffer.from(`dashboard:${token}`).toString("base64")}` } : {}), ...options.headers } }),
    restart: async () => { await close(server); server = await createAppServer({ dataDir, distDir, homeAssistantUrl, homeAssistantToken: "fixture-ha-token", dashboardPassword: "fixture-valid-token" }); url = await listen(server); },
  };
}
const configuration = () => ({ ...emptyConfiguration(), settings: { ...emptyPlanner(), memberOrder: ["home|person.one"] } });

function timetablePdf(pages = 2) {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Count ${pages} /Kids [${Array.from({ length: pages }, (_, i) => `${4 + i * 2} 0 R`).join(" ")}] >>`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  for (let page = 0; page < pages; page++) {
    const content = `BT /F1 18 Tf 20 140 Td (Timetable page ${page + 1}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 180] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + page * 2} 0 R >>`, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function timetableFixture(t) {
  const app = await fixture(t);
  const { revision } = await (await app.request()).json();
  const config = configuration();
  config.settings.timetableEnabled = { "home|person.one": true };
  config.settings.timetables = { "home|person.one": ["/previous.png"], other: ["/keep.png"] };
  const saved = await (await app.request("PUT", config, revision)).json();
  const path = timetableUploadPath("home|person.one");
  const upload = (body = timetablePdf(), options = {}, token) => app.api(path, { method: "POST", body, headers: { "Content-Type": "application/pdf" }, ...options }, token);
  return { ...app, saved, path, upload };
}

test("uploads and converts ordered PDF pages privately, persists them, and rejects stale screen saves", async t => {
  const app = await timetableFixture(t);
  assert.equal((await app.upload(undefined, {}, "")).status, 401);
  assert.equal((await app.upload(undefined, {}, "wrong")).status, 401);
  const response = await app.upload();
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).pages, 2);
  const saved = await (await app.request()).json();
  const pages = saved.config.settings.timetables["home|person.one"];
  assert.equal(pages.length, 2);
  assert.match(pages[0], /\/1\.png$/);
  assert.match(pages[1], /\/2\.png$/);
  assert.deepEqual(saved.config.settings.timetables.other, ["/keep.png"]);
  assert.deepEqual(saved.config.settings.memberOrder, app.saved.config.settings.memberOrder);
  assert.equal((await app.request("PUT", app.saved.config, app.saved.revision)).status, 409);
  await app.restart();
  assert.deepEqual(await (await app.request()).json(), saved);
  const images = [];
  for (const path of pages) {
    assert.equal((await app.api(path, {}, "")).status, 401);
    const image = await app.api(path);
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.equal(image.headers.get("cache-control"), "no-store");
    images.push(Buffer.from(await image.arrayBuffer()));
    assert.equal(images.at(-1).subarray(1, 4).toString(), "PNG");
  }
  assert.notDeepEqual(images[0], images[1]);
  const directory = join(app.dataDir, "timetables", ...pages[0].split("/").slice(3, 5));
  assert.deepEqual((await readdir(directory)).sort(), ["1-dark.svg", "1.png", "2-dark.svg", "2.png", "source.pdf"]);
  for (const [index, path] of pages.entries()) {
    const darkPath = path.replace(/\.png$/, "-dark.svg");
    assert.equal((await app.api(darkPath, {}, "")).status, 401);
    const dark = await app.api(darkPath);
    assert.equal(dark.headers.get("content-type"), "image/svg+xml");
    assert.equal(dark.headers.get("cache-control"), "no-store");
    const svg = await dark.text();
    assert.match(svg, /filter="url\(#dark\)"/);
    assert.ok(svg.includes(`width="${images[index].readUInt32BE(16)}" height="${images[index].readUInt32BE(20)}"`));
    assert.deepEqual(Buffer.from(svg.match(/base64,([^\"]+)/)[1], "base64"), images[index], "Dark image embeds the matching original page");
    await rm(join(directory, `${index + 1}-dark.svg`));
    assert.equal(await (await app.api(darkPath)).text(), svg, "Older uploads get the same dark image on demand");
  }
  assert.equal((await app.api(pages[0].replace("1.png", "99.png"))).status, 404);
  for (const name of ["99-dark.svg", "1.svg", "1-dark.png", "source.pdf"]) {
    assert.equal((await app.api(pages[0].replace("1.png", name))).status, 404);
  }
  assert.equal((await app.upload(timetablePdf(1))).status, 200);
  const replaced = await (await app.request()).json();
  assert.equal(replaced.config.settings.timetables["home|person.one"].length, 1);
  assert.equal((await app.api(pages[0])).status, 200, "Old pages remain available for settings-backup restores");
  assert.equal((await app.api(pages[0].replace(/\.png$/, "-dark.svg"))).status, 200);
});

test("rejects invalid, oversized and excessive-page PDFs without replacing existing timetables or leaving files", async t => {
  const app = await timetableFixture(t);
  assert.equal((await app.upload(timetablePdf(), { headers: { "Content-Type": "text/plain" } })).status, 415);
  assert.equal((await app.upload(Buffer.from("not a PDF"))).status, 400);
  assert.equal((await app.upload(Buffer.from("%PDF-1.4\nbroken"))).status, 400);
  assert.equal((await app.upload(Buffer.alloc(MAX_TIMETABLE_BYTES + 1))).status, 413);
  assert.equal((await app.upload(timetablePdf(21))).status, 400);
  for (const member of ["missing", "__proto__", "constructor"]) {
    assert.equal((await app.api(timetableUploadPath(member), { method: "POST", body: timetablePdf(), headers: { "Content-Type": "application/pdf" } })).status, 404);
  }
  assert.deepEqual(await (await app.request()).json(), app.saved);
  assert.deepEqual(await readdir(join(app.dataDir, "timetables", "one")), []);
  app.authStatus(503);
  assert.equal((await app.upload()).status, 200);
});

test("bounds parallel PDF conversion and handles double-digit page numbers", async t => {
  const app = await timetableFixture(t);
  const responses = await Promise.all([app.upload(timetablePdf(10)), app.upload(timetablePdf(10))]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 503]);
  const saved = await (await app.request()).json();
  const pages = saved.config.settings.timetables["home|person.one"];
  assert.equal(pages.length, 10);
  assert.equal((await app.api(pages[9])).status, 200);
  assert.equal((await readdir(join(app.dataDir, "timetables"))).length, 1);
});

test("preserves simultaneous unrelated edits and refuses a timetable changed while uploading", async t => {
  const app = await timetableFixture(t);
  const handler = await createAppHandler(app);
  const call = async (method, path, stream = [], headers = {}) => {
    const request = Object.assign(Readable.from(stream), { method, url: path, headers: { authorization: `Basic ${Buffer.from("dashboard:fixture-valid-token").toString("base64")}`, ...headers } });
    let status, responseHeaders, body;
    await handler(request, { writeHead: (code, values) => { status = code; responseHeaders = values; }, end: value => { body = value; } });
    return new Response(body, { status, headers: responseHeaders });
  };
  for (const conflict of [false, true]) {
    const started = Promise.withResolvers(), resume = Promise.withResolvers();
    async function* slowPdf() { started.resolve(); await resume.promise; yield timetablePdf(1); }
    const pending = call("POST", app.path, slowPdf(), { "content-type": "application/pdf" });
    await started.promise;
    const { config, revision } = await (await call("GET", "/api/config")).json();
    const planner = config.settings;
    if (conflict) planner.timetables["home|person.one"] = ["/changed-elsewhere.png"];
    else planner.appearance.compactMode = true;
    const edit = await call("PUT", "/api/config", [Buffer.from(JSON.stringify(config))], { "content-type": "application/json", "if-match": `"${revision}"` });
    assert.equal(edit.status, 200);
    resume.resolve();
    assert.equal((await pending).status, conflict ? 409 : 200);
    const result = await (await call("GET", "/api/config")).json();
    assert.equal(result.config.settings.appearance.compactMode, true);
    if (conflict) assert.deepEqual(result.config.settings.timetables["home|person.one"], ["/changed-elsewhere.png"]);
  }
  assert.equal((await readdir(join(app.dataDir, "timetables"))).length, 1, "Failed replacements leave no converted files behind");
});

test("requires the dashboard password and keeps settings available when HA is unavailable", async t => {
  const app = await fixture(t);
  assert.equal((await app.request("GET", undefined, undefined, "")).status, 401);
  assert.equal((await app.request("GET", undefined, undefined, "wrong-token")).status, 401);
  assert.equal((await app.request("PUT", configuration(), "old", "")).status, 401);
  app.authStatus(503);
  assert.equal((await app.request()).status, 200);
  app.authStatus(401);
  assert.equal((await app.request()).status, 200);
});

test("persists a validated backup across restart and exposes it to a second device", async t => {
  const app = await fixture(t);
  const initial = await (await app.request()).json();
  const input = configuration();
  const response = await app.request("PUT", input, initial.revision);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.notEqual(saved.revision, initial.revision);
  assert.deepEqual(saved.config, input);
  await app.restart();
  assert.deepEqual(await (await app.request()).json(), saved);
  const disk = await readFile(join(app.dataDir, "settings.yaml"), "utf8");
  assert.deepEqual(load(disk), input);
  assert.doesNotMatch(disk, /fixture-valid-token/);
});

test("serializes simultaneous edits and refuses stale overwrites", async t => {
  const app = await fixture(t);
  const { revision } = await (await app.request()).json();
  const a = configuration(), b = configuration();
  b.settings.memberOrder = ["other-person"];
  const results = await Promise.all([app.request("PUT", a, revision), app.request("PUT", b, revision)]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  const winner = await results.find(result => result.status === 200).json();
  assert.deepEqual(await (await app.request()).json(), winner);
  assert.equal((await app.request("PUT", configuration())).status, 428);
});

test("invalid, credential-bearing, oversized and future-version imports leave existing data untouched", async t => {
  const app = await fixture(t);
  const initial = await (await app.request()).json();
  const saved = await (await app.request("PUT", configuration(), initial.revision)).json();
  const invalid = ["not json", { ...configuration(), version: 4 }, { ...configuration(), access_token: "fixture-secret" }];
  const unsafe = configuration(); unsafe.settings.timetables = { child: ["javascript:alert(1)"] }; invalid.push(unsafe);
  const missing = configuration(); delete missing.settings.timetables; invalid.push(missing);
  for (const field of ["events", "items", "people", "states"]) {
    const data = configuration(); data.settings[field] = [];
    invalid.push(data);
  }
  invalid.push('{"format":"home-harmony-config","version":1,"planners":{"__proto__":{}}}');
  for (const input of invalid) assert.equal((await app.request("PUT", input, saved.revision)).status, 400);
  assert.equal((await app.request("PUT", " ".repeat(MAX_CONFIG_BYTES + 1), saved.revision)).status, 413);
  assert.equal((await app.request("PUT", configuration(), saved.revision, "fixture-valid-token", { "Content-Type": "text/plain" })).status, 415);
  assert.deepEqual(await (await app.request()).json(), saved);
  await app.restart();
  assert.deepEqual(await (await app.request()).json(), saved);
});

test("serves SPA routes but never storage, dot files, traversal or symlinks outside public assets", async t => {
  const app = await fixture(t);
  const initial = await (await app.request()).json();
  await app.request("PUT", configuration(), initial.revision);
  await symlink(join(app.dataDir, "settings.yaml"), join(app.distDir, "leak.json"));
  for (const path of ["/", "/settings?auth_callback=1&code=fixture", "/devices/test"]) {
    const response = await app.page(path);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "<html>Afterglow</html>");
  }
  for (const path of ["/leak.json", "/%2e%2e%2fdata/settings.yaml", "/.env", "/assets/missing.js"]) assert.equal((await app.page(path)).status, 404, path);
  assert.doesNotMatch(await (await app.page("/data/settings.yaml")).text(), /memberOrder/);
  assert.equal((await app.page("/api/missing")).status, 404);
});

test("refuses to overwrite a corrupt on-disk configuration", async t => {
  const app = await fixture(t);
  await writeFile(join(app.dataDir, "settings.yaml"), "corrupted-original");
  await assert.rejects(createAppServer({ dataDir: app.dataDir, distDir: app.distDir, homeAssistantUrl: app.homeAssistantUrl, homeAssistantToken: "fixture-ha-token", dashboardPassword: "fixture-valid-token" }), /existing file has been kept/);
  assert.equal(await readFile(join(app.dataDir, "settings.yaml"), "utf8"), "corrupted-original");
});

test("default development and preview serve the storage API and preserve settings across restarts", async t => {
  const app = await fixture(t);
  const originalData = process.env.DATA_DIR, originalHa = process.env.HOME_ASSISTANT_URL;
  process.env.DATA_DIR = join(app.dir, "vite-data");
  process.env.HOME_ASSISTANT_URL = app.homeAssistantUrl;
  const oldToken = process.env.HOME_ASSISTANT_TOKEN, oldPassword = process.env.DASHBOARD_PASSWORD;
  process.env.HOME_ASSISTANT_TOKEN = "fixture-ha-token";
  process.env.DASHBOARD_PASSWORD = "fixture-valid-token";
  let saved;
  try {
    for (const mode of ["development", "production"]) {
      const options = { mode, logLevel: "silent", build: { outDir: app.distDir },
        server: { host: "127.0.0.1", port: 0, fs: { allow: [process.cwd(), app.dir] } }, preview: { host: "127.0.0.1", port: 0 } };
      const vite = mode === "development" ? await createViteServer(options) : await preview(options);
      try {
        if (mode === "development") await vite.listen();
        const url = `http://127.0.0.1:${vite.httpServer.address().port}/api/config`;
        assert.equal((await fetch(url)).status, 401);
        const headers = { Authorization: `Basic ${Buffer.from("dashboard:fixture-valid-token").toString("base64")}` };
        const loaded = await (await fetch(url, { headers })).json();
        if (saved) assert.deepEqual(loaded, saved);
        else {
          const response = await fetch(url, { method: "PUT", headers: { ...headers, "Content-Type": "application/json", "If-Match": `"${loaded.revision}"` }, body: JSON.stringify(configuration()) });
          assert.equal(response.status, 200);
          saved = await response.json();
        }
        if (mode === "development") {
          for (const query of ["", "?raw", "?import"]) {
            const direct = await fetch(new URL(`/@fs${process.env.DATA_DIR}/settings.yaml${query}`, url), { headers });
            assert.equal(direct.status, 403);
            assert.doesNotMatch(await direct.text(), /memberOrder/);
          }
        }
      } finally { await vite.close(); }
    }
  } finally {
    if (oldToken === undefined) delete process.env.HOME_ASSISTANT_TOKEN; else process.env.HOME_ASSISTANT_TOKEN = oldToken;
    if (oldPassword === undefined) delete process.env.DASHBOARD_PASSWORD; else process.env.DASHBOARD_PASSWORD = oldPassword;
    if (originalData === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = originalData;
    if (originalHa === undefined) delete process.env.HOME_ASSISTANT_URL; else process.env.HOME_ASSISTANT_URL = originalHa;
  }
});
