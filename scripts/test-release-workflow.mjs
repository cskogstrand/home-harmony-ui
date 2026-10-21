import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "js-yaml";

const workflow = load(readFileSync(new URL("../.github/workflows/publish-image.yml", import.meta.url), "utf8"));
const config = load(readFileSync(new URL("../config.yaml", import.meta.url), "utf8"));
const { build, publish } = workflow.jobs;
const metadata = build.steps.find(step => step.id === "metadata").run;
const guard = publish.steps.find(step => step.name === "Refuse to overwrite a released version").run;
const directory = mkdtempSync(join(tmpdir(), "home-harmony-release-"));
const output = join(directory, "output");
const image = "ghcr.io/example/home-harmony-ui";
const fixture = `version: "1.2.3"\nimage: "${image}"\n`;
const run = (script, env = {}) => spawnSync("bash", ["-e", "-o", "pipefail", "-c", script], {
  cwd: directory,
  encoding: "utf8",
  env: { ...process.env, GITHUB_REF_NAME: "v1.2.3", GITHUB_REPOSITORY: "Example/home-harmony-ui", GITHUB_OUTPUT: output, IMAGE: image, VERSION: "1.2.3", ...env },
});

try {
  writeFileSync(join(directory, "config.yaml"), fixture);
  const valid = run(metadata);
  assert.equal(valid.status, 0, valid.stderr + valid.stdout);
  assert.equal(readFileSync(output, "utf8"), `version=1.2.3\nimage=${image}\n`);
  for (const tag of ["v1.2.4", "1.2.3", "v01.2.3", "v1.2.3-rc.1", "v1.2.3\nimage=unexpected"]) {
    assert.notEqual(run(metadata, { GITHUB_REF_NAME: tag }).status, 0, `Reject mismatched or invalid tag ${JSON.stringify(tag)}`);
  }
  writeFileSync(join(directory, "config.yaml"), fixture.replace(image, "ghcr.io/example/other-app"));
  assert.notEqual(run(metadata).status, 0, "Reject publishing an image Home Assistant will not use");
  writeFileSync(join(directory, "config.yaml"), 'version: "1.2.3"\n');
  assert.notEqual(run(metadata).status, 0, "Require a prebuilt image reference");

  const inspect = 'docker() { printf "%s\\n" "$REGISTRY_RESPONSE"; return "$REGISTRY_STATUS"; }\n';
  for (const [status, response, allowed] of [
    [0, "Existing manifest", false],
    [1, `${image}:1.2.3: not found`, true],
    [1, "manifest unknown", true],
    [1, "MANIFEST_UNKNOWN", true],
    [1, "unauthorized: authentication required", false],
    [1, "dial tcp: connection refused", false],
  ]) {
    const result = run(inspect + guard, { REGISTRY_STATUS: String(status), REGISTRY_RESPONSE: response });
    assert.equal(result.status === 0, allowed, `Registry response: ${response}`);
  }

  assert.deepEqual(workflow.on, { push: { tags: ["v*"] } }, "Only release tags start builds");
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.deepEqual(Object.keys(workflow.jobs).sort(), ["build", "publish"]);
  for (const job of Object.values(workflow.jobs)) {
    assert.equal(job.if, "github.event.repository.private == false", "Never consume paid private-repository minutes");
    assert.ok(job["timeout-minutes"] > 0 && job["timeout-minutes"] <= 20);
    for (const step of job.steps.filter(step => step.uses)) {
      assert.match(step.uses, /^(actions\/(checkout|setup-node)|docker\/login-action)@[a-f0-9]{40}$/, "Use pinned actions without artifact or cache uploads");
    }
  }
  assert.equal(build["runs-on"], "${{ matrix.runner }}");
  assert.deepEqual(build.strategy.matrix.include, [
    { arch: "amd64", platform: "linux/amd64", runner: "ubuntu-24.04" },
    { arch: "aarch64", platform: "linux/arm64", runner: "ubuntu-24.04-arm" },
  ]);
  assert.deepEqual(config.arch.toSorted(), build.strategy.matrix.include.map(entry => entry.arch).toSorted());
  assert.equal(build.steps.find(step => step.uses?.startsWith("actions/setup-node@")).with["package-manager-cache"], false);
  assert.equal(publish["runs-on"], "ubuntu-24.04");
  assert.equal(publish.needs, "build", "Publish the manifest only after both architectures succeed");
  const smokeIndex = build.steps.findIndex(step => step.run?.includes("node scripts/test-ha-app.mjs"));
  const pushIndex = build.steps.findIndex(step => step.run?.startsWith("docker push"));
  assert.ok(smokeIndex >= 0 && pushIndex > smokeIndex, "Smoke-test before pushing");
  assert.ok(publish.steps.indexOf(publish.steps.find(step => step.run === guard)) < publish.steps.findIndex(step => step.run?.includes("imagetools create")));
  console.log("Release metadata, publication order and free-usage safeguards passed.");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
