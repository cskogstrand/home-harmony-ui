import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as ha from "home-assistant-js-websocket";
import type { Connection } from "home-assistant-js-websocket";
import { HomeAssistantClient } from "@/lib/home-assistant";
import { applyNotificationEvent, backupProblems, maintenanceItems, parseBackupInfo, parseRepairs, type BackupHealth } from "@/lib/ha-health";
import { AppContext } from "@/contexts/AppContext";
import { HaHealthContext, noHealth, useHaHealth, type HaHealth } from "@/contexts/HaHealthContext";
import { FamilyContext } from "@/contexts/FamilyContext";
import { HaHealthSettings } from "@/components/HaHealthSettings";
import { MemoryRouter } from "react-router-dom";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import { HEALTH_REFRESH_MS, HaHealthProvider } from "@/contexts/HaHealthProvider";
import { config, services, state, states, user } from "./ha-fixtures";

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

describe("health refresh", () => {
  function Probe() {
    const health = useHaHealth();
    return <p data-testid="health">{health.repairs.status}/{health.backup.status}/{health.items.length}</p>;
  }
  const fakeApp = (overrides: Record<string, unknown> = {}) => ({
    homeOnline: true, listRepairs: vi.fn(async () => parseRepairs(repairs)), backupInfo: vi.fn(async () => parseBackupInfo(backup())), ...overrides,
  });
  const view = (app: ReturnType<typeof fakeApp>) => <AppContext.Provider value={app as never}><HaHealthProvider><Probe /></HaHealthProvider></AppContext.Provider>;
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("reads on connect, every 15 minutes while visible and again when shown after a hidden refresh", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(now);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const app = fakeApp();
    render(view(app));
    await act(async () => {});
    expect(screen.getByTestId("health")).toHaveTextContent("ready/ready/2");
    expect(app.listRepairs).toHaveBeenCalledWith("en");
    expect(app.backupInfo).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(HEALTH_REFRESH_MS - 1000); });
    expect(app.listRepairs).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(app.listRepairs).toHaveBeenCalledTimes(2);
    visibility.mockReturnValue("hidden");
    await act(async () => { await vi.advanceTimersByTimeAsync(2 * HEALTH_REFRESH_MS); });
    expect(app.listRepairs).toHaveBeenCalledTimes(2);
    visibility.mockReturnValue("visible");
    await act(async () => { fireEvent(document, new Event("visibilitychange")); });
    expect(app.listRepairs).toHaveBeenCalledTimes(3);
    await act(async () => { fireEvent(document, new Event("visibilitychange")); });
    expect(app.listRepairs).toHaveBeenCalledTimes(3);
  });

  it("waits for a connection and reads again after a reconnect", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const app = fakeApp({ homeOnline: false });
    const { rerender } = render(view(app));
    expect(app.listRepairs).not.toHaveBeenCalled();
    expect(screen.getByTestId("health")).toHaveTextContent("loading/loading/0");
    app.homeOnline = true;
    rerender(view({ ...app }));
    await waitFor(() => expect(screen.getByTestId("health")).toHaveTextContent("ready/ready/2"));
    rerender(view({ ...app, homeOnline: false }));
    rerender(view({ ...app, homeOnline: true }));
    await waitFor(() => expect(app.listRepairs).toHaveBeenCalledTimes(2));
  });

  it("hides refused reads and reports failed reads as unavailable", async () => {
    const app = fakeApp({ listRepairs: vi.fn(async () => undefined), backupInfo: vi.fn(async () => { throw new Error("Backups unavailable"); }) });
    render(view(app));
    await waitFor(() => expect(screen.getByTestId("health")).toHaveTextContent("hidden/unavailable/0"));
  });
});

describe("Home Assistant health settings", () => {
  type Receive = (notifications: unknown) => void;
  let receive: Receive | undefined;
  const settingsApp = (overrides: Record<string, unknown> = {}) => ({
    homeOnline: true, haUrl: "http://ha.local:8123",
    currentHome: mapHome({
      "update.example_core": state("update.example_core", "on", { friendly_name: "Example core update", title: "Example core", latest_version: "2026.11.1" }),
      "update.example_current": state("update.example_current", "off", { friendly_name: "Example current" }),
    }, emptyRegistries, "home"),
    subscribePersistentNotifications: vi.fn((callback: Receive) => { receive = callback; return () => { receive = undefined; }; }),
    dismissPersistentNotification: vi.fn(async () => {}),
    ...overrides,
  });
  const health = (overrides: Partial<HaHealth> = {}): HaHealth => ({
    ...noHealth, refresh: vi.fn(), checkedAt: now,
    repairs: { status: "ready", value: parseRepairs(repairs) },
    backup: { status: "ready", value: parseBackupInfo(backup()) }, ...overrides,
  });
  const view = (app: ReturnType<typeof settingsApp>, value: HaHealth) => render(<MemoryRouter><AppContext.Provider value={app as never}>
    <FamilyContext.Provider value={{ now: new Date(now) } as never}><HaHealthContext.Provider value={value}><HaHealthSettings /></HaHealthContext.Provider></FamilyContext.Provider>
  </AppContext.Provider></MemoryRouter>);
  const card = (name: string) => screen.getByRole("heading", { name }).closest("section");
  const notification = (id: string, title: string | undefined, message: string, hoursAgo: number) => ({ id, title, message, created: now - hoursAgo * HOUR });

  it("shows open repairs by severity with their links, and hides ignored ones", () => {
    const value = health();
    view(settingsApp(), value);
    expect(value.refresh).toHaveBeenCalledOnce();
    const section = within(card("Repairs"));
    expect(section.getAllByRole("listitem").map(item => item.textContent)).toEqual([
      expect.stringMatching(/^CriticalExample critical/), expect.stringMatching(/^ErrorExample error.*Learn more/), expect.stringMatching(/^WarningExample warning/),
    ]);
    expect(section.getByRole("link", { name: /Learn more/ })).toHaveAttribute("href", "https://example.com/help");
    expect(section.getByText("1 ignored repair is not shown.")).toBeVisible();
    expect(section.getByRole("link", { name: /Open repairs in Home Assistant/ })).toHaveAttribute("href", "http://ha.local:8123/config/repairs");
  });

  it("shows notifications live as plain text and dismisses them with pending and failure feedback", async () => {
    const app = settingsApp();
    let finish: () => void;
    app.dismissPersistentNotification.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }))
      .mockRejectedValueOnce(new Error("Home Assistant did not confirm the dismissal. Check the connection and try again."));
    view(app, health());
    const section = within(card("Notifications from Home Assistant"));
    expect(section.getByRole("status")).toHaveTextContent("Checking Home Assistant…");
    const first = notification("first", "Example title", "Example **message** with [a guide](/config/example) and [elsewhere](javascript:alert(1)).\nSecond line", 2);
    const second = notification("second", undefined, "Second example", 1);
    act(() => receive([first]));
    expect(section.getByText("Example title")).toBeVisible();
    const text = section.getByText(/Example message with/);
    expect(text.innerHTML).not.toContain("<strong>");
    expect(within(text).getByRole("link", { name: "a guide" })).toHaveAttribute("href", "http://ha.local:8123/config/example");
    expect(within(text).queryByRole("link", { name: "elsewhere" })).toBeNull();
    act(() => receive([second, first]));
    expect(section.getAllByRole("listitem").map(item => item.querySelector("strong").textContent)).toEqual(["Notification", "Example title"]);

    fireEvent.click(section.getByRole("button", { name: "Dismiss Example title" }));
    expect(app.dismissPersistentNotification).toHaveBeenCalledWith("first");
    const button = section.getByRole("button", { name: "Dismiss Example title" });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Dismissing…");
    await act(async () => { finish(); });
    act(() => receive([second]));
    expect(section.queryByText("Example title")).toBeNull();

    fireEvent.click(section.getByRole("button", { name: "Dismiss Notification" }));
    expect(await section.findByRole("alert")).toHaveTextContent("Home Assistant did not confirm the dismissal");
    expect(section.getByRole("button", { name: "Dismiss Notification" })).toBeEnabled();
    expect(section.getByText("Second example")).toBeVisible();
  });

  it("shows backup health with relative times and problems", () => {
    view(settingsApp(), health({ backup: { status: "ready", value: parseBackupInfo(backup({
      last_completed_automatic_backup: iso(-72), last_attempted_automatic_backup: iso(-12), agent_errors: { "example.remote": "Example location is full" },
    })) } }));
    const section = within(card("Backups"));
    expect(section.getByText("The last automatic backup failed.")).toBeVisible();
    expect(section.getByText("The last successful automatic backup is more than 2 days old.")).toBeVisible();
    expect(section.getByText("Last successful automatic backup").nextSibling).toHaveTextContent("3 days ago");
    expect(section.getByText("Next scheduled backup").nextSibling).toHaveTextContent("in 14 hours");
    expect(section.getByText("A backup location reported an error.")).toBeVisible();
    expect(section.getByText("Example location is full")).toBeVisible();
  });

  it("lists waiting updates with a link to install them in Home Assistant", () => {
    view(settingsApp(), health());
    const section = within(card("Updates"));
    expect(section.getAllByRole("listitem")).toHaveLength(1);
    expect(section.getByText("Example core")).toBeVisible();
    expect(section.getByText("Version 2026.11.1 is available.")).toBeVisible();
    expect(section.getByRole("link", { name: /Install updates in Home Assistant/ })).toHaveAttribute("href", "http://ha.local:8123/config/updates");
  });

  it("hides what Home Assistant refuses without showing errors", () => {
    view(settingsApp(), health({ repairs: { status: "hidden" }, backup: { status: "hidden" } }));
    act(() => receive(undefined));
    expect(screen.queryByRole("heading", { name: "Repairs" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Backups" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Notifications from Home Assistant" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Repairs and backup status need a Home Assistant administrator token on the dashboard server.")).toBeVisible();
  });
});
