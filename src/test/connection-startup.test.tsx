import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import * as ha from "home-assistant-js-websocket";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { HomeAssistantClient, STARTUP_GRACE_MS } from "@/lib/home-assistant";
import { AppProvider } from "@/contexts/AppProvider";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { createI18n } from "@/lib/i18n";
import { config, registries, services, states, user } from "./ha-fixtures";

vi.mock("home-assistant-js-websocket", async importOriginal => ({
  ...await importOriginal<typeof import("home-assistant-js-websocket")>(),
  createConnection: vi.fn(), subscribeEntities: vi.fn(), getConfig: vi.fn(), getUser: vi.fn(), getServices: vi.fn(), callService: vi.fn(),
}));
vi.mock("@/hooks/use-i18n", () => ({ useI18n: () => createI18n("en") }));

// A fictional socket: tests decide when it opens, when states arrive and when it drops.
class FakeConnection {
  connected = true;
  haVersion = "2026.10.0";
  listeners = new Map<string, Set<() => void>>();
  entityCallback?: (states: HassEntities) => void;
  close = vi.fn(() => { this.connected = false; });
  addEventListener = (name: string, listener: () => void) => { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(listener); };
  removeEventListener = (name: string, listener: () => void) => { this.listeners.get(name)?.delete(listener); };
  subscribeEvents = vi.fn(async () => async () => {});
  sendMessagePromise = vi.fn(async ({ type }: { type: string }): Promise<unknown> => ({ "config/area_registry/list": registries.areas, "config/device_registry/list": registries.devices, "config/entity_registry/list": registries.entities })[type]);
  emit(name: string) { this.connected = name === "ready"; this.listeners.get(name)?.forEach(listener => listener()); }
}
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

let conn: FakeConnection;
let opening: ReturnType<typeof deferred<Connection>>;
let clients: HomeAssistantClient[];
const newClient = () => { const client = new HomeAssistantClient(); clients.push(client); return client; };
const flush = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); });
/** Opens the socket and delivers metadata and the first states: the screen is connected. */
const open = async () => {
  opening.resolve(conn as unknown as Connection);
  await flush();
  act(() => conn.entityCallback?.(states));
  await flush();
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.clearAllMocks();
  clients = [];
  conn = new FakeConnection();
  opening = deferred<Connection>();
  vi.stubGlobal("fetch", vi.fn(async (path: string) => path === "/api/runtime"
    ? new Response(JSON.stringify({ homeAssistantUrl: "http://ha.example.test:8123" }))
    : new Response("{}", { status: 404 })));
  vi.mocked(ha.createConnection).mockImplementation(() => opening.promise);
  vi.mocked(ha.getConfig).mockResolvedValue(config);
  vi.mocked(ha.getUser).mockResolvedValue(user);
  vi.mocked(ha.getServices).mockResolvedValue(services);
  vi.mocked(ha.subscribeEntities).mockImplementation((connection, callback) => {
    (connection as unknown as FakeConnection).entityCallback = callback;
    return () => {};
  });
  vi.mocked(ha.callService).mockResolvedValue({});
});
afterEach(() => { cleanup(); clients.forEach(client => client.dispose()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps a fresh load calm until the first connection completes", async () => {
  const client = newClient();
  expect(client.getSnapshot()).toMatchObject({ starting: true, awaitingFirstConnection: true });
  client.start();
  await flush();
  expect(client.getSnapshot()).toMatchObject({ status: "connecting", starting: true });
  await open();
  expect(client.getSnapshot()).toMatchObject({ status: "connected", starting: false, awaitingFirstConnection: false });
});

it("ends the grace period after its timeout while the first connection is still slow", async () => {
  const client = newClient();
  client.start();
  await flush();
  await act(() => vi.advanceTimersByTimeAsync(STARTUP_GRACE_MS - 1));
  expect(client.getSnapshot()).toMatchObject({ status: "connecting", starting: true });
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(client.getSnapshot()).toMatchObject({ status: "connecting", starting: false, awaitingFirstConnection: true });
});

it.each([
  ["a refused connection", new Error("refused"), "disconnected"],
  ["a rejected token", ha.ERR_INVALID_AUTH, "auth-error"],
])("reports %s at once instead of waiting for the grace period", async (_name, error, status) => {
  const client = newClient();
  client.start();
  await flush();
  opening.reject(error);
  await flush();
  expect(client.getSnapshot()).toMatchObject({ status, starting: false, awaitingFirstConnection: true });
  expect(client.getSnapshot().error).not.toBe("");
});

it("ends the grace period when the user pauses live controls", async () => {
  const client = newClient();
  client.start();
  await flush();
  client.disconnect();
  expect(client.getSnapshot()).toMatchObject({ status: "disconnected", starting: false });
});

it("refuses commands during startup and after a real break, and never replays them", async () => {
  const client = newClient();
  client.start();
  await flush();
  await expect(client.command("light.living", "turn_on")).rejects.toThrow("Controls are paused until fresh Home Assistant state arrives.");
  await open();
  act(() => conn.emit("disconnected"));
  expect(client.getSnapshot()).toMatchObject({ status: "reconnecting", starting: false, awaitingFirstConnection: false });
  await expect(client.command("light.living", "turn_on")).rejects.toThrow("Controls are paused until fresh Home Assistant state arrives.");
  act(() => conn.emit("ready"));
  await flush();
  act(() => conn.entityCallback?.({ ...states }));
  await flush();
  expect(client.getSnapshot().status).toBe("connected");
  expect(ha.callService).not.toHaveBeenCalled();
});

const banner = () => render(<AppProvider><MemoryRouter><ConnectionBanner /></MemoryRouter></AppProvider>);

it("shows a neutral connecting status on a fresh load, then nothing once connected", async () => {
  banner();
  await flush();
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Connecting to Home Assistant…");
  expect(status).toHaveAttribute("data-tone", "neutral");
  expect(status).not.toHaveTextContent(/stale|paused|Connection settings/);
  await open();
  expect(screen.queryByRole("status")).toBeNull();
});

it("escalates a slow first connection to the paused warning when the grace period ends", async () => {
  banner();
  await flush();
  await act(() => vi.advanceTimersByTimeAsync(STARTUP_GRACE_MS));
  const status = screen.getByRole("status");
  expect(status).not.toHaveAttribute("data-tone");
  expect(status).toHaveTextContent("Home Assistant: connecting. Controls are paused until Home Assistant connects.");
  expect(status).not.toHaveTextContent("stale");
  expect(screen.getByRole("link", { name: "Connection settings" })).toHaveAttribute("href", "/settings/connection");
});

it("warns about stale readings immediately after a real break", async () => {
  banner();
  await flush();
  await open();
  act(() => conn.emit("disconnected"));
  const status = screen.getByRole("status");
  expect(status).not.toHaveAttribute("data-tone");
  expect(status).toHaveTextContent("Home Assistant: reconnecting. Readings are stale; controls are paused.");
  act(() => conn.emit("ready"));
  await flush();
  act(() => conn.entityCallback?.({ ...states }));
  await flush();
  expect(screen.queryByRole("status")).toBeNull();
});

it.each([
  ["/", "Today"], ["/calendar", "Calendar"], ["/lists", "Lists"], ["/school", "School"], ["/home", "Smart home"],
])("shapes the loading page at %s with its title instead of a bare loading line", (path, title) => {
  const { container } = render(<MemoryRouter initialEntries={[path]}><PageSkeleton /></MemoryRouter>);
  const skeleton = container.querySelector(".page-skeleton");
  expect(skeleton).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  expect(screen.getByText(title)).toHaveClass("skeleton-title");
  expect(skeleton.querySelectorAll(".skeleton-panel").length).toBeGreaterThan(0);
});

it("keeps an unnamed page's skeleton without guessing its title", () => {
  const { container } = render(<MemoryRouter initialEntries={["/settings"]}><PageSkeleton /></MemoryRouter>);
  expect(container.querySelector(".skeleton-title")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Loading…");
});
