import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "home-harmony-deploy-"));
const definitions = [
  ["home-harmony-ui", "VERSION", "0.9.9", "0.9.10"],
  ["home-assistant-unofficial-dibber", "custom_components/dibber/manifest.json", "1.2.9", "1.2.10"],
  ["home-assistant-onics-app-api", "custom_components/eva/manifest.json", "2.0.0", "2.0.1"],
];
const write = (file, content, executable = false) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content, { mode: executable ? 0o755 : 0o644 });
};

function fixture(name) {
  const root = join(directory, name);
  const log = join(root, "calls.log");
  const env = {
    ...process.env,
    PATH: `${join(root, "bin")}:${process.env.PATH}`,
    DEPLOY_TEST_LOG: log,
    GIT_AUTHOR_NAME: "Release Test", GIT_COMMITTER_NAME: "Release Test",
    GIT_AUTHOR_EMAIL: "release@example.invalid", GIT_COMMITTER_EMAIL: "release@example.invalid",
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "commit.gpgsign", GIT_CONFIG_VALUE_0: "false",
  };
  const git = (cwd, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const check = label => `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const call = path.basename(process.cwd()) + ':' + ${JSON.stringify(label)} + (process.argv.length > 2 ? ' ' + process.argv.slice(2).join(' ') : '');
fs.appendFileSync(process.env.DEPLOY_TEST_LOG, call + '\\n');
if (process.env.DEPLOY_TEST_DIRTY === call) fs.writeFileSync('unrelated.txt', 'concurrent work\\n');
if (process.env.DEPLOY_TEST_FAIL === call) process.exit(1);
`;
  for (const command of ["npm", "docker"]) write(join(root, "bin", command), check(command), true);
  write(log, "");
  const repos = definitions.map(([name, file, previous, next], index) => {
    const cwd = join(root, name);
    const remote = join(root, `${name}.git`);
    const original = file === "VERSION" ? `${previous}\n` : `{\n  "domain": "example",\n  "requirements": [],\n  "version": "${previous}"\n}\n`;
    write(join(cwd, file), original);
    write(join(cwd, ".gitignore"), ".venv/\nnode_modules/\n");
    write(join(cwd, "config.yaml"), 'version: "0.9.8"\n');
    if (index === 0) {
      mkdirSync(join(cwd, "scripts"), { recursive: true });
      copyFileSync(new URL("./deploy.mjs", import.meta.url), join(cwd, "scripts/deploy.mjs"));
      for (const script of ["test-morning-summary.mjs", "check-designs.cjs"]) {
        const body = check(`node scripts/${script}`).replace(/^#!.*\n/, "");
        const imports = script.endsWith(".mjs") ? "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);\n" : "";
        write(join(cwd, "scripts", script), imports + body);
      }
      write(join(cwd, "node_modules/.bin/tsc"), check("tsc"), true);
    } else {
      for (const command of ["lint", "test"]) write(join(cwd, "scripts", command), check(`scripts/${command}`), true);
      write(join(cwd, ".venv/bin/python"), check("python"), true);
    }
    git(root, "init", "--bare", "--initial-branch=main", remote);
    git(cwd, "init", "--initial-branch=main");
    git(cwd, "add", ".");
    git(cwd, "commit", "-m", "test: initial files");
    git(cwd, "remote", "add", "origin", remote);
    git(cwd, "push", "-u", "origin", "main");
    write(join(remote, "hooks/pre-receive"), `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.DEPLOY_TEST_LOG, 'push:${name}\\n');
if (process.env.DEPLOY_TEST_REJECT === '${name}') process.exit(1);
`, true);
    return { cwd, remote, file, original, next, head: git(cwd, "rev-parse", "HEAD") };
  });
  return {
    repos, git, env,
    run: () => spawnSync(process.execPath, [join(repos[0].cwd, "scripts/deploy.mjs")], { cwd: root, env, encoding: "utf8" }),
    calls: () => readFileSync(log, "utf8").trim().split("\n").filter(Boolean),
  };
}

function unchanged(f) {
  for (const repo of f.repos) {
    assert.equal(readFileSync(join(repo.cwd, repo.file), "utf8"), repo.original);
    assert.equal(f.git(repo.cwd, "rev-parse", "HEAD"), repo.head);
    assert.equal(f.git(repo.remote, "rev-parse", "main"), repo.head);
  }
  assert.ok(!f.calls().some(call => call.startsWith("push:")), "A failed check must prevent every push");
}

try {
  const success = fixture("success");
  const result = success.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const repo of success.repos) {
    assert.equal(readFileSync(join(repo.cwd, repo.file), "utf8"), repo.original.replace(/\d+\.\d+\.\d+/, repo.next));
    assert.equal(success.git(repo.cwd, "diff", "--name-only", "HEAD^", "HEAD"), repo.file);
    assert.equal(success.git(repo.cwd, "status", "--porcelain"), "");
    assert.equal(success.git(repo.cwd, "rev-parse", "HEAD"), success.git(repo.remote, "rev-parse", "main"));
    assert.equal(readFileSync(join(repo.cwd, "config.yaml"), "utf8"), 'version: "0.9.8"\n');
  }
  assert.deepEqual(success.calls(), [
    ...["npm test", "npm run test:server", "npm run test:release", "npm run test:deploy", "node scripts/test-morning-summary.mjs", "python scripts/test-morning-summary-templates.py", "node scripts/check-designs.cjs", "tsc --noEmit -p tsconfig.app.json", "npm run lint", "npm run build", "npm run test:ha-app"].map(command => `home-harmony-ui:${command}`),
    "home-assistant-unofficial-dibber:scripts/lint", "home-assistant-unofficial-dibber:scripts/test",
    "home-assistant-onics-app-api:scripts/lint", "home-assistant-onics-app-api:scripts/test", "home-assistant-onics-app-api:docker compose config --quiet",
    ...definitions.map(([name]) => `push:${name}`),
  ], "Every project's checks must pass before the first push");

  const failed = fixture("failed-test");
  failed.env.DEPLOY_TEST_FAIL = "home-assistant-onics-app-api:scripts/test";
  assert.notEqual(failed.run().status, 0);
  unchanged(failed);

  const dirty = fixture("dirty");
  write(join(dirty.repos[2].cwd, "unrelated.txt"), "local work\n");
  assert.notEqual(dirty.run().status, 0);
  unchanged(dirty);
  assert.equal(readFileSync(join(dirty.repos[2].cwd, "unrelated.txt"), "utf8"), "local work\n");

  const branch = fixture("wrong-branch");
  branch.git(branch.repos[1].cwd, "checkout", "-b", "develop");
  assert.notEqual(branch.run().status, 0);
  unchanged(branch);

  const prerelease = fixture("prerelease");
  const prereleaseRepo = prerelease.repos[2];
  prereleaseRepo.original = prereleaseRepo.original.replace("2.0.0", "2.1.0rc1");
  write(join(prereleaseRepo.cwd, prereleaseRepo.file), prereleaseRepo.original);
  prerelease.git(prereleaseRepo.cwd, "commit", "-am", "test: prerelease");
  prereleaseRepo.head = prerelease.git(prereleaseRepo.cwd, "rev-parse", "HEAD");
  prerelease.git(prereleaseRepo.cwd, "push", "origin", "main");
  write(prerelease.env.DEPLOY_TEST_LOG, "");
  assert.notEqual(prerelease.run().status, 0);
  unchanged(prerelease);

  const behind = fixture("behind");
  const repo = behind.repos[1];
  write(join(repo.cwd, "remote.txt"), "remote work\n");
  behind.git(repo.cwd, "add", "remote.txt");
  behind.git(repo.cwd, "commit", "-m", "test: remote change");
  behind.git(repo.cwd, "push", "origin", "main");
  behind.git(repo.cwd, "reset", "--hard", repo.head);
  write(behind.env.DEPLOY_TEST_LOG, "");
  assert.notEqual(behind.run().status, 0);
  assert.deepEqual(behind.calls(), []);
  for (const entry of behind.repos) assert.equal(readFileSync(join(entry.cwd, entry.file), "utf8"), entry.original);

  const edited = fixture("edited-during-tests");
  edited.env.DEPLOY_TEST_DIRTY = "home-assistant-onics-app-api:scripts/test";
  assert.notEqual(edited.run().status, 0);
  unchanged(edited);
  assert.equal(readFileSync(join(edited.repos[2].cwd, "unrelated.txt"), "utf8"), "concurrent work\n");

  const rejected = fixture("rejected-push");
  rejected.env.DEPLOY_TEST_REJECT = basename(rejected.repos[1].cwd);
  const failure = rejected.run();
  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /finish the remaining pushes manually; do not bump again/);
  assert.notEqual(rejected.git(rejected.repos[0].remote, "rev-parse", "main"), rejected.repos[0].head);
  for (const entry of rejected.repos.slice(1)) {
    assert.equal(rejected.git(entry.remote, "rev-parse", "main"), entry.head);
    assert.notEqual(rejected.git(entry.cwd, "rev-parse", "HEAD"), entry.head, "Keep local version commits after a failed push");
  }
  console.log("Deploy checks passed: patch bumps, all tests before pushes, clean main, rollback, concurrent edits and partial push recovery.");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
