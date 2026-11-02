import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAppServer } from "./app.mjs";
import { emptyConfiguration } from "../shared/configuration.ts";

const headers = { Authorization: `Basic ${Buffer.from("dashboard:fixture-password-long").toString("base64")}` };
const listen = async server => { server.listen(0, "127.0.0.1"); await once(server, "listening"); return `http://127.0.0.1:${server.address().port}`; };
async function fixture(t, snapshot = { type: "frigate", camera: "example" }, response = {}) {
  const dir = await mkdtemp(join(tmpdir(), "camera-proxy-"));
  const distDir = join(dir, "dist"), dataDir = join(dir, "data");
  await mkdir(distDir); await mkdir(dataDir); await writeFile(join(distDir, "index.html"), "Fixture");
  const requests = [];
  const upstream = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    requests.push({ path: req.url, authorization: req.headers.authorization, method: req.method, body });
    const state = req.url.startsWith("/api/states/");
    const webrtc = req.url.startsWith("/api/webrtc");
    res.writeHead(response.status ?? 200, response.headers ?? { "Content-Type": state ? "application/json" : webrtc ? "application/sdp" : "image/jpeg" });
    res.end(state ? JSON.stringify({ attributes: { entity_picture: response.picture ?? "/api/image_proxy/image.example_person?token=fixture-picture-token" } }) : webrtc ? "v=0\r\nfixture-answer" : "fixture-image");
  });
  const origin = await listen(upstream);
  const config = emptyConfiguration();
  config.settings.cameras = { go2rtcUrl: origin, frigateUrl: origin, sources: { "camera.example": { stream: "example", personSnapshot: snapshot } } };
  config.settings.notifications.rules = [{ id: "example", title: "Example", kind: "camera", cameraEntity: "home|camera.example", cameraMedia: "person", trigger: { type: "state", entity: "home|binary_sensor.example", operator: "eq", value: "on" } }];
  await writeFile(join(dataDir, "settings.yaml"), JSON.stringify(config));
  const server = await createAppServer({ dataDir, distDir, homeAssistantUrl: origin, homeAssistantToken: "fixture-ha-token", dashboardPassword: "fixture-password-long" });
  const url = await listen(server);
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  return { url, requests };
}
const offer = { method: "POST", headers: { ...headers, "Content-Type": "application/sdp" }, body: "v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=recvonly\r\n" };

test("proxies configured go2rtc and Frigate without forwarding dashboard or HA credentials", async t => {
  const app = await fixture(t);
  const stream = await fetch(`${app.url}/api/cameras/camera.example/webrtc?src=evil&dst=evil`, offer);
  assert.equal(stream.status, 200); assert.equal(await stream.text(), "v=0\r\nfixture-answer");
  const image = await fetch(`${app.url}/api/cameras/camera.example/person.jpg?v=123&url=http://other.example`, { headers });
  assert.equal(image.status, 200); assert.equal(await image.text(), "fixture-image");
  assert.equal(image.headers.get("cache-control"), "no-store");
  assert.deepEqual(app.requests.map(({ path, authorization }) => ({ path, authorization })), [
    { path: "/api/webrtc?src=example", authorization: undefined }, { path: "/api/example/person/snapshot.jpg", authorization: undefined },
  ]);
  const saved = await (await fetch(`${app.url}/api/config`, { headers })).json();
  assert.equal(saved.config.settings.notifications.rules[0].cameraMedia, "person");
});

test("protects camera routes, rejects unknown cameras, uploads and oversized offers", async t => {
  const app = await fixture(t);
  assert.equal((await fetch(`${app.url}/api/cameras/camera.example/person.jpg`)).status, 401);
  assert.equal((await fetch(`${app.url}/api/cameras/camera.example/webrtc`, { ...offer, headers: { ...offer.headers, Origin: "https://other.example" } })).status, 403);
  assert.equal((await fetch(`${app.url}/api/cameras/camera.other/person.jpg`, { headers })).status, 404);
  assert.equal((await fetch(`${app.url}/api/cameras/camera.example/personXjpg`, { headers })).status, 404);
  assert.equal((await fetch(`${app.url}/api/cameras/camera.example/webrtc`, { ...offer, body: "v=0\r\na=sendrecv\r\n" })).status, 400);
  assert.equal((await fetch(`${app.url}/api/cameras/camera.example/webrtc`, { ...offer, headers })).status, 415);
  assert.equal((await fetch(`${app.url}/api/cameras/camera.example/webrtc`, { ...offer, body: "x".repeat(65537) })).status, 413);
  assert.equal(app.requests.length, 0);
});

for (const entity of ["image.example_person", "camera.example_person", "sensor.example_person", "binary_sensor.example_person"]) test(`fetches ${entity} with the server HA token`, async t => {
  const app = await fixture(t, { type: "home-assistant", entity });
  assert.equal((await fetch(`${app.url}/api/cameras/camera.example/person.jpg`, { headers })).status, 200);
  assert.ok(app.requests.every(request => request.authorization === "Bearer fixture-ha-token"));
  assert.ok(app.requests.every(request => !request.path.includes("token=")));
  assert.equal(app.requests.at(-1).path, entity.startsWith("camera.") ? "/api/camera_proxy/camera.example_person" : "/api/image_proxy/image.example_person");
});

test("rejects sensor picture URLs outside the fixed HA proxies", async t => {
  for (const picture of ["https://other.example/snapshot.jpg", "/api/services/light/turn_on", "//other.example/image.jpg"]) {
    const app = await fixture(t, { type: "home-assistant", entity: "sensor.example" }, { picture });
    assert.equal((await fetch(`${app.url}/api/cameras/camera.example/person.jpg`, { headers })).status, 422);
    assert.equal(app.requests.length, 1);
  }
});

test("rejects upstream redirects, HTML and unavailable snapshots", async t => {
  for (const response of [{ status: 404 }, { headers: { "Content-Type": "text/html" } }, { status: 302, headers: { Location: "http://other.example/" } }]) {
    const app = await fixture(t, undefined, response);
    const result = await fetch(`${app.url}/api/cameras/camera.example/person.jpg`, { headers });
    assert.equal(result.status, 502); assert.equal(app.requests.length, 1);
  }
  const app = await fixture(t, { type: "none" });
  assert.equal((await fetch(`${app.url}/api/cameras/camera.example/person.jpg`, { headers })).status, 404);
  assert.equal(app.requests.length, 0);
});
