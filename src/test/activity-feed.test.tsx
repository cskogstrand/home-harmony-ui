import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as ha from "home-assistant-js-websocket";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { HomeAssistantClient } from "@/lib/home-assistant";
import { activitySourceCandidates, activityTime, curateActivity, curatedActivityEntityIds, defaultActivitySources, MAX_LOGBOOK_BACKFILL_MS, mergeLogbook, parseLogbookMessage,
  type ActivityItem, type ActivityOptions, type LogbookEvent } from "@/lib/activity";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { createI18n } from "@/lib/i18n";
import { config, registries, services, state, states, user } from "./ha-fixtures";
import { AppContext } from "@/contexts/AppContext";
import { RecentActivity } from "@/components/ActivityFeed";
import History from "@/pages/History";
import type { Entity } from "@/types/api";

const family = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/FamilyContext")>(), useFamily: () => family.value }));

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
afterEach(() => { cleanup(); clients.forEach(client => client.dispose()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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

const activityStates = {
  "binary_sensor.example_garage": state("binary_sensor.example_garage", "off", { device_class: "garage_door", friendly_name: "Garage door" }),
  "lock.example_front": state("lock.example_front", "locked", { friendly_name: "Front door" }),
  "vacuum.example_robot": state("vacuum.example_robot", "docked", { friendly_name: "Robot vacuum" }),
  "binary_sensor.example_dishwasher": state("binary_sensor.example_dishwasher", "off", { device_class: "running", friendly_name: "Dishwasher" }),
  "sensor.example_washer": state("sensor.example_washer", "run", { device_class: "enum", options: ["ready", "run", "finished"], friendly_name: "Washer" }),
  "sensor.example_temperature": state("sensor.example_temperature", "21.5", { device_class: "temperature", unit_of_measurement: "°C", friendly_name: "Hall temperature" }),
  "update.example_firmware": state("update.example_firmware", "off", { friendly_name: "Firmware" }),
  "automation.example_lights": state("automation.example_lights", "on", { friendly_name: "Evening lights" }),
  "person.example_parent": state("person.example_parent", "home", { friendly_name: "Example parent" }),
  "alarm_control_panel.example_house": state("alarm_control_panel.example_house", "disarmed", { friendly_name: "House alarm" }),
  "event.example_doorbell": state("event.example_doorbell", "2026-10-06T10:00:00Z", { device_class: "doorbell", friendly_name: "Front doorbell" }),
  "light.example_lamp": state("light.example_lamp", "off", { friendly_name: "Reading lamp" }),
  "binary_sensor.example_person": state("binary_sensor.example_person", "off", { device_class: "occupancy", friendly_name: "Driveway person occupancy" }),
};
const activityEntities = mapHome(activityStates, emptyRegistries, "home").entities;
const id = (entityId: string) => `home|${entityId}`;
const minute = 60000, base = Date.parse("2026-10-06T12:00:00Z");
const event = (entityId: string, state: string, minutesAgo: number) => ({ entityId, state, when: base - minutesAgo * minute });
const english = createI18n("en"), norwegian = createI18n("nb");
const sentences = (items: ActivityItem[], i18n = english) => items.map(item => i18n.message(item.sentence));
const curated = (events: LogbookEvent[], options: Partial<ActivityOptions> = {}) => curateActivity(events, activityEntities, { mode: "curated", language: "en", people: false, ...options });

describe("activity curation", () => {
  it("suggests openings, locks, alarms, appliances, robots, doorbells and camera person sensors, never readings or administration", () => {
    expect(defaultActivitySources(activityEntities, ["binary_sensor.example_person"]).sort()).toEqual([
      "alarm_control_panel.example_house", "binary_sensor.example_dishwasher", "binary_sensor.example_garage", "binary_sensor.example_person",
      "event.example_doorbell", "lock.example_front", "sensor.example_washer", "vacuum.example_robot",
    ].map(id));
    const candidates = activitySourceCandidates(activityEntities).map(entity => entity.entityId);
    expect(candidates).toContain("light.example_lamp");
    for (const excluded of ["sensor.example_temperature", "update.example_firmware", "automation.example_lights", "person.example_parent"]) expect(candidates).not.toContain(excluded);
  });

  it("writes readable sentences from templates, newest first, and keeps starts, readings and administration out", () => {
    const events = [
      event("binary_sensor.example_garage", "on", 50), event("binary_sensor.example_dishwasher", "on", 45), event("binary_sensor.example_dishwasher", "off", 40),
      event("vacuum.example_robot", "cleaning", 35), event("vacuum.example_robot", "docked", 30), event("sensor.example_washer", "finished", 25),
      event("lock.example_front", "unlocked", 20), event("alarm_control_panel.example_house", "armed_away", 15), event("event.example_doorbell", "2026-10-06T11:50:00Z", 10),
      event("sensor.example_temperature", "22", 9), event("automation.example_lights", "off", 8), event("update.example_firmware", "on", 7), event("light.example_lamp", "on", 6),
      { entityId: "automation.example_lights", when: base - 5 * minute, message: "triggered by time" },
    ];
    const items = curated(events);
    expect(sentences(items)).toEqual([
      "Front doorbell rang", "House alarm: Armed away", "Front door unlocked", "Washer finished", "Robot vacuum docked", "Dishwasher finished", "Garage door opened",
    ]);
    expect(sentences(curated(events, { language: "nb" }), norwegian)).toEqual([
      "Det ringte på Front doorbell", "House alarm: Aktivert borte", "Front door ble låst opp", "Washer er ferdig", "Robot vacuum er tilbake i ladestasjonen", "Dishwasher er ferdig", "Garage door ble åpnet",
    ]);
    expect(items[items.length - 1]).toMatchObject({ icon: "garage", group: "access", path: "/entities/binary_sensor.example_garage", count: 1 });
    expect(curated(events, { limit: 2 })).toHaveLength(2);
  });

  it("follows chosen sources, including turned on and off for an added light", () => {
    const events = [event("light.example_lamp", "on", 3), event("binary_sensor.example_garage", "on", 2)];
    expect(sentences(curated(events, { sources: [id("light.example_lamp")] }))).toEqual(["Reading lamp turned on"]);
    expect(sentences(curated(events, { sources: [] }))).toEqual([]);
  });

  it("folds same-entity flapping within two minutes into the newest change", () => {
    const flapping = [event("binary_sensor.example_garage", "on", 10), event("binary_sensor.example_garage", "off", 9), event("binary_sensor.example_garage", "on", 8.5),
      event("lock.example_front", "unlocked", 8.2), event("binary_sensor.example_garage", "off", 4)];
    const items = curated(flapping);
    expect(sentences(items)).toEqual(["Garage door closed", "Front door unlocked", "Garage door opened"]);
    expect(items.map(item => item.count)).toEqual([1, 1, 3]);
    expect(curateActivity(flapping, activityEntities, { mode: "full", language: "en", people: false })).toHaveLength(5);
  });

  it("shows people coming and going only when opted in", () => {
    const events = [event("person.example_parent", "not_home", 30), event("person.example_parent", "Example school", 20), event("person.example_parent", "home", 10)];
    expect(curated(events)).toEqual([]);
    expect(curatedActivityEntityIds(activityEntities, { people: false })).not.toContain("person.example_parent");
    expect(curatedActivityEntityIds(activityEntities, { people: true })).toContain("person.example_parent");
    expect(sentences(curated(events, { people: true }))).toEqual(["Example parent came home", "Example parent arrived at Example school", "Example parent left home"]);
    expect(curateActivity(events, activityEntities, { mode: "full", language: "en", people: false })).toEqual([]);
  });

  it("names camera person detections after the camera and skips recoveries after an outage", () => {
    const personSensors = { "binary_sensor.example_person": "Driveway" };
    const events = [event("binary_sensor.example_person", "on", 5), event("binary_sensor.example_person", "off", 1),
      event("lock.example_front", "unavailable", 30), event("lock.example_front", "locked", 29)];
    expect(sentences(curated(events, { personSensors }))).toEqual(["Person at Driveway"]);
    expect(curated(events, { personSensors })[0]).toMatchObject({ icon: "camera", group: "security" });
  });

  it("falls back to generic templates and Home Assistant's message in the full log only", () => {
    const events = [{ entityId: "automation.example_lights", when: base, message: "triggered by time" }, event("vacuum.example_robot", "returning", 1), event("sensor.example_gone", "on", 2)];
    expect(sentences(curateActivity(events, activityEntities, { mode: "full", language: "en", people: false }))).toEqual([
      "Evening lights triggered by time", "Robot vacuum changed to Returning", "sensor.example_gone turned on",
    ]);
    expect(curated(events)).toEqual([]);
  });

  it("formats relative and clock times in the home's time zone", () => {
    const now = Date.parse("2026-10-06T12:00:00Z"), zone = "Europe/Oslo";
    expect(activityTime(now - 20000, now, "en-GB", zone)).toBe("now");
    expect(activityTime(now - 5 * minute, now, "en-GB", zone)).toBe("5 minutes ago");
    expect(activityTime(now - 5 * minute, now, "nb-NO", zone)).toBe("for 5 minutter siden");
    expect(activityTime(Date.parse("2026-10-06T08:02:00Z"), now, "en-GB", zone)).toBe("10:02");
    expect(activityTime(Date.parse("2026-10-05T20:15:00Z"), now, "en-GB", zone)).toBe("yesterday 22:15");
    expect(activityTime(Date.parse("2026-10-05T20:15:00Z"), now, "nb-NO", zone)).toBe("i går 22:15");
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

describe("Recent at home", () => {
  type Subscriber = { options: { start: Date; entityIds?: string[] }; receive: (events: LogbookEvent[] | null) => void; stop: ReturnType<typeof vi.fn> };
  let subscribers: Subscriber[];
  const subscribeLogbook = vi.fn((options: Subscriber["options"], receive: Subscriber["receive"]) => {
    const stop = vi.fn();
    subscribers.push({ options, receive, stop });
    return stop;
  });
  const now = new Date(base);
  const app = (homeOnline = true, entities: Entity[] = activityEntities) => ({ homeOnline, subscribeLogbook, currentHome: { entities, areas: [], timeZone: "Europe/Oslo" } });
  const view = (homeOnline = true, entities?: Entity[]) => <AppContext.Provider value={app(homeOnline, entities) as never}><MemoryRouter><RecentActivity /></MemoryRouter></AppContext.Provider>;
  const panel = () => within(screen.getByRole("region", { name: "Recent at home" }));
  const rows = () => panel().queryAllByRole("listitem").map(row => row.textContent);
  beforeEach(() => {
    subscribers = [];
    subscribeLogbook.mockClear();
    family.value = { activity: { panel: true, people: false }, now, cameras: { items: [] } };
  });

  it("subscribes to the curated sources for 24 hours, shows the six newest items and updates live", () => {
    render(view());
    expect(panel().getByText("Loading activity…")).toBeVisible();
    const [{ options, receive }] = subscribers;
    expect(options.entityIds).toEqual(curatedActivityEntityIds(activityEntities, { people: false }));
    expect(options.entityIds).not.toContain("person.example_parent");
    expect(Date.now() - options.start.getTime()).toBeGreaterThanOrEqual(86400000 - 60000);
    act(() => receive([1, 2, 3, 4, 5, 6, 7].map(step => event("binary_sensor.example_garage", step % 2 ? "on" : "off", step * 10))));
    expect(rows()).toHaveLength(6);
    expect(rows()[0]).toBe("Garage door opened10 minutes ago");
    expect(panel().getAllByRole("link", { name: "Garage door opened" })[0]).toHaveAttribute("href", "/entities/binary_sensor.example_garage");
    act(() => receive([event("lock.example_front", "unlocked", 1)]));
    expect(rows()[0]).toBe("Front door unlocked1 minute ago");
    expect(rows()).toHaveLength(6);
  });

  it("distinguishes a quiet day from unavailable activity and missing sources", () => {
    const { unmount } = render(view());
    act(() => subscribers[0].receive([event("sensor.example_temperature", "22", 5)]));
    expect(panel().getByText("Nothing has happened in the last 24 hours.")).toBeVisible();
    act(() => subscribers[0].receive(null));
    expect(panel().getByText("Activity is unavailable right now.")).toBeVisible();
    unmount();
    family.value = { ...family.value, activity: { panel: true, people: false, sources: [] } };
    render(view());
    expect(panel().getByText("No activity sources are selected.")).toBeVisible();
    expect(panel().getByRole("link", { name: "Choose sources" })).toHaveAttribute("href", "/settings/activity?panel=recent");
    expect(subscribeLogbook).toHaveBeenCalledOnce();
  });

  it("follows people only when opted in and stays hidden when turned off", () => {
    family.value = { ...family.value, activity: { panel: true, people: true } };
    const { unmount } = render(view());
    expect(subscribers[0].options.entityIds).toContain("person.example_parent");
    act(() => subscribers[0].receive([event("person.example_parent", "home", 3)]));
    expect(rows()).toEqual(["Example parent came home3 minutes ago"]);
    unmount();
    subscribeLogbook.mockClear();
    family.value = { ...family.value, activity: { panel: false, people: false } };
    render(view());
    expect(screen.queryByRole("region", { name: "Recent at home" })).toBeNull();
    expect(subscribeLogbook).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount and when the sources change", () => {
    const { rerender, unmount } = render(view());
    const first = subscribers[0];
    rerender(view(true, activityEntities.filter(entity => entity.entityId !== "lock.example_front")));
    expect(first.stop).toHaveBeenCalledOnce();
    expect(subscribers[1].options.entityIds).not.toContain("lock.example_front");
    unmount();
    expect(subscribers[1].stop).toHaveBeenCalledOnce();
  });

  it("keeps cached items marked stale while offline and resubscribes after reconnecting", () => {
    const { rerender } = render(view());
    act(() => subscribers[0].receive([event("binary_sensor.example_garage", "on", 5)]));
    rerender(view(false));
    expect(subscribers[0].stop).toHaveBeenCalledOnce();
    expect(panel().getByRole("status")).toHaveTextContent("Cached activity is stale while Home Assistant is offline.");
    expect(rows()).toEqual(["Garage door opened5 minutes ago"]);
    rerender(view(true));
    expect(subscribers).toHaveLength(2);
    act(() => subscribers[1].receive([event("binary_sensor.example_garage", "off", 2), event("binary_sensor.example_garage", "on", 5)]));
    expect(rows()).toEqual(["Garage door closed2 minutes ago", "Garage door opened5 minutes ago"]);
    expect(panel().queryByText(/stale/)).toBeNull();
  });

  it("shows activity as unavailable while offline without a cache", () => {
    render(view(false));
    expect(subscribeLogbook).not.toHaveBeenCalled();
    expect(panel().getByText("Activity is unavailable right now.")).toBeVisible();
  });
});

describe("Activity log", () => {
  type Subscriber = { options: { start: Date; end?: Date; entityIds?: string[] }; receive: (events: LogbookEvent[] | null) => void; stop: ReturnType<typeof vi.fn> };
  let subscribers: Subscriber[];
  const subscribeLogbook = vi.fn((options: Subscriber["options"], receive: Subscriber["receive"]) => {
    const stop = vi.fn();
    subscribers.push({ options, receive, stop });
    return stop;
  });
  const home = mapHome(activityStates, {
    areas: [{ area_id: "garage", name: "Garage" }, { area_id: "hall", name: "Hall" }], devices: [],
    entities: [{ id: "garage-sensor", entity_id: "binary_sensor.example_garage", area_id: "garage" }, { id: "front-lock", entity_id: "lock.example_front", area_id: "hall" }],
  }, "home", config);
  const view = (homeOnline = true) => <AppContext.Provider value={{ homeOnline, subscribeLogbook, haUrl: "http://ha.local:8123", currentHome: home } as never}>
    <MemoryRouter><History /></MemoryRouter></AppContext.Provider>;
  const log = () => within(screen.getByRole("region", { name: "Activity log" }));
  const rows = () => log().queryAllByRole("listitem").map(row => row.textContent);
  const events = [event("binary_sensor.example_garage", "on", 5), event("lock.example_front", "unlocked", 10), event("light.example_lamp", "on", 15),
    { entityId: "automation.example_lights", when: base - 20 * minute, message: "triggered by time" }, event("person.example_parent", "home", 25)];
  beforeEach(() => {
    subscribers = [];
    subscribeLogbook.mockClear();
    family.value = { activity: { panel: true, people: false }, now: new Date(base), today: "2026-10-06", cameras: { items: [] } };
  });

  it("logs every entity for today in the home's time zone with clock times and keeps people private by default", () => {
    render(view());
    expect(log().getByRole("status")).toHaveTextContent("Loading activity…");
    expect(subscribers[0].options).toEqual({ start: new Date("2026-10-05T22:00:00.000Z"), end: undefined, entityIds: undefined });
    act(() => subscribers[0].receive(events));
    expect(rows()).toEqual(["Garage door opened13:55", "Front door unlocked13:50", "Reading lamp turned on13:45", "Evening lights triggered by time13:40"]);
    expect(log().getByRole("link", { name: /Open logbook in Home Assistant/ })).toHaveAttribute("href", "http://ha.local:8123/logbook");
  });

  it("filters by area and type and explains an empty result", () => {
    render(view());
    act(() => subscribers[0].receive(events));
    fireEvent.change(log().getByLabelText("Area"), { target: { value: "garage" } });
    expect(rows()).toEqual(["Garage door opened13:55"]);
    fireEvent.change(log().getByLabelText("Type"), { target: { value: "lighting" } });
    expect(log().getByText("No activity matches these filters.")).toBeVisible();
    fireEvent.change(log().getByLabelText("Area"), { target: { value: "all" } });
    expect(rows()).toEqual(["Reading lamp turned on13:45"]);
  });

  it("switches to yesterday with a closed window and marks cached entries stale while offline", () => {
    const { rerender } = render(view());
    act(() => subscribers[0].receive(events));
    fireEvent.click(log().getByRole("button", { name: "Yesterday" }));
    expect(subscribers[0].stop).toHaveBeenCalledOnce();
    expect(subscribers[1].options).toEqual({ start: new Date("2026-10-04T22:00:00.000Z"), end: new Date("2026-10-05T22:00:00.000Z"), entityIds: undefined });
    expect(log().getByRole("button", { name: "Yesterday" })).toHaveAttribute("aria-pressed", "true");
    act(() => subscribers[1].receive([]));
    expect(log().getByText("Nothing was logged on this day.")).toBeVisible();
    act(() => subscribers[1].receive([event("lock.example_front", "locked", 900)]));
    rerender(view(false));
    expect(log().getByText("Cached activity is stale while Home Assistant is offline.")).toBeVisible();
    expect(rows()).toEqual(["Front door locked23:00"]);
  });
});
