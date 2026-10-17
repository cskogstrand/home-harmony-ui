import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runtimeOptions } from "./runtime.mjs";

test("loads .env and HAOS options, gives environment values precedence, and rejects incomplete configuration", async () => {
  const directory = await mkdtemp(join(tmpdir(), "home-harmony-env-"));
  const cwd = process.cwd(), saved = { ...process.env };
  const keys = ["DATA_DIR", "HOME_ASSISTANT_URL", "HOME_ASSISTANT_TOKEN", "DASHBOARD_PASSWORD", "PORT"];
  try {
    process.chdir(directory);
    keys.forEach(key => delete process.env[key]);
    await assert.rejects(runtimeOptions(), /HOME_ASSISTANT_URL/);
    await mkdir("data");
    const haosOptions = { home_assistant_url: "http://ha.local:8123", home_assistant_token: "haos-token", dashboard_password: "haos-password-123" };
    await writeFile("data/options.json", JSON.stringify(haosOptions));
    let options = await runtimeOptions();
    assert.equal(options.homeAssistantToken, "haos-token");
    assert.equal(options.dashboardPassword, "haos-password-123");
    for (const token of [" \thaos-token\r\n", "\u00a0haos-token\u00a0"]) {
      await writeFile("data/options.json", JSON.stringify({ ...haosOptions, home_assistant_token: token }));
      assert.equal((await runtimeOptions()).homeAssistantToken, "haos-token");
    }
    for (const token of [undefined, null, 123, "", " \t\r\n"]) {
      await writeFile("data/options.json", JSON.stringify({ ...haosOptions, home_assistant_token: token }));
      await assert.rejects(runtimeOptions(), /Set HOME_ASSISTANT_TOKEN/);
    }
    for (const token of ['"haos-token"', "Bearer haos-token", "haos token", "haos-\r\ntoken", "haos\u200b-token", "a".repeat(4097)]) {
      await writeFile("data/options.json", JSON.stringify({ ...haosOptions, home_assistant_token: token }));
      await assert.rejects(runtimeOptions(), error => {
        assert.match(error.message, /HOME_ASSISTANT_TOKEN.*invalid characters or exceeds 4096 characters/);
        assert.ok(!error.message.includes(token), "Token must not appear in validation errors");
        return true;
      });
    }
    await writeFile("data/options.json", JSON.stringify(haosOptions));
    await writeFile(".env", 'HOME_ASSISTANT_URL=http://env.local:8123\nHOME_ASSISTANT_TOKEN=env-token\nDASHBOARD_PASSWORD="env-password-123"\nPORT=9000\n');
    process.env.HOME_ASSISTANT_TOKEN = " \texplicit-token\r\n";
    options = await runtimeOptions();
    assert.equal(options.homeAssistantToken, "explicit-token");
    assert.equal(options.homeAssistantUrl, "http://env.local:8123");
    assert.equal(options.dashboardPassword, "env-password-123");
    assert.equal(options.port, 9000);
    process.env.HOME_ASSISTANT_TOKEN = " ";
    await assert.rejects(runtimeOptions(), /Set HOME_ASSISTANT_TOKEN/);
    process.env.HOME_ASSISTANT_TOKEN = "explicit-token";
    process.env.DASHBOARD_PASSWORD = "short";
    await assert.rejects(runtimeOptions(), /at least 12/);
    process.env.DASHBOARD_PASSWORD = "valid-password-123";
    process.env.HOME_ASSISTANT_URL = "http://user:password@ha.local";
    await assert.rejects(runtimeOptions(), /HTTP\(S\) origin/);
  } finally {
    process.chdir(cwd);
    keys.forEach(key => { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; });
    await rm(directory, { recursive: true, force: true });
  }
});
