import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repos = [
  {
    directory: root,
    file: "VERSION",
    checks: [
      ["npm", "test"],
      ["npm", "run", "test:server"],
      ["npm", "run", "test:release"],
      ["npm", "run", "test:deploy"],
      ["node", "scripts/test-morning-summary.mjs"],
      ["../home-assistant-unofficial-dibber/.venv/bin/python", "scripts/test-morning-summary-templates.py"],
      ["node", "scripts/check-designs.cjs"],
      ["./node_modules/.bin/tsc", "--noEmit", "-p", "tsconfig.app.json"],
      ["npm", "run", "lint"],
      ["npm", "run", "build"],
      ["npm", "run", "test:ha-app"],
    ],
  },
  {
    directory: resolve(root, "../home-assistant-unofficial-dibber"),
    file: "custom_components/dibber/manifest.json",
    checks: [["./scripts/lint"], ["./scripts/test"]],
  },
  {
    directory: resolve(root, "../home-assistant-onics-app-api"),
    file: "custom_components/eva/manifest.json",
    checks: [["./scripts/lint"], ["./scripts/test"], ["docker", "compose", "config", "--quiet"]],
  },
];

const git = (repo, ...args) => execFileSync("git", args, { cwd: repo.directory, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
const readVersionFile = repo => readFileSync(resolve(repo.directory, repo.file), "utf8");
let committing = false;
const pushed = [];

try {
  assert.equal(process.argv.length, 2, "Usage: npm run deploy (patch-bumps all three repositories)");
  // Validate every repository before editing any version file.
  for (const repo of repos) {
    assert.equal(git(repo, "branch", "--show-current"), "main", `${repo.directory}: switch to main first`);
    assert.equal(git(repo, "status", "--porcelain"), "", `${repo.directory}: commit or stash local changes first`);
    git(repo, "fetch", "origin", "main");
    git(repo, "merge-base", "--is-ancestor", "FETCH_HEAD", "HEAD");
    repo.head = git(repo, "rev-parse", "HEAD");
    repo.original = readVersionFile(repo);
    const previous = repo.file === "VERSION" ? repo.original.trim() : JSON.parse(repo.original).version;
    assert.match(previous, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, `${repo.file}: automatic patch bumps require a stable version`);
    const [major, minor, patch] = previous.split(".");
    repo.version = `${major}.${minor}.${BigInt(patch) + 1n}`;
    if (repo.file === "VERSION") {
      repo.updated = `${repo.version}\n`;
    } else {
      assert.equal((repo.original.match(/"version"\s*:\s*"[^"]*"/g) ?? []).length, 1, `${repo.file}: expected one version field`);
      repo.updated = repo.original.replace(/("version"\s*:\s*")[^"]*(")/, (_, before, after) => `${before}${repo.version}${after}`);
      assert.equal(JSON.parse(repo.updated).version, repo.version);
    }
    console.log(`${repo.directory}: ${previous} → ${repo.version}`);
  }
  for (const repo of repos) {
    writeFileSync(resolve(repo.directory, repo.file), repo.updated);
    repo.written = true;
  }
  for (const repo of repos) {
    for (const [command, ...args] of repo.checks) {
      console.log(`\n${repo.directory}: ${[command, ...args].join(" ")}`);
      execFileSync(command, args, { cwd: repo.directory, stdio: "inherit" });
    }
  }
  for (const repo of repos) {
    assert.equal(git(repo, "branch", "--show-current"), "main", "Branch changed during tests");
    assert.equal(git(repo, "rev-parse", "HEAD"), repo.head, "HEAD changed during tests");
    assert.equal(readVersionFile(repo), repo.updated, "Version changed during tests");
    assert.equal(git(repo, "status", "--porcelain"), `M ${repo.file}`, "Only the version file may change during tests");
  }
  committing = true;
  for (const repo of repos) {
    git(repo, "commit", "--only", "-m", `chore: release ${repo.version}`, "--", repo.file);
    repo.commit = git(repo, "rev-parse", "HEAD");
  }
  for (const repo of repos) {
    assert.equal(git(repo, "status", "--porcelain"), "", "Working tree changed during commit; inspect before pushing");
    assert.equal(git(repo, "rev-parse", "HEAD^"), repo.head, "Unexpected commit history; inspect before pushing");
    assert.equal(git(repo, "diff", "--name-only", "HEAD^", "HEAD"), repo.file, "Commit must change only the version file");
    assert.equal(readVersionFile(repo), repo.updated, "Version changed during commit");
  }
  for (const repo of repos) {
    git(repo, "-c", "push.followTags=false", "push", "origin", `${repo.commit}:refs/heads/main`);
    pushed.push(repo.directory);
  }
  console.log("\nAll tests passed and all three version bumps were pushed. Watch their release workflows in GitHub Actions.");
} catch (error) {
  if (!committing) {
    for (const repo of repos) {
      // Preserve concurrent edits instead of blindly restoring the original file.
      try {
        if (repo.written && readVersionFile(repo) === repo.updated && git(repo, "rev-parse", "HEAD") === repo.head) {
          writeFileSync(resolve(repo.directory, repo.file), repo.original);
        }
      } catch (restoreError) {
        console.error(`Could not restore ${repo.directory}/${repo.file}: ${restoreError.message}`);
      }
    }
  }
  console.error(`\nDeploy stopped: ${error.message}`);
  if (committing) console.error(`Pushed: ${pushed.join(", ") || "none"}. Inspect local version commits and finish the remaining pushes manually; do not bump again.`);
  else console.error("Nothing was committed or pushed; unchanged version edits were restored.");
  process.exitCode = 1;
}
