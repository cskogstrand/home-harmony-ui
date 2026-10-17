import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8" }).trim();
const image = "home-harmony-ui:smoke";
execFileSync("docker", ["build", "--tag", image, "."], { stdio: "inherit" });
const container = docker("run", "--detach", "--rm", "--init", "--publish", "127.0.0.1::8099", image);

try {
  docker("exec", container, "nginx", "-t");
  const base = `http://${docker("port", container, "8099/tcp")}`;
  let response;
  for (let attempt = 0; attempt < 50; attempt++) {
    response = await fetch(base).catch(() => undefined);
    if (response?.ok) break;
    await setTimeout(100);
  }
  assert.ok(response?.ok, "Container must serve the dashboard");
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("cache-control"), "no-cache");
  const html = await response.text();
  assert.match(html, /Afterglow/);
  assert.match(html, /Content-Security-Policy/);

  for (const route of ["/settings?auth_callback=1&code=smoke-auth-code&state=fixture", "/devices/example", "/calendar"]) {
    const page = await fetch(`${base}${route}`);
    assert.equal(page.status, 200, `${route} must survive a reload`);
    assert.equal(await page.text(), html, `${route} must serve the SPA`);
  }

  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(asset => asset.endsWith(".js")), "Built JavaScript must be present");
  assert.ok(assets.some(asset => asset.endsWith(".css")), "Built styles must be present");
  for (const asset of assets) {
    const resource = await fetch(`${base}${asset}`);
    assert.equal(resource.status, 200, asset);
    assert.match(resource.headers.get("content-type"), asset.endsWith(".js") ? /javascript/ : /text\/css/);
    assert.match(resource.headers.get("cache-control"), /immutable/);
  }
  assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404);
  const logs = spawnSync("docker", ["logs", container], { encoding: "utf8" });
  assert.equal(logs.status, 0, logs.stderr);
  assert.doesNotMatch(logs.stdout + logs.stderr, /smoke-auth-code/, "OAuth codes must not enter logs");
  console.log("HAOS container smoke test passed.");
} finally {
  docker("rm", "--force", container);
}
