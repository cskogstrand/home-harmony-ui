import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { SharedConfiguration } from "@/lib/shared-configuration";
import { emptyConfiguration, emptyPlanner, parseConfiguration, remapPlanner, type Configuration } from "../../shared/configuration";

const response = (status: number, value: unknown) => ({ ok: status === 200, status, json: async () => structuredClone(value) }) as Response;
const deferred = <T,>() => { let resolve: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve: resolve! }; };
const stores: SharedConfiguration[] = [];
afterEach(() => { stores.forEach(store => store.stop()); stores.length = 0; });
function server() {
  let config = emptyConfiguration(), version = 0;
  const revision = () => String(version).padStart(64, "0");
  const request = vi.fn(async (method: "GET" | "PUT", body?: string, expected?: string) => {
    if (method === "PUT") {
      if (expected !== revision()) return response(409, {});
      config = parseConfiguration(body); version++;
    }
    return response(200, { config, revision: revision() });
  });
  const start = async (send = request) => {
    const store = new SharedConfiguration(send); stores.push(store); store.start();
    await waitFor(() => expect(store.getSnapshot().loaded).toBe(true));
    return store;
  };
  return { request, start, current: () => config };
}
const url = "http://ha.local:8123";

describe("shared configuration", () => {
  it("shares settings across devices without uploading a browser's defaults", async () => {
    const backend = server();
    const a = await backend.start(), b = await backend.start();
    expect(backend.request.mock.calls.every(([method]) => method === "GET")).toBe(true);
    a.updatePlanner("home-1", url, planner => ({ ...planner, memberOrder: [`${url}|person.one`], hiddenMembers: [`${url}|person.one`] }));
    await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
    await b.refresh();
    expect(b.getSnapshot().config).toEqual(a.getSnapshot().config);
    expect(b.getSnapshot().config.planners["home-1"].planner.hiddenMembers).toEqual([`${url}|person.one`]);
  });

  it("serializes rapid edits made while a save is pending", async () => {
    const backend = server(), pending = deferred<Response>();
    let first = true;
    const send = vi.fn(async (method: "GET" | "PUT", body?: string, revision?: string) => {
      if (method === "PUT" && first) { first = false; const result = await backend.request(method, body, revision); pending.resolve(result); return hold.promise; }
      return backend.request(method, body, revision);
    });
    const hold = deferred<Response>();
    const store = await backend.start(send);
    store.updatePlanner("home-1", url, p => ({ ...p, memberOrder: ["one"] }));
    const firstResult = await pending.promise;
    store.updatePlanner("home-1", url, p => ({ ...p, timetableEnabled: { one: true } }));
    hold.resolve(firstResult);
    await waitFor(() => expect(store.getSnapshot().dirty).toBe(false));
    expect(backend.current().planners["home-1"].planner).toMatchObject({ memberOrder: ["one"], timetableEnabled: { one: true } });
    expect(send.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(2);
  });

  it("preserves an unsaved draft on conflict and only discards it on explicit reload", async () => {
    const backend = server();
    const a = await backend.start(), b = await backend.start();
    a.updatePlanner("home-1", url, p => ({ ...p, memberOrder: ["one"] }));
    await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
    b.updatePlanner("home-1", url, p => ({ ...p, memberOrder: ["two"] }));
    await waitFor(() => expect(b.getSnapshot().error).toMatch(/Another screen/));
    expect(b.getSnapshot().config.planners["home-1"].planner.memberOrder).toEqual(["two"]);
    expect(b.getSnapshot().dirty).toBe(true);
    await b.refresh();
    expect(b.getSnapshot().dirty).toBe(true);
    expect(backend.current().planners["home-1"].planner.memberOrder).toEqual(["one"]);
    await b.refresh(true);
    expect(b.getSnapshot().dirty).toBe(false);
    expect(b.getSnapshot().config).toEqual(backend.current());
  });

  it("retains edits after a network failure and retries only on request", async () => {
    const backend = server();
    let failing = false;
    const send = vi.fn(async (method: "GET" | "PUT", body?: string, revision?: string) => {
      if (method === "PUT" && failing) throw new Error("Network unavailable");
      return backend.request(method, body, revision);
    });
    const store = await backend.start(send);
    failing = true;
    store.updatePlanner("home-1", url, p => ({ ...p, memberOrder: ["one"] }));
    await waitFor(() => expect(store.getSnapshot().error).toBe("Network unavailable"));
    await store.refresh();
    expect(send.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(1);
    failing = false;
    await store.retry();
    expect(store.getSnapshot().dirty).toBe(false);
    expect(backend.current().planners["home-1"].planner.memberOrder).toEqual(["one"]);
  });

  it("does not let a stale read or stopped session overwrite a newer draft", async () => {
    const backend = server(), waiting = deferred<Response>();
    let delay = false;
    const send = vi.fn(async (method: "GET" | "PUT", body?: string, revision?: string) => delay && method === "GET" ? waiting.promise : backend.request(method, body, revision));
    const store = await backend.start(send);
    delay = true;
    const refresh = store.refresh();
    store.updatePlanner("home-1", url, p => ({ ...p, memberOrder: ["one"] }));
    store.stop();
    waiting.resolve(response(200, { revision: "0".repeat(64), config: emptyConfiguration() }));
    await refresh;
    expect(store.getSnapshot().config.planners["home-1"].planner.memberOrder).toEqual(["one"]);
    expect(store.getSnapshot().dirty).toBe(true);
  });

  it("ignores a stale read that arrives after a successful save", async () => {
    const backend = server(), waiting = deferred<Response>();
    let delay = false;
    const send = vi.fn(async (method: "GET" | "PUT", body?: string, revision?: string) => delay && method === "GET" ? waiting.promise : backend.request(method, body, revision));
    const store = await backend.start(send);
    delay = true;
    const refresh = store.refresh();
    store.updatePlanner("home-1", url, p => ({ ...p, memberOrder: ["one"] }));
    await waitFor(() => expect(store.getSnapshot().dirty).toBe(false));
    waiting.resolve(response(200, { revision: "0".repeat(64), config: emptyConfiguration() }));
    await refresh;
    expect(store.getSnapshot().config).toEqual(backend.current());
    store.updatePlanner("home-1", url, p => ({ ...p, timetableEnabled: { one: true } }));
    await waitFor(() => expect(store.getSnapshot().dirty).toBe(false));
    expect(store.getSnapshot().error).toBe("");
  });
});

it("moves instance references across HA addresses without rewriting image URLs", () => {
  const old = "http://old.local:8123", next = "https://new.local";
  const planner = { ...emptyPlanner(),
    selectedAlarm: `${old}|alarm`,
    memberOrder: [`${old}|person`], hiddenMembers: [`${old}|person`], timetables: { [`${old}|person`]: [`${old}/local/timetable.jpg`] },
    timetableEnabled: { [`${old}|person`]: true }, calendarMembers: { [`${old}|calendar`]: `${old}|person` },
    todoLists: { [`${old}|list`]: { kind: "daily" as const, member: `${old}|person` } }, homeEntities: { [old]: [`${old}|light`] },
  };
  const moved = remapPlanner(planner, old, next);
  expect(moved.memberOrder).toEqual([`${next}|person`]);
  expect(moved.hiddenMembers).toEqual([`${next}|person`]);
  expect(moved.calendarMembers[`${next}|calendar`]).toBe(`${next}|person`);
  expect(moved.todoLists[`${next}|list`].member).toBe(`${next}|person`);
  expect(moved.homeEntities[next]).toEqual([`${next}|light`]);
  expect(moved.timetables[`${next}|person`]).toEqual([`${old}/local/timetable.jpg`]);
  expect(moved.selectedAlarm).toBe(`${next}|alarm`);
});

it("rejects invalid or unsupported backup files instead of silently dropping their fields", () => {
  const config: Configuration = { ...emptyConfiguration(), planners: { main: { instanceUrl: url, planner: emptyPlanner() } } };
  expect(parseConfiguration(JSON.stringify(config))).toEqual(config);
  expect(() => parseConfiguration(JSON.stringify({ ...config, version: 3 }))).toThrow();
  expect(() => parseConfiguration(JSON.stringify({ ...config, refresh_token: "fixture" }))).toThrow();
  config.planners.main.planner.calendar = { view: "invalid", startDay: "today" } as never;
  expect(() => parseConfiguration(JSON.stringify(config))).toThrow();
});

it("rejects old formats and HA data in settings backups", () => {
  const config = { ...emptyConfiguration(), planners: { main: { instanceUrl: url, planner: emptyPlanner() } } };
  expect(() => parseConfiguration(JSON.stringify({ ...config, version: 1 }))).toThrow();
  for (const field of ["events", "items", "people", "states"]) {
    const input = structuredClone(config);
    Object.assign(input.planners.main.planner, { [field]: [] });
    expect(() => parseConfiguration(JSON.stringify(input))).toThrow();
  }
});
