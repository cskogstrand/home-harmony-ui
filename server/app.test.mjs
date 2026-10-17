import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAppServer } from "./app.mjs";
import { emptyConfiguration, emptyPlanner, MAX_CONFIG_BYTES } from "../shared/configuration.ts";

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
  let server = await createAppServer({ dataDir, distDir, homeAssistantUrl });
  let url = await listen(server);
  t.after(async () => { await close(server); await close(ha); await rm(dir, { recursive: true, force: true }); });
  return {
    dir, dataDir, distDir, homeAssistantUrl,
    authStatus: status => { authStatus = status; },
    request: (method = "GET", config, revision, token = "fixture-valid-token", headers = {}) => fetch(`${url}/api/config`, { method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(config !== undefined ? { "Content-Type": "application/json" } : {}), ...(revision ? { "If-Match": `"${revision}"` } : {}), ...headers },
      body: config === undefined ? undefined : typeof config === "string" ? config : JSON.stringify(config) }),
    page: path => fetch(`${url}${path}`),
    restart: async () => { await close(server); server = await createAppServer({ dataDir, distDir, homeAssistantUrl }); url = await listen(server); },
  };
}
const configuration = () => ({ ...emptyConfiguration(), planners: { "home-1": { instanceUrl: "http://ha.local:8123", planner: { ...emptyPlanner(), memberOrder: ["http://ha.local:8123|person.one"] } } } });

test("requires valid HA authentication for reads and writes and fails closed if HA is unavailable", async t => {
  const app = await fixture(t);
  assert.equal((await app.request("GET", undefined, undefined, "")).status, 401);
  assert.equal((await app.request("GET", undefined, undefined, "wrong-token")).status, 401);
  assert.equal((await app.request("PUT", configuration(), "old", "")).status, 401);
  app.authStatus(503);
  assert.equal((await app.request()).status, 503);
  app.authStatus(401);
  assert.equal((await app.request()).status, 401);
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
  const disk = await readFile(join(app.dataDir, "configuration.json"), "utf8");
  assert.deepEqual(JSON.parse(disk), input);
  assert.doesNotMatch(disk, /fixture-valid-token/);
});

test("serializes simultaneous edits and refuses stale overwrites", async t => {
  const app = await fixture(t);
  const { revision } = await (await app.request()).json();
  const a = configuration(), b = configuration();
  b.planners["home-1"].planner.memberOrder = ["other-person"];
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
  const invalid = ["not json", { ...configuration(), version: 2 }, { ...configuration(), access_token: "fixture-secret" }];
  const unsafe = configuration(); unsafe.planners["home-1"].planner.timetables = { child: ["javascript:alert(1)"] }; invalid.push(unsafe);
  const missing = configuration(); delete missing.planners["home-1"].planner.events; invalid.push(missing);
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
  await symlink(join(app.dataDir, "configuration.json"), join(app.distDir, "leak.json"));
  for (const path of ["/", "/settings?auth_callback=1&code=fixture", "/devices/test"]) {
    const response = await app.page(path);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "<html>Afterglow</html>");
  }
  for (const path of ["/leak.json", "/%2e%2e%2fdata/configuration.json", "/.env", "/assets/missing.js"]) assert.equal((await app.page(path)).status, 404, path);
  assert.doesNotMatch(await (await app.page("/data/configuration.json")).text(), /memberOrder/);
  assert.equal((await app.page("/api/missing")).status, 404);
});

test("refuses to overwrite a corrupt on-disk configuration", async t => {
  const app = await fixture(t);
  await writeFile(join(app.dataDir, "configuration.json"), "corrupted-original");
  await assert.rejects(createAppServer({ dataDir: app.dataDir, distDir: app.distDir, homeAssistantUrl: app.homeAssistantUrl }), /existing file has been kept/);
  assert.equal(await readFile(join(app.dataDir, "configuration.json"), "utf8"), "corrupted-original");
});
