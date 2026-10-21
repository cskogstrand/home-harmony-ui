import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "js-yaml";

const version = readFileSync("VERSION", "utf8").trim();
const configText = readFileSync("config.yaml", "utf8");
const config = load(configText);
const image = `ghcr.io/${process.env.GITHUB_REPOSITORY?.toLowerCase()}`;
const platforms = { amd64: "amd64", arm64: "aarch64" };

function compareVersions(left, right) {
  for (const value of [left, right]) assert.match(value, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "Use a stable version such as 0.9.9");
  const a = left.split(".").map(BigInt);
  const b = right.split(".").map(BigInt);
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function withVersion(text) {
  assert.equal((text.match(/^version:/gm) ?? []).length, 1, "config.yaml must have one top-level version");
  const updated = text.replace(/^version:.*$/m, `version: "${version}"`);
  assert.equal(load(updated).version, version);
  return updated;
}

assert.ok(compareVersions(version, config.version) >= 0, "VERSION must not be older than the published config.yaml version");
assert.equal(config.image, image, "config.yaml must reference this repository's GHCR image");
assert.deepEqual(config.arch.toSorted(), Object.values(platforms).toSorted(), "Build every supported architecture");
withVersion(configText);

if (process.argv[2] === "prepare") {
  console.log(`version=${version}\nimage=${image}\npending=${version !== config.version}`);
} else if (process.argv[2] === "publish") {
  const revision = process.env.GITHUB_SHA;
  const runId = process.env.GITHUB_RUN_ID;
  assert.match(revision, /^[a-f0-9]{40}$/, "Require the source commit SHA");
  assert.match(runId, /^\d+$/, "Require the workflow run ID");
  const ref = `${image}:${version}`;
  const docker = (args, env = process.env) => execFileSync("docker", args, { encoding: "utf8", env, maxBuffer: 10 * 1024 * 1024 });
  let exists = true;
  try {
    docker(["buildx", "imagetools", "inspect", ref]);
  } catch (error) {
    const message = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    if (!message.includes(`${ref}: not found`) && !/manifest[ _]unknown/i.test(message)) throw error;
    exists = false;
  }
  if (!exists) {
    docker(["buildx", "imagetools", "create", "--tag", ref, ...Object.values(platforms).map(arch => `${image}:build-${runId}-${arch}`)]);
  }

  // Verify anonymously: a successful authenticated push does not make a package public.
  const dockerConfig = mkdtempSync(join(tmpdir(), "home-harmony-public-image-"));
  try {
    const env = { ...process.env, DOCKER_CONFIG: dockerConfig };
    const manifest = JSON.parse(docker(["manifest", "inspect", ref], env));
    for (const [arch, hassArch] of Object.entries(platforms)) {
      const matches = manifest.manifests?.filter(entry => entry.platform?.os === "linux" && entry.platform.architecture === arch);
      assert.equal(matches?.length, 1, `Release must contain exactly one linux/${arch} image`);
      const digest = matches[0].digest;
      assert.match(digest, /^sha256:[a-f0-9]{64}$/);
      const child = `${image}@${digest}`;
      docker(["pull", "--platform", `linux/${arch}`, child], env);
      const [built] = JSON.parse(docker(["image", "inspect", child], env));
      assert.equal(built.Os, "linux");
      assert.equal(built.Architecture, arch);
      assert.equal(built.Config.Labels["io.hass.arch"], hassArch);
      assert.equal(built.Config.Labels["io.hass.version"], version);
      assert.equal(built.Config.Labels["org.opencontainers.image.revision"], revision, "Published version belongs to another commit; bump VERSION instead of overwriting it");
    }
  } finally {
    rmSync(dockerConfig, { recursive: true, force: true });
  }
  console.log(`Verified public AMD64 and ARM64 images for ${version}.`);
} else if (process.argv[2] === "promote") {
  const directory = process.argv[3];
  assert.ok(directory, "Require a fresh checkout of main");
  const wanted = readFileSync(join(directory, "VERSION"), "utf8").trim();
  const path = join(directory, "config.yaml");
  const currentText = readFileSync(path, "utf8");
  const current = load(currentText);
  if (wanted !== version || compareVersions(current.version, version) >= 0) {
    console.log("::notice::Release already advertised or superseded; leaving main unchanged.");
  } else {
    assert.deepEqual({ ...current, version }, { ...config, version }, "App configuration changed during the build; release a new VERSION with that configuration");
    writeFileSync(path, withVersion(currentText));
    console.log(`Ready to advertise ${version} in config.yaml.`);
  }
} else {
  throw new Error("Use prepare, publish, or promote <main-checkout>");
}
