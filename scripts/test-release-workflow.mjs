import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const workflow = load(readFileSync(new URL("../.github/workflows/publish-image.yml", import.meta.url), "utf8"));
const config = load(readFileSync(new URL("../config.yaml", import.meta.url), "utf8"));
const script = fileURLToPath(new URL("./release.mjs", import.meta.url));
const { prepare, build, publish } = workflow.jobs;
const directory = mkdtempSync(join(tmpdir(), "home-harmony-release-"));
const image = "ghcr.io/example/home-harmony-ui";
const revision = "c".repeat(40);
const fixture = `name: Example app\nversion: "1.2.3"\nimage: "${image}"\narch: [amd64, aarch64]\n`;
const env = { ...process.env, GITHUB_REPOSITORY: "Example/home-harmony-ui", GITHUB_SHA: revision, GITHUB_RUN_ID: "123", VERSION: "1.2.4", PATH: `${directory}:${process.env.PATH}`, TEST_REGISTRY: join(directory, "registry.json"), TEST_DOCKER_LOG: join(directory, "docker.log") };
const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: directory, encoding: "utf8", env });
const succeeded = result => assert.equal(result.status, 0, result.stderr + result.stdout);
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", env: { ...env, GIT_AUTHOR_NAME: "Release test", GIT_AUTHOR_EMAIL: "release@example.invalid", GIT_COMMITTER_NAME: "Release test", GIT_COMMITTER_EMAIL: "release@example.invalid" }, stdio: ["ignore", "pipe", "pipe"] });
const manifest = { manifests: ["amd64", "arm64"].map((arch, index) => ({ platform: { os: "linux", architecture: arch }, digest: `sha256:${(index ? "b" : "a").repeat(64)}` })) };
const images = Object.fromEntries(manifest.manifests.map(entry => [entry.digest, { Os: "linux", Architecture: entry.platform.architecture, Config: { Labels: { "io.hass.arch": entry.platform.architecture === "arm64" ? "aarch64" : "amd64", "io.hass.version": "1.2.4", "org.opencontainers.image.revision": revision } } }]));
const registry = changes => {
  writeFileSync(env.TEST_REGISTRY, JSON.stringify({ manifest, images, ...changes }));
  writeFileSync(env.TEST_DOCKER_LOG, "");
};
const calls = () => readFileSync(env.TEST_DOCKER_LOG, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));

try {
  writeFileSync(join(directory, "VERSION"), "1.2.4\n");
  writeFileSync(join(directory, "config.yaml"), fixture);
  const prepared = run("prepare");
  succeeded(prepared);
  assert.equal(prepared.stdout, `version=1.2.4\nimage=${image}\npending=true\n`);
  assert.equal(readFileSync(join(directory, "config.yaml"), "utf8"), fixture, "Preparing a release must not advertise it");
  writeFileSync(join(directory, "VERSION"), "1.2.3\n");
  assert.match(run("prepare").stdout, /pending=false/, "Adding VERSION at the current version must not publish again");
  for (const version of ["1.2.2", "v1.2.4", "01.2.4", "1.2.4-rc.1", "1.2.4\nimage=unexpected"]) {
    writeFileSync(join(directory, "VERSION"), version);
    assert.notEqual(run("prepare").status, 0, `Reject invalid or older version ${JSON.stringify(version)}`);
  }
  writeFileSync(join(directory, "VERSION"), "1.2.10\n");
  writeFileSync(join(directory, "config.yaml"), fixture.replace("1.2.3", "1.2.9"));
  succeeded(run("prepare"));
  writeFileSync(join(directory, "VERSION"), "1.2.4\n");
  for (const invalid of [fixture.replace(image, "ghcr.io/example/other-app"), fixture.replace("[amd64, aarch64]", "[amd64]"), fixture + 'version: "1.2.3"\n']) {
    writeFileSync(join(directory, "config.yaml"), invalid);
    assert.notEqual(run("prepare").status, 0, "Reject mismatched image, architecture, or duplicate metadata");
  }
  writeFileSync(join(directory, "config.yaml"), fixture);
  const stage = build.steps.find(step => step.name === "Set the version inside the image").run;
  succeeded(spawnSync("bash", ["-e", "-o", "pipefail", "-c", stage], { cwd: directory, encoding: "utf8", env }));
  assert.equal(load(readFileSync(join(directory, "config.yaml"), "utf8")).version, "1.2.4", "The image's UI must display the requested version");
  writeFileSync(join(directory, "config.yaml"), fixture);

  // Exercise publication without contacting a registry or using real credentials.
  writeFileSync(join(directory, "docker"), `#!/usr/bin/env node
const fs = require('node:fs');
const state = JSON.parse(fs.readFileSync(process.env.TEST_REGISTRY, 'utf8'));
const args = process.argv.slice(2);
const anonymous = !!process.env.DOCKER_CONFIG && fs.readdirSync(process.env.DOCKER_CONFIG).length === 0;
fs.appendFileSync(process.env.TEST_DOCKER_LOG, JSON.stringify({args, anonymous}) + '\\n');
function fail(message) { console.error(message); process.exit(1); }
if (args[0] === 'buildx') {
  if (args[2] === 'inspect') {
    if (state.inspectionError) fail(state.inspectionError);
    if (!state.exists) fail(args[3] + ': not found');
  } else if (args[2] !== 'create') fail('Unexpected buildx call');
} else {
  if (!anonymous) fail('Expected an empty Docker configuration for anonymous verification');
  if (state.private) fail('unauthorized: authentication required');
  if (args[0] === 'manifest') console.log(JSON.stringify(state.manifest));
  else if (args[0] === 'pull') { if (state.pullFailure) fail('blob unavailable'); }
  else if (args[0] === 'image') console.log(JSON.stringify([state.images[args[2].split('@')[1]]]));
  else fail('Unexpected Docker call');
}
`, { mode: 0o755 });
  registry({});
  succeeded(run("publish"));
  assert.equal(calls().filter(call => call.args[2] === "create").length, 1);
  assert.equal(calls().filter(call => call.args[0] === "pull" && call.anonymous).length, 2);
  registry({ exists: true });
  succeeded(run("publish"));
  assert.ok(!calls().some(call => call.args[2] === "create"), "Resume after publication without replacing the released tag");
  for (const changes of [
    { inspectionError: "unauthorized: authentication required" },
    { inspectionError: "dial tcp: connection refused" },
    { private: true },
    { pullFailure: true },
    { manifest: { manifests: [manifest.manifests[0]] } },
    { manifest: { manifests: [manifest.manifests[0], manifest.manifests[0], manifest.manifests[1]] } },
    { exists: true, images: { ...images, [manifest.manifests[0].digest]: { ...images[manifest.manifests[0].digest], Config: { Labels: { ...images[manifest.manifests[0].digest].Config.Labels, "org.opencontainers.image.revision": "d".repeat(40) } } } } },
  ]) {
    registry(changes);
    assert.notEqual(run("publish").status, 0, `Reject unverifiable release: ${JSON.stringify(changes)}`);
    assert.equal(readFileSync(join(directory, "config.yaml"), "utf8"), fixture);
    if (changes.inspectionError || changes.exists) assert.ok(!calls().some(call => call.args[2] === "create"));
  }

  const main = join(directory, "release-main");
  mkdirSync(main);
  for (const [wanted, published, changed, expectedStatus, expectedVersion] of [
    ["1.2.4", "1.2.3", false, 0, "1.2.4"],
    ["1.2.5", "1.2.3", false, 0, "1.2.3"],
    ["1.2.4", "1.2.5", false, 0, "1.2.5"],
    ["1.2.4", "1.2.4", false, 0, "1.2.4"],
    ["1.2.4", "1.2.3", true, 1, "1.2.3"],
  ]) {
    writeFileSync(join(main, "VERSION"), wanted);
    writeFileSync(join(main, "config.yaml"), fixture.replace("1.2.3", published) + (changed ? "description: Changed during the build\n" : ""));
    assert.equal(run("promote", main).status, expectedStatus);
    assert.equal(load(readFileSync(join(main, "config.yaml"), "utf8")).version, expectedVersion);
  }

  // Use local Git repositories to prove promotion preserves concurrent work and never force-pushes.
  rmSync(main, { recursive: true });
  const remote = join(directory, "origin.git");
  const writer = join(directory, "writer");
  git(directory, "init", "--bare", "--initial-branch=main", remote);
  git(directory, "clone", remote, writer);
  writeFileSync(join(writer, "VERSION"), "1.2.4\n");
  writeFileSync(join(writer, "config.yaml"), fixture);
  git(writer, "add", ".");
  git(writer, "commit", "-m", "test: request release");
  git(writer, "push", "origin", "main");
  git(directory, "clone", remote, main);
  mkdirSync(join(directory, "scripts"));
  symlinkSync(script, join(directory, "scripts", "release.mjs"));
  writeFileSync(join(writer, "unrelated.txt"), "concurrent work\n");
  git(writer, "add", "unrelated.txt");
  git(writer, "commit", "-m", "test: concurrent change");
  git(writer, "push", "origin", "main");
  const promote = publish.steps.find(step => step.name === "Advertise the verified release").run;
  const advertise = () => spawnSync("bash", ["-e", "-o", "pipefail", "-c", promote], { cwd: directory, encoding: "utf8", env });
  assert.notEqual(advertise().status, 0, "A racing push must be rejected");
  assert.equal(git(remote, "show", "main:config.yaml"), fixture);
  rmSync(main, { recursive: true });
  git(directory, "clone", remote, main);
  succeeded(advertise());
  assert.equal(git(remote, "show", "main:config.yaml"), fixture.replace("1.2.3", "1.2.4"));
  assert.equal(git(remote, "show", "main:unrelated.txt"), "concurrent work\n");
  assert.equal(git(remote, "diff", "--name-only", "HEAD^", "HEAD").trim(), "config.yaml");

  assert.deepEqual(workflow.on, { push: { branches: ["main"], paths: ["VERSION"] }, workflow_dispatch: null });
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.deepEqual(Object.keys(workflow.jobs).sort(), ["build", "prepare", "publish"]);
  assert.match(prepare.if, /github.ref == 'refs\/heads\/main'/);
  assert.match(build.if, /needs.prepare.outputs.pending == 'true'/);
  for (const job of Object.values(workflow.jobs)) {
    assert.ok(job.if.startsWith("github.event.repository.private == false"), "Never consume paid private-repository minutes");
    assert.ok(job["timeout-minutes"] > 0 && job["timeout-minutes"] <= 20);
    for (const step of job.steps.filter(step => step.uses)) {
      assert.match(step.uses, /^(actions\/(checkout|setup-node)|docker\/login-action)@[a-f0-9]{40}$/, "Use pinned actions without artifact or cache uploads");
      if (step.uses.startsWith("actions/setup-node@")) assert.equal(step.with["package-manager-cache"], false);
    }
  }
  assert.equal(build["runs-on"], "${{ matrix.runner }}");
  assert.deepEqual(build.strategy.matrix.include, [
    { arch: "amd64", platform: "linux/amd64", runner: "ubuntu-24.04" },
    { arch: "aarch64", platform: "linux/arm64", runner: "ubuntu-24.04-arm" },
  ]);
  assert.deepEqual(config.arch.toSorted(), build.strategy.matrix.include.map(entry => entry.arch).toSorted());
  assert.equal(prepare["runs-on"], "ubuntu-24.04");
  assert.equal(publish["runs-on"], "ubuntu-24.04");
  assert.equal(build.needs, "prepare");
  assert.deepEqual(publish.needs, ["prepare", "build"]);
  const smokeIndex = build.steps.findIndex(step => step.run?.includes("node scripts/test-ha-app.mjs"));
  assert.ok(smokeIndex >= 0 && build.steps.findIndex(step => step.run?.startsWith("docker push")) > smokeIndex);
  const verifyIndex = publish.steps.findIndex(step => step.run === "node scripts/release.mjs publish");
  const checkoutIndex = publish.steps.findIndex(step => step.with?.path === "release-main");
  assert.ok(verifyIndex >= 0 && checkoutIndex > verifyIndex && publish.steps.findIndex(step => step.run === promote) > checkoutIndex);
  assert.equal(publish.steps[checkoutIndex].with.ref, "main");
  console.log("Release validation, public-image verification, retry, stale-run, Git race and free-usage checks passed.");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
