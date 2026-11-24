import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import * as ha from "home-assistant-js-websocket";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { HomeAssistantClient } from "@/lib/home-assistant";
import { MAX_LOGBOOK_BACKFILL_MS, mergeLogbook, parseLogbookMessage } from "@/lib/activity";
import { config, registries, services, states, user } from "./ha-fixtures";

vi.mock("home-assistant-js-websocket", async importOriginal => ({
  ...await importOriginal<typeof import("home-assistant-js-websocket")>(),
  createConnection: vi.fn(), subscribeEntities: vi.fn(), getConfig: vi.fn(), getUser: vi.fn(), getServices: vi.fn(),
}));

type Receive = (message: unknown) => void;
class FakeConnection {
  connected = true;
  haVersion = "2026.10.0";
  listeners = new Map<string, Set<() => void>>();
  close = vi.fn(() => { this.connected = false; });
  addEventListener = (name: string, listener: () => void) => { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(listener); };
  removeEventListener = (name: string, listener: () => void) => { this.listeners.get(name)?.delete(listener); };
  subscribeEvents = vi.fn(async () => async () => {});
  subscribeMessage = vi.fn(async (_receive: Receive, _message: Record<string, unknown>, _options: { resubscribe: boolean }): Promise<() => Promise<void>> => async () => {});
  sendMessagePromise = vi.fn(async ({ type }: { type: string }): Promise<unknown> => ({ "config/area_registry/list": registries.areas, "config/device_registry/list": registries.devices, "config/entity_registry/list": registries.entities, "frontend/get_translations": { resources: {} } })[type]);
  emit(name: string) { this.connected = name === "ready"; this.listeners.get(name)?.forEach(listener => listener()); }
}
let conn: FakeConnection;
let clients: HomeAssistantClient[];
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(res => { resolve = res; }); return { promise, resolve }; };
const connectedClient = async () => {
  const client = new HomeAssistantClient();
  clients.push(client);
  await client.connect();
  await waitFor(() => expect(client.getSnapshot().status).toBe("connected"));
  return client;
};
const lastSubscription = () => {
  const call = conn.subscribeMessage.mock.calls[conn.subscribeMessage.mock.calls.length - 1];
  return { receive: call[0], message: call[1], options: call[2] };
};

beforeEach(() => {
  vi.clearAllMocks();
  clients = [];
  conn = new FakeConnection();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ homeAssistantUrl: "http://ha.local:8123" }))));
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  vi.mocked(ha.getConfig).mockResolvedValue(config);
  vi.mocked(ha.getUser).mockResolvedValue(user);
  vi.mocked(ha.getServices).mockResolvedValue(services);
  vi.mocked(ha.subscribeEntities).mockImplementation((_conn, callback) => { (callback as (states: HassEntities) => void)(states); return () => {}; });
});
afterEach(() => { clients.forEach(client => client.dispose()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("logbook subscription", () => {
  it("requests a bounded backfill for the chosen entities and delivers validated events", async () => {
    const client = await connectedClient(), receive = vi.fn();
    const start = new Date(Date.now() - 7 * 86400000);
    client.subscribeLogbook({ start, entityIds: ["binary_sensor.example_door"] }, receive);
    const { receive: send, message, options } = lastSubscription();
    expect(message).toMatchObject({ type: "logbook/event_stream", entity_ids: ["binary_sensor.example_door"] });
    expect(message).not.toHaveProperty("end_time");
    expect(Date.now() - Date.parse(String(message.start_time))).toBeLessThanOrEqual(MAX_LOGBOOK_BACKFILL_MS + 1000);
    expect(options).toEqual({ resubscribe: false });
    send({ events: [{ entity_id: "binary_sensor.example_door", state: "on", when: 1893456000.5 }, { when: 1893456001, message: "started" }, { entity_id: "bad id", state: "on", when: 1 }] });
    expect(receive).toHaveBeenLastCalledWith([{ entityId: "binary_sensor.example_door", state: "on", when: 1893456000500 }]);
  });

  it("ignores callbacks after a reconnect and unsubscribes a late subscription once stopped", async () => {
    const client = await connectedClient(), receive = vi.fn();
    const subscribed = deferred<() => Promise<void>>(), unsubscribe = vi.fn(async () => {});
    conn.subscribeMessage.mockImplementationOnce(() => subscribed.promise);
    const stop = client.subscribeLogbook({ start: new Date(Date.now() - 3600000) }, receive);
    const { receive: send, message } = lastSubscription();
    expect(message).not.toHaveProperty("entity_ids");
    send({ events: [{ entity_id: "lock.example", state: "locked", when: 1893456000 }] });
    expect(receive).toHaveBeenCalledOnce();
    conn.emit("disconnected");
    send({ events: [{ entity_id: "lock.example", state: "unlocked", when: 1893456100 }] });
    expect(receive).toHaveBeenCalledOnce();
    stop();
    subscribed.resolve(unsubscribe);
    await waitFor(() => expect(unsubscribe).toHaveBeenCalledOnce());
  });

  it("unsubscribes an active subscription and reports an unavailable logbook", async () => {
    const client = await connectedClient(), unsubscribe = vi.fn(async () => {});
    conn.subscribeMessage.mockResolvedValueOnce(unsubscribe);
    const stop = client.subscribeLogbook({ start: new Date(Date.now() - 3600000) }, vi.fn());
    await Promise.resolve();
    stop();
    await waitFor(() => expect(unsubscribe).toHaveBeenCalledOnce());
    const failed = vi.fn();
    conn.subscribeMessage.mockRejectedValueOnce({ code: "unknown_command" });
    client.subscribeLogbook({ start: new Date(Date.now() - 3600000) }, failed);
    await waitFor(() => expect(failed).toHaveBeenCalledWith(null));
    const empty = vi.fn(), calls = conn.subscribeMessage.mock.calls.length;
    client.subscribeLogbook({ start: new Date(), entityIds: [] }, empty);
    expect(empty).toHaveBeenCalledWith([]);
    expect(conn.subscribeMessage).toHaveBeenCalledTimes(calls);
  });

  it("reports an unavailable logbook while disconnected", () => {
    const receive = vi.fn();
    new HomeAssistantClient().subscribeLogbook({ start: new Date() }, receive);
    expect(receive).toHaveBeenCalledWith(null);
  });
});

describe("logbook events", () => {
  it("parses only valid entity events and merges replayed history without duplicates", () => {
    expect(parseLogbookMessage({ nope: true })).toBeUndefined();
    const first = parseLogbookMessage({ events: [{ entity_id: "cover.example_garage", state: "open", when: 100 }, { entity_id: "cover.example_garage", state: "closed", when: 200 }] })!;
    const replay = parseLogbookMessage({ events: [{ entity_id: "cover.example_garage", state: "closed", when: 200 }, { entity_id: "lock.example", state: "locked", when: 300 }] })!;
    expect(mergeLogbook(first, replay).map(event => event.when)).toEqual([300000, 200000, 100000]);
    expect(mergeLogbook(first, replay, 2)).toHaveLength(2);
  });
});
