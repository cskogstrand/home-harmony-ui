import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8" }).trim();
const image = process.argv[2] ?? "home-harmony-ui:smoke";
if (!process.argv[2]) execFileSync("docker", ["build", "--tag", image, "."], { stdio: "inherit" });
const container = docker("run", "--detach", "--rm", "--init", "--publish", "127.0.0.1::8099", "-e", "HOME_ASSISTANT_URL=http://127.0.0.1:8123", "-e", "HOME_ASSISTANT_TOKEN=smoke-ha-token", "-e", "DASHBOARD_PASSWORD=smoke-dashboard-password", image);
const headers = { Authorization: `Basic ${Buffer.from("dashboard:smoke-dashboard-password").toString("base64")}` };

try {
  const base = `http://${docker("port", container, "8099/tcp")}`;
  let response;
  for (let attempt = 0; attempt < 50; attempt++) {
    response = await fetch(base, { headers }).catch(() => undefined);
    if (response?.ok) break;
    await setTimeout(100);
  }
  assert.ok(response?.ok, "Container must serve the dashboard");
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("cache-control"), "no-cache");
  const html = await response.text();
  assert.match(html, /Afterglow/);
  assert.match(html, /Content-Security-Policy/);

  const versionResponse = await fetch(`${base}/version.json`, { headers });
  assert.equal(versionResponse.status, 200);
  assert.match(versionResponse.headers.get("content-type"), /application\/json/);
  assert.equal(versionResponse.headers.get("cache-control"), "no-cache");
  const { version } = await versionResponse.json();
  assert.match(version, /^\d+\.\d+\.\d+$/);
  const imageVersion = JSON.parse(docker("inspect", "--format", "{{json .Config.Labels}}", container))?.["io.hass.version"];
  if (imageVersion) assert.equal(version, imageVersion, "The update notice must advertise the version inside this image");

  for (const route of ["/settings?auth_callback=1&code=smoke-auth-code&state=fixture", "/devices/example", "/calendar"]) {
    const page = await fetch(`${base}${route}`, { headers });
    assert.equal(page.status, 200, `${route} must survive a reload`);
    assert.equal(await page.text(), html, `${route} must serve the SPA`);
  }

  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(asset => asset.endsWith(".js")), "Built JavaScript must be present");
  assert.ok(assets.some(asset => asset.endsWith(".css")), "Built styles must be present");
  for (const asset of assets) {
    const resource = await fetch(`${base}${asset}`, { headers });
    assert.equal(resource.status, 200, asset);
    assert.match(resource.headers.get("content-type"), asset.endsWith(".js") ? /javascript/ : /text\/css/);
    assert.match(resource.headers.get("cache-control"), /immutable/);
  }
  assert.equal((await fetch(`${base}/assets/missing.js`, { headers })).status, 404);
  assert.equal((await fetch(`${base}/api/config`)).status, 401, "Shared configuration must require the dashboard password");
  assert.equal((await fetch(`${base}/api/timetables`, { method: "POST" })).status, 401, "PDF uploads must require the dashboard password");
  const loaded = await (await fetch(`${base}/api/config`, { headers })).json();
  loaded.config.settings.appearance.compactMode = true;
  const saved = await fetch(`${base}/api/config`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json", "If-Match": `"${loaded.revision}"` }, body: JSON.stringify(loaded.config) });
  assert.equal(saved.status, 200);
  assert.match(docker("exec", container, "cat", "/data/settings.yaml"), /compactMode: true/);
  assert.equal((await fetch(`${base}/api/runtime`, { headers })).status, 200);
  for (const executable of ["pdfinfo", "pdftoppm"]) {
    const result = spawnSync("docker", ["exec", container, executable, "-v"], { encoding: "utf8" });
    assert.equal(result.status, 0, `${executable} must run in the container: ${result.stderr}`);
  }
  const logs = spawnSync("docker", ["logs", container], { encoding: "utf8" });
  assert.equal(logs.status, 0, logs.stderr);
  assert.doesNotMatch(logs.stdout + logs.stderr, /smoke-auth-code|smoke-ha-token|smoke-dashboard-password/, "OAuth codes must not enter logs");
  console.log("HAOS container smoke test passed.");
} finally {
  docker("rm", "--force", container);
}
