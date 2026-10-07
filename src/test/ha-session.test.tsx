import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import * as ha from "home-assistant-js-websocket";
import type { Auth, AuthData, Connection, HassEntities } from "home-assistant-js-websocket";
import { HomeAssistantClient } from "@/lib/home-assistant";
import App from "@/App";
import { PinPadModal } from "@/components/devices/PinPadModal";
import { config, registries, services, states, state, user } from "./ha-fixtures";

vi.mock("home-assistant-js-websocket", async importOriginal => ({
  ...await importOriginal<typeof import("home-assistant-js-websocket")>(),
  getAuth: vi.fn(), createConnection: vi.fn(), subscribeEntities: vi.fn(), getConfig: vi.fn(), getUser: vi.fn(), getServices: vi.fn(), callService: vi.fn(),
}));
class FakeConnection {
  connected = true;
  haVersion = "2026.10.0";
  listeners = new Map<string, Set<() => void>>();
  subscriptions = new Map<string, () => void>();
  entityCallback?: (states: HassEntities) => void;
  unsubscribeEntities = vi.fn();
  unsubscribeEvent = vi.fn(async () => {});
  close = vi.fn(() => { this.connected = false; });
  addEventListener = (name: string, listener: () => void) => { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(listener); };
  removeEventListener = (name: string, listener: () => void) => { this.listeners.get(name)?.delete(listener); };
  subscribeEvents = vi.fn(async (callback: () => void, event: string) => { this.subscriptions.set(event, callback); return this.unsubscribeEvent; });
  sendMessagePromise = vi.fn(async ({ type }: { type: string; entity_id?: string }): Promise<unknown> => ({ "config/area_registry/list": registries.areas, "config/device_registry/list": registries.devices, "config/entity_registry/list": registries.entities })[type]);
  emit(name: string) { this.connected = name === "ready"; this.listeners.get(name)?.forEach(listener => listener()); }
}
let conn: FakeConnection;
let auth: Auth;
let clients: HomeAssistantClient[];
const TOKEN_KEY = "home-harmony:ha-session";
const tokenData = (): AuthData => ({
  hassUrl: "http://ha.local:8123", clientId: `${window.location.origin}/`,
  access_token: "fixture-access-secret", refresh_token: "fixture-refresh-secret",
  expires: Date.now() + 1800000, expires_in: 1800,
});
const newClient = () => { const client = new HomeAssistantClient(); clients.push(client); return client; };
const connectedClient = async () => {
  const client = newClient();
  await client.connect("http://ha.local:8123");
  await waitFor(() => expect(client.getSnapshot().status).toBe("connected"));
  return client;
};
const deferred = <T,>() => { let resolve: (value: T) => void; let reject: (error: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve: resolve!, reject: reject! }; };
beforeEach(() => {
  vi.clearAllMocks();
  clients = [];
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { get length() { return storage.size; }, key: (i: number) => [...storage.keys()][i], getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  sessionStorage.clear();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  window.history.replaceState(null, "", "/");
  conn = new FakeConnection();
  auth = { data: tokenData(), accessToken: "fixture-access-secret", expired: false, refreshAccessToken: vi.fn(async () => {}), revoke: vi.fn(async () => {}) } as unknown as Auth;
  vi.mocked(ha.getAuth).mockImplementation(async options => {
    const saved = await options.loadTokens?.();
    options.saveTokens?.(saved ?? { ...tokenData(), hassUrl: options.hassUrl });
    return auth;
  });
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  vi.mocked(ha.getConfig).mockResolvedValue(config);
  vi.mocked(ha.getUser).mockResolvedValue(user);
  vi.mocked(ha.getServices).mockResolvedValue(services);
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    const fake = connection as unknown as FakeConnection;
    fake.entityCallback = callback;
    queueMicrotask(() => callback(states));
    return fake.unsubscribeEntities;
  });
  vi.mocked(ha.callService).mockResolvedValue({});
});
afterEach(() => { cleanup(); clients.forEach(client => client.dispose()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("uses browser auth, limits callbacks to the selected instance and saves credentials for this browser profile", async () => {
  window.history.replaceState(null, "", "/settings?auth_callback=1&code=one-time-code&state=callback-state");
  const client = await connectedClient();
  expect(ha.getAuth).toHaveBeenCalledWith({ hassUrl: "http://ha.local:8123", clientId: `${window.location.origin}/`, redirectUrl: `${window.location.origin}/settings`, limitHassInstance: true, saveTokens: expect.any(Function), loadTokens: expect.any(Function) });
  expect(window.location.search).toBe("");
  expect(localStorage.length).toBe(3);
  expect(localStorage.getItem("home-harmony:ha-url")).toBe("http://ha.local:8123");
  expect(JSON.parse(localStorage.getItem(TOKEN_KEY)).refresh_token).toBe("fixture-refresh-secret");
  expect(client.getSnapshot().user).toEqual(user);
  expect(JSON.stringify(client.getSnapshot())).not.toContain("fixture-access-secret");
  await client.logout();
  expect(auth.revoke).toHaveBeenCalledOnce();
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  expect(client.getSnapshot().states).toEqual({});
});
it("cleans subscriptions/listeners and closes obsolete connections", async () => {
  const client = await connectedClient();
  client.disconnect();
  expect(conn.close).toHaveBeenCalledOnce();
  expect(conn.unsubscribeEntities).toHaveBeenCalledOnce();
  expect(conn.unsubscribeEvent).toHaveBeenCalledTimes(5);
  expect([...conn.listeners.values()].every(set => set.size === 0)).toBe(true);
  const before = client.getSnapshot();
  conn.entityCallback?.({});
  expect(client.getSnapshot()).toBe(before);
  const late = deferred<Connection>();
  const old = new FakeConnection();
  vi.mocked(ha.createConnection).mockReturnValueOnce(late.promise);
  const first = client.connect("http://other.local:8123");
  await waitFor(() => expect(ha.createConnection).toHaveBeenCalledTimes(2));
  client.disconnect();
  late.resolve(old as unknown as Connection);
  await first;
  expect(old.close).toHaveBeenCalledOnce();
  expect(client.getSnapshot().status).toBe("disconnected");
});
it("keeps readings stale through reconnect until a fresh subscription snapshot arrives", async () => {
  const client = await connectedClient();
  conn.emit("disconnected");
  expect(client.getSnapshot().status).toBe("reconnecting");
  expect(client.getSnapshot().states).toBe(states);
  await expect(client.command("light.living", "turn_off")).rejects.toThrow("fresh");
  conn.emit("ready");
  await act(async () => {});
  expect(client.getSnapshot().status).toBe("syncing");
  conn.entityCallback?.(states); // A cached callback must not unlock controls.
  await expect(client.command("light.living", "turn_off")).rejects.toThrow("fresh");
  conn.entityCallback?.({ ...states });
  expect(client.getSnapshot().status).toBe("connected");
  expect(ha.callService).not.toHaveBeenCalled();
  await client.command("light.living", "turn_off");
  expect(ha.callService).toHaveBeenCalledExactlyOnceWith(conn, "light", "turn_off", {}, { entity_id: "light.living" });
  expect(client.getSnapshot().states["light.living"].state).toBe("on");
});
it("rejects failed commands, does not leak codes and never replays after reconnect", async () => {
  const client = await connectedClient();
  vi.mocked(ha.callService).mockRejectedValueOnce({ code: "invalid_code", message: "bad secret-code" });
  await expect(client.command("alarm_control_panel.house", "alarm_disarm", undefined, "secret-code")).rejects.toThrow("Home Assistant rejected");
  expect(ha.callService).toHaveBeenCalledWith(conn, "alarm_control_panel", "alarm_disarm", { code: "secret-code" }, { entity_id: "alarm_control_panel.house" });
  expect(JSON.stringify(client.getSnapshot())).not.toContain("secret-code");
  expect(client.getSnapshot().states["alarm_control_panel.house"].state).toBe("disarmed");
  conn.emit("disconnected"); conn.emit("ready"); conn.entityCallback?.({ ...states });
  await act(async () => {});
  expect(ha.callService).toHaveBeenCalledTimes(1);
});
it("does not report success for an in-flight command across a disconnect", async () => {
  const client = await connectedClient();
  const request = deferred<unknown>();
  vi.mocked(ha.callService).mockReturnValueOnce(request.promise);
  const command = client.command("lock.front", "unlock", undefined, "code");
  const rejected = expect(command).rejects.toThrow("Connection changed");
  expect(client.getSnapshot().commands["lock.front"].pending).toBe(true);
  conn.emit("disconnected"); conn.emit("ready"); conn.entityCallback?.({ ...states });
  request.resolve({});
  await rejected;
  expect(client.getSnapshot().commands["lock.front"].pending).toBe(false);
  expect(ha.callService).toHaveBeenCalledOnce();
});
it("handles revoked credentials and failed initial connections without a mock fallback", async () => {
  const client = await connectedClient();
  conn.emit("reconnect-error");
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  expect(client.getSnapshot().status).toBe("auth-error");
  expect(client.getSnapshot().error).toContain("revoked");
  await expect(client.command("light.living", "turn_on")).rejects.toThrow("fresh");
  vi.mocked(ha.createConnection).mockRejectedValueOnce(ha.ERR_CANNOT_CONNECT);
  await client.connect("http://new.local:8123");
  expect(client.getSnapshot().status).toBe("disconnected");
  expect(client.getSnapshot().states).toEqual({});
  expect(client.getSnapshot().error).toContain("certificate");
});
it("loads registry metadata updates and reports unavailable registries honestly", async () => {
  const client = await connectedClient();
  conn.sendMessagePromise.mockRejectedValueOnce({ code: "unauthorized" });
  conn.subscriptions.get("area_registry_updated")?.();
  await waitFor(() => expect(client.getSnapshot().warnings.join()).toContain("areas"));
  expect(client.getSnapshot().registries.areas).toEqual([]);
  expect(client.getSnapshot().status).toBe("connected");
});
it("reads calendar ranges with a bearer header, refreshes expired auth and reports API failures", async () => {
  const client = await connectedClient();
  Object.defineProperty(auth, "expired", { value: true });
  const events = [{ summary: "HA event", start: { date: "2026-10-06" }, end: { date: "2026-10-07" } }];
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => events });
  vi.stubGlobal("fetch", fetchMock);
  const signal = new AbortController().signal;
  expect(await client.calendarEvents("calendar.house", "2026-10-05T22:00:00Z", "2026-10-12T22:00:00Z", signal)).toEqual(events);
  expect(auth.refreshAccessToken).toHaveBeenCalledOnce();
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toContain("/api/calendars/calendar.house?start=");
  expect(url).not.toContain("secret");
  expect(options.headers).toEqual({ Authorization: "Bearer fixture-access-secret" });
  fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
  await expect(client.calendarEvents("calendar.house", "start", "end", signal)).rejects.toThrow("CORS");
  fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
  await expect(client.calendarEvents("calendar.house", "start", "end", signal)).rejects.toThrow();
  expect(client.getSnapshot().status).toBe("auth-error");
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
});
it("keeps non-demo alarm codes transient and shows actual command rejection", async () => {
  const request = deferred<void>();
  const submit = vi.fn().mockReturnValueOnce(request.promise).mockResolvedValueOnce(undefined);
  const close = vi.fn();
  render(<PinPadModal open onOpenChange={close} title="Disarm" description="Code sent to HA" codeRequired onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText("Code"), { target: { value: "a long non-demo code" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  const confirm = screen.getByRole("button", { name: "Confirm" });
  expect(confirm).toHaveAttribute("aria-busy", "true");
  expect(confirm.querySelector(".animate-spin")).toBeInTheDocument();
  expect(screen.queryByText("Sending…")).not.toBeInTheDocument();
  await act(async () => request.reject(new Error("HA rejection")));
  expect(await screen.findByRole("alert")).toHaveTextContent("did not confirm");
  expect(confirm).toHaveAttribute("aria-busy", "false");
  expect(confirm.querySelector(".animate-spin")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Code")).toHaveValue("");
  expect(close).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Code"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  expect(submit.mock.calls).toEqual([["a long non-demo code"], ["7"]]);
  expect(localStorage.length).toBe(0);
});
it("uses reported state throughout navigation and disables stale controls in the UI", async () => {
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  window.history.replaceState(null, "", "/?auth_callback=1&code=fixture&state=fixture");
  render(<StrictMode><App /></StrictMode>);
  const toggle = await screen.findByRole("switch", { name: "Toggle Living Room Light" });
  await waitFor(() => expect(toggle).not.toBeDisabled());
  fireEvent.click(toggle);
  await waitFor(() => expect(ha.callService).toHaveBeenCalledOnce());
  expect(toggle).toBeChecked(); // No optimistic physical state.
  act(() => conn.entityCallback?.({ ...states, "light.living": state("light.living", "off", states["light.living"].attributes) }));
  expect(toggle).not.toBeChecked();
  fireEvent.click(screen.getByRole("link", { name: "Living Room Light details" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Living Room Light" })).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).not.toBeChecked();
  act(() => conn.emit("disconnected"));
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).toBeDisabled();
  expect(screen.getByText("Offline")).toBeInTheDocument();
});
it("keeps saved planner datasets and calendar preferences independent of HA authentication", async () => {
  const planner = { events: [{ id: "personal", title: "My existing plan", date: "2026-10-06", time: "12:00", member: "anna", location: "Home", note: "Keep me" }], items: [{ id: "task", text: "Keep this task", kind: "tasks", member: "anna", done: false }], timetables: { emma: "/custom.svg", leo: "/leo.svg" }, calendar: { view: "week", startDay: "monday" } };
  localStorage.setItem("afterglow-planner-v1:home-1", JSON.stringify(planner));
  localStorage.setItem("afterglow-planner-v1:home-2", JSON.stringify({ ...planner, events: [] }));
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  window.history.replaceState(null, "", "/settings?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  await screen.findByText("HA user");
  fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
  expect(JSON.parse(localStorage.getItem("afterglow-planner-v1:home-1"))).toEqual(planner);
  expect(JSON.parse(localStorage.getItem("afterglow-planner-v1:home-2")).events).toEqual([]);
  fireEvent.keyDown(screen.getByRole("button", { name: "Open app settings" }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "App preferences" }));
  expect(screen.getByLabelText("Saved local planner")).toHaveValue("home-1");
  fireEvent.change(screen.getByLabelText("Saved local planner"), { target: { value: "home-2" } });
  expect(screen.getByLabelText("Saved local planner")).toHaveValue("home-2");
  expect(JSON.parse(localStorage.getItem("afterglow-planner-v1:home-1"))).toEqual(planner);
});
it("does not clear the pending guard when a duplicate action is rejected", async () => {
  const client = await connectedClient();
  const request = deferred<unknown>();
  vi.mocked(ha.callService).mockReturnValueOnce(request.promise);
  const first = client.command("light.living", "turn_off");
  await expect(client.command("light.living", "turn_off")).rejects.toThrow("already pending");
  expect(client.getSnapshot().commands["light.living"].pending).toBe(true);
  request.resolve({});
  await first;
  expect(ha.callService).toHaveBeenCalledOnce();
});
it("loads only the displayed HA calendar range and never saves its events in the local planner", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    (connection as unknown as FakeConnection).entityCallback = callback;
    queueMicrotask(() => callback({ ...states, "calendar.house": state("calendar.house", "off", { friendly_name: "House calendar" }) }));
    return conn.unsubscribeEntities;
  });
  const event = { summary: "Imported read-only event", start: { date: "2026-10-06" }, end: { date: "2026-10-08" }, location: null };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [event] });
  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  localStorage.setItem("afterglow-connected-planner-v1:http://ha.local:8123:home-1", JSON.stringify({ events: [], items: [], timetables: {}, calendarMembers: { "http://ha.local:8123|calendar.house": "everyone" } }));
  window.history.replaceState(null, "", "/calendar?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  expect(await screen.findAllByRole("button", { name: /Imported read-only event/ })).toHaveLength(2);
  const firstUrl = new URL(fetchMock.mock.calls[0][0]);
  expect(firstUrl.searchParams.get("start")).toBe("2026-10-05T22:00:00.000Z");
  expect(firstUrl.searchParams.get("end")).toBe("2026-10-12T22:00:00.000Z");
  fireEvent.click(screen.getAllByRole("button", { name: /Imported read-only event/ })[0]);
  expect(screen.getByText(/Read-only Home Assistant event/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save plan" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(localStorage.getItem("afterglow-connected-planner-v1:http://ha.local:8123:home-1")).not.toContain(event.summary);
  const nextResponse = deferred<unknown>();
  fetchMock.mockReturnValueOnce(nextResponse.promise);
  fireEvent.click(screen.getByRole("button", { name: "Next week" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("start")).toBe("2026-10-12T22:00:00.000Z");
  view.unmount();
  expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true);
  await act(async () => nextResponse.resolve({ ok: true, json: async () => [event] }));
});
it("rejects malformed calendar dates instead of crashing the planner", async () => {
  const client = await connectedClient();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ summary: "Broken", start: 123, end: "no date" }] }));
  await expect(client.calendarEvents("calendar.house", "start", "end", new AbortController().signal)).rejects.toThrow("could not be read");
});
it("disables an already-open physical confirmation when its connection becomes stale", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  const view = render(<PinPadModal open onOpenChange={() => {}} title="Unlock" description="Confirm action" onSubmit={submit} />);
  expect(screen.getByRole("button", { name: "Confirm" })).not.toBeDisabled();
  view.rerender(<PinPadModal open disabled onOpenChange={() => {}} title="Unlock" description="Confirm action" onSubmit={submit} />);
  expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  fireEvent.submit(screen.getByRole("button", { name: "Confirm" }).closest("form"));
  expect(submit).not.toHaveBeenCalled();
});

it("restores the dashboard in a new tab without replaying commands or changing planner storage", async () => {
  const client = await connectedClient();
  await client.command("light.living", "turn_off");
  localStorage.setItem("afterglow-planner-v1:home-1", "existing planner");
  const saved = localStorage.getItem(TOKEN_KEY);
  client.dispose(); // Closing the tab destroys its client and sessionStorage.
  sessionStorage.clear();
  conn = new FakeConnection();
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  const restored = newClient();
  restored.start();
  await waitFor(() => expect(restored.getSnapshot().status).toBe("connected"));
  expect(localStorage.getItem(TOKEN_KEY)).toBe(saved);
  expect(restored.getSnapshot().states).toEqual(states);
  expect(restored.getSnapshot().commands).toEqual({});
  expect(ha.callService).toHaveBeenCalledOnce();
  expect(localStorage.getItem("afterglow-planner-v1:home-1")).toBe("existing planner");
});

it("restores expired tokens through the real HA auth library and saves refreshed credentials in StrictMode", async () => {
  const { getAuth } = await vi.importActual<typeof ha>("home-assistant-js-websocket");
  vi.mocked(ha.getAuth).mockImplementation(getAuth);
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...tokenData(), expires: 0, storageRevision: null }));
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: "fixture-refreshed-secret", expires_in: 1800 }) });
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(ha.createConnection).mockImplementation(async options => {
    if (options.auth.expired) await options.auth.refreshAccessToken();
    return conn as unknown as Connection;
  });
  window.history.replaceState(null, "", "/settings");
  render(<StrictMode><App /></StrictMode>);
  await screen.findByText("HA user");
  expect(ha.getAuth).toHaveBeenCalledOnce();
  expect(ha.createConnection).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0][0]).toBe("http://ha.local:8123/auth/token");
  expect(fetchMock.mock.calls[0][1].body.get("grant_type")).toBe("refresh_token");
  const saved = JSON.parse(localStorage.getItem(TOKEN_KEY));
  expect(saved.access_token).toBe("fixture-refreshed-secret");
  expect(saved.refresh_token).toBe("fixture-refresh-secret");
  expect(saved.expires).toBeGreaterThan(Date.now());
  expect(document.body).not.toHaveTextContent("fixture-refreshed-secret");
  expect(localStorage.length).toBe(3); // URL, browser login and existing local planner.
});

it("keeps Disconnect paused across refresh and revokes a saved session on logout even while disconnected", async () => {
  const client = await connectedClient();
  client.disconnect();
  client.dispose();
  const restored = newClient();
  restored.start();
  expect(restored.getSnapshot().status).toBe("disconnected");
  expect(ha.getAuth).toHaveBeenCalledOnce();
  expect(localStorage.getItem(TOKEN_KEY)).not.toBeNull();
  const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", fetchMock);
  await restored.logout();
  expect(fetchMock.mock.calls[0][0]).toBe("http://ha.local:8123/auth/revoke");
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  expect(restored.getSnapshot().error).toContain("revocation could not be confirmed");
  newClient().start();
  expect(ha.getAuth).toHaveBeenCalledOnce();
});

it.each([
  "not json",
  JSON.stringify({ ...tokenData(), refresh_token: "" }),
  JSON.stringify({ ...tokenData(), expires: "tomorrow" }),
  JSON.stringify({ ...tokenData(), hassUrl: "http://other.local:8123" }),
  JSON.stringify({ ...tokenData(), clientId: "http://other-dashboard.local/" }),
])("discards invalid or mismatched stored auth without redirecting on refresh (%#)", async saved => {
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  localStorage.setItem(TOKEN_KEY, saved === "not json" ? saved : JSON.stringify({ ...JSON.parse(saved), storageRevision: null }));
  const client = newClient();
  client.start();
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  expect(ha.getAuth).not.toHaveBeenCalled();
  expect(ha.createConnection).not.toHaveBeenCalled();
  expect(client.getSnapshot().sessionWarning).toContain("could not be read");
});

it("clears rejected saved credentials and requires an explicit Connect after authentication failure", async () => {
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...tokenData(), storageRevision: null }));
  vi.mocked(ha.createConnection).mockRejectedValueOnce(ha.ERR_INVALID_AUTH);
  const client = newClient();
  client.start();
  await waitFor(() => expect(client.getSnapshot().status).toBe("auth-error"));
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  client.dispose();
  newClient().start();
  expect(ha.getAuth).toHaveBeenCalledOnce();
});

it("prevents late login/refresh/revoke callbacks from restoring or erasing a newer session", async () => {
  const client = await connectedClient();
  const oldSave = vi.mocked(ha.getAuth).mock.calls[0][0].saveTokens;
  await client.logout();
  oldSave(tokenData());
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  conn = new FakeConnection();
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  await client.connect("http://other.local:8123");
  const current = localStorage.getItem(TOKEN_KEY);
  expect(JSON.parse(current).hassUrl).toBe("http://other.local:8123");
  oldSave(null);
  oldSave(tokenData());
  expect(localStorage.getItem(TOKEN_KEY)).toBe(current);

  const login = deferred<Auth>();
  vi.mocked(ha.getAuth).mockReturnValueOnce(login.promise);
  const pending = client.connect("http://pending.local:8123");
  const calls = vi.mocked(ha.getAuth).mock.calls;
  const lateSave = calls[calls.length - 1][0].saveTokens;
  client.disconnect();
  lateSave({ ...tokenData(), hassUrl: "http://pending.local:8123" });
  login.resolve(auth);
  await pending;
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  expect(client.getSnapshot().status).toBe("disconnected");
});

it("reports denied persistent token storage without falling back to sessionStorage or leaking tokens", async () => {
  const setItem = localStorage.setItem;
  vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
    if (key === TOKEN_KEY) throw new Error("blocked");
    setItem(key, value);
  });
  const client = await connectedClient();
  expect(client.getSnapshot().sessionWarning).toContain("Reopening or refreshing may require signing in again");
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  expect(JSON.stringify(client.getSnapshot())).not.toContain("fixture-access-secret");
  expect(JSON.stringify(client.getSnapshot())).not.toContain("fixture-refresh-secret");
});

const storageEvent = (key: string | null) => {
  const event = new StorageEvent("storage", { key });
  Object.defineProperty(event, "storageArea", { value: localStorage });
  window.dispatchEvent(event);
};

it("closes other tabs on logout and blocks stale token saves even before the storage event arrives", async () => {
  const client = await connectedClient();
  const oldSave = vi.mocked(ha.getAuth).mock.calls[0][0].saveTokens;
  localStorage.setItem("afterglow-planner-v1:home-1", "keep planner");
  // Another tab signs out. Native storage events are delivered asynchronously.
  localStorage.setItem("home-harmony:ha-auth-revision", "other-tab-logout");
  localStorage.removeItem(TOKEN_KEY);
  oldSave(tokenData());
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  storageEvent("home-harmony:ha-auth-revision");
  expect(client.getSnapshot().status).toBe("disconnected");
  expect(client.getSnapshot().user).toBeUndefined();
  expect(client.getSnapshot().states).toEqual({});
  expect(conn.close).toHaveBeenCalledOnce();
  await expect(client.command("light.living", "turn_off")).rejects.toThrow("fresh");
  expect(localStorage.getItem("afterglow-planner-v1:home-1")).toBe("keep planner");

  const otherLogin = JSON.stringify({ ...tokenData(), refresh_token: "other-fixture-refresh", storageRevision: "other-tab-logout" });
  localStorage.setItem(TOKEN_KEY, otherLogin);
  oldSave(null);
  oldSave(tokenData());
  expect(localStorage.getItem(TOKEN_KEY)).toBe(otherLogin);
});

it("ignores another tab's token renewal and stops when browser site data is cleared", async () => {
  const client = await connectedClient();
  const saved = JSON.parse(localStorage.getItem(TOKEN_KEY));
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...saved, access_token: "another-tab-renewal" }));
  storageEvent(TOKEN_KEY);
  expect(client.getSnapshot().status).toBe("connected");
  expect(conn.close).not.toHaveBeenCalled();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("home-harmony:ha-auth-revision");
  storageEvent(null);
  expect(client.getSnapshot().status).toBe("disconnected");
  expect(conn.close).toHaveBeenCalledOnce();
  client.dispose();
  const snapshot = client.getSnapshot();
  storageEvent(TOKEN_KEY);
  expect(client.getSnapshot()).toBe(snapshot);
});

it("rejects a write racing with logout instead of restoring a retired browser login", () => {
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  localStorage.setItem("home-harmony:ha-auth-revision", "logged-out-revision");
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...tokenData(), storageRevision: "old-revision" }));
  const client = newClient();
  client.start();
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  expect(ha.getAuth).not.toHaveBeenCalled();
});

it("does not erase a newer browser login when an old tab reports revoked auth before its storage event", async () => {
  const client = await connectedClient();
  localStorage.setItem("home-harmony:ha-auth-revision", "new-login");
  const saved = JSON.stringify({ ...tokenData(), refresh_token: "new-login-secret", storageRevision: "new-login" });
  localStorage.setItem(TOKEN_KEY, saved);
  conn.emit("reconnect-error");
  expect(client.getSnapshot().status).toBe("auth-error");
  expect(localStorage.getItem(TOKEN_KEY)).toBe(saved);
  expect(localStorage.getItem("home-harmony:ha-auth-revision")).toBe("new-login");
});

it("shows HA zones with live presence, passive metadata and honest missing or stale readings", async () => {
  const zoneStates = {
    ...states,
    "zone.home": state("zone.home", "2", { friendly_name: "Our home", radius: 100, latitude: 0, longitude: 0, passive: false }),
    "zone.school": state("zone.school", "0", { friendly_name: "School zone", radius: 250, passive: true }),
    "zone.work": state("zone.work", "unknown", { friendly_name: "Work zone", latitude: 999, radius: -1 }),
    "zone.other": state("zone.other", "unavailable", { friendly_name: "Other zone" }),
  };
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    const fake = connection as unknown as FakeConnection;
    fake.entityCallback = callback;
    queueMicrotask(() => callback(zoneStates));
    return fake.unsubscribeEntities;
  });
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  window.history.replaceState(null, "", "/zones?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  const home = within(await screen.findByRole("article", { name: "Our home" }));
  expect(home.getByText("2 people")).toBeInTheDocument();
  expect(home.getByText("100 m")).toBeInTheDocument();
  expect(home.getAllByText("0")).toHaveLength(2);
  expect(home.getByText("Active")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Manage zones in Home Assistant" })).toHaveAttribute("href", "http://ha.local:8123/config/zone");
  expect(within(screen.getByRole("article", { name: "School zone" })).getByText("Passive · automations only")).toBeInTheDocument();
  const work = within(screen.getByRole("article", { name: "Work zone" }));
  expect(work.getByText("unknown")).toBeInTheDocument();
  expect(work.getAllByText("Not reported")).toHaveLength(4);
  expect(screen.getByText("unavailable")).toBeInTheDocument();
  act(() => conn.entityCallback?.({ ...zoneStates, "zone.home": state("zone.home", "1", zoneStates["zone.home"].attributes) }));
  expect(home.getByText("1 person")).toBeInTheDocument();
  act(() => conn.emit("disconnected"));
  expect(home.getByText("Stale · 1 person")).toBeInTheDocument();
  expect(screen.getByText("Cached zone readings are stale while Home Assistant is offline.")).toBeInTheDocument();
  expect(ha.callService).not.toHaveBeenCalled();
});

it("keeps dimmers on the family dashboard, including off lights without a brightness reading", async () => {
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  window.history.replaceState(null, "", "/?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  const slider = await screen.findByRole("slider", { name: "Living Room Light brightness" });
  await waitFor(() => expect(slider).not.toHaveAttribute("data-disabled"));
  const off = state("light.living", "off", { friendly_name: "Living Room Light", supported_color_modes: ["brightness"] });
  act(() => conn.entityCallback?.({ ...states, "light.living": off }));
  expect(slider).toHaveAttribute("aria-valuenow", "0");
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  await waitFor(() => expect(ha.callService).toHaveBeenCalledWith(conn, "light", "turn_on", { brightness: 3 }, { entity_id: "light.living" }));
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).not.toBeChecked();
  act(() => conn.entityCallback?.({ ...states, "light.living": { ...off, attributes: { ...off.attributes, supported_color_modes: ["onoff"] } } }));
  expect(screen.queryByRole("slider", { name: "Living Room Light brightness" })).not.toBeInTheDocument();
  act(() => conn.entityCallback?.({ ...states, "light.living": { ...off, state: "unavailable" } }));
  expect(screen.getByRole("slider", { name: "Living Room Light brightness" })).toHaveAttribute("data-disabled");
});

it("saves selected devices, sensors and scenes, survives renames and respects an empty selection", async () => {
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  window.history.replaceState(null, "", "/?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  await screen.findByRole("switch", { name: "Toggle Living Room Light" });
  fireEvent.click(screen.getByRole("button", { name: "Customize" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Search favorites" }), { target: { value: "Living Room" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Living Room Light" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Search favorites" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Power" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Evening" }));
  fireEvent.click(screen.getByRole("button", { name: "Save favorites" }));
  const favorites = () => within(screen.getByRole("region", { name: "Home favorites" }));
  expect(favorites().getAllByRole("article")).toHaveLength(2);
  expect(favorites().getByRole("button", { name: "Activate Evening" })).toBeInTheDocument();
  const key = "afterglow-connected-planner-v1:http://ha.local:8123:home-1";
  const saved = JSON.parse(localStorage.getItem(key)!);
  expect(saved.homeEntities["http://ha.local:8123"]).toEqual(["http://ha.local:8123|stable-light", "http://ha.local:8123|stable-sensor", "http://ha.local:8123|scene.evening"]);
  fireEvent.click(screen.getByRole("button", { name: "Customize" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(favorites().getAllByRole("article")).toHaveLength(2);
  view.unmount();
  conn = new FakeConnection();
  conn.sendMessagePromise.mockImplementation(async ({ type }) => ({ "config/area_registry/list": registries.areas, "config/device_registry/list": registries.devices, "config/entity_registry/list": registries.entities.map(e => e.id === "stable-light" ? { ...e, name: "Sofa light" } : e) })[type]);
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  render(<App />);
  await screen.findByRole("switch", { name: "Toggle Sofa light" });
  expect(favorites().getAllByRole("article")).toHaveLength(2);
  expect(favorites().queryByRole("switch", { name: "Toggle Charger power" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Customize" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  fireEvent.click(screen.getByRole("button", { name: "Save favorites" }));
  expect(favorites().queryByRole("article")).not.toBeInTheDocument();
  expect(favorites().queryByRole("button", { name: "Activate Evening" })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key)!).homeEntities["http://ha.local:8123"]).toEqual([]);
  expect(JSON.parse(localStorage.getItem(key)!).events).toEqual(saved.events);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Smart home" }));
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Today" }));
  expect(favorites().queryByRole("article")).not.toBeInTheDocument();
  expect(ha.callService).not.toHaveBeenCalled();
});

it("offers temperature, mode and blind controls without duplicating raw state labels", async () => {
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  window.history.replaceState(null, "", "/devices?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  const target = await screen.findByRole("slider", { name: "Living target" });
  await waitFor(() => expect(target).not.toHaveAttribute("data-disabled"));
  fireEvent.keyDown(target, { key: "ArrowRight" });
  await waitFor(() => expect(ha.callService).toHaveBeenCalledWith(conn, "climate", "set_temperature", { temperature: 21.5 }, { entity_id: "climate.living" }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Living mode" })).toBeEnabled());
  fireEvent.change(screen.getByRole("combobox", { name: "Living mode" }), { target: { value: "off" } });
  await waitFor(() => expect(ha.callService).toHaveBeenCalledWith(conn, "climate", "set_hvac_mode", { hvac_mode: "off" }, { entity_id: "climate.living" }));
  fireEvent.keyDown(screen.getByRole("slider", { name: "Blind open" }), { key: "ArrowLeft" });
  await waitFor(() => expect(ha.callService).toHaveBeenCalledWith(conn, "cover", "set_cover_position", { position: 49 }, { entity_id: "cover.blind" }));
  const lock = within(screen.getByRole("article", { name: "Front" }));
  expect(lock.queryByRole("button", { name: "Lock Front" })).not.toBeInTheDocument();
  fireEvent.click(lock.getByRole("button", { name: "Unlock Front" }));
  expect(await screen.findByLabelText("Code")).toBeInTheDocument();
  expect(ha.callService).toHaveBeenCalledTimes(3);
});

it("shows spinners on busy device and scene controls, clears them on completion, and keeps errors", async () => {
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  window.history.replaceState(null, "", "/?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  const toggle = await screen.findByRole("switch", { name: "Toggle Living Room Light" });
  await waitFor(() => expect(toggle).toBeEnabled());
  const request = deferred<unknown>();
  vi.mocked(ha.callService).mockReturnValueOnce(request.promise);
  fireEvent.click(toggle);
  const controller = toggle.closest(".command-controller")!;
  expect(controller).toHaveAttribute("aria-busy", "true");
  expect(within(controller as HTMLElement).getByRole("status").querySelector(".animate-spin")).toBeInTheDocument();
  expect(toggle).toBeDisabled();
  expect(screen.queryByText(/Sending…|Request sent/)).not.toBeInTheDocument();
  await act(async () => request.resolve({}));
  expect(controller).toHaveAttribute("aria-busy", "false");
  expect(within(controller as HTMLElement).queryByRole("status")).not.toBeInTheDocument();
  expect(toggle).toBeEnabled();
  expect(toggle).toBeChecked(); // Service acceptance still does not invent a physical state change.
  expect(screen.queryByText(/Sending…|Request sent/)).not.toBeInTheDocument();
  const rejected = deferred<unknown>();
  vi.mocked(ha.callService).mockReturnValueOnce(rejected.promise);
  const scene = screen.getByRole("button", { name: "Activate Evening" });
  fireEvent.click(scene);
  const sceneController = scene.closest(".command-controller")!;
  expect(sceneController).toHaveAttribute("aria-busy", "true");
  expect(within(sceneController as HTMLElement).getByRole("status").querySelector(".animate-spin")).toBeInTheDocument();
  expect(scene).toBeDisabled();
  await act(async () => rejected.reject(new Error("HA rejection")));
  expect(within(sceneController as HTMLElement).getByRole("alert")).toHaveTextContent("Home Assistant rejected");
  expect(within(sceneController as HTMLElement).queryByRole("status")).not.toBeInTheDocument();
  expect(sceneController).toHaveAttribute("aria-busy", "false");
  expect(scene).toBeEnabled();
});

it("replaces the existing demo household with setup states and never restores it on disconnect, logout or reload", async () => {
  const demo = render(<App />);
  expect(screen.getByRole("checkbox", { name: "Set the table" })).toBeInTheDocument();
  demo.unmount();
  const original = localStorage.getItem("afterglow-planner-v1:home-1");
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  window.history.replaceState(null, "", "/?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  await screen.findByText(/Set up people in Home Assistant → Settings → People/);
  const noDemo = () => {
    expect(screen.queryByText(/Anna|Erik|Emma|Leo|Football practice|Piano lesson|Oat milk|Set the table|Year 5|Class 2A/)).not.toBeInTheDocument();
    expect(document.querySelector('img[src^="/timetables/"]')).toBeNull();
  };
  noDemo();
  expect(screen.getAllByText(/Set up to-do lists in Home Assistant/)).toHaveLength(2);
  expect(screen.getByText(/Set up school timetables in this app/)).toBeInTheDocument();
  const nav = (name: string) => fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name }));
  nav("School");
  noDemo();
  nav("Lists");
  noDemo();
  nav("Our week");
  noDemo();
  fireEvent.click(screen.getByRole("link", { name: "Set up people and calendars" }));
  fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
  nav("Today");
  noDemo();
  expect(screen.getByText(/Connect to Home Assistant to load people and calendars/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Set up people and calendars" }));
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  nav("Today");
  noDemo();
  view.unmount();
  render(<App />);
  noDemo();
  expect(localStorage.getItem("afterglow-planner-v1:home-1")).toBe(original);
});

it("assigns HA calendars to real people in both views, persists setup, and isolates a different instance", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
  const household = { ...states,
    "person.morgan": state("person.morgan", "home", { friendly_name: "Morgan" }),
    "person.riley": state("person.riley", "not_home", { friendly_name: "Riley" }),
    "calendar.morgan": state("calendar.morgan", "off", { friendly_name: "Morgan calendar" }),
  };
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    (connection as unknown as FakeConnection).entityCallback = callback;
    queueMicrotask(() => callback(household));
    return conn.unsubscribeEntities;
  });
  const event = { summary: "Dentist appointment", start: { dateTime: "2026-10-07T13:00:00Z" }, end: { dateTime: "2026-10-07T14:00:00Z" } };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [event] });
  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  window.history.replaceState(null, "", "/settings?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  const assignment = within(await screen.findByRole("group", { name: "Morgan" })).getByRole("combobox", { name: "Add calendar for Morgan" });
  await waitFor(() => expect(assignment).not.toBeDisabled());
  expect(assignment).toHaveValue("");
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.change(assignment, { target: { value: "http://ha.local:8123|calendar.morgan" } });
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Our week" }));
  expect(await screen.findByRole("button", { name: /15:00 Dentist appointment/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Weekly grid" })).toHaveAttribute("aria-pressed", "true");
  const row = (name: string) => within(screen.getByRole("rowheader", { name }).closest("tr")!);
  expect(row("Morgan").getByRole("button", { name: /Dentist appointment/ })).toBeInTheDocument();
  expect(row("Riley").queryByRole("button", { name: /Dentist appointment/ })).not.toBeInTheDocument();
  fireEvent.click(row("Riley").getByRole("button", { name: "Add a plan for Riley on Thu 8 Oct" }));
  fireEvent.change(await screen.findByLabelText("What’s happening?"), { target: { value: "Local library visit" } });
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  expect(row("Riley").getByRole("button", { name: /Local library visit/ })).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Today" }));
  expect(await within(screen.getByRole("table")).findByRole("button", { name: /Dentist appointment/ })).toBeInTheDocument();
  expect(row("Riley").getByRole("button", { name: /Local library visit/ })).toBeInTheDocument();
  const key = "afterglow-connected-planner-v1:http://ha.local:8123:home-1";
  expect(localStorage.getItem(key)).toContain("Local library visit");
  expect(localStorage.getItem(key)).not.toContain("Dentist appointment");
  view.unmount();
  conn = new FakeConnection();
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  const restored = render(<App />);
  expect(await within(await screen.findByRole("table")).findByRole("button", { name: /Dentist appointment/ })).toBeInTheDocument();
  expect(row("Riley").getByRole("button", { name: /Local library visit/ })).toBeInTheDocument();
  act(() => conn.entityCallback?.(states));
  expect(row("Person unavailable").getByRole("button", { name: /Local library visit/ })).toBeInTheDocument();
  fireEvent.click(row("Person unavailable").getByRole("button", { name: /Local library visit/ }));
  expect(await screen.findByLabelText("Who’s going?")).toHaveValue("http://ha.local:8123|person.riley");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  restored.unmount();
  localStorage.setItem("home-harmony:ha-url", "http://other.local:8123");
  render(<App />);
  expect(screen.queryByText("Local library visit")).not.toBeInTheDocument();
  expect(screen.queryByText("Dentist appointment")).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key)).calendarMembers).toEqual({ "http://ha.local:8123|calendar.morgan": "http://ha.local:8123|person.morgan" });
});

it("selects multiple calendars per person, moves and clears assignments, and restores the saved selections", async () => {
  const instance = "http://ha.local:8123";
  const key = `afterglow-connected-planner-v1:${instance}:home-1`;
  const household = { ...states,
    "person.morgan": state("person.morgan", "home", { friendly_name: "Morgan" }),
    "person.riley": state("person.riley", "home", { friendly_name: "Riley" }),
    "calendar.personal": state("calendar.personal", "off", { friendly_name: "Personal" }),
    "calendar.work": state("calendar.work", "off", { friendly_name: "Work" }),
    "calendar.shared": state("calendar.shared", "off", { friendly_name: "Shared" }),
  };
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    (connection as unknown as FakeConnection).entityCallback = callback;
    queueMicrotask(() => callback(household));
    return conn.unsubscribeEntities;
  });
  localStorage.setItem("home-harmony:ha-url", instance);
  localStorage.setItem(key, JSON.stringify({ events: [], items: [], timetables: {}, calendarMembers: {
    [`${instance}|calendar.personal`]: `${instance}|person.morgan`, [`${instance}|calendar.shared`]: "everyone",
  } }));
  window.history.replaceState(null, "", "/settings?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  await screen.findByRole("group", { name: "Morgan" });
  const selected = (person: string, calendar: string) => within(screen.getByRole("group", { name: person })).getByRole("button", { name: `Remove ${calendar} from ${person}` });
  const dropdown = (person: string) => screen.getByRole("combobox", { name: `Add calendar for ${person}` });
  const add = (person: string, calendar: string) => fireEvent.change(dropdown(person), { target: { value: `${instance}|calendar.${calendar}` } });
  await waitFor(() => expect(dropdown("Morgan")).not.toBeDisabled());
  expect(selected("Morgan", "Personal")).toBeInTheDocument();
  expect(selected("Everyone", "Shared")).toBeInTheDocument();
  expect(within(dropdown("Morgan")).queryByRole("option", { name: "Personal" })).not.toBeInTheDocument();
  expect(within(dropdown("Riley")).getByRole("option", { name: "Personal — move from Morgan" })).toBeInTheDocument();
  add("Morgan", "work");
  expect(dropdown("Morgan")).toHaveValue("");
  expect(selected("Morgan", "Work")).toBeInTheDocument();
  expect(selected("Morgan", "Personal")).toBeInTheDocument();
  add("Riley", "personal");
  expect(selected("Riley", "Personal")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Remove Personal from Morgan" })).not.toBeInTheDocument();
  fireEvent.click(selected("Riley", "Personal"));
  expect(JSON.parse(localStorage.getItem(key)).calendarMembers[`${instance}|calendar.personal`]).toBeUndefined();
  expect(within(dropdown("Riley")).getByRole("option", { name: "Personal" })).toBeInTheDocument();
  add("Everyone", "personal");
  add("Everyone", "work");
  expect(dropdown("Everyone")).toBeDisabled();
  expect(within(dropdown("Everyone")).getByRole("option", { name: "All calendars selected" })).toBeInTheDocument();
  add("Morgan", "work");
  act(() => conn.emit("disconnected"));
  expect(dropdown("Morgan")).toBeDisabled();
  expect(selected("Morgan", "Work")).toBeDisabled();
  expect(selected("Everyone", "Personal")).toBeDisabled();
  view.unmount();
  conn = new FakeConnection();
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  render(<App />);
  await screen.findByRole("group", { name: "Morgan" });
  await waitFor(() => expect(dropdown("Morgan")).not.toBeDisabled());
  expect(selected("Morgan", "Work")).toBeInTheDocument();
  expect(selected("Everyone", "Personal")).toBeInTheDocument();
  expect(selected("Everyone", "Shared")).toBeInTheDocument();
});

it("keeps successful calendar reads visible alongside errors and removes remote events while offline", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    (connection as unknown as FakeConnection).entityCallback = callback;
    queueMicrotask(() => callback({ ...states, "person.morgan": state("person.morgan", "home", { friendly_name: "Morgan" }), "calendar.good": state("calendar.good", "off"), "calendar.denied": state("calendar.denied", "off") }));
    return conn.unsubscribeEntities;
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("calendar.denied") ? { ok: false, status: 403 } : { ok: true, json: async () => [{ summary: "Shared day", start: "2026-10-07", end: "2026-10-08" }] }));
  localStorage.setItem("home-harmony:ha-url", "http://ha.local:8123");
  localStorage.setItem("afterglow-connected-planner-v1:http://ha.local:8123:home-1", JSON.stringify({ events: [], items: [], timetables: {}, calendarMembers: { "http://ha.local:8123|calendar.good": "everyone", "http://ha.local:8123|calendar.denied": "everyone" } }));
  window.history.replaceState(null, "", "/calendar?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  expect(await screen.findByRole("button", { name: /Shared day/ })).toBeInTheDocument();
  expect(within(screen.getByRole("rowheader", { name: "Everyone" }).closest("tr")!).getByRole("button", { name: /Shared day/ })).toBeVisible();
  expect(within(screen.getByRole("rowheader", { name: "Morgan" }).closest("tr")!).queryByRole("button", { name: /Shared day/ })).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Could not read calendar.denied");
  act(() => conn.emit("disconnected"));
  expect(screen.queryByRole("button", { name: /Shared day/ })).not.toBeInTheDocument();
  expect(screen.getByText(/calendar events are unavailable while offline/)).toBeInTheDocument();
  expect(screen.queryByText(/Anna|Erik|Emma|Leo/)).not.toBeInTheDocument();
});

it("assigns one task and daily list per person plus shared shopping, moves selections and restores them", async () => {
  const instance = "http://ha.local:8123";
  const key = `afterglow-connected-planner-v1:${instance}:home-1`;
  const household = { ...states, "person.morgan": state("person.morgan", "home", { friendly_name: "Morgan" }),
    ...Object.fromEntries(["family", "personal", "daily", "routine", "shopping"].map(id => [`todo.${id}`, state(`todo.${id}`, "0", { friendly_name: id })])),
  };
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    (connection as unknown as FakeConnection).entityCallback = callback;
    queueMicrotask(() => callback(household));
    return conn.unsubscribeEntities;
  });
  localStorage.setItem("home-harmony:ha-url", instance);
  window.history.replaceState(null, "", "/settings?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  const select = (name: string) => screen.getByRole("combobox", { name });
  await waitFor(() => expect(select("Tasks for Morgan")).toBeEnabled());
  const choose = (name: string, list: string) => fireEvent.change(select(name), { target: { value: list ? `${instance}|todo.${list}` : "" } });
  choose("Tasks for Everyone", "family");
  choose("Tasks for Morgan", "personal");
  choose("Daily tasks for Everyone", "daily");
  choose("Daily tasks for Morgan", "routine");
  choose("Shared shopping list for Everyone", "shopping");
  expect(JSON.parse(localStorage.getItem(key)).todoLists).toEqual({
    [`${instance}|todo.family`]: { kind: "tasks", member: "everyone" },
    [`${instance}|todo.personal`]: { kind: "tasks", member: `${instance}|person.morgan` },
    [`${instance}|todo.daily`]: { kind: "daily", member: "everyone" },
    [`${instance}|todo.routine`]: { kind: "daily", member: `${instance}|person.morgan` },
    [`${instance}|todo.shopping`]: { kind: "shopping", member: "everyone" },
  });
  choose("Tasks for Morgan", "family");
  expect(select("Tasks for Everyone")).toHaveValue("");
  expect(JSON.parse(localStorage.getItem(key)).todoLists[`${instance}|todo.personal`]).toBeUndefined();
  choose("Tasks for Morgan", "");
  expect(JSON.parse(localStorage.getItem(key)).todoLists[`${instance}|todo.family`]).toBeUndefined();
  choose("Tasks for Everyone", "family");
  view.unmount();
  conn = new FakeConnection();
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  const restored = render(<App />);
  await waitFor(() => expect(select("Tasks for Everyone")).toBeEnabled());
  expect(select("Daily tasks for Morgan")).toHaveValue(`${instance}|todo.routine`);
  expect(select("Shared shopping list for Everyone")).toHaveValue(`${instance}|todo.shopping`);
  act(() => conn.emit("disconnected"));
  expect(select("Tasks for Everyone")).toBeDisabled();
  restored.unmount();
  localStorage.setItem("home-harmony:ha-url", "http://other.local:8123");
  render(<App />);
  expect(select("Tasks for Everyone")).toHaveValue("");
  expect(select("Shared shopping list for Everyone")).toHaveValue("");
});

it("reads and edits assigned HA lists in the dashboard and Lists without storing remote items", async () => {
  const instance = "http://ha.local:8123";
  const key = `afterglow-connected-planner-v1:${instance}:home-1`;
  const household = { ...states, "person.morgan": state("person.morgan", "home", { friendly_name: "Morgan" }),
    ...Object.fromEntries(["family", "personal", "daily", "shopping"].map(id => [`todo.${id}`, state(`todo.${id}`, "1", { friendly_name: id, supported_features: 7 })])),
  };
  const lists = {
    "todo.family": [{ uid: "shared", summary: "Book holiday", status: "needs_action" }],
    "todo.personal": [{ uid: "personal", summary: "Book dentist", status: "needs_action" }],
    "todo.daily": [{ uid: "daily", summary: "Pack bag", status: "completed" }],
    "todo.shopping": [{ uid: "milk", summary: "Milk", status: "needs_action" }],
  };
  const originalRead = conn.sendMessagePromise.getMockImplementation()!;
  conn.sendMessagePromise.mockImplementation(async message => message.type === "todo/item/list" ? { items: lists[message.entity_id].map(item => ({ ...item })) } : originalRead(message));
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    (connection as unknown as FakeConnection).entityCallback = callback;
    queueMicrotask(() => callback(household));
    return conn.unsubscribeEntities;
  });
  vi.mocked(ha.getServices).mockResolvedValue({ ...services, todo: { add_item: { fields: {} }, update_item: { fields: {} }, remove_item: { fields: {} } } });
  vi.mocked(ha.callService).mockImplementation(async (_connection, domain, service, data, target) => {
    expect(domain).toBe("todo");
    const id = target.entity_id as string;
    const value = data as { item: string; status?: string };
    if (service === "add_item") lists[id].push({ uid: "new-item", summary: value.item, status: "needs_action" });
    if (service === "update_item") lists[id] = lists[id].map(item => item.uid === value.item ? { ...item, status: value.status } : item);
    if (service === "remove_item") lists[id] = lists[id].filter(item => item.uid !== value.item);
    return {};
  });
  localStorage.setItem("home-harmony:ha-url", instance);
  localStorage.setItem(key, JSON.stringify({ events: [], items: [], timetables: {}, todoLists: {
    [`${instance}|todo.family`]: { kind: "tasks", member: "everyone" },
    [`${instance}|todo.personal`]: { kind: "tasks", member: `${instance}|person.morgan` },
    [`${instance}|todo.daily`]: { kind: "daily", member: `${instance}|person.morgan` },
    [`${instance}|todo.shopping`]: { kind: "shopping", member: "everyone" },
  } }));
  window.history.replaceState(null, "", "/?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  const daily = within(await screen.findByRole("group", { name: "Morgan daily tasks" }));
  fireEvent.click(await daily.findByText("Completed (1)"));
  expect(daily.getByRole("checkbox", { name: "Pack bag" })).toBeChecked();
  expect(await screen.findByRole("checkbox", { name: "Milk" })).not.toBeChecked();
  expect(ha.callService).not.toHaveBeenCalled(); // Viewing a daily list never resets HA completion.
  fireEvent.click(screen.getByRole("checkbox", { name: "Milk" }));
  const shopping = within(screen.getByRole("group", { name: "Everyone shopping" }));
  await shopping.findByText("Completed (1)");
  expect(shopping.getByRole("checkbox", { name: "Milk" })).not.toBeVisible();
  fireEvent.click(shopping.getByText("Completed (1)"));
  expect(shopping.getByRole("checkbox", { name: "Milk" })).toBeChecked();
  expect(ha.callService).toHaveBeenCalledWith(conn, "todo", "update_item", { item: "milk", status: "completed" }, { entity_id: "todo.shopping" });
  fireEvent.click(shopping.getByRole("button", { name: "Add item" }));
  const shoppingInput = shopping.getByRole("textbox", { name: "New item in shopping" });
  fireEvent.change(shoppingInput, { target: { value: "mi" } });
  fireEvent.click(within(shopping.getByRole("group", { name: "Existing items" })).getByRole("button", { name: "Milk" }));
  expect(shoppingInput).toHaveValue("Milk");
  fireEvent.change(shoppingInput, { target: { value: " milk " } });
  fireEvent.click(shopping.getByRole("button", { name: "Save item to shopping" }));
  await waitFor(() => expect(shopping.getByRole("checkbox", { name: "Milk" })).not.toBeChecked());
  expect(ha.callService).toHaveBeenLastCalledWith(conn, "todo", "update_item", { item: "milk", status: "needs_action" }, { entity_id: "todo.shopping" });
  const calls = vi.mocked(ha.callService).mock.calls.length;
  fireEvent.click(shopping.getByRole("button", { name: "Add item" }));
  fireEvent.change(shopping.getByRole("textbox", { name: "New item in shopping" }), { target: { value: "MILK" } });
  fireEvent.click(shopping.getByRole("button", { name: "Save item to shopping" }));
  expect(ha.callService).toHaveBeenCalledTimes(calls);
  expect(lists["todo.shopping"]).toHaveLength(1);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Lists" }));
  fireEvent.click(screen.getByRole("button", { name: /Family tasks/ }));
  expect(await screen.findByRole("checkbox", { name: "Book holiday" })).toBeInTheDocument();
  expect(await screen.findByRole("checkbox", { name: "Book dentist" })).toBeInTheDocument();
  expect(screen.getAllByRole("group").filter(group => /^(Everyone|Morgan) tasks$/.test(group.getAttribute("aria-label") ?? "")).map(group => group.getAttribute("aria-label"))).toEqual(["Everyone tasks", "Morgan tasks"]);
  const shared = within(screen.getByRole("group", { name: "Everyone tasks" }));
  fireEvent.click(shared.getByRole("button", { name: "Add task" }));
  fireEvent.change(shared.getByRole("textbox", { name: "New item in family" }), { target: { value: "Fix bike" } });
  fireEvent.click(shared.getByRole("button", { name: "Save item to family" }));
  expect(await shared.findByRole("checkbox", { name: "Fix bike" })).toBeInTheDocument();
  expect(ha.callService).toHaveBeenLastCalledWith(conn, "todo", "add_item", { item: "Fix bike" }, { entity_id: "todo.family" });
  fireEvent.click(shared.getByRole("button", { name: "Remove Fix bike" }));
  await waitFor(() => expect(shared.queryByRole("checkbox", { name: "Fix bike" })).not.toBeInTheDocument());
  expect(ha.callService).toHaveBeenLastCalledWith(conn, "todo", "remove_item", { item: "new-item" }, { entity_id: "todo.family" });
  vi.mocked(ha.callService).mockRejectedValueOnce(new Error("Permission denied"));
  fireEvent.click(shared.getByRole("checkbox", { name: "Book holiday" }));
  expect(await shared.findByRole("alert")).toHaveTextContent("Home Assistant rejected");
  expect(shared.getByRole("checkbox", { name: "Book holiday" })).not.toBeChecked();
  expect(localStorage.getItem(key)).not.toMatch(/Book holiday|Book dentist|Pack bag|Milk|Fix bike/);
  act(() => conn.emit("disconnected"));
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getAllByText(/To-do lists are unavailable while offline/)).toHaveLength(2);
  expect(screen.queryByText(/Set the table|Oat milk/)).not.toBeInTheDocument();
});

it("rejects malformed or stale to-do reads and blocks unsupported and offline writes", async () => {
  const client = await connectedClient();
  const household = { ...states, "todo.list": state("todo.list", "1", { supported_features: 4 }) };
  act(() => conn.entityCallback?.(household));
  conn.sendMessagePromise.mockResolvedValueOnce({ items: [{ uid: "one", summary: "Test", status: "invalid-private-response" }] });
  await expect(client.todoItems("todo.list")).rejects.toThrow("could not be read");
  await expect(client.todoItems("light.living")).rejects.toThrow("could not be read");
  await expect(client.command("todo.list", "add_item", { item: "No support" })).rejects.toThrow("not supported");
  expect(ha.callService).not.toHaveBeenCalled();
  const pending = deferred<unknown>();
  conn.sendMessagePromise.mockReturnValueOnce(pending.promise);
  const read = client.todoItems("todo.list");
  conn.emit("disconnected");
  pending.resolve({ items: [{ uid: "one", summary: "Old session", status: "needs_action" }] });
  await expect(read).rejects.toThrow("could not be read");
  await expect(client.command("todo.list", "update_item", { item: "one", status: "completed" })).rejects.toThrow("fresh");
  expect(ha.callService).not.toHaveBeenCalled();
});

it("shows unavailable and failed lists separately while keeping readable lists usable", async () => {
  const instance = "http://ha.local:8123";
  const household = { ...states, "person.morgan": state("person.morgan", "home", { friendly_name: "Morgan" }), "person.riley": state("person.riley", "home", { friendly_name: "Riley" }),
    "todo.readonly": state("todo.readonly", "1", { supported_features: 0 }),
    "todo.denied": state("todo.denied", "2", { supported_features: 7 }),
  };
  const originalRead = conn.sendMessagePromise.getMockImplementation()!;
  conn.sendMessagePromise.mockImplementation(async message => {
    if (message.type !== "todo/item/list") return originalRead(message);
    if (message.entity_id === "todo.denied") throw new Error("private server details");
    return { items: [{ uid: "one", summary: "Read only item", status: "needs_action" }] };
  });
  vi.mocked(ha.subscribeEntities).mockImplementation((_connection, callback) => {
    queueMicrotask(() => callback(household));
    return conn.unsubscribeEntities;
  });
  localStorage.setItem("home-harmony:ha-url", instance);
  localStorage.setItem(`afterglow-connected-planner-v1:${instance}:home-1`, JSON.stringify({ events: [], items: [], timetables: {}, todoLists: {
    [`${instance}|todo.readonly`]: { kind: "tasks", member: "everyone" },
    [`${instance}|todo.denied`]: { kind: "tasks", member: `${instance}|person.morgan` },
    [`${instance}|todo.missing`]: { kind: "tasks", member: `${instance}|person.riley` },
  } }));
  window.history.replaceState(null, "", "/lists?tab=tasks&auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  expect(await screen.findByRole("checkbox", { name: "Read only item" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Remove Read only item" })).toBeDisabled();
  expect(screen.getByText("This list is read-only.")).toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("To-do items could not be read");
  expect(screen.queryByText(/private server details/)).not.toBeInTheDocument();
  expect(screen.getByText(/This to-do list is unavailable/)).toBeInTheDocument();
  expect(conn.sendMessagePromise).not.toHaveBeenCalledWith({ type: "todo/item/list", entity_id: "todo.missing" });
  expect(ha.callService).not.toHaveBeenCalled();
});
