import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import * as ha from "home-assistant-js-websocket";
import type { Auth, Connection, HassEntities } from "home-assistant-js-websocket";
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
  sendMessagePromise = vi.fn(async ({ type }: { type: string }) => ({ "config/area_registry/list": registries.areas, "config/device_registry/list": registries.devices, "config/entity_registry/list": registries.entities })[type]);
  emit(name: string) { this.connected = name === "ready"; this.listeners.get(name)?.forEach(listener => listener()); }
}
let conn: FakeConnection;
let auth: Auth;
let clients: HomeAssistantClient[];
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
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  window.history.replaceState(null, "", "/");
  conn = new FakeConnection();
  auth = { accessToken: "fixture-access-secret", expired: false, refreshAccessToken: vi.fn(async () => {}), revoke: vi.fn(async () => {}) } as unknown as Auth;
  vi.mocked(ha.getAuth).mockResolvedValue(auth);
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

it("uses browser auth, limits callback to the selected instance and keeps credentials out of storage", async () => {
  window.history.replaceState(null, "", "/settings?auth_callback=1&code=one-time-code&state=callback-state");
  const client = await connectedClient();
  expect(ha.getAuth).toHaveBeenCalledWith({ hassUrl: "http://ha.local:8123", clientId: `${window.location.origin}/`, redirectUrl: `${window.location.origin}/settings`, limitHassInstance: true });
  expect(window.location.search).toBe("");
  expect(localStorage.length).toBe(1);
  expect(localStorage.getItem("home-harmony:ha-url")).toBe("http://ha.local:8123");
  expect(client.getSnapshot().user).toEqual(user);
  expect(JSON.stringify(client.getSnapshot())).not.toContain("fixture-access-secret");
  await client.logout();
  expect(auth.revoke).toHaveBeenCalledOnce();
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
});
it("keeps non-demo alarm codes transient and shows actual command rejection", async () => {
  const submit = vi.fn().mockRejectedValueOnce(new Error("HA rejection")).mockResolvedValueOnce(undefined);
  const close = vi.fn();
  render(<PinPadModal open onOpenChange={close} title="Disarm" description="Code sent to HA" codeRequired onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText("Code"), { target: { value: "a long non-demo code" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("did not confirm");
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
  fireEvent.click(screen.getByRole("link", { name: "Living Room Light" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Living Room Light" })).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).not.toBeChecked();
  act(() => conn.emit("disconnected"));
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).toBeDisabled();
  expect(screen.getByText("Stale · off")).toBeInTheDocument();
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
  window.history.replaceState(null, "", "/calendar?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  expect(await screen.findByRole("heading", { name: event.summary })).toBeInTheDocument();
  const firstUrl = new URL(fetchMock.mock.calls[0][0]);
  expect(firstUrl.searchParams.get("start")).toBe("2026-10-05T22:00:00.000Z");
  expect(firstUrl.searchParams.get("end")).toBe("2026-10-12T22:00:00.000Z");
  expect(screen.queryByRole("button", { name: /Imported read-only event/ })).not.toBeInTheDocument();
  expect(localStorage.getItem("afterglow-planner-v1:home-1")).not.toContain(event.summary);
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
