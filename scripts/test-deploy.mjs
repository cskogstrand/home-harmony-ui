import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "home-harmony-deploy-"));
const checks = ["npm test", "npm run test:server", "npm run test:release", "npm run test:deploy", "node scripts/test-morning-summary.mjs", "python scripts/test-morning-summary-templates.py", "node scripts/check-designs.cjs", "tsc --noEmit -p tsconfig.app.json", "npm run lint", "npm run build", "npm run test:ha-app"];
const write = (file, content, executable = false) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content, { mode: executable ? 0o755 : 0o644 });
};

function fixture(name) {
  const root = join(directory, name);
  const cwd = join(root, "app");
  const remote = join(root, "origin.git");
  const log = join(root, "calls.log");
  const env = {
    ...process.env,
    PATH: `${join(root, "bin")}:${process.env.PATH}`,
    DEPLOY_TEST_LOG: log,
    GIT_AUTHOR_NAME: "Release Test", GIT_COMMITTER_NAME: "Release Test",
    GIT_AUTHOR_EMAIL: "release@example.invalid", GIT_COMMITTER_EMAIL: "release@example.invalid",
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "commit.gpgsign", GIT_CONFIG_VALUE_0: "false",
  };
  const git = (location, ...args) => execFileSync("git", args, { cwd: location, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const check = label => `#!/usr/bin/env node
const fs = require('node:fs');
const call = ${JSON.stringify(label)} + (process.argv.length > 2 ? ' ' + process.argv.slice(2).join(' ') : '');
fs.appendFileSync(process.env.DEPLOY_TEST_LOG, call + '\\n');
if (process.env.DEPLOY_TEST_DIRTY === call) fs.writeFileSync('unrelated.txt', 'concurrent work\\n');
if (process.env.DEPLOY_TEST_FAIL === call) process.exit(1);
`;
  write(join(root, "bin/npm"), check("npm"), true);
  write(log, "");
  write(join(cwd, "VERSION"), "0.9.9\n");
  write(join(cwd, ".gitignore"), ".venv/\nnode_modules/\n");
  write(join(cwd, "config.yaml"), 'version: "0.9.8"\n');
  copyFileSync(new URL("../deploy.sh", import.meta.url), join(cwd, "deploy.sh"));
  chmodSync(join(cwd, "deploy.sh"), 0o755);
  for (const script of ["test-morning-summary.mjs", "check-designs.cjs"]) {
    const body = check(`node scripts/${script}`).replace(/^#!.*\n/, "");
    const imports = script.endsWith(".mjs") ? "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);\n" : "";
    write(join(cwd, "scripts", script), imports + body);
  }
  write(join(cwd, "node_modules/.bin/tsc"), check("tsc"), true);
  write(join(cwd, ".venv/bin/python"), check("python"), true);
  git(root, "init", "--bare", "--initial-branch=main", remote);
  git(cwd, "init", "--initial-branch=main");
  git(cwd, "add", ".");
  git(cwd, "commit", "-m", "test: initial files");
  git(cwd, "remote", "add", "origin", remote);
  git(cwd, "push", "-u", "origin", "main");
  write(join(remote, "hooks/pre-receive"), `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.DEPLOY_TEST_LOG, 'push\\n');
if (process.env.DEPLOY_TEST_REJECT) process.exit(1);
`, true);
  return {
    cwd, remote, git, env, head: git(cwd, "rev-parse", "HEAD"),
    run: () => spawnSync(join(cwd, "deploy.sh"), [], { cwd: root, env, encoding: "utf8" }),
    calls: () => readFileSync(log, "utf8").trim().split("\n").filter(Boolean),
  };
}

function unchanged(f) {
  assert.equal(readFileSync(join(f.cwd, "VERSION"), "utf8"), "0.9.9\n");
  assert.equal(f.git(f.cwd, "rev-parse", "HEAD"), f.head);
  assert.equal(f.git(f.remote, "rev-parse", "main"), f.head);
  assert.ok(!f.calls().includes("push"), "A failed check must prevent every push");
}

try {
  const success = fixture("success");
  const result = success.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(readFileSync(join(success.cwd, "VERSION"), "utf8"), "0.9.10\n");
  assert.equal(success.git(success.cwd, "diff", "--name-only", "HEAD^", "HEAD"), "VERSION");
  assert.equal(success.git(success.cwd, "status", "--porcelain"), "");
  assert.equal(success.git(success.cwd, "rev-parse", "HEAD"), success.git(success.remote, "rev-parse", "main"));
  assert.equal(readFileSync(join(success.cwd, "config.yaml"), "utf8"), 'version: "0.9.8"\n');
  assert.deepEqual(success.calls(), [...checks, "push"], "Every local check must pass before pushing");

  for (const check of ["npm run test:server", "npm run test:ha-app"]) {
    const failed = fixture(check.replaceAll(" ", "-"));
    failed.env.DEPLOY_TEST_FAIL = check;
    const failure = failed.run();
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /Version restored/);
    unchanged(failed);
  }

  const dirty = fixture("dirty");
  write(join(dirty.cwd, "unrelated.txt"), "local work\n");
  assert.notEqual(dirty.run().status, 0);
  unchanged(dirty);

  const branch = fixture("wrong-branch");
  branch.git(branch.cwd, "checkout", "-b", "develop");
  assert.notEqual(branch.run().status, 0);
  unchanged(branch);

  const behind = fixture("behind");
  write(join(behind.cwd, "remote.txt"), "remote work\n");
  behind.git(behind.cwd, "add", "remote.txt");
  behind.git(behind.cwd, "commit", "-m", "test: remote change");
  behind.git(behind.cwd, "push", "origin", "main");
  behind.git(behind.cwd, "reset", "--hard", behind.head);
  write(behind.env.DEPLOY_TEST_LOG, "");
  assert.notEqual(behind.run().status, 0);
  assert.deepEqual(behind.calls(), []);
  assert.equal(readFileSync(join(behind.cwd, "VERSION"), "utf8"), "0.9.9\n");

  const edited = fixture("edited-during-tests");
  edited.env.DEPLOY_TEST_DIRTY = "npm run test:ha-app";
  assert.notEqual(edited.run().status, 0);
  unchanged(edited);
  assert.equal(readFileSync(join(edited.cwd, "unrelated.txt"), "utf8"), "concurrent work\n");

  const rejected = fixture("rejected-push");
  rejected.env.DEPLOY_TEST_REJECT = "true";
  const failure = rejected.run();
  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /finish the push manually; do not bump again/);
  assert.equal(rejected.git(rejected.remote, "rev-parse", "main"), rejected.head);
  assert.notEqual(rejected.git(rejected.cwd, "rev-parse", "HEAD"), rejected.head, "Keep the local version commit after a failed push");
  console.log("Deploy checks passed: standalone checkout, patch bump, checks before push, failed-test rollback and Git safeguards.");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
