import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import WebSocket, { WebSocketServer } from "ws";
import { Auth, createConnection, ERR_INVALID_AUTH } from "home-assistant-js-websocket";
import { createAppServer } from "./app.mjs";
import { emptyConfiguration } from "../shared/configuration.ts";

const password = "fixture-dashboard-password";
const token = "fixture-server-only-token";
const headers = { Authorization: `Basic ${Buffer.from(`dashboard:${password}`).toString("base64")}` };
const listen = async server => { server.listen(0, "127.0.0.1"); await once(server, "listening"); return `http://127.0.0.1:${server.address().port}`; };
const close = server => new Promise(resolve => server.close(resolve));

const photoPath = "/api/image/serve/0123456789abcdef0123456789abcdef/original";
const photo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=", "base64");

async function fixture(t, { legacy = false, imageResponse, ...options } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "home-harmony-proxy-"));
  const distDir = join(directory, "dist"), dataDir = join(directory, "data");
  await mkdir(distDir); await mkdir(dataDir);
  await writeFile(join(distDir, "index.html"), "Dashboard");
  const requests = [];
  const ha = createServer((req, res) => {
    requests.push({ url: req.url, authorization: req.headers.authorization });
    if (req.url.startsWith("/api/image/serve/")) {
      res.writeHead(imageResponse?.status ?? 200, imageResponse?.headers ?? { "Content-Type": "image/png" });
      res.end(photo);
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify([{ summary: "Family event", start: "2026-10-17", end: "2026-10-18" }]));
  });
  const sockets = new WebSocketServer({ server: ha });
  const commands = [];
  sockets.on("connection", socket => {
    socket.send(JSON.stringify({ type: "auth_required", ha_version: "2026.10.0" }));
    socket.on("message", data => {
      const message = JSON.parse(data.toString()); commands.push(message);
      if (message.type === "supported_features") return;
      socket.send(JSON.stringify(message.type === "auth" ? { type: message.access_token === token ? "auth_ok" : "auth_invalid", ha_version: "2026.10.0" } : { id: message.id, type: "pong" }));
    });
  });
  if (legacy) await writeFile(join(dataDir, "configuration.json"), JSON.stringify({ format: "home-harmony-config", version: 2, planners: { old: { secret: "legacy" } } }));
  const homeAssistantUrl = await listen(ha);
  const server = await createAppServer({ dataDir, distDir, homeAssistantUrl, homeAssistantToken: token, dashboardPassword: password, ...options });
  const url = await listen(server);
  t.after(async () => { await close(server); for (const socket of sockets.clients) socket.terminate(); sockets.close(); await close(ha); await rm(directory, { recursive: true, force: true }); });
  return { url, homeAssistantUrl, dataDir, requests, commands };
}

test("protects every dashboard surface and exposes only the configured URL", async t => {
  const app = await fixture(t);
  for (const path of ["/", "/settings", "/api/runtime", "/api/config", "/api/calendars/calendar.family", photoPath]) {
    const denied = await fetch(`${app.url}${path}`);
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get("www-authenticate"), /Basic/);
  }
  const runtime = await (await fetch(`${app.url}/api/runtime`, { headers })).json();
  assert.deepEqual(runtime, { homeAssistantUrl: app.homeAssistantUrl });
  assert.equal((await fetch(`${app.url}/api/config`, { headers: { ...headers, Origin: "https://other.example" } })).status, 403);
  assert.equal((await fetch(`${app.url}/api/config`, { headers: { ...headers, "Sec-Fetch-Site": "cross-site" } })).status, 403);
  assert.equal((await fetch(`${app.url}/api/calendars/calendar.family?start=2026-10-17&end=2026-10-18`, { headers })).status, 200);
  assert.deepEqual(app.requests, [{ url: "/api/calendars/calendar.family?start=2026-10-17&end=2026-10-18", authorization: `Bearer ${token}` }]);
  assert.equal((await fetch(`${app.url}/api/services/light/turn_on`, { method: "POST", headers })).status, 404);
});

test("serves uploaded person photos through the authenticated dashboard without exposing the HA token", async t => {
  const app = await fixture(t);
  const result = await fetch(`${app.url}${photoPath}`, { headers });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("content-type"), "image/png");
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(result.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), photo);
  assert.deepEqual(app.requests, [{ url: photoPath, authorization: `Bearer ${token}` }]);
  for (const path of ["/api/image/serve/not-an-id/original", photoPath.replace("original", "unsupported"), "/api/image/upload"]) {
    assert.equal((await fetch(`${app.url}${path}`, { headers })).status, 404);
  }
  assert.equal((await fetch(`${app.url}${photoPath}`, { method: "POST", headers })).status, 404);
  assert.equal((await fetch(`${app.url}${photoPath}`, { headers: { ...headers, Origin: "https://other.example" } })).status, 403);
  assert.equal(app.requests.length, 1);
});

test("rejects failed, non-image and redirecting person photo responses", async t => {
  for (const imageResponse of [
    { status: 404 },
    { headers: { "Content-Type": "text/html" } },
    { status: 302, headers: { Location: "/unexpected" } },
  ]) {
    const app = await fixture(t, { imageResponse });
    const result = await fetch(`${app.url}${photoPath}`, { headers });
    assert.equal(result.status, 502);
    assert.deepEqual(await result.json(), { error: "Home Assistant person photo unavailable." });
    assert.equal(app.requests.length, 1);
  }
});

test("authenticates the socket on the server without disclosing or accepting browser HA tokens", { timeout: 10000 }, async t => {
  const timetableApiKey = "fixture-timetable-api-key-1234567890";
  const app = await fixture(t, { timetableApiKey });
  const socket = new WebSocket(app.url.replace(/^http/, "ws") + "/api/websocket", { headers: { ...headers, Origin: app.url } });
  t.after(() => socket.terminate());
  socket.on("open", () => socket.send(JSON.stringify({ type: "auth", access_token: "server-managed" })));
  const [data] = await once(socket, "message");
  assert.equal(JSON.parse(data).type, "auth_ok");
  assert.deepEqual(app.commands, [{ type: "auth", access_token: token }]);
  assert.ok(!data.toString().includes(token));
  socket.send(JSON.stringify({ id: 1, type: "ping" }));
  const [pong] = await once(socket, "message");
  assert.deepEqual(JSON.parse(pong), { id: 1, type: "pong" });
  socket.close(); await once(socket, "close");
  for (const extra of [{}, { ...headers, Origin: "https://other.example" }, { Authorization: `Bearer ${timetableApiKey}` }]) {
    const rejected = new WebSocket(app.url.replace(/^http/, "ws") + "/api/websocket", { headers: extra });
    const error = await new Promise(resolve => rejected.once("error", resolve));
    assert.match(error.message, /401|403/);
  }
});

test("ignores legacy JSON storage instead of importing it", async t => {
  const app = await fixture(t, { legacy: true });
  const saved = await (await fetch(`${app.url}/api/config`, { headers })).json();
  assert.deepEqual(saved.config, emptyConfiguration());
});

test("explicit login bypass permits pages, APIs and sockets without a password but keeps cross-origin checks", { timeout: 10000 }, async t => {
  const app = await fixture(t, { dashboardAuthDisabled: true, dashboardPassword: undefined });
  for (const path of ["/", "/settings", "/api/runtime", "/api/config", "/api/calendars/calendar.family"]) {
    const response = await fetch(`${app.url}${path}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("www-authenticate"), null);
    assert.ok(!(await response.text()).includes(token));
  }
  const saved = await (await fetch(`${app.url}/api/config`)).json();
  assert.equal((await fetch(`${app.url}/api/config`, { method: "PUT", headers: { "Content-Type": "application/json", "If-Match": `"${saved.revision}"` }, body: JSON.stringify(saved.config) })).status, 200);
  for (const extra of [{ Origin: "https://other.example" }, { "Sec-Fetch-Site": "cross-site" }]) {
    assert.equal((await fetch(`${app.url}/api/config`, { headers: extra })).status, 403);
    const rejected = new WebSocket(app.url.replace(/^http/, "ws") + "/api/websocket", { headers: extra });
    const error = await new Promise(resolve => rejected.once("error", resolve));
    assert.match(error.message, /403/);
  }
  const auth = new Auth({ hassUrl: app.url, clientId: `${app.url}/`, access_token: "server-managed", refresh_token: "", expires: Number.MAX_SAFE_INTEGER, expires_in: Number.MAX_SAFE_INTEGER });
  const connection = await createConnection({ auth, setupRetry: 0 });
  t.after(() => connection.close());
  await connection.ping();
  assert.deepEqual(app.commands[0], { type: "auth", access_token: token });
});

test("reports an invalid upstream token distinctly from a network failure", { timeout: 10000 }, async t => {
  const warning = t.mock.method(console, "warn", () => {});
  const app = await fixture(t, { dashboardAuthDisabled: true, homeAssistantToken: "rejected-server-token" });
  const auth = new Auth({ hassUrl: app.url, clientId: `${app.url}/`, access_token: "server-managed", refresh_token: "", expires: Number.MAX_SAFE_INTEGER, expires_in: Number.MAX_SAFE_INTEGER });
  await assert.rejects(createConnection({ auth, setupRetry: 0 }), error => error === ERR_INVALID_AUTH);
  assert.match(warning.mock.calls[0].arguments[0], /rejected the configured server token/);
  assert.ok(!JSON.stringify(warning.mock.calls).includes("rejected-server-token"));
});

test("logs upstream connection errors without exposing credentials", { timeout: 10000 }, async t => {
  const warning = t.mock.method(console, "warn", () => {});
  const unavailable = createServer();
  const homeAssistantUrl = await listen(unavailable);
  await close(unavailable);
  const app = await fixture(t, { homeAssistantUrl });
  const socket = new WebSocket(app.url.replace(/^http/, "ws") + "/api/websocket", { headers });
  const [code] = await once(socket, "close");
  assert.equal(code, 1011);
  assert.match(warning.mock.calls[0].arguments[0], /ECONNREFUSED/);
  assert.ok(!JSON.stringify(warning.mock.calls).includes(token));
  assert.ok(!JSON.stringify(warning.mock.calls).includes(password));
});

test("rejects malformed socket messages without crashing the dashboard", { timeout: 10000 }, async t => {
  const app = await fixture(t);
  for (const payload of ["null", "42", "[]", "not json"]) {
    const socket = new WebSocket(app.url.replace(/^http/, "ws") + "/api/websocket", { headers });
    socket.on("error", () => {});
    socket.on("open", () => socket.send(payload));
    const [code] = await once(socket, "close");
    assert.equal(code, 1008);
  }
  assert.equal((await fetch(`${app.url}/api/config`, { headers })).status, 200);
});
