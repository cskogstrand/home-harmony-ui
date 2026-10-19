import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import * as ha from "home-assistant-js-websocket";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { HomeAssistantClient } from "@/lib/home-assistant";
import App from "@/App";
import { PinPadModal } from "@/components/devices/PinPadModal";
import { config, registries, services, states, state, user } from "./ha-fixtures";
import { emptyConfiguration, emptyPlanner } from "../../shared/configuration";
import { timetableUploadPath } from "../../shared/timetables";

vi.mock("home-assistant-js-websocket", async importOriginal => ({
  ...await importOriginal<typeof import("home-assistant-js-websocket")>(),
  createConnection: vi.fn(), subscribeEntities: vi.fn(), getConfig: vi.fn(), getUser: vi.fn(), getServices: vi.fn(), callService: vi.fn(),
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
  subscribeMessage = vi.fn(async (_callback: (message: { events: unknown }) => void, _message: { type: string; entity_id: string; start: string; end: string }, _options: { resubscribe: boolean }): Promise<() => Promise<void>> => { throw { code: "unknown_command" }; });
  sendMessagePromise = vi.fn(async ({ type }: { type: string; entity_id?: string }): Promise<unknown> => ({ "config/area_registry/list": registries.areas, "config/device_registry/list": registries.devices, "config/entity_registry/list": registries.entities })[type]);
  emit(name: string) { this.connected = name === "ready"; this.listeners.get(name)?.forEach(listener => listener()); }
}
let conn: FakeConnection;
let serverConfig = emptyConfiguration();
const savedSettings = () => ({ ...serverConfig.settings, events: [], items: [] });
let haFetch = vi.fn();
const setHaFetch = (mock: typeof haFetch) => { haFetch = mock; };
const seedSettings = (value: Record<string, unknown>) => {
  const { events, items, ...settings } = value;
  if (settings.homeEntities && !Array.isArray(settings.homeEntities)) settings.homeEntities = Object.values(settings.homeEntities)[0];
  serverConfig = { ...emptyConfiguration(), settings: { ...emptyPlanner(), ...settings } };
};
let clients: HomeAssistantClient[];
const newClient = () => { const client = new HomeAssistantClient(); clients.push(client); return client; };
const connectedClient = async () => {
  const client = newClient();
  await client.connect();
  await waitFor(() => expect(client.getSnapshot().status).toBe("connected"));
  return client;
};
const confirmAction = async (name: string) => { await act(async () => { fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name })); }); };
const deferred = <T,>() => { let resolve: (value: T) => void; let reject: (error: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve: resolve!, reject: reject! }; };

it("starts without browser storage and keeps shared settings usable after HA disconnects", async () => {
  vi.spyOn(localStorage, "getItem").mockImplementation(() => { throw new Error("Browser storage disabled"); });
  vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("Browser storage disabled"); });
  const client = newClient();
  client.start();
  await waitFor(() => expect(client.getSnapshot().status).toBe("connected"));
  const options = vi.mocked(ha.createConnection).mock.calls[0][0];
  expect(options.auth.accessToken).toBe("server-managed");
  expect(options.auth.data.hassUrl).toBe(window.location.origin);
  client.disconnect();
  expect((await client.configurationRequest("GET")).ok).toBe(true);
  expect(localStorage.getItem).not.toHaveBeenCalled();
  expect(localStorage.setItem).not.toHaveBeenCalled();
});

it("uploads raw PDF bytes and loads binary images without leaking the token into URLs", async () => {
  const client = await connectedClient();
  const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);
  const fetch = vi.fn().mockImplementation(async () => new Response(bytes, { headers: { "Content-Type": "image/png" } }));
  setHaFetch(fetch);
  const image = await client.storageRequest("/api/timetables/morgan/00000000-0000-4000-8000-000000000000/1.png");
  expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes);
  const pdf = new File(["%PDF-1.4"], "week.pdf", { type: "application/pdf" });
  const path = timetableUploadPath("home|person.morgan");
  await client.storageRequest(path, { method: "POST", body: pdf, headers: { "Content-Type": "application/pdf" } });
  expect(haFetch).toHaveBeenLastCalledWith(path, expect.objectContaining({ method: "POST", body: pdf, redirect: "error", credentials: "same-origin", headers: { "Content-Type": "application/pdf" } }));
  await expect(client.storageRequest("https://other.example/api/timetables")).rejects.toThrow("dashboard API path");
  expect(haFetch).toHaveBeenCalledTimes(2);
});

it("confirms PDF uploads, preserves failed drafts, refreshes private previews and keeps them available while HA is offline", async () => {
  vi.stubEnv("MODE", "production");
  const instance = "http://ha.local:8123", previousInstance = "http://old-ha.local:8123";
  const member = `home|person.morgan`;
  const imagePath = "/api/timetables/morgan/00000000-0000-4000-8000-000000000000/1.png";
  const saved = serverConfig = { ...emptyConfiguration(), settings: { ...emptyPlanner(), timetableEnabled: { [member]: true }, timetables: { [member]: ["/previous.png"] } } };
  const post = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: "Invalid PDF; previous timetable kept." }), { status: 400 })).mockImplementationOnce(async () => {
    saved.settings.timetables[member] = [imagePath];
    return new Response(JSON.stringify({ message: "Timetable uploaded.", pages: 1 }));
  });
  const fetch = vi.fn().mockImplementation(async (path: string, options: RequestInit) => {
    if (options.method === "POST") return post(path, options);
    if (path === "/api/config") return new Response(JSON.stringify({ revision: "a".repeat(64), config: saved }));
    if (path === imagePath) return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "Content-Type": "image/png" } });
    throw new Error(`Unexpected request ${path}`);
  });
  setHaFetch(fetch);
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:private-timetable"), revokeObjectURL: vi.fn() }));
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    conn.entityCallback = callback;
    queueMicrotask(() => callback({ ...states, "person.morgan": state("person.morgan", "home", { friendly_name: "Morgan" }) }));
    return conn.unsubscribeEntities;
  });
  window.history.replaceState(null, "", "/school");
  const view = render(<App />);
  const picker = await screen.findByLabelText("Upload Morgan timetable PDF");
  await waitFor(() => expect(picker).toBeEnabled());
  expect(screen.getByLabelText("Morgan upload URL")).toHaveValue(new URL(timetableUploadPath(member), window.location.origin).href);
  fireEvent.click(screen.getByRole("button", { name: "Change timetable images" }));
  fireEvent.change(screen.getByLabelText("Morgan timetable image URLs"), { target: { value: "/unfinished-draft.png" } });
  const pdf = new File(["%PDF-1.4"], "week.pdf", { type: "application/pdf" });
  fireEvent.change(picker, { target: { files: [pdf] } });
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
  expect(post).not.toHaveBeenCalled();
  fireEvent.change(picker, { target: { files: [pdf] } });
  await confirmAction("Upload PDF");
  expect(within(screen.getByRole("alertdialog")).getByRole("alert")).toHaveTextContent("Invalid PDF");
  expect(screen.getByLabelText("Morgan timetable image URLs")).toHaveValue("/unfinished-draft.png");
  expect(screen.getByRole("img", { name: "Morgan’s school timetable", hidden: true })).toHaveAttribute("src", "/previous.png");
  await confirmAction("Upload PDF");
  expect(post).toHaveBeenCalledTimes(2);
  expect(post).toHaveBeenLastCalledWith(timetableUploadPath(member), expect.objectContaining({ body: pdf }));
  await waitFor(() => expect(screen.getByRole("img", { name: "Morgan’s school timetable" })).toHaveAttribute("src", "blob:private-timetable"));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Morgan timetable image URLs")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Change timetable images" }));
  expect(screen.getByLabelText("Morgan timetable image URLs")).toHaveValue(imagePath);
  act(() => conn.emit("disconnected"));
  expect(screen.getByRole("img", { name: "Morgan’s school timetable" })).toHaveAttribute("src", "blob:private-timetable");
  expect(picker).toBeEnabled();
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-timetable");
});
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
  serverConfig = emptyConfiguration();
  setHaFetch(vi.fn().mockResolvedValue(new Response("[]")));
  vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit = {}) => {
    if (path === "/api/runtime") return new Response(JSON.stringify({ homeAssistantUrl: "http://ha.local:8123" }));
    if (path === "/api/config") {
      if (options.method === "PUT") serverConfig = JSON.parse(String(options.body));
      return new Response(JSON.stringify({ revision: "a".repeat(64), config: serverConfig }));
    }
    return haFetch(path, options);
  }));
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
afterEach(() => { cleanup(); clients.forEach(client => client.dispose()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each(["/", "/calendar"])("loads uploaded person photos and falls back to initials from %s", async path => {
  const photo = "/api/image/serve/0123456789abcdef0123456789abcdef/original";
  vi.stubGlobal("Image", class extends EventTarget {
    complete = false;
    naturalWidth = 0;
    source = "";
    get src() { return this.source; }
    set src(value: string) {
      this.source = value; this.complete = false; this.naturalWidth = 0;
      queueMicrotask(() => { this.complete = true; this.naturalWidth = value === photo ? 256 : 0; this.dispatchEvent(new Event(value === photo ? "load" : "error")); });
    }
  });
  const person = (picture?: unknown) => ({ ...states, "person.morgan": state("person.morgan", "home", { friendly_name: "Morgan", entity_picture: picture }) });
  vi.mocked(ha.subscribeEntities).mockImplementation((_connection, callback) => {
    conn.entityCallback = callback;
    queueMicrotask(() => callback(person(photo)));
    return conn.unsubscribeEntities;
  });
  window.history.replaceState(null, "", path);
  render(<App />);
  const row = await screen.findByRole("rowheader", { name: "Morgan" });
  await waitFor(() => expect(row.querySelector("img")).toHaveAttribute("src", photo));
  expect(row.querySelector("img")).toHaveAttribute("alt", "");
  act(() => conn.entityCallback?.(person(photo.replace("original", "256x256"))));
  await waitFor(() => expect(row.querySelector("img")).toBeNull());
  expect(within(row).getByText("M")).toBeVisible();
  act(() => conn.entityCallback?.(person(photo)));
  await waitFor(() => expect(row.querySelector("img")).toHaveAttribute("src", photo));
  for (const picture of [undefined, 42, "https://other.example/photo.png"]) {
    act(() => conn.entityCallback?.(person(picture)));
    await waitFor(() => expect(row.querySelector("img")).toBeNull());
    expect(within(row).getByText("M")).toBeVisible();
  }
});

it("shows the morning notification on the front page, updates live, and hides stale or invalid summaries", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // Already the next day in the home's timezone, even though UTC is still Sunday.
  vi.setSystemTime(new Date("2026-10-18T22:05:00Z"));
  render(<App />);
  await waitFor(() => expect(conn.entityCallback).toBeDefined());
  expect(screen.queryByRole("region", { name: "Morning summary" })).not.toBeInTheDocument();

  const entityId = "sensor.afterglow_morning_summary";
  const message = `🏡 Household: ${"Remember today's plans. ".repeat(11)}\n\n🧑 Parent: Bring gym shoes.`;
  const publish = (date: string, value: unknown) => act(() => conn.entityCallback?.({ ...states, [entityId]: state(entityId, date, { message: value }) }));
  publish("2026-10-19", message);
  const panel = await screen.findByRole("region", { name: "Morning summary" });
  expect(message.length).toBeGreaterThan(255);
  expect(panel.querySelector("p")?.textContent).toBe(message);
  expect(panel.querySelector("p")).toHaveClass("whitespace-pre-wrap", "break-words");

  publish("2026-10-19", "🏡 Household: Updated plans. <b>Bring food.</b>");
  expect(panel).toHaveTextContent("Updated plans. <b>Bring food.</b>");
  expect(panel.querySelector("b")).toBeNull();
  act(() => conn.emit("disconnected"));
  expect(within(panel).getByText("Cached summary · Home Assistant is offline.")).toBeInTheDocument();
  act(() => conn.emit("ready"));
  publish("2026-10-19", message);
  await waitFor(() => expect(screen.queryByText("Cached summary · Home Assistant is offline.")).not.toBeInTheDocument());

  for (const [date, value] of [
    ["2026-10-18", message], ["2026-10-20", message], ["unavailable", message],
    ["unknown", message], ["2026-10-19", "  "], ["2026-10-19", null], ["2026-10-19", { text: message }],
  ] as const) {
    publish(date, value);
    expect(screen.queryByRole("region", { name: "Morning summary" })).not.toBeInTheDocument();
  }
  publish("2026-10-19", message);
  expect(screen.getByRole("region", { name: "Morning summary" })).toBeInTheDocument();
  act(() => conn.entityCallback?.(states));
  expect(screen.queryByRole("region", { name: "Morning summary" })).not.toBeInTheDocument();
  expect(ha.callService).not.toHaveBeenCalled();
});

it("plays the morning summary only on request and blocks duplicate, unavailable and offline starts", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T06:00:00Z"));
  vi.mocked(ha.getServices).mockResolvedValue({ ...services, script: { turn_on: { fields: {} } } });
  render(<App />);
  await waitFor(() => expect(conn.entityCallback).toBeDefined());
  const scriptId = "script.morning_summary_voice";
  const summaryId = "sensor.afterglow_morning_summary";
  const publish = (scriptState?: string) => act(() => conn.entityCallback?.({
    ...states,
    [summaryId]: state(summaryId, "2026-10-19", { message: "God morgen! Husk gymtøy." }),
    ...(scriptState ? { [scriptId]: state(scriptId, scriptState) } : {}),
  }));
  publish();
  const panel = await screen.findByRole("region", { name: "Morning summary" });
  const play = within(panel).getByRole("button", { name: "Play summary" });
  expect(play).toBeDisabled();
  publish("off");
  await waitFor(() => expect(play).toBeEnabled());
  expect(ha.callService).not.toHaveBeenCalled();

  const request = deferred<object>();
  vi.mocked(ha.callService).mockReturnValueOnce(request.promise);
  fireEvent.click(play);
  fireEvent.click(play);
  expect(ha.callService).toHaveBeenCalledExactlyOnceWith(conn, "script", "turn_on", {}, { entity_id: scriptId });
  expect(play).toBeDisabled();
  expect(play).toHaveTextContent("Preparing summary…");
  publish("on");
  await act(async () => request.resolve({}));
  expect(play).toBeDisabled();
  publish("off");
  expect(play).toBeEnabled();

  vi.mocked(ha.callService).mockRejectedValueOnce(new Error("Permission denied"));
  fireEvent.click(play);
  expect(await within(panel).findByRole("alert")).toHaveTextContent("Home Assistant rejected or did not acknowledge the command");
  expect(play).toBeEnabled();
  for (const scriptState of [undefined, "unknown", "unavailable", "on"]) {
    publish(scriptState);
    expect(play).toBeDisabled();
    fireEvent.click(play);
  }
  publish("off");
  act(() => conn.emit("disconnected"));
  expect(play).toBeDisabled();
  fireEvent.click(play);
  expect(ha.callService).toHaveBeenCalledTimes(2);
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
  const first = client.connect();
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
  expect(null).toBeNull();
  expect(client.getSnapshot().status).toBe("auth-error");
  expect(client.getSnapshot().error).toContain("server token");
  await expect(client.command("light.living", "turn_on")).rejects.toThrow("fresh");
  vi.mocked(ha.createConnection).mockRejectedValueOnce(ha.ERR_CANNOT_CONNECT);
  await client.connect();
  expect(client.getSnapshot().status).toBe("disconnected");
  expect(client.getSnapshot().error).toContain("dashboard server");
});
it("loads registry metadata updates and reports unavailable registries honestly", async () => {
  const client = await connectedClient();
  conn.sendMessagePromise.mockRejectedValueOnce({ code: "unauthorized" });
  conn.subscriptions.get("area_registry_updated")?.();
  await waitFor(() => expect(client.getSnapshot().warnings.join()).toContain("areas"));
  expect(client.getSnapshot().registries.areas).toEqual([]);
  expect(client.getSnapshot().status).toBe("connected");
});
it("reads calendar ranges through the server and reports API failures", async () => {
  const client = await connectedClient();
  const events = [{ summary: "HA event", start: { date: "2026-10-06" }, end: { date: "2026-10-07" } }];
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => events });
  setHaFetch(fetchMock);
  const signal = new AbortController().signal;
  expect(await client.calendarEvents("calendar.house", "2026-10-05T22:00:00Z", "2026-10-12T22:00:00Z", signal)).toEqual(events);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toContain("/api/calendars/calendar.house?start=");
  expect(url).not.toContain("secret");
  expect(options.credentials).toBe("same-origin");
  fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
  await expect(client.calendarEvents("calendar.house", "start", "end", signal)).rejects.toThrow("server settings");
  fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
  await expect(client.calendarEvents("calendar.house", "start", "end", signal)).rejects.toThrow();
  expect(client.getSnapshot().status).toBe("auth-error");
  expect(null).toBeNull();
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
it("closes an alarm confirmation if the selected alarm changes", async () => {
  window.history.replaceState(null, "", "/alarm?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  const disarm = await screen.findByRole("button", { name: "Disarm" });
  await waitFor(() => expect(disarm).toBeEnabled());
  fireEvent.click(disarm);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  act(() => conn.entityCallback?.({
    ...Object.fromEntries(Object.entries(states).filter(([id]) => id !== "alarm_control_panel.house")),
    "alarm_control_panel.garage": state("alarm_control_panel.garage", "disarmed", { ...states["alarm_control_panel.house"].attributes, friendly_name: "Garage alarm" }),
  }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(ha.callService).not.toHaveBeenCalled();
});

it("uses reported state throughout navigation and disables stale controls in the UI", async () => {
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
  expect(await screen.findByRole("heading", { level: 1, name: "Multi sensor" })).toBeInTheDocument();
  expect(window.location.hash).toBe("#light.living");
  expect(screen.getByRole("article", { name: "Living Room Light" })).toHaveFocus();
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).not.toBeChecked();
  act(() => conn.emit("disconnected"));
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).toBeDisabled();
  expect(screen.getAllByText("Offline").length).toBeGreaterThan(0);
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
it("loads only the displayed HA calendar range and never saves its events in the shared settings", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    (connection as unknown as FakeConnection).entityCallback = callback;
    queueMicrotask(() => callback({ ...states, "calendar.house": state("calendar.house", "off", { friendly_name: "House calendar" }) }));
    return conn.unsubscribeEntities;
  });
  const event = { summary: "Imported read-only event", start: { date: "2026-10-06" }, end: { date: "2026-10-08" }, location: null };
  const timedEvent = { summary: "Read-only appointment", start: "2026-10-06T15:00:00Z", end: "2026-10-06T16:00:00Z" };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [event, timedEvent] });
  setHaFetch(fetchMock);
  seedSettings({ events: [], items: [], timetables: {}, calendarMembers: { "home|calendar.house": "everyone" } });
  window.history.replaceState(null, "", "/calendar?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  expect(await screen.findAllByRole("button", { name: /Imported read-only event/ })).toHaveLength(1);
  expect(screen.getByRole("button", { name: /Imported read-only event/ }).closest("td")).toHaveAttribute("colspan", "2");
  const firstUrl = new URL(fetchMock.mock.calls[0][0], window.location.origin);
  expect(firstUrl.searchParams.get("start")).toBe("2026-10-05T22:00:00.000Z");
  expect(firstUrl.searchParams.get("end")).toBe("2026-10-12T22:00:00.000Z");
  fireEvent.click(screen.getAllByRole("button", { name: /Imported read-only event/ })[0]);
  expect(screen.getByText(/does not support editing existing events/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save plan" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: /17:00 – 18:00 Read-only appointment/ }));
  expect(within(screen.getByRole("dialog")).getByText(/17:00 – 18:00/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })).not.toContain(event.summary);
  const nextResponse = deferred<unknown>();
  fetchMock.mockReturnValueOnce(nextResponse.promise);
  fireEvent.click(screen.getByRole("button", { name: "Next week" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(new URL(fetchMock.mock.calls[1][0], window.location.origin).searchParams.get("start")).toBe("2026-10-12T22:00:00.000Z");
  view.unmount();
  expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true);
  await act(async () => nextResponse.resolve({ ok: true, json: async () => [event] }));
});
it.each(["2026-10-07", "2026-10-08", null])("skips all-day plans in Today’s Up next card with the next timed plan on %s", async date => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    queueMicrotask(() => callback({ ...states, "calendar.house": state("calendar.house", "off") }));
    return conn.unsubscribeEntities;
  });
  const events = [
    { summary: "All-day trip", start: "2026-10-07", end: "2026-10-09" },
    { summary: "Past appointment", start: "2026-10-07T08:00:00Z", end: "2026-10-07T09:00:00Z" },
    ...(date ? [
      { summary: "Later appointment", start: `${date}T15:00:00Z`, end: `${date}T16:00:00Z` },
      { summary: "Next appointment", start: `${date}T13:00:00Z`, end: `${date}T14:00:00Z` },
    ] : []),
  ];
  setHaFetch(vi.fn().mockResolvedValue({ ok: true, json: async () => events }));
  seedSettings({ events: [], items: [], timetables: {}, calendarMembers: { "home|calendar.house": "everyone" } });
  window.history.replaceState(null, "", "/?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  const calendar = within(screen.getByRole("region", { name: "Family weekly calendar" }));
  expect(await calendar.findAllByRole("button", { name: /All-day trip/ })).toHaveLength(1);
  const next = within(screen.getByRole("region", { name: "Next family plan" }));
  expect(next.getByRole("heading", { name: date ? "Next appointment" : "No upcoming plans to display." })).toBeInTheDocument();
  if (date) expect(next.getByText("15:00 – 16:00")).toBeInTheDocument();
});
const setupWritableCalendars = (features = 1) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
  const household = { ...states,
    "person.morgan": state("person.morgan", "home", { friendly_name: "Morgan" }),
    "calendar.house": state("calendar.house", "off", { friendly_name: "Family calendar", supported_features: features }),
    "calendar.work": state("calendar.work", "off", { friendly_name: "Work calendar", supported_features: 1 }),
    "calendar.morgan": state("calendar.morgan", "off", { friendly_name: "Morgan calendar", supported_features: 1 }),
    "calendar.holidays": state("calendar.holidays", "off", { friendly_name: "Holidays", supported_features: 0 }),
  };
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    (connection as unknown as FakeConnection).entityCallback = callback;
    queueMicrotask(() => callback(household));
    return conn.unsubscribeEntities;
  });
  seedSettings({ events: [], items: [], timetables: {}, calendarMembers: {
    "home|calendar.house": "everyone", "home|calendar.work": "everyone",
    "home|calendar.holidays": "everyone", "home|calendar.morgan": "home|person.morgan",
  } });
  setHaFetch(vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  return { household };
};

it.each([
  { path: "/", features: 3, recurring: false },
  { path: "/calendar", features: 3, recurring: true },
  { path: "/calendar", features: 7, recurring: false },
])("confirms HA event deletion and refreshes only after success: %j", async ({ path, features, recurring }) => {
  setupWritableCalendars(features);
  const target = { uid: "event-uid", summary: "Delete this plan", start: "2026-10-07T14:00:00Z", end: "2026-10-07T15:00:00Z",
    ...(recurring && { recurrence_id: "google-instance-1", rrule: "FREQ=DAILY" }),
  };
  const remaining = { ...target, uid: recurring ? target.uid : "other-uid", summary: "Keep this plan", start: "2026-10-08T14:00:00Z", end: "2026-10-08T15:00:00Z",
    ...(recurring && { recurrence_id: "google-instance-2" }),
  };
  let events = [target, remaining];
  vi.mocked(haFetch).mockImplementation(async input => ({ ok: true, json: async () => String(input).includes("calendar.house") ? events : [] }) as Response);
  window.history.replaceState(null, "", `${path}?auth_callback=1&code=fixture&state=fixture`);
  render(<App />);
  const grid = within(screen.getByRole("region", { name: "Family weekly calendar" }));
  fireEvent.click(await grid.findByRole("button", { name: /Delete this plan/ }));
  expect(await screen.findByRole("button", { name: "Delete" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Remove event" })).not.toBeInTheDocument();
  if (features === 3) expect(screen.queryByRole("button", { name: "Save plan" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  const confirmation = screen.getByRole("alertdialog", { name: "Confirm event deletion" });
  expect(confirmation).toHaveTextContent("Delete this plan");
  expect(confirmation).toHaveTextContent("Family calendar and its source calendar");
  if (recurring) expect(confirmation).toHaveTextContent("only this occurrence");
  fireEvent.click(screen.getByRole("button", { name: "Keep event" }));
  expect(screen.queryByRole("alertdialog", { name: "Confirm event deletion" })).not.toBeInTheDocument();
  expect(conn.sendMessagePromise.mock.calls.filter(([message]) => message.type === "calendar/event/delete")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  const request = deferred<unknown>();
  conn.sendMessagePromise.mockReturnValueOnce(request.promise);
  fireEvent.click(screen.getByRole("button", { name: "Remove event" }));
  expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Keep event" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Deleting…" }));
  fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(conn.sendMessagePromise).toHaveBeenLastCalledWith({ type: "calendar/event/delete", entity_id: "calendar.house", uid: "event-uid", ...(recurring && { recurrence_id: "google-instance-1" }) });
  expect(conn.sendMessagePromise.mock.calls.filter(([message]) => message.type === "calendar/event/delete")).toHaveLength(1);
  events = [remaining];
  await act(async () => request.resolve({}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(await grid.findByRole("button", { name: /Keep this plan/ })).toBeInTheDocument();
  expect(grid.queryByRole("button", { name: /Delete this plan/ })).not.toBeInTheDocument();
  expect(ha.callService).not.toHaveBeenCalled();
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).events).toEqual([]);
});

it.each([
  { features: 4, uid: "event", recurrence_id: null, rrule: null },
  { features: 3, uid: null, recurrence_id: null, rrule: null },
  { features: 3, uid: "series", recurrence_id: null, rrule: "FREQ=WEEKLY" },
])("hides deletion without capability or safe occurrence identity: %j", async ({ features, ...identity }) => {
  setupWritableCalendars(features);
  const event = { ...identity, summary: "Keep this event", start: "2026-10-07", end: "2026-10-08" };
  vi.mocked(haFetch).mockImplementation(async input => ({ ok: true, json: async () => String(input).includes("calendar.house") ? [event] : [] }) as Response);
  window.history.replaceState(null, "", "/calendar?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Keep this event/ }));
  expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Remove event" })).not.toBeInTheDocument();
});

it("keeps failed deletions visible and blocks confirmation after disconnect or capability loss", async () => {
  const { household } = setupWritableCalendars(3);
  const event = { uid: "event", summary: "Still here", start: "2026-10-07", end: "2026-10-08" };
  vi.mocked(haFetch).mockImplementation(async input => ({ ok: true, json: async () => String(input).includes("calendar.house") ? [event] : [] }) as Response);
  window.history.replaceState(null, "", "/calendar?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Still here/ }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  conn.sendMessagePromise.mockRejectedValueOnce(new Error("Permission denied with private details"));
  fireEvent.click(screen.getByRole("button", { name: "Remove event" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("could not confirm the deletion");
  expect(screen.queryByText(/private details/)).not.toBeInTheDocument();
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  act(() => conn.emit("disconnected"));
  expect(screen.getByRole("button", { name: "Remove event" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Remove event" }));
  act(() => conn.emit("ready"));
  act(() => conn.entityCallback?.({ ...household }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Remove event" })).toBeEnabled());
  act(() => conn.entityCallback?.({ ...household, "calendar.house": state("calendar.house", "unavailable", { supported_features: 3 }) }));
  expect(screen.getByRole("button", { name: "Remove event" })).toBeDisabled();
  act(() => conn.entityCallback?.({ ...household, "calendar.house": state("calendar.house", "off", { supported_features: 1 }) }));
  expect(screen.getByRole("button", { name: "Remove event" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Remove event" }));
  fireEvent.click(screen.getByRole("button", { name: "Keep event" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(await screen.findByRole("button", { name: /Still here/ })).toBeInTheDocument();
  expect(conn.sendMessagePromise.mock.calls.filter(([message]) => message.type === "calendar/event/delete")).toHaveLength(1);
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).events).toEqual([]);
});

it.each(["/", "/calendar"])("shows continuous spans and unique person cards from %s", async path => {
  setupWritableCalendars(4);
  const events = [
    { uid: "trip", summary: "Family trip", start: "2026-10-06", end: "2026-10-16" },
    { uid: "train", summary: "Night train", start: "2026-10-07T20:00:00Z", end: "2026-10-08T06:00:00Z" },
    { uid: "midnight", summary: "Midnight finish", start: "2026-10-08T20:00:00Z", end: "2026-10-08T22:00:00Z" },
  ];
  vi.mocked(haFetch).mockImplementation(async input => ({ ok: true, json: async () => String(input).includes("calendar.house") ? events : [] }) as Response);
  window.history.replaceState(null, "", `${path}?auth_callback=1&code=fixture&state=fixture`);
  render(<App />);
  const grid = within(screen.getByRole("region", { name: "Family weekly calendar" }));
  const trip = await grid.findByRole("button", { name: /Family trip/ });
  const train = grid.getByRole("button", { name: /Night train/ });
  expect(trip.closest("td")).toHaveAttribute("colspan", "7");
  expect(trip).toHaveAccessibleName(/Tue 6 Oct – Thu 15 Oct/);
  expect(trip).toHaveClass("event-continues-before", "event-continues-after");
  expect(train.closest("td")).toHaveAttribute("colspan", "2");
  expect(train).toHaveTextContent("22:00 – Thu 8 Oct, 08:00");
  expect(train.closest("tr")).not.toBe(trip.closest("tr"));
  expect(grid.getByRole("button", { name: /Midnight finish/ }).closest("td")).toHaveAttribute("colspan", "1");
  expect(grid.queryAllByRole("button", { name: /Add a plan for Everyone/ })).toHaveLength(path === "/calendar" ? 7 : 0);
  expect(screen.getByRole("button", { name: path === "/" ? "Add a family plan" : "Add a plan" })).toBeEnabled();
  fireEvent.click(train);
  expect(await screen.findByLabelText("Date")).toHaveValue("2026-10-07");
  expect(screen.getByLabelText("Time")).toHaveValue("22:00:00");
  expect(screen.getByLabelText("End date")).toHaveValue("2026-10-08");
  expect(screen.getByLabelText("End time")).toHaveValue("08:00:00");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  if (path === "/calendar") {
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    const continuation = await grid.findByRole("button", { name: /Family trip/ });
    expect(continuation.closest("td")).toHaveAttribute("colspan", "2");
    expect(continuation).toHaveClass("event-continues-before");
    expect(continuation).not.toHaveClass("event-continues-after");
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    await grid.findByRole("button", { name: /Night train/ });
  }
  fireEvent.click(screen.getByRole("button", { name: "By person" }));
  expect(screen.getAllByRole("button", { name: /Family trip/ })).toHaveLength(1);
  expect(screen.getByText("Tue 6 Oct – Thu 15 Oct")).toBeVisible();
  expect(screen.getByText(/^3 plans/)).toBeInTheDocument();
  if (path === "/calendar") {
    fireEvent.click(screen.getByRole("button", { name: "Fri 09" }));
    expect(await screen.findByRole("button", { name: /Family trip/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Night train/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Midnight finish/ })).not.toBeInTheDocument();
  }
});

it.each(["/", "/calendar"])("edits a recurring HA event from %s and refreshes without a local duplicate", async path => {
  setupWritableCalendars(4);
  let event = { uid: "dinner-series", recurrence_id: "20261007T160000", rrule: "FREQ=WEEKLY", summary: "Family dinner", start: { dateTime: "2026-10-07T14:00:15Z" }, end: { dateTime: "2026-10-07T15:00:30Z" }, location: "Home", description: "Bring bread\nAnd cheese" };
  const subscriptions: ((message: { events: unknown }) => void)[] = [];
  conn.subscribeMessage.mockImplementation(async (receive, message) => {
    if (message.entity_id === "calendar.house") subscriptions.push(receive);
    queueMicrotask(() => receive({ events: message.entity_id === "calendar.house" ? [event] : [] }));
    return vi.fn(async () => {});
  });
  window.history.replaceState(null, "", `${path}?auth_callback=1&code=fixture&state=fixture`);
  render(<App />);
  const grid = within(screen.getByRole("region", { name: "Family weekly calendar" }));
  fireEvent.click(await grid.findByRole("button", { name: /Family dinner/ }));
  expect(await screen.findByLabelText("Time")).toHaveValue("16:00:15");
  expect(screen.getByLabelText("End time")).toHaveValue("17:00:30");
  expect(screen.getByLabelText("A little reminder")).toHaveValue("Bring bread\nAnd cheese");
  expect(screen.getByText("Only this occurrence will be changed.")).toBeInTheDocument();
  expect(screen.getByLabelText("Who’s going?")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("What’s happening?"), { target: { value: "Dinner outside" } });
  fireEvent.change(screen.getByLabelText("Where?"), { target: { value: "Garden" } });
  fireEvent.change(screen.getByLabelText("End time"), { target: { value: "15:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("end after the start");
  expect(conn.sendMessagePromise.mock.calls.filter(([message]) => message.type === "calendar/event/update")).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("End time"), { target: { value: "18:30" } });
  const request = deferred<unknown>();
  conn.sendMessagePromise.mockReturnValueOnce(request.promise);
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  fireEvent.submit(screen.getByLabelText("What’s happening?").closest("form")!);
  expect(conn.sendMessagePromise).toHaveBeenLastCalledWith({ type: "calendar/event/update", entity_id: "calendar.house", uid: "dinner-series", recurrence_id: "20261007T160000", event: {
    summary: "Dinner outside", dtstart: "2026-10-07T14:00:15.000Z", dtend: "2026-10-07T16:30:00.000Z", location: "Garden", description: "Bring bread\nAnd cheese",
  } });
  expect(conn.sendMessagePromise.mock.calls.filter(([message]) => message.type === "calendar/event/update")).toHaveLength(1);
  event = { ...event, summary: "Dinner outside", end: { dateTime: "2026-10-07T16:30:00Z" }, location: "Garden" };
  await act(async () => request.resolve({}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(await grid.findByRole("button", { name: /Dinner outside/ })).toBeInTheDocument();
  expect(subscriptions).toHaveLength(2);
  expect(ha.callService).not.toHaveBeenCalled();
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).events).toEqual([]);
});

it("edits an all-day continuation using the original start and an exclusive HA end date", async () => {
  setupWritableCalendars(4);
  const event = { uid: "trip", summary: "Family trip", start: { date: "2026-10-06" }, end: { date: "2026-10-09" } };
  vi.mocked(haFetch).mockImplementation(async input => ({ ok: true, json: async () => String(input).includes("calendar.house") ? [event] : [] }) as Response);
  window.history.replaceState(null, "", "/calendar?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Family trip/ }));
  expect(await screen.findByLabelText("Date")).toHaveValue("2026-10-06");
  expect(screen.getByLabelText("End date")).toHaveValue("2026-10-08");
  expect(screen.queryByLabelText("Time")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-10-10" } });
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(conn.sendMessagePromise).toHaveBeenLastCalledWith({ type: "calendar/event/update", entity_id: "calendar.house", uid: "trip", event: {
    summary: "Family trip", dtstart: "2026-10-06", dtend: "2026-10-11", location: "", description: "",
  } });
});

it.each([
  { features: 1, uid: "event", recurrence_id: null, rrule: null, reason: /does not support editing existing events/ },
  { features: 3, uid: "google-event", recurrence_id: null, rrule: null, reason: /does not support editing existing events/ },
  { features: 4, uid: null, recurrence_id: null, rrule: null, reason: /did not provide the event ID/ },
  { features: 4, uid: "series", recurrence_id: null, rrule: "FREQ=WEEKLY", reason: /did not identify this occurrence/ },
])("explains why an event cannot be edited: %j", async ({ features, reason, ...identity }) => {
  setupWritableCalendars(features);
  const event = { ...identity, summary: "Read-only plan", start: "2026-10-07T14:00:00Z", end: "2026-10-07T15:00:00Z" };
  vi.mocked(haFetch).mockImplementation(async input => ({ ok: true, json: async () => String(input).includes("calendar.house") ? [event] : [] }) as Response);
  window.history.replaceState(null, "", "/calendar?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Read-only plan/ }));
  expect(screen.getByText(reason)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save plan" })).not.toBeInTheDocument();
  expect(conn.sendMessagePromise.mock.calls.filter(([message]) => message.type === "calendar/event/update")).toHaveLength(0);
});

it("retains failed update drafts and prevents writes offline or to unavailable calendars", async () => {
  const { household } = setupWritableCalendars(4);
  const event = { uid: "visit", summary: "Family visit", start: "2026-10-07T14:00:00Z", end: "2026-10-07T15:00:00Z" };
  vi.mocked(haFetch).mockImplementation(async input => ({ ok: true, json: async () => String(input).includes("calendar.house") ? [event] : [] }) as Response);
  window.history.replaceState(null, "", "/calendar?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Family visit/ }));
  fireEvent.change(await screen.findByLabelText("What’s happening?"), { target: { value: "Keep my edits" } });
  conn.sendMessagePromise.mockRejectedValueOnce(new Error("Permission denied with private details"));
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("could not confirm the update");
  expect(screen.getByLabelText("What’s happening?")).toHaveValue("Keep my edits");
  expect(screen.queryByText(/private details/)).not.toBeInTheDocument();
  act(() => conn.emit("disconnected"));
  expect(screen.getByRole("button", { name: "Save plan" })).toBeDisabled();
  fireEvent.submit(screen.getByLabelText("What’s happening?").closest("form")!);
  act(() => conn.emit("ready"));
  act(() => conn.entityCallback?.({ ...household, "calendar.house": state("calendar.house", "unavailable", { supported_features: 4 }) }));
  expect(screen.getByRole("button", { name: "Save plan" })).toBeDisabled();
  fireEvent.submit(screen.getByLabelText("What’s happening?").closest("form")!);
  expect(conn.sendMessagePromise.mock.calls.filter(([message]) => message.type === "calendar/event/update")).toHaveLength(1);
  expect(ha.callService).not.toHaveBeenCalled();
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).events).toEqual([]);
});

it.each(["/", "/calendar"])("saves new plans from %s to the selected HA calendar without a local duplicate", async path => {
  setupWritableCalendars();
  window.history.replaceState(null, "", `${path}?auth_callback=1&code=fixture&state=fixture`);
  render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh calendars" })).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: path === "/" ? "Add a family plan" : "Add a plan" }));
  fireEvent.change(await screen.findByLabelText("What’s happening?"), { target: { value: "Evening walk" } });
  const select = screen.getByRole("combobox", { name: "Calendar" });
  expect(select).toHaveValue("");
  expect(screen.getByRole("button", { name: "Save plan" })).toBeDisabled();
  expect(within(select).getByRole("option", { name: /Holidays/ })).toBeDisabled();
  fireEvent.change(select, { target: { value: "home|calendar.work" } });
  fireEvent.change(screen.getByLabelText("Where?"), { target: { value: "Park" } });
  fireEvent.change(screen.getByLabelText("A little reminder"), { target: { value: "Bring cocoa" } });
  fireEvent.change(screen.getByLabelText("End time"), { target: { value: "15:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("end after the start");
  expect(ha.callService).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("End time"), { target: { value: "17:00" } });
  const request = deferred<unknown>();
  vi.mocked(ha.callService).mockReturnValueOnce(request.promise);
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  fireEvent.submit(screen.getByLabelText("What’s happening?").closest("form")!);
  expect(ha.callService).toHaveBeenCalledExactlyOnceWith(conn, "calendar", "create_event", {
    summary: "Evening walk", start_date_time: "2026-10-07T16:00:00", end_date_time: "2026-10-07T17:00:00", location: "Park", description: "Bring cocoa",
  }, { entity_id: "calendar.work" });
  vi.mocked(haFetch).mockImplementation(async input => ({ ok: true, json: async () => String(input).includes("calendar.work") ? [{ summary: "Evening walk", start: "2026-10-07T14:00:00Z", end: "2026-10-07T15:00:00Z", location: "Park", description: "Bring cocoa" }] : [] }) as Response);
  await act(async () => request.resolve({}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const grid = within(screen.getByRole("region", { name: "Family weekly calendar" }));
  expect(await grid.findAllByRole("button", { name: /Evening walk/ })).toHaveLength(1);
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).events).toEqual([]);
});

it("preserves a failed calendar draft and blocks writes offline or without a writable calendar", async () => {
  const { household } = setupWritableCalendars();
  window.history.replaceState(null, "", "/calendar?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh calendars" })).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "Add a plan for Morgan on Thu 8 Oct" }));
  expect(await screen.findByLabelText("Date")).toHaveValue("2026-10-08");
  expect(screen.getByLabelText("End date")).toHaveValue("2026-10-08");
  expect(screen.getByRole("combobox", { name: "Calendar" })).toHaveValue("home|calendar.morgan");
  fireEvent.change(screen.getByLabelText("What’s happening?"), { target: { value: "Keep this draft" } });
  vi.mocked(ha.callService).mockRejectedValueOnce(new Error("Permission denied with private details"));
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Check the calendar before trying again");
  expect(screen.getByLabelText("What’s happening?")).toHaveValue("Keep this draft");
  expect(screen.queryByText(/private details/)).not.toBeInTheDocument();
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).events).toEqual([]);
  act(() => conn.emit("disconnected"));
  expect(screen.getByRole("button", { name: "Save plan" })).toBeDisabled();
  act(() => conn.emit("ready"));
  act(() => conn.entityCallback?.({ ...household, "calendar.morgan": state("calendar.morgan", "off", { supported_features: 0 }) }));
  expect(await screen.findByText(/No writable calendar is available for Morgan/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save plan" })).toBeDisabled();
  fireEvent.submit(screen.getByLabelText("What’s happening?").closest("form")!);
  expect(ha.callService).toHaveBeenCalledOnce();
});

it("updates calendar plans from the WebSocket stream and replaces subscriptions across navigation and reconnect", async () => {
  setupWritableCalendars();
  const subscriptions: { id: string; receive: (message: { events: unknown }) => void; unsubscribe: typeof haFetch }[] = [];
  conn.subscribeMessage.mockImplementation(async (receive, message) => {
    const unsubscribe = vi.fn(async () => {});
    subscriptions.push({ id: message.entity_id, receive, unsubscribe });
    queueMicrotask(() => receive({ events: [] }));
    return unsubscribe;
  });
  window.history.replaceState(null, "", "/calendar?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  await waitFor(() => expect(subscriptions).toHaveLength(4));
  expect(conn.subscribeMessage).toHaveBeenCalledWith(expect.any(Function), { type: "calendar/event/subscribe", entity_id: "calendar.house", start: "2026-10-06T22:00:00.000Z", end: "2026-10-13T22:00:00.000Z" }, { resubscribe: false });
  const house = subscriptions.find(s => s.id === "calendar.house")!;
  const event = { summary: "Created in Home Assistant", start: "2026-10-07T14:00:00+02:00", end: "2026-10-07T15:00:00+02:00" };
  act(() => house.receive({ events: [event] }));
  expect(screen.getByRole("button", { name: /Created in Home Assistant/ })).toBeInTheDocument();
  act(() => house.receive({ events: [{ ...event, summary: "Updated in Google" }] }));
  expect(screen.queryByRole("button", { name: /Created in Home Assistant/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Updated in Google/ })).toBeInTheDocument();
  act(() => house.receive({ events: [] }));
  expect(screen.queryByRole("button", { name: /Updated in Google/ })).not.toBeInTheDocument();
  act(() => house.receive({ events: [{ summary: "Invalid event", start: 123 }] }));
  expect(screen.getByRole("alert")).toHaveTextContent("Could not read calendar.house");
  act(() => house.receive({ events: [event] }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next week" }));
  expect(house.unsubscribe).toHaveBeenCalledOnce();
  act(() => house.receive({ events: [event] }));
  expect(screen.queryByRole("button", { name: /Created in Home Assistant/ })).not.toBeInTheDocument();
  await waitFor(() => expect(subscriptions).toHaveLength(8));
  act(() => conn.emit("disconnected"));
  expect(subscriptions.slice(4).every(s => s.unsubscribe.mock.calls.length === 1)).toBe(true);
  act(() => conn.emit("ready"));
  act(() => conn.entityCallback?.({ ...states, "calendar.house": state("calendar.house", "off") }));
  await waitFor(() => expect(subscriptions).toHaveLength(9));
  expect(haFetch).not.toHaveBeenCalled();
  view.unmount();
  expect(subscriptions[8].unsubscribe).toHaveBeenCalledOnce();
});

it("cleans up a calendar subscription acknowledged after its range was closed", async () => {
  const client = await connectedClient();
  const pending = deferred<() => Promise<void>>();
  conn.subscribeMessage.mockReturnValueOnce(pending.promise);
  const controller = new AbortController(), receive = vi.fn(), unsubscribe = vi.fn(async () => {});
  client.watchCalendarEvents("calendar.house", "2026-10-07T00:00:00Z", "2026-10-08T00:00:00Z", controller.signal, receive);
  controller.abort();
  await act(async () => pending.resolve(unsubscribe));
  conn.subscribeMessage.mock.calls[0][0]({ events: [] });
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(receive).not.toHaveBeenCalled();
});

it("refreshes older HA calendars after state changes and polls changes that leave entity state unchanged", async () => {
  const client = await connectedClient();
  vi.useFakeTimers();
  const event = { summary: "Google event", start: "2026-10-07T14:00:00Z", end: "2026-10-07T15:00:00Z" };
  setHaFetch(vi.fn().mockResolvedValue({ ok: true, json: async () => [event] }));
  const controller = new AbortController(), receive = vi.fn();
  client.watchCalendarEvents("calendar.house", "2026-10-07T00:00:00Z", "2026-10-08T00:00:00Z", controller.signal, receive);
  await act(async () => {});
  expect(receive).toHaveBeenLastCalledWith([event]);
  act(() => conn.entityCallback?.({ ...states, "calendar.house": state("calendar.house", "off") }));
  await act(async () => {});
  expect(haFetch).toHaveBeenCalledTimes(2);
  await act(async () => vi.advanceTimersByTimeAsync(60000));
  expect(haFetch).toHaveBeenCalledTimes(3);
  controller.abort();
  await act(async () => vi.advanceTimersByTimeAsync(60000));
  expect(haFetch).toHaveBeenCalledTimes(3);
});

it("rejects malformed calendar dates instead of crashing the planner", async () => {
  const client = await connectedClient();
  setHaFetch(vi.fn().mockResolvedValue({ ok: true, json: async () => [{ summary: "Broken", start: 123, end: "no date" }] }));
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
  seedSettings({ memberOrder: ["home|person.morgan"] });
  client.dispose();
  sessionStorage.clear();
  conn = new FakeConnection();
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  const restored = newClient();
  restored.start();
  await waitFor(() => expect(restored.getSnapshot().status).toBe("connected"));
  expect(restored.getSnapshot().states).toEqual(states);
  expect(restored.getSnapshot().commands).toEqual({});
  expect(ha.callService).toHaveBeenCalledOnce();
  expect(serverConfig.settings.memberOrder).toEqual(["home|person.morgan"]);
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
  window.history.replaceState(null, "", "/?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  await screen.findByRole("switch", { name: "Toggle Living Room Light" });
  fireEvent.click(screen.getByRole("button", { name: "Customize" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  await confirmAction("Remove favorites");
  fireEvent.change(screen.getByRole("textbox", { name: "Search favorites" }), { target: { value: "Living Room" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Living Room Light" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Search favorites" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Power" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Evening" }));
  fireEvent.click(screen.getByRole("button", { name: "Save favorites" }));
  const favorites = () => within(screen.getByRole("region", { name: "Home favorites" }));
  expect(favorites().getAllByRole("article")).toHaveLength(2);
  expect(favorites().getByRole("button", { name: "Activate Evening" })).toBeInTheDocument();
  const saved = JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!);
  expect(saved.homeEntities).toEqual(["home|stable-light", "home|stable-sensor", "home|scene.evening"]);
  fireEvent.click(screen.getByRole("button", { name: "Customize" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  await confirmAction("Remove favorites");
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
  await confirmAction("Remove favorites");
  fireEvent.click(screen.getByRole("button", { name: "Save favorites" }));
  expect(favorites().queryByRole("article")).not.toBeInTheDocument();
  expect(favorites().queryByRole("button", { name: "Activate Evening" })).not.toBeInTheDocument();
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).homeEntities).toEqual([]);
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).events).toEqual(saved.events);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Smart home" }));
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Today" }));
  expect(favorites().queryByRole("article")).not.toBeInTheDocument();
  expect(ha.callService).not.toHaveBeenCalled();
});

it("offers temperature, mode and blind controls without duplicating raw state labels", async () => {
  window.history.replaceState(null, "", "/home?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  const target = await screen.findByRole("slider", { name: "Living target" });
  await waitFor(() => expect(target).not.toHaveAttribute("data-disabled"));
  fireEvent.keyDown(target, { key: "ArrowRight" });
  await waitFor(() => expect(ha.callService).toHaveBeenCalledWith(conn, "climate", "set_temperature", { temperature: 21.5 }, { entity_id: "climate.living" }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Living mode" })).toBeEnabled());
  fireEvent.change(screen.getByRole("combobox", { name: "Living mode" }), { target: { value: "off" } });
  await confirmAction("Confirm");
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
  fireEvent.click(screen.getByRole("button", { name: "Activate scene" }));
  const sceneController = scene.closest(".command-controller")!;
  expect(sceneController).toHaveAttribute("aria-busy", "true");
  expect(within(sceneController as HTMLElement).getByRole("status", { hidden: true }).querySelector(".animate-spin")).toBeInTheDocument();
  expect(scene).toBeDisabled();
  await act(async () => rejected.reject(new Error("HA rejection")));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(within(sceneController as HTMLElement).getByRole("alert")).toHaveTextContent("Home Assistant rejected");
  expect(within(sceneController as HTMLElement).queryByRole("status")).not.toBeInTheDocument();
  expect(sceneController).toHaveAttribute("aria-busy", "false");
  expect(scene).toBeEnabled();
});

it("assigns HA calendars to real people in both views, persists setup, without local event storage", async () => {
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
  setHaFetch(fetchMock);
  seedSettings({ events: [{ id: "legacy", title: "Local library visit", date: "2026-10-08", time: "16:00", member: "home|person.riley", location: "", note: "" }], items: [], timetables: {} });
  window.history.replaceState(null, "", "/settings?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  const assignment = within(await screen.findByRole("group", { name: "Morgan" })).getByRole("combobox", { name: "Add calendar for Morgan" });
  await waitFor(() => expect(assignment).not.toBeDisabled());
  expect(assignment).toHaveValue("");
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.change(assignment, { target: { value: "home|calendar.morgan" } });
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Our week" }));
  expect(await screen.findByRole("button", { name: /15:00 – 16:00 Dentist appointment/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Weekly grid" })).toHaveAttribute("aria-pressed", "true");
  const row = (name: string) => within(screen.getByRole("rowheader", { name }).closest("tr")!);
  expect(row("Morgan").getByRole("button", { name: /Dentist appointment/ })).toBeInTheDocument();
  expect(row("Riley").queryByRole("button", { name: /Dentist appointment/ })).not.toBeInTheDocument();
  expect(row("Riley").queryByRole("button", { name: /Local library visit/ })).not.toBeInTheDocument();
  expect(JSON.stringify(serverConfig)).not.toMatch(/Local library visit|Dentist appointment/);
  view.unmount();
  conn = new FakeConnection();
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  const restored = render(<App />);
  expect(await within(await screen.findByRole("table")).findByRole("button", { name: /Dentist appointment/ })).toBeInTheDocument();
  expect(serverConfig.settings.calendarMembers).toEqual({ "home|calendar.morgan": "home|person.morgan" });

});

it("selects multiple calendars per person, moves and clears assignments, and restores the saved selections", async () => {
  const instance = "http://ha.local:8123";
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
  seedSettings({ events: [], items: [], timetables: {}, calendarMembers: {
    [`home|calendar.personal`]: `home|person.morgan`, [`home|calendar.shared`]: "everyone",
  } });
  window.history.replaceState(null, "", "/settings?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  await screen.findByRole("group", { name: "Morgan" });
  const selected = (person: string, calendar: string) => within(screen.getByRole("group", { name: person })).getByRole("button", { name: `Remove ${calendar} from ${person}` });
  const dropdown = (person: string) => screen.getByRole("combobox", { name: `Add calendar for ${person}` });
  const add = (person: string, calendar: string) => fireEvent.change(dropdown(person), { target: { value: `home|calendar.${calendar}` } });
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
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).calendarMembers[`home|calendar.personal`]).toBe(`home|person.morgan`);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(selected("Morgan", "Personal")).toBeInTheDocument();
  add("Riley", "personal");
  await confirmAction("Move calendar");
  expect(selected("Riley", "Personal")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Remove Personal from Morgan" })).not.toBeInTheDocument();
  fireEvent.click(selected("Riley", "Personal"));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(selected("Riley", "Personal")).toBeInTheDocument();
  fireEvent.click(selected("Riley", "Personal"));
  await confirmAction("Unlink calendar");
  expect(savedSettings().calendarMembers[`home|calendar.personal`]).toBeUndefined();
  expect(within(dropdown("Riley")).getByRole("option", { name: "Personal" })).toBeInTheDocument();
  add("Everyone", "personal");
  add("Everyone", "work");
  await confirmAction("Move calendar");
  expect(dropdown("Everyone")).toBeDisabled();
  expect(within(dropdown("Everyone")).getByRole("option", { name: "All calendars selected" })).toBeInTheDocument();
  add("Morgan", "work");
  await confirmAction("Move calendar");
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
  setHaFetch(vi.fn(async (url: string) => url.includes("calendar.denied") ? { ok: false, status: 403 } : { ok: true, json: async () => [{ summary: "Shared day", start: "2026-10-07", end: "2026-10-08" }] }));
  seedSettings({ events: [], items: [], timetables: {}, calendarMembers: { "home|calendar.good": "everyone", "home|calendar.denied": "everyone" } });
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
  const household = { ...states, "person.morgan": state("person.morgan", "home", { friendly_name: "Morgan" }),
    ...Object.fromEntries(["family", "personal", "daily", "routine", "shopping"].map(id => [`todo.${id}`, state(`todo.${id}`, "0", { friendly_name: id })])),
  };
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    (connection as unknown as FakeConnection).entityCallback = callback;
    queueMicrotask(() => callback(household));
    return conn.unsubscribeEntities;
  });
  window.history.replaceState(null, "", "/settings?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  const select = (name: string) => screen.getByRole("combobox", { name });
  await waitFor(() => expect(select("Tasks for Morgan")).toBeEnabled());
  const choose = async (name: string, list: string) => { await act(async () => fireEvent.change(select(name), { target: { value: list ? `home|todo.${list}` : "" } })); };
  await choose("Tasks for Everyone", "family");
  await choose("Tasks for Morgan", "personal");
  await choose("Daily tasks for Everyone", "daily");
  await choose("Daily tasks for Morgan", "routine");
  await choose("Shared shopping list for Everyone", "shopping");
  expect(savedSettings().todoLists).toEqual({
    [`home|todo.family`]: { kind: "tasks", member: "everyone" },
    [`home|todo.personal`]: { kind: "tasks", member: `home|person.morgan` },
    [`home|todo.daily`]: { kind: "daily", member: "everyone" },
    [`home|todo.routine`]: { kind: "daily", member: `home|person.morgan` },
    [`home|todo.shopping`]: { kind: "shopping", member: "everyone" },
  });
  await choose("Tasks for Morgan", "family");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(select("Tasks for Everyone")).toHaveValue(`home|todo.family`);
  expect(select("Tasks for Morgan")).toHaveValue(`home|todo.personal`);
  await choose("Tasks for Morgan", "family");
  await confirmAction("Change list");
  expect(select("Tasks for Everyone")).toHaveValue("");
  expect(savedSettings().todoLists[`home|todo.personal`]).toBeUndefined();
  await choose("Tasks for Morgan", "");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(select("Tasks for Morgan")).toHaveValue(`home|todo.family`);
  await choose("Tasks for Morgan", "");
  act(() => conn.emit("disconnected"));
  expect(screen.getByRole("button", { name: "Unlink list" })).toBeDisabled();
  act(() => conn.emit("ready"));
  act(() => conn.entityCallback?.({ ...household }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Unlink list" })).toBeEnabled());
  await confirmAction("Unlink list");
  expect(savedSettings().todoLists[`home|todo.family`]).toBeUndefined();
  await choose("Tasks for Everyone", "family");
  view.unmount();
  conn = new FakeConnection();
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  const restored = render(<App />);
  await waitFor(() => expect(select("Tasks for Everyone")).toBeEnabled());
  expect(select("Daily tasks for Morgan")).toHaveValue(`home|todo.routine`);
  expect(select("Shared shopping list for Everyone")).toHaveValue(`home|todo.shopping`);
  act(() => conn.emit("disconnected"));
  expect(select("Tasks for Everyone")).toBeDisabled();
  restored.unmount();
  render(<App />);
  await waitFor(() => expect(select("Tasks for Everyone")).toHaveValue("home|todo.family"));
  expect(select("Shared shopping list for Everyone")).toHaveValue("home|todo.shopping");
});

it("uses saved people order for connected lists and retains missing people across screens", async () => {
  const instance = "http://ha.local:8123";
  const personId = (name: string) => `home|person.${name}`;
  const household = { ...states,
    "person.morgan": state("person.morgan", "home", { friendly_name: "Morgan" }),
    "person.riley": state("person.riley", "home", { friendly_name: "Riley" }),
  };
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    (connection as unknown as FakeConnection).entityCallback = callback;
    queueMicrotask(() => callback(household));
    return conn.unsubscribeEntities;
  });
  const todoLists = Object.fromEntries(["daily", "tasks"].flatMap(kind => ["morgan", "everyone", "riley"].map(name => [
    `home|todo.${name}_${kind}`, { kind, member: name === "everyone" ? name : personId(name) },
  ])));
  seedSettings({ events: [], items: [], timetables: {}, todoLists });
  window.history.replaceState(null, "", "/settings?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Move Riley up" }));
  const order = () => JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).memberOrder;
  expect(order()).toEqual([personId("riley"), personId("morgan")]);
  const nav = (name: string) => fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name }));
  const listOrder = (kind: string) => screen.getAllByRole("group", { name: new RegExp(` ${kind}$`) }).map(group => group.getAttribute("aria-label"));
  nav("Today");
  await screen.findByRole("heading", { level: 1, name: "Good to be home." });
  expect(screen.getAllByRole("rowheader").map(row => row.textContent)).toEqual(["AllEveryone", "RRiley", "MMorgan"]);
  expect(listOrder("daily tasks")).toEqual(["Everyone daily tasks", "Riley daily tasks", "Morgan daily tasks"]);
  nav("Lists");
  fireEvent.click(await screen.findByRole("button", { name: /Daily rhythm/ }));
  expect(listOrder("daily tasks")).toEqual(["Everyone daily tasks", "Riley daily tasks", "Morgan daily tasks"]);
  fireEvent.click(screen.getByRole("button", { name: /Family tasks/ }));
  expect(listOrder("tasks")).toEqual(["Everyone tasks", "Riley tasks", "Morgan tasks"]);
  act(() => conn.entityCallback?.({ ...states, "person.morgan": household["person.morgan"] }));
  expect(listOrder("tasks")).toEqual(["Everyone tasks", "Person unavailable tasks", "Morgan tasks"]);
  const newPerson = { "person.alex": state("person.alex", "home", { friendly_name: "Alex" }) };
  act(() => conn.entityCallback?.({ ...newPerson, ...household }));
  nav("Our week");
  await screen.findByRole("heading", { level: 1, name: "Our week." });
  expect(screen.getAllByRole("rowheader").map(row => row.textContent)).toEqual(["AllEveryone", "RRiley", "MMorgan", "AAlex"]);
  expect(order()).toEqual([personId("riley"), personId("morgan")]);
  view.unmount();
  conn = new FakeConnection();
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  const restored = render(<App />);
  await screen.findByRole("rowheader", { name: "Riley" });
  expect(screen.getAllByRole("rowheader").map(row => row.textContent)).toEqual(["AllEveryone", "RRiley", "MMorgan"]);
  restored.unmount();
  render(<App />);
  expect(serverConfig.settings.memberOrder).toEqual([personId("riley"), personId("morgan")]);
  expect(order()).toEqual([personId("riley"), personId("morgan")]);
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).todoLists).toEqual(todoLists);
  expect(ha.callService).not.toHaveBeenCalled();
});

it("hides connected people and their plans and lists without losing assignments", async () => {
  const { household } = setupWritableCalendars();
  const morgan = "home|person.morgan";
  const planner = { ...JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!),
    events: [],
    todoLists: { "home|todo.morgan": { kind: "daily", member: morgan }, "home|todo.shared": { kind: "daily", member: "everyone" } },
  };
  seedSettings(planner);
  vi.mocked(haFetch).mockImplementation(async input => ({ ok: true, json: async () => String(input).includes("calendar.morgan") ? [
    { uid: "remote", summary: "Morgan remote plan", start: "2026-10-07T13:00:00Z", end: "2026-10-07T14:00:00Z" },
  ] : [] }) as Response);
  window.history.replaceState(null, "", "/calendar?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  expect(await screen.findByText("Morgan remote plan")).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("button", { name: "Open app settings" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: "Home settings" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show Morgan in family planner" }));
  expect(screen.getByRole("button", { name: "Remove Morgan calendar from Morgan" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Daily tasks for Morgan" })).toHaveValue("home|todo.morgan");
  const nav = (name: string) => fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name }));
  nav("Today");
  expect(screen.getAllByRole("rowheader").map(row => row.textContent)).toEqual(["AllEveryone"]);
  expect(screen.queryByText("Morgan remote plan")).not.toBeInTheDocument();
  expect(screen.queryByText("Morgan local plan")).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Morgan daily tasks" })).not.toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Everyone daily tasks" })).toBeInTheDocument();
  expect(screen.queryByText(/select calendars under each person/)).not.toBeInTheDocument();
  act(() => conn.entityCallback?.(states));
  expect(screen.queryByRole("rowheader", { name: "Person unavailable" })).not.toBeInTheDocument();
  act(() => conn.entityCallback?.(household));
  nav("Lists");
  fireEvent.click(screen.getByRole("button", { name: /Daily rhythm/ }));
  expect(screen.queryByRole("group", { name: "Morgan daily tasks" })).not.toBeInTheDocument();
  view.unmount();
  conn = new FakeConnection();
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  window.history.replaceState(null, "", "/settings");
  const restored = render(<App />);
  expect(await screen.findByRole("switch", { name: "Show Morgan in family planner" })).not.toBeChecked();
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!)).toMatchObject({ ...planner, hiddenMembers: [morgan] });
  fireEvent.click(screen.getByRole("switch", { name: "Show Morgan in family planner" }));
  nav("Our week");
  expect(await screen.findByText("Morgan remote plan")).toBeInTheDocument();
  expect(screen.queryByText("Morgan local plan")).not.toBeInTheDocument();
  nav("Lists");
  fireEvent.click(screen.getByRole("button", { name: /Daily rhythm/ }));
  expect(screen.getByRole("group", { name: "Morgan daily tasks" })).toBeInTheDocument();
  restored.unmount();
  render(<App />);
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).hiddenMembers).toEqual([]);
  expect(ha.callService).not.toHaveBeenCalled();
});

it("remembers timetable toggles across school, dashboard and reload without losing saved images", async () => {
  const instance = "http://ha.local:8123";
  const riley = `home|person.riley`;
  const household = { ...states,
    "person.morgan": state("person.morgan", "home", { friendly_name: "Morgan" }),
    "person.riley": state("person.riley", "home", { friendly_name: "Riley" }),
  };
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    (connection as unknown as FakeConnection).entityCallback = callback;
    queueMicrotask(() => callback(household));
    return conn.unsubscribeEntities;
  });
  const timetables = { [riley]: ["https://school.example/riley.png"] };
  const migratedTimetables = timetables;
  seedSettings({ events: [], items: [], timetables });
  window.history.replaceState(null, "", "/settings?auth_callback=1&code=fixture&state=fixture");
  const view = render(<App />);
  expect(await screen.findByRole("switch", { name: "Timetable for Riley" })).toBeChecked();
  expect(screen.getByRole("switch", { name: "Timetable for Morgan" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("switch", { name: "Timetable for Riley" }));
  if (screen.queryByRole("alertdialog")) await confirmAction("Hide timetable");
  const nav = (name: string) => fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name }));
  nav("School");
  expect(screen.getByText(/No timetables enabled/)).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /’s school week/ })).not.toBeInTheDocument();
  nav("Today");
  expect(screen.queryByRole("button", { name: /Enlarge .* timetable/ })).not.toBeInTheDocument();
  expect(screen.getByRole("rowheader", { name: "Riley" })).toBeInTheDocument();
  view.unmount();
  conn = new FakeConnection();
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  window.history.replaceState(null, "", "/settings");
  const restored = render(<App />);
  expect(await screen.findByRole("switch", { name: "Timetable for Riley" })).not.toBeChecked();
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).timetables).toEqual(migratedTimetables);
  fireEvent.click(screen.getByRole("switch", { name: "Timetable for Riley" }));
  if (screen.queryByRole("alertdialog")) await confirmAction("Hide timetable");
  fireEvent.click(screen.getByRole("switch", { name: "Timetable for Morgan" }));
  fireEvent.click(screen.getByRole("button", { name: "Move Riley up" }));
  nav("School");
  expect(screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent)).toEqual(["Riley’s school week", "Morgan’s school week"]);
  expect(screen.getByRole("img", { name: "Riley’s school timetable" })).toHaveAttribute("src", timetables[riley][0]);
  expect(screen.getByRole("button", { name: "Add timetable images" })).toBeInTheDocument();
  nav("Today");
  expect(screen.getAllByRole("button", { name: /Enlarge .* timetable/ }).map(button => button.getAttribute("aria-label"))).toEqual(["Enlarge Riley’s timetable", "Enlarge Morgan’s timetable"]);
  await waitFor(() => expect(screen.getByRole("status", { name: "Settings storage" })).toHaveTextContent("Shared settings saved."));
  restored.unmount();
  render(<App />);
  await waitFor(() => expect(serverConfig.settings.timetableEnabled).toEqual({ [riley]: true, "home|person.morgan": true }));
  expect(JSON.parse(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })!).timetables).toEqual(migratedTimetables);
  expect(ha.callService).not.toHaveBeenCalled();
});

it("reads and edits assigned HA lists in the dashboard and Lists without storing remote items", async () => {
  const instance = "http://ha.local:8123";
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
    const value = data as { item: string; status?: string; rename?: string };
    if (service === "add_item") lists[id].push({ uid: "new-item", summary: value.item, status: "needs_action" });
    if (service === "update_item") lists[id] = lists[id].map(item => item.uid === value.item ? { ...item, status: value.status ?? item.status, summary: value.rename ?? item.summary } : item);
    if (service === "remove_item") lists[id] = lists[id].filter(item => item.uid !== value.item);
    return {};
  });
  seedSettings({ events: [], items: [], timetables: {}, todoLists: {
    [`home|todo.family`]: { kind: "tasks", member: "everyone" },
    [`home|todo.personal`]: { kind: "tasks", member: `home|person.morgan` },
    [`home|todo.daily`]: { kind: "daily", member: `home|person.morgan` },
    [`home|todo.shopping`]: { kind: "shopping", member: "everyone" },
  } });
  window.history.replaceState(null, "", "/?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  const daily = within(await screen.findByRole("group", { name: "Morgan daily tasks" }));
  fireEvent.click(await daily.findByText("Completed (1)"));
  expect(daily.getByRole("checkbox", { name: "Pack bag" })).toBeChecked();
  expect(await screen.findByRole("checkbox", { name: "Milk" })).not.toBeChecked();
  expect(ha.callService).not.toHaveBeenCalled(); // Viewing a daily list never resets HA completion.
  fireEvent.click(daily.getByRole("button", { name: "Edit Pack bag" }));
  expect(within(screen.getByRole("dialog")).getByRole("textbox")).toHaveValue("Pack bag");
  expect(ha.callService).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(ha.callService).not.toHaveBeenCalled();
  fireEvent.click(daily.getByRole("button", { name: "Edit Pack bag" }));
  fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "Pack lunch" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(await daily.findByText("Completed (1)"));
  expect(daily.getByRole("checkbox", { name: "Pack lunch" })).toBeChecked();
  expect(ha.callService).toHaveBeenLastCalledWith(conn, "todo", "update_item", { item: "daily", rename: "Pack lunch" }, { entity_id: "todo.daily" });
  const milk = screen.getByRole("checkbox", { name: "Milk" });
  const rejectedCompletion = deferred<unknown>();
  vi.mocked(ha.callService).mockReturnValueOnce(rejectedCompletion.promise);
  fireEvent.click(milk);
  expect(milk).toBeDisabled();
  expect(milk).not.toBeChecked();
  expect(milk.closest(".check-row")).not.toHaveClass("completing");
  await act(async () => rejectedCompletion.reject(new Error("Permission denied")));
  expect(milk).toBeEnabled();
  expect(milk).not.toBeChecked();
  expect(milk.closest(".check-row")).not.toHaveClass("completing");
  const refreshedItems = deferred<{ items: typeof lists["todo.shopping"] }>();
  const readItems = conn.sendMessagePromise.getMockImplementation()!;
  conn.sendMessagePromise.mockImplementationOnce(() => refreshedItems.promise);
  fireEvent.click(milk);
  await screen.findByText("Refreshing list…");
  expect(screen.queryByText("Loading to-do items…")).not.toBeInTheDocument();
  expect(milk).toBeInTheDocument();
  expect(milk).toBeDisabled();
  expect(milk).not.toBeChecked();
  await act(async () => refreshedItems.resolve({ items: lists["todo.shopping"].map(item => ({ ...item })) }));
  conn.sendMessagePromise.mockImplementation(readItems);
  expect(milk).toBeChecked();
  expect(milk.closest(".check-row")).toHaveClass("completing");
  await waitFor(() => expect(milk).not.toBeInTheDocument());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const shopping = within(screen.getByRole("group", { name: "Everyone shopping" }));
  await shopping.findByText("Completed (1)");
  expect(shopping.getByRole("checkbox", { name: "Milk" })).not.toBeVisible();
  fireEvent.click(shopping.getByText("Completed (1)"));
  expect(shopping.getByRole("checkbox", { name: "Milk" })).toBeChecked();
  expect(ha.callService).toHaveBeenCalledWith(conn, "todo", "update_item", { item: "milk", status: "completed" }, { entity_id: "todo.shopping" });
  fireEvent.click(shopping.getByRole("button", { name: "Add item" }));
  const shoppingInput = shopping.getByRole("textbox", { name: "New item in shopping" });
  expect(shoppingInput).toHaveFocus();
  expect(shopping.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-controls", shoppingInput.closest("form")!.id);
  expect(shopping.getByRole("button", { name: "Save item to shopping" })).toBeDisabled();
  fireEvent.change(shoppingInput, { target: { value: "Keep this item" } });
  fireEvent.click(shopping.getByRole("button", { name: "Cancel" }));
  expect(shopping.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(shopping.getByRole("button", { name: "Add item" }));
  expect(shopping.getByRole("textbox", { name: "New item in shopping" })).toHaveValue("Keep this item");
  const reopenedShoppingInput = shopping.getByRole("textbox", { name: "New item in shopping" });
  fireEvent.change(reopenedShoppingInput, { target: { value: "mi" } });
  const suggestion = within(shopping.getByRole("group", { name: "Existing items" })).getByRole("button", { name: "Milk" });
  fireEvent.click(suggestion);
  expect(suggestion).toHaveAttribute("aria-busy", "true");
  expect(suggestion).toBeDisabled();
  await waitFor(() => expect(shopping.getByRole("checkbox", { name: "Milk" })).not.toBeChecked());
  expect(shopping.queryByRole("textbox")).not.toBeInTheDocument();
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
  fireEvent.click(shared.getByRole("button", { name: "Edit Book holiday" }));
  fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "Plan holiday" } });
  const saving = deferred<unknown>();
  vi.mocked(ha.callService).mockReturnValueOnce(saving.promise);
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await act(async () => saving.reject(new Error("Permission denied")));
  expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("Home Assistant rejected");
  expect(within(screen.getByRole("dialog")).getByRole("textbox")).toHaveValue("Plan holiday");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(await shared.findByRole("checkbox", { name: "Plan holiday" })).not.toBeChecked();
  expect(ha.callService).toHaveBeenLastCalledWith(conn, "todo", "update_item", { item: "shared", rename: "Plan holiday" }, { entity_id: "todo.family" });
  fireEvent.click(shared.getByRole("button", { name: "Add task" }));
  fireEvent.change(shared.getByRole("textbox", { name: "New item in family" }), { target: { value: "Fix bike" } });
  const failedAdd = deferred<unknown>();
  vi.mocked(ha.callService).mockReturnValueOnce(failedAdd.promise);
  fireEvent.click(shared.getByRole("button", { name: "Save item to family" }));
  expect(shared.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(shared.getByRole("button", { name: "Save item to family" })).toBeDisabled();
  await act(async () => failedAdd.reject(new Error("Permission denied")));
  expect(shared.getByRole("textbox", { name: "New item in family" })).toHaveValue("Fix bike");
  expect(shared.getByRole("alert")).toHaveTextContent("Home Assistant rejected");
  fireEvent.click(shared.getByRole("button", { name: "Save item to family" }));
  expect(await shared.findByRole("checkbox", { name: "Fix bike" })).toBeInTheDocument();
  expect(ha.callService).toHaveBeenLastCalledWith(conn, "todo", "add_item", { item: "Fix bike" }, { entity_id: "todo.family" });
  fireEvent.click(shared.getByRole("button", { name: "Remove Fix bike" }));
  expect(lists["todo.family"].some(item => item.summary === "Fix bike")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(lists["todo.family"].some(item => item.summary === "Fix bike")).toBe(true);
  fireEvent.click(shared.getByRole("button", { name: "Remove Fix bike" }));
  const deletion = deferred<unknown>();
  vi.mocked(ha.callService).mockReturnValueOnce(deletion.promise);
  fireEvent.click(screen.getByRole("button", { name: "Remove item" }));
  expect(screen.getByRole("button", { name: "Removing…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await act(async () => deletion.reject(new Error("Permission denied")));
  expect(within(screen.getByRole("alertdialog")).getByRole("alert")).toHaveTextContent("Home Assistant rejected");
  expect(lists["todo.family"].some(item => item.summary === "Fix bike")).toBe(true);
  act(() => conn.emit("disconnected"));
  expect(screen.getByRole("button", { name: "Remove item" })).toBeDisabled();
  act(() => conn.emit("ready"));
  act(() => conn.entityCallback?.({ ...household }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Remove item" })).toBeEnabled());
  await confirmAction("Remove item");
  await waitFor(() => expect(shared.queryByRole("checkbox", { name: "Fix bike" })).not.toBeInTheDocument());
  expect(ha.callService).toHaveBeenLastCalledWith(conn, "todo", "remove_item", { item: "new-item" }, { entity_id: "todo.family" });
  vi.mocked(ha.callService).mockRejectedValueOnce(new Error("Permission denied"));
  fireEvent.click(shared.getByRole("checkbox", { name: "Plan holiday" }));
  expect(await shared.findByRole("alert")).toHaveTextContent("Home Assistant rejected");
  expect(shared.getByRole("checkbox", { name: "Plan holiday" })).not.toBeChecked();
  expect(JSON.stringify({ ...serverConfig.settings, events: [], items: [] })).not.toMatch(/Book holiday|Plan holiday|Book dentist|Pack bag|Pack lunch|Milk|Fix bike/);
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
  seedSettings({ events: [], items: [], timetables: {}, todoLists: {
    [`home|todo.readonly`]: { kind: "tasks", member: "everyone" },
    [`home|todo.denied`]: { kind: "tasks", member: `home|person.morgan` },
    [`home|todo.missing`]: { kind: "tasks", member: `home|person.riley` },
  } });
  window.history.replaceState(null, "", "/lists?tab=tasks&auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  expect(await screen.findByRole("checkbox", { name: "Read only item" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Edit Read only item" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Remove Read only item" })).toBeDisabled();
  expect(screen.getByText("This list is read-only.")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Add task" })).toHaveLength(3);
  screen.getAllByRole("button", { name: "Add task" }).forEach(button => expect(button).toBeDisabled());
  expect(await screen.findByRole("alert")).toHaveTextContent("To-do items could not be read");
  expect(screen.queryByText(/private server details/)).not.toBeInTheDocument();
  expect(screen.getByText(/This to-do list is unavailable/)).toBeInTheDocument();
  expect(conn.sendMessagePromise).not.toHaveBeenCalledWith({ type: "todo/item/list", entity_id: "todo.missing" });
  expect(ha.callService).not.toHaveBeenCalled();
});

it.each(["/automations", "/devices", "/devices/automation.sunset", "/areas/unassigned", "/home"])("confirms automation disabling from %s", async path => {
  window.history.replaceState(null, "", `${path}?auth_callback=1&code=fixture&state=fixture`);
  render(<App />);
  if (path === "/devices") fireEvent.click(await screen.findByText(/^Other controls/));
  const toggle = await screen.findByRole("switch", { name: "Toggle Sunset" });
  await waitFor(() => expect(toggle).toBeEnabled());
  fireEvent.click(toggle);
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Disable Sunset?");
  expect(ha.callService).not.toHaveBeenCalled();
  expect(toggle).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(toggle).toBeChecked();
  fireEvent.click(toggle);
  act(() => conn.emit("disconnected"));
  expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  act(() => conn.emit("ready"));
  act(() => conn.entityCallback?.({ ...states }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled());
  await confirmAction("Confirm");
  expect(ha.callService).toHaveBeenCalledExactlyOnceWith(conn, "automation", "turn_off", {}, { entity_id: "automation.sunset" });
});

it.each(["/", "/moods", "/devices/scene.evening"])("confirms scene activation from %s", async path => {
  window.history.replaceState(null, "", `${path}?auth_callback=1&code=fixture&state=fixture`);
  render(<App />);
  const activate = await screen.findByRole("button", { name: "Activate Evening" });
  await waitFor(() => expect(activate).toBeEnabled());
  fireEvent.click(activate);
  expect(ha.callService).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(ha.callService).not.toHaveBeenCalled();
  fireEvent.click(activate);
  await confirmAction(path.includes("/devices") ? "Confirm" : "Activate scene");
  expect(ha.callService).toHaveBeenCalledExactlyOnceWith(conn, "scene", "turn_on", {}, { entity_id: "scene.evening" });
});

it("confirms door and gate movement while keeping Stop immediate", async () => {
  window.history.replaceState(null, "", "/devices/cover.blind?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  await screen.findByRole("button", { name: "Close Blind" });
  act(() => conn.entityCallback?.({ ...states, "cover.blind": state("cover.blind", "open", { supported_features: 15, current_position: 50, device_class: "garage" }) }));
  fireEvent.click(screen.getByRole("button", { name: "Close Blind" }));
  expect(ha.callService).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.keyDown(screen.getByRole("slider", { name: "Blind open" }), { key: "ArrowLeft" });
  expect(ha.callService).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("slider", { name: "Blind open" })).toHaveAttribute("aria-valuenow", "50");
  fireEvent.keyDown(screen.getByRole("slider", { name: "Blind open" }), { key: "ArrowLeft" });
  await confirmAction("Confirm");
  expect(ha.callService).toHaveBeenCalledExactlyOnceWith(conn, "cover", "set_cover_position", { position: 49 }, { entity_id: "cover.blind" });
  fireEvent.click(screen.getByRole("button", { name: "Stop Blind" }));
  await waitFor(() => expect(ha.callService).toHaveBeenLastCalledWith(conn, "cover", "stop_cover", {}, { entity_id: "cover.blind" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

it("keeps favorites intact when individual or bulk removal is canceled", async () => {
  window.history.replaceState(null, "", "/?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  await screen.findByRole("switch", { name: "Toggle Living Room Light" });
  fireEvent.click(screen.getByRole("button", { name: "Customize" }));
  const checkbox = screen.getByRole("checkbox", { name: "Living Room Light" });
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(checkbox).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(checkbox).toBeChecked();
  fireEvent.click(checkbox);
  await confirmAction("Remove favorites");
  expect(checkbox).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Save favorites" }));
  expect(screen.queryByRole("switch", { name: "Toggle Living Room Light" })).not.toBeInTheDocument();
});

it("lists devices once, searches their metadata and child readings, and keeps standalone controls secondary", async () => {
  window.history.replaceState(null, "", "/devices?auth_callback=1&code=fixture&state=fixture");
  render(<App />);
  const card = await screen.findByRole("link", { name: "Multi sensor details" });
  expect(screen.getAllByRole("link", { name: "Multi sensor details" })).toHaveLength(1);
  expect(card).toHaveTextContent("Hall");
  expect(card).toHaveTextContent("Some readings unavailable");
  expect(card.querySelector(".device-symbol svg")).toHaveClass("lucide-lightbulb");
  expect(screen.queryByRole("switch", { name: "Toggle Living Room Light" })).not.toBeInTheDocument();
  const other = screen.getByText(/^Other controls/).closest("details")!;
  expect(other).not.toHaveAttribute("open");
  const search = screen.getByRole("textbox", { name: "Search devices" });
  for (const query of [" MULTI ", "Hall", "Reported manufacturer", "Living Room Light", "sensor.power", "Living Room"]) {
    fireEvent.change(search, { target: { value: query } });
    expect(screen.getByRole("link", { name: "Multi sensor details" })).toBeInTheDocument();
  }
  fireEvent.change(search, { target: { value: "charger" } });
  expect(screen.queryByRole("link", { name: "Multi sensor details" })).not.toBeInTheDocument();
  expect(screen.getByText(/^Other controls/).closest("details")).toHaveAttribute("open");
  fireEvent.click(screen.getByRole("link", { name: "Charger power details" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Charger power" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/entities/switch.charger");
  expect(screen.getByRole("link", { name: "Devices" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("switch", { name: "Toggle Charger power" })).toBeEnabled();
  fireEvent.click(screen.getByRole("link", { name: "Back to devices" }));
  expect(screen.getByRole("textbox", { name: "Search devices" })).toHaveValue("charger");
  fireEvent.change(screen.getByRole("textbox", { name: "Search devices" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("link", { name: "Multi sensor details" }));
  expect(window.location.pathname).toBe("/devices/physical-1");
  expect(screen.getByRole("heading", { level: 1, name: "Multi sensor" })).toBeInTheDocument();
  expect(document.querySelector(".device-page .device-symbol svg")).toHaveClass("lucide-lightbulb");
  expect(screen.getByRole("link", { name: "Hall" })).toHaveAttribute("href", "/areas/hall");
  expect(screen.getAllByRole("article")).toHaveLength(2);
  const light = screen.getByRole("article", { name: "Living Room Light" });
  expect(light).toHaveTextContent("Living Room");
  expect(within(light).getByText("Entity ID")).not.toBeVisible();
  fireEvent.click(within(light).getByText("Technical details"));
  expect(within(light).getByText("Entity ID")).toBeVisible();
  fireEvent.click(screen.getByRole("switch", { name: "Toggle Living Room Light" }));
  await waitFor(() => expect(ha.callService).toHaveBeenCalledExactlyOnceWith(conn, "light", "turn_off", {}, { entity_id: "light.living" }));
});

it.each(["/devices/light.living", "/entities/light.living", "/devices/physical-1#light.living"])("opens the parent device and focuses its control from %s after loading", async path => {
  window.history.replaceState(null, "", path);
  const metadata = deferred<typeof registries.devices>();
  conn.sendMessagePromise.mockImplementation(async ({ type }) => type === "config/device_registry/list" ? metadata.promise : ({ "config/area_registry/list": registries.areas, "config/entity_registry/list": registries.entities })[type]);
  render(<App />);
  await waitFor(() => expect(conn.entityCallback).toBeDefined());
  await act(async () => metadata.resolve(registries.devices));
  expect(await screen.findByRole("heading", { level: 1, name: "Multi sensor" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/devices/physical-1");
  expect(window.location.hash).toBe("#light.living");
  expect(screen.getByRole("article", { name: "Living Room Light" })).toHaveFocus();
  act(() => conn.emit("disconnected"));
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).toBeDisabled();
  expect(screen.getByText("Home Assistant offline")).toBeInTheDocument();
});

it("retains empty devices, custom names, models and unassigned rooms", async () => {
  window.history.replaceState(null, "", "/devices?auth_callback=1&code=fixture&state=fixture");
  conn.sendMessagePromise.mockImplementation(async ({ type }) => ({
    "config/area_registry/list": registries.areas,
    "config/device_registry/list": [...registries.devices, { id: "empty", name: "Original", name_by_user: "Bedroom thermostat", model: "T100", sw_version: "1.0" }],
    "config/entity_registry/list": registries.entities,
  })[type]);
  render(<App />);
  const card = await screen.findByRole("link", { name: "Bedroom thermostat details" });
  expect(card).toHaveTextContent("Unassigned");
  expect(card).toHaveTextContent("No controls or readings");
  expect(card.querySelector(".device-symbol svg")).toHaveClass("lucide-cpu");
  fireEvent.change(screen.getByRole("textbox", { name: "Search devices" }), { target: { value: "T100" } });
  expect(screen.queryByRole("link", { name: "Multi sensor details" })).not.toBeInTheDocument();
  fireEvent.click(card);
  expect(screen.getByRole("heading", { level: 1, name: "Bedroom thermostat" })).toBeInTheDocument();
  expect(screen.getByText(/This device has no visible controls/)).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.getByText("1.0")).not.toBeVisible();
  fireEvent.click(screen.getByText("Device technical details"));
  expect(screen.getByText("1.0")).toBeVisible();
});

it.each(["config/device_registry/list", "config/entity_registry/list"])("keeps controls accessible when %s cannot be loaded", async failed => {
  window.history.replaceState(null, "", "/devices?auth_callback=1&code=fixture&state=fixture");
  conn.sendMessagePromise.mockImplementation(async ({ type }) => {
    if (type === failed) throw new Error("Unavailable");
    return ({ "config/area_registry/list": registries.areas, "config/device_registry/list": registries.devices, "config/entity_registry/list": registries.entities })[type];
  });
  render(<App />);
  expect(await screen.findByText(/Device information may be incomplete/)).toBeInTheDocument();
  fireEvent.click(screen.getByText(/^Other controls/));
  const control = screen.getByRole("switch", { name: "Toggle Living Room Light" });
  expect(control).toBeEnabled();
  fireEvent.click(screen.getByRole("link", { name: "Living Room Light details" }));
  expect(window.location.pathname).toBe("/entities/light.living");
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).toBeEnabled();
});

it("opens legacy links with readable states when services cannot load", async () => {
  window.history.replaceState(null, "", "/devices/light.living?auth_callback=1&code=fixture&state=fixture");
  vi.mocked(ha.getServices).mockRejectedValueOnce(new Error("Unavailable"));
  render(<App />);
  expect(await screen.findByRole("heading", { level: 1, name: "Multi sensor" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/devices/physical-1");
  expect(screen.getByRole("article", { name: "Living Room Light" })).toHaveTextContent("Offline");
  expect(ha.callService).not.toHaveBeenCalled();
});

it("switches room and type grouping while retaining search through detail navigation and reloads", async () => {
  window.history.replaceState(null, "", "/devices?auth_callback=1&code=fixture&state=fixture");
  conn.sendMessagePromise.mockImplementation(async ({ type }) => ({
    "config/area_registry/list": registries.areas,
    "config/device_registry/list": [...registries.devices, { id: "other-device", name: "Bedroom sensor" }],
    "config/entity_registry/list": registries.entities,
  })[type]);
  const view = render(<App />);
  const hall = await screen.findByRole("region", { name: "Hall" });
  expect(within(hall).getByText("1 device")).toBeInTheDocument();
  expect(within(hall).getByRole("link", { name: "Multi sensor details" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Room" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("region", { name: "Unassigned" })).toHaveTextContent("Bedroom sensor");
  fireEvent.click(screen.getByRole("button", { name: "Device type" }));
  expect(screen.getByRole("region", { name: "Lights" })).toHaveTextContent("Multi sensor");
  expect(screen.getByRole("region", { name: "Other" })).toHaveTextContent("Bedroom sensor");
  fireEvent.change(screen.getByRole("textbox", { name: "Search devices" }), { target: { value: "lights" } });
  expect(screen.queryByRole("region", { name: "Other" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Multi sensor details" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Multi sensor" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to devices" })).toHaveAttribute("href", "/devices?group=type&q=lights");
  fireEvent.click(screen.getByRole("link", { name: "Back to devices" }));
  expect(screen.getByRole("button", { name: "Device type" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("textbox", { name: "Search devices" })).toHaveValue("lights");
  view.unmount();
  conn.connected = true;
  render(<App />);
  expect(await screen.findByRole("link", { name: "Multi sensor details" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Device type" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("textbox", { name: "Search devices" })).toHaveValue("lights");
  fireEvent.click(screen.getByRole("button", { name: "None" }));
  expect(screen.getByRole("region", { name: "All devices" })).toHaveTextContent("Multi sensor");
  fireEvent.change(screen.getByRole("textbox", { name: "Search devices" }), { target: { value: "" } });
  expect(within(screen.getByRole("region", { name: "All devices" })).getByText("2 devices")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Search devices" }), { target: { value: "does not exist" } });
  expect(screen.getByText("No devices match your search.")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "All devices" })).not.toBeInTheDocument();
  expect(ha.callService).not.toHaveBeenCalled();
});

it("falls back to room grouping for an invalid bookmarked view", async () => {
  window.history.replaceState(null, "", "/devices?group=invalid&q=multi");
  render(<App />);
  expect(await screen.findByRole("region", { name: "Hall" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Room" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("textbox", { name: "Search devices" })).toHaveValue("multi");
});
