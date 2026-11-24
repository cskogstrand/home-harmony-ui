import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import * as ha from "home-assistant-js-websocket";
import type { Connection } from "home-assistant-js-websocket";
import { HomeAssistantClient } from "@/lib/home-assistant";
import { applyNotificationEvent, backupProblems, maintenanceItems, parseBackupInfo, parseRepairs, type BackupHealth } from "@/lib/ha-health";
import { config, services, states, user } from "./ha-fixtures";

vi.mock("home-assistant-js-websocket", async importOriginal => ({
  ...await importOriginal<typeof import("home-assistant-js-websocket")>(),
  createConnection: vi.fn(), subscribeEntities: vi.fn(), getConfig: vi.fn(), getUser: vi.fn(), getServices: vi.fn(), callService: vi.fn(),
}));

// Fictional Home Assistant payloads, shaped like the live responses.
const HOUR = 3600000;
const now = Date.parse("2026-11-20T12:00:00Z");
const iso = (offsetHours: number) => new Date(now + offsetHours * HOUR).toISOString();
const issue = (id: string, severity: string, extra: Record<string, unknown> = {}) => ({
  breaks_in_ha_version: null, created: iso(-5), dismissed_version: null, ignored: false, domain: "example_integration", is_fixable: false,
  issue_domain: "example_integration", issue_id: id, learn_more_url: null, severity, translation_key: id, translation_placeholders: { name: "Example device" }, ...extra,
});
const repairs = { issues: [
  issue("example_warning", "warning"),
  issue("example_error", "error", { learn_more_url: "https://example.com/help" }),
  issue("example_critical", "critical"),
  issue("example_ignored", "error", { ignored: true }),
  { issue_id: "malformed" },
] };
const backup = (overrides: Record<string, unknown> = {}) => ({
  agent_errors: {}, agent_error_translations: {}, backups: [
    { backup_id: "b1", date: iso(-10), with_automatic_settings: true, agents: {} },
    { backup_id: "b2", date: iso(-34), with_automatic_settings: true, agents: {} },
    { backup_id: "manual", date: iso(-2), with_automatic_settings: false, agents: {} },
  ],
  last_attempted_automatic_backup: iso(-10), last_completed_automatic_backup: iso(-10), next_automatic_backup: iso(14),
  next_automatic_backup_additional: false, state: "idle", ...overrides,
});

class FakeConnection {
  connected = true;
  haVersion = "2026.10.0";
  responses: Record<string, unknown> = {};
  failures: Record<string, unknown> = {};
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  subscribeEvents = vi.fn(async () => async () => {});
  subscribeMessage = vi.fn(async (_callback: (message: unknown) => void, _message: unknown, _options: unknown): Promise<() => Promise<void>> => async () => {});
  close = vi.fn(() => { this.connected = false; });
  sendMessagePromise = vi.fn(async (message: { type: string; language?: string; category?: string }): Promise<unknown> => {
    if (message.type in this.failures) throw this.failures[message.type];
    return this.responses[message.type] ?? ({ "config/area_registry/list": [], "config/device_registry/list": [], "config/entity_registry/list": [] } as Record<string, unknown>)[message.type];
  });
}
let conn: FakeConnection;
let client: HomeAssistantClient;
const connected = async () => {
  await client.connect();
  await waitFor(() => expect(client.getSnapshot().status).toBe("connected"));
};

beforeEach(() => {
  conn = new FakeConnection();
  client = new HomeAssistantClient();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ homeAssistantUrl: "http://ha.local:8123" }))));
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  vi.mocked(ha.subscribeEntities).mockImplementation((_conn, callback) => { callback(states); return () => {}; });
  vi.mocked(ha.getConfig).mockResolvedValue(config);
  vi.mocked(ha.getUser).mockResolvedValue(user);
  vi.mocked(ha.getServices).mockResolvedValue(services);
  vi.mocked(ha.callService).mockResolvedValue({});
});
afterEach(() => { client.dispose(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("health client", () => {
  it("lists repairs with titles in the dashboard language and skips malformed issues", async () => {
    await connected();
    conn.responses["repairs/list_issues"] = repairs;
    conn.responses["frontend/get_translations"] = { resources: { "component.example_integration.issues.example_error.title": "{name} trenger tilsyn" } };
    const issues = await client.listRepairs("nb");
    expect(issues.map(item => [item.issueId, item.severity, item.ignored, item.title])).toEqual([
      ["example_warning", "warning", false, undefined],
      ["example_error", "error", false, "Example device trenger tilsyn"],
      ["example_critical", "critical", false, undefined],
      ["example_ignored", "error", true, undefined],
    ]);
    expect(issues[1].learnMoreUrl).toBe("https://example.com/help");
    expect(conn.sendMessagePromise).toHaveBeenCalledWith({ type: "frontend/get_translations", language: "nb", category: "issues", integration: ["example_integration"] });
  });

  it("keeps repairs when their titles cannot be loaded", async () => {
    await connected();
    conn.responses["repairs/list_issues"] = repairs;
    conn.failures["frontend/get_translations"] = { code: "unknown_error" };
    expect(await client.listRepairs("en")).toHaveLength(4);
  });

  it.each(["unauthorized", "unknown_command"])("resolves undefined when Home Assistant answers %s", async code => {
    await connected();
    conn.failures["repairs/list_issues"] = { code, message: "Unauthorized" };
    conn.failures["backup/info"] = { code, message: "Unauthorized" };
    await expect(client.listRepairs("en")).resolves.toBeUndefined();
    await expect(client.backupInfo()).resolves.toBeUndefined();
  });

  it("rejects other failures and reads while offline", async () => {
    await expect(client.listRepairs()).rejects.toThrow("Repairs unavailable");
    await connected();
    conn.failures["backup/info"] = { code: "home_assistant_error" };
    await expect(client.backupInfo()).rejects.toThrow("Backups unavailable");
  });

  it("reads backup status", async () => {
    await connected();
    conn.responses["backup/info"] = backup({ agent_errors: { "example.remote": "Example location is full" } });
    expect(await client.backupInfo()).toEqual({
      lastCompleted: now - 10 * HOUR, lastAttempted: now - 10 * HOUR, next: now + 14 * HOUR,
      automaticBackups: [now - 10 * HOUR, now - 34 * HOUR], agentErrors: [{ agent: "example.remote", message: "Example location is full" }],
    });
  });

  it("follows persistent notifications live and reports a refused subscription as undefined", async () => {
    await connected();
    const receive = vi.fn();
    const stop = client.subscribePersistentNotifications(receive);
    const [callback, message, options] = conn.subscribeMessage.mock.calls[0];
    expect(message).toEqual({ type: "persistent_notification/subscribe" });
    expect(options).toEqual({ resubscribe: false });
    callback({ type: "current", notifications: { first: { notification_id: "first", title: "Example title", message: "Example message", created_at: iso(-2) } } });
    callback({ type: "added", notifications: { second: { notification_id: "second", title: null, message: "Second example", created_at: iso(-1) } } });
    expect(receive).toHaveBeenLastCalledWith([
      { id: "second", title: undefined, message: "Second example", created: now - HOUR },
      { id: "first", title: "Example title", message: "Example message", created: now - 2 * HOUR },
    ]);
    callback({ type: "removed", notifications: { first: { notification_id: "first" } } });
    expect(receive.mock.lastCall[0].map(item => item.id)).toEqual(["second"]);
    stop();
    callback({ type: "removed", notifications: { second: {} } });
    expect(receive).toHaveBeenCalledTimes(3);

    conn.subscribeMessage.mockRejectedValueOnce({ code: "unauthorized" });
    const refused = vi.fn();
    client.subscribePersistentNotifications(refused);
    await waitFor(() => expect(refused).toHaveBeenCalledWith(undefined));
    conn.subscribeMessage.mockRejectedValueOnce({ code: "unknown_error" });
    const failed = vi.fn();
    client.subscribePersistentNotifications(failed);
    await waitFor(() => expect(failed).toHaveBeenCalledWith(null));
  });

  it("dismisses one notification through the persistent_notification.dismiss service", async () => {
    await connected();
    await client.dismissPersistentNotification("example_id");
    expect(ha.callService).toHaveBeenCalledWith(conn, "persistent_notification", "dismiss", { notification_id: "example_id" });
    vi.mocked(ha.callService).mockRejectedValueOnce({ code: "home_assistant_error" });
    await expect(client.dismissPersistentNotification("example_id")).rejects.toThrow("Home Assistant did not confirm the dismissal");
  });
});

describe("health rules", () => {
  const info = (overrides: Record<string, unknown> = {}) => parseBackupInfo(backup(overrides));

  it("counts only error and critical repairs that are not ignored, critical first", () => {
    const items = maintenanceItems({ repairs: parseRepairs(repairs) }, now);
    expect(items.map(item => item.id)).toEqual(["repair:example_integration:example_critical", "repair:example_integration:example_error"]);
  });

  it("flags a failed last attempt", () => {
    expect(backupProblems(info({ last_attempted_automatic_backup: iso(-1) }), now)).toEqual(["failed"]);
    expect(backupProblems(info({ last_completed_automatic_backup: null, backups: [] }), now)).toEqual(["failed"]);
  });

  it("flags a daily backup older than 48 hours", () => {
    expect(backupProblems(info(), now)).toEqual([]);
    expect(backupProblems(info({ last_completed_automatic_backup: iso(-47), last_attempted_automatic_backup: iso(-47) }), now)).toEqual([]);
    expect(backupProblems(info({ last_completed_automatic_backup: iso(-49), last_attempted_automatic_backup: iso(-49) }), now)).toEqual(["stale"]);
  });

  it("allows a weekly schedule its own spacing plus a day", () => {
    const weekly = (age: number) => info({ last_completed_automatic_backup: iso(-age), last_attempted_automatic_backup: iso(-age),
      backups: [{ date: iso(-age), with_automatic_settings: true }, { date: iso(-age - 168), with_automatic_settings: true }] });
    expect(backupProblems(weekly(120), now)).toEqual([]);
    expect(backupProblems(weekly(193), now)).toEqual(["stale"]);
  });

  it("flags backup location errors and ignores missing automatic backups", () => {
    expect(backupProblems(info({ agent_errors: { "example.remote": "Example error" } }), now)).toEqual(["agent-errors"]);
    const none: BackupHealth = parseBackupInfo({ backups: [], agent_errors: {}, last_attempted_automatic_backup: null, last_completed_automatic_backup: null, next_automatic_backup: null });
    expect(backupProblems(none, now)).toEqual([]);
    expect(backupProblems(undefined, now)).toEqual([]);
  });

  it("ignores messages that are not notification updates", () => {
    expect(applyNotificationEvent([], { type: "unexpected", notifications: {} })).toBeUndefined();
    expect(applyNotificationEvent([], { type: "current", notifications: { bad: { title: "No message" } } })).toEqual([]);
  });
});
