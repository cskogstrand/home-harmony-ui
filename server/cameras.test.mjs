import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAppServer } from "./app.mjs";
import { emptyConfiguration } from "../shared/configuration.ts";
import { go2rtcErrors } from "../shared/cameras.ts";

const headers = { Authorization: `Basic ${Buffer.from("dashboard:fixture-password-long").toString("base64")}` };
const listen = async server => { server.listen(0, "127.0.0.1"); await once(server, "listening"); return `http://127.0.0.1:${server.address().port}`; };
async function fixture(t, snapshot = { type: "frigate", connectionId: "example-frigate", camera: "example" }, response = {}) {
  const dir = await mkdtemp(join(tmpdir(), "camera-proxy-"));
  const distDir = join(dir, "dist"), dataDir = join(dir, "data");
  await mkdir(distDir); await mkdir(dataDir); await writeFile(join(distDir, "index.html"), "Fixture");
  const requests = [];
  const upstream = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    requests.push({ path: req.url, authorization: req.headers.authorization, method: req.method, body });
    const discovery = req.url === "/api/streams";
    const state = req.url.startsWith("/api/states/");
    const webrtc = req.url.startsWith("/api/webrtc");
    res.writeHead(response.status ?? 200, response.headers ?? { "Content-Type": state || discovery ? "application/json" : webrtc ? "application/sdp" : "image/jpeg" });
    res.end(discovery ? JSON.stringify(response.streams ?? { example: { producers: [{ url: "rtsp://fixture:secret@camera.example/live" }] }, "invalid?url=secret": {} }) : state ? JSON.stringify({ attributes: { entity_picture: response.picture ?? "/api/image_proxy/image.example_person?token=fixture-picture-token" } }) : webrtc ? "v=0\r\nfixture-answer" : response.body ?? "fixture-image");
  });
  const origin = await listen(upstream);
  const config = emptyConfiguration();
  config.settings.cameras = { connections: [{ id: "example-go2rtc", name: "Example go2rtc", type: "go2rtc", url: origin }, { id: "example-frigate", name: "Example Frigate", type: "frigate", url: origin }], items: [{ id: "example-camera", name: "Example camera", connectionId: "example-go2rtc", source: "example", personSnapshot: snapshot }] };
  config.settings.notifications.rules = [{ id: "example", title: "Example", kind: "camera", cameraEntity: "example-camera", cameraMedia: "person", trigger: { type: "state", entity: "home|binary_sensor.example", operator: "eq", value: "on" } }];
  await writeFile(join(dataDir, "settings.yaml"), JSON.stringify(config));
  const server = await createAppServer({ dataDir, distDir, homeAssistantUrl: origin, homeAssistantToken: "fixture-ha-token", dashboardPassword: "fixture-password-long" });
  const url = await listen(server);
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  return { url, requests };
}
const offer = { method: "POST", headers: { ...headers, "Content-Type": "application/sdp" }, body: "v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=recvonly\r\n" };

test("loads fresh go2rtc preview frames from the saved live source without person-image setup", async t => {
  const app = await fixture(t, { type: "none" });
  const path = `${app.url}/api/cameras/example-camera/snapshot.jpg`;
  assert.equal((await fetch(path)).status, 401);
  assert.equal((await fetch(path, { method: "POST", headers })).status, 404);
  assert.equal((await fetch(`${app.url}/api/cameras/unknown/snapshot.jpg`, { headers })).status, 404);
  assert.equal(app.requests.length, 0);
  for (let i = 0; i < 2; i++) {
    const image = await fetch(`${path}?src=other&width=9999&url=http://other.example&cache=1h`, { headers });
    assert.equal(image.status, 200); assert.equal(await image.text(), "fixture-image");
    assert.equal(image.headers.get("content-type"), "image/jpeg");
    assert.equal(image.headers.get("cache-control"), "no-store");
  }
  assert.deepEqual(app.requests.map(({ path, authorization }) => ({ path, authorization })), Array(2).fill({ path: "/api/frame.jpeg?src=example&width=640", authorization: undefined }));
});

test("rejects failed, redirected, non-image and oversized preview frames", async t => {
  for (const response of [{ status: 500 }, { headers: { "Content-Type": "text/html" } }, { status: 302, headers: { Location: "http://other.example" } }, { body: "x".repeat(10 * 1024 * 1024 + 1) }]) {
    const app = await fixture(t, { type: "none" }, response);
    const result = await fetch(`${app.url}/api/cameras/example-camera/snapshot.jpg`, { headers });
    assert.ok([413, 502].includes(result.status)); assert.equal(app.requests.length, 1);
  }
});

test("proxies configured go2rtc and Frigate without forwarding dashboard or HA credentials", async t => {
  const app = await fixture(t);
  const stream = await fetch(`${app.url}/api/cameras/example-camera/webrtc?src=evil&dst=evil`, offer);
  assert.equal(stream.status, 200); assert.equal(await stream.text(), "v=0\r\nfixture-answer");
  const image = await fetch(`${app.url}/api/cameras/example-camera/person.jpg?v=123&url=http://other.example`, { headers });
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
  assert.equal((await fetch(`${app.url}/api/cameras/example-camera/person.jpg`)).status, 401);
  assert.equal((await fetch(`${app.url}/api/cameras/example-camera/webrtc`, { ...offer, headers: { ...offer.headers, Origin: "https://other.example" } })).status, 403);
  assert.equal((await fetch(`${app.url}/api/cameras/camera.other/person.jpg`, { headers })).status, 404);
  assert.equal((await fetch(`${app.url}/api/cameras/example-camera/personXjpg`, { headers })).status, 404);
  assert.equal((await fetch(`${app.url}/api/cameras/example-camera/webrtc`, { ...offer, body: "v=0\r\na=sendrecv\r\n" })).status, 400);
  assert.equal((await fetch(`${app.url}/api/cameras/example-camera/webrtc`, { ...offer, headers })).status, 415);
  assert.equal((await fetch(`${app.url}/api/cameras/example-camera/webrtc`, { ...offer, body: "x".repeat(65537) })).status, 413);
  assert.equal(app.requests.length, 0);
});

for (const entity of ["image.example_person", "camera.example_person", "sensor.example_person", "binary_sensor.example_person"]) test(`fetches ${entity} with the server HA token`, async t => {
  const app = await fixture(t, { type: "home-assistant", entity });
  assert.equal((await fetch(`${app.url}/api/cameras/example-camera/person.jpg`, { headers })).status, 200);
  assert.ok(app.requests.every(request => request.authorization === "Bearer fixture-ha-token"));
  assert.ok(app.requests.every(request => !request.path.includes("token=")));
  assert.equal(app.requests.at(-1).path, entity.startsWith("camera.") ? "/api/camera_proxy/camera.example_person" : "/api/image_proxy/image.example_person");
});

test("rejects sensor picture URLs outside the fixed HA proxies", async t => {
  for (const picture of ["https://other.example/snapshot.jpg", "/api/services/light/turn_on", "//other.example/image.jpg"]) {
    const app = await fixture(t, { type: "home-assistant", entity: "sensor.example" }, { picture });
    assert.equal((await fetch(`${app.url}/api/cameras/example-camera/person.jpg`, { headers })).status, 422);
    assert.equal(app.requests.length, 1);
  }
});

test("rejects upstream redirects, HTML and unavailable snapshots", async t => {
  for (const response of [{ status: 404 }, { headers: { "Content-Type": "text/html" } }, { status: 302, headers: { Location: "http://other.example/" } }]) {
    const app = await fixture(t, undefined, response);
    const result = await fetch(`${app.url}/api/cameras/example-camera/person.jpg`, { headers });
    assert.equal(result.status, 502); assert.equal(app.requests.length, 1);
  }
  const app = await fixture(t, { type: "none" });
  assert.equal((await fetch(`${app.url}/api/cameras/example-camera/person.jpg`, { headers })).status, 404);
  assert.equal(app.requests.length, 0);
});

test("reports go2rtc stream rejection and wrong API responses without upstream details", async t => {
  for (const [response, message] of [[{ status: 404 }, go2rtcErrors.rejected], [{ headers: { "Content-Type": "text/html" } }, go2rtcErrors.invalid], [{ status: 302, headers: { Location: "http://other.example" } }, go2rtcErrors.unreachable]]) {
    const app = await fixture(t, undefined, response);
    const result = await fetch(`${app.url}/api/cameras/example-camera/webrtc`, offer);
    assert.equal(result.status, 502);
    assert.deepEqual(await result.json(), { error: message });
  }
});

test("relays MP4 with its codecs from only the saved source and rejects non-video replies", async t => {
  const type = 'video/mp4; codecs="avc1.640029,mp4a.40.2"';
  const app = await fixture(t, undefined, { headers: { "Content-Type": type } });
  const result = await fetch(`${app.url}/api/cameras/example-camera/stream.mp4?src=evil&url=http://other.example`, { headers });
  assert.equal(result.status, 200); assert.equal(result.headers.get("content-type"), type);
  assert.equal(await result.text(), "fixture-image");
  assert.equal(app.requests[0].path, "/api/stream.mp4?src=example");
  assert.equal(app.requests[0].authorization, undefined);
  assert.equal((await fetch(`${app.url}/api/cameras/example-camera/stream.mp4`)).status, 401);
  for (const contentType of ["text/html", "video/mp4", 'video/mp4; codecs="unexpected <markup>"']) {
    const invalid = await fixture(t, undefined, { headers: { "Content-Type": contentType } });
    assert.equal((await fetch(`${invalid.url}/api/cameras/example-camera/stream.mp4`, { headers })).status, 502);
  }
});


test("discovers names from a saved go2rtc connection without exposing upstream credentials", async t => {
  const app = await fixture(t);
  const result = await fetch(`${app.url}/api/camera-connections/example-go2rtc/streams?url=http://other.example`, { headers });
  assert.equal(result.status, 200); assert.deepEqual(await result.json(), ["example"]);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.deepEqual(app.requests.map(({ path, authorization }) => ({ path, authorization })), [{ path: "/api/streams", authorization: undefined }]);
  assert.equal((await fetch(`${app.url}/api/camera-connections/example-go2rtc/streams`)).status, 401);
  assert.equal((await fetch(`${app.url}/api/camera-connections/missing/streams`, { headers })).status, 404);
  assert.equal((await fetch(`${app.url}/api/camera-connections/example-frigate/streams`, { headers })).status, 404);
  assert.equal((await fetch(`${app.url}/api/camera-connections/example-go2rtc/streams`, { method: "POST", headers })).status, 404);
});

test("rejects invalid and oversized discovery replies", async t => {
  for (const response of [{ streams: [] }, { headers: { "Content-Type": "text/html" } }, { status: 302, headers: { Location: "http://other.example" } }, { streams: { example: "x".repeat(2 * 1024 * 1024) } }]) {
    const app = await fixture(t, undefined, response);
    const result = await fetch(`${app.url}/api/camera-connections/example-go2rtc/streams`, { headers });
    assert.ok([413, 502].includes(result.status)); assert.equal(app.requests.length, 1);
  }
});
