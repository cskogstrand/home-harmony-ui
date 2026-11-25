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
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => ({ state: { loaded: true, error: "" } }) }));
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

  it("shows only real changes: no repeated states, no outage or transition round trips", () => {
    const hour = 60 * minute;
    const events = [
      // Known before the shown day: the front door was already locked, so locking again is no change.
      event("lock.example_front", "locked", 30 * 60), event("lock.example_front", "locked", 50),
      // off → unavailable → off is no change; off → unavailable → on is.
      event("binary_sensor.example_garage", "off", 40), event("binary_sensor.example_garage", "unavailable", 30), event("binary_sensor.example_garage", "off", 29),
      event("binary_sensor.example_garage", "unknown", 20), event("binary_sensor.example_garage", "on", 19),
      // A logged state equal to the last one is a repeat, not a change.
      event("binary_sensor.example_dishwasher", "on", 15), event("binary_sensor.example_dishwasher", "off", 12), event("binary_sensor.example_dishwasher", "off", 5),
    ];
    const items = curated(events, { since: base - 24 * hour });
    expect(sentences(items)).toEqual(["Dishwasher finished", "Garage door opened", "Garage door closed"]);
    expect(items.map(item => item.when)).toEqual([base - 12 * minute, base - 19 * minute, base - 40 * minute]);
    // Without the earlier state, a first state is shown as it may be a change; a recovery after an outage is not.
    expect(sentences(curated(events.slice(1), { since: base - 24 * hour }))).toContain("Front door locked");
    expect(sentences(curated([event("lock.example_front", "unavailable", 3), event("lock.example_front", "unlocked", 2)]))).toEqual([]);
    // The full log keeps every event.
    expect(curateActivity(events, activityEntities, { mode: "full", language: "en", people: false, since: base - 24 * hour })).toHaveLength(9);
  });

  it("keeps each door of a device on its own row, named by position, and folds only one entity's flapping", () => {
    // A fictional car reports each door and all doors together.
    const devices = [{ id: "car", name: "Example car" }];
    const doors = [["binary_sensor.example_car_doors", "Doors"], ["binary_sensor.example_car_driver_front", "Door (Driver Front)"], ["binary_sensor.example_car_passenger_front", "Door (Passenger Front)"]];
    const home = mapHome(Object.fromEntries(doors.map(([entityId, part]) => [entityId, state(entityId, "off", { device_class: "door", friendly_name: `Example car ${part}` })])),
      { areas: [], devices, entities: doors.map(([entityId, part], index) => ({ id: `d${index}`, entity_id: entityId, platform: "example_mqtt", device_id: "car", original_name: part })) },
      "home", undefined, undefined, { "component.binary_sensor.entity_component.door.name": "Dør", "@language": "nb" }).entities;
    const at = (entityId: string, value: string, seconds: number) => ({ entityId, state: value, when: base - seconds * 1000 });
    const events = [
      // A first trip: the passenger door opens and closes; the all-doors sensor follows within milliseconds.
      at(doors[0][0], "on", 600), at(doors[2][0], "on", 600.01), at(doors[0][0], "off", 584), at(doors[2][0], "off", 584.02),
      // Three minutes later: the driver door, then the passenger door.
      at(doors[0][0], "on", 406), at(doors[1][0], "on", 406.003), at(doors[0][0], "off", 390), at(doors[1][0], "off", 390.01),
      at(doors[0][0], "on", 375), at(doors[2][0], "on", 375.01), at(doors[0][0], "off", 360), at(doors[2][0], "off", 360.01),
    ];
    const items = curateActivity(events, home, { mode: "curated", language: "nb", people: false, sources: home.map(entity => entity.preferenceId) });
    expect(sentences(items, norwegian)).toEqual([
      "Example car Dører ble lukket", "Example car Dør (passasjer foran) ble lukket", "Example car Dør (fører foran) ble lukket",
      "Example car Dører ble lukket", "Example car Dør (passasjer foran) ble lukket",
    ]);
    expect(items.map(item => item.count)).toEqual([4, 2, 2, 2, 2]);
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

  it("reports only appliance programmes as finished, not a car's climate or a mode that uses the running class", () => {
    const running = (entityId: string, friendly: string) => state(entityId, "off", { device_class: "running", friendly_name: friendly });
    const ids = ["binary_sensor.example_dryer_programme", "binary_sensor.example_car_climate", "binary_sensor.example_car_sentry_mode",
      "binary_sensor.example_car_preconditioning", "binary_sensor.example_car_service_mode", "binary_sensor.example_pump_compressor"];
    // The car's sensors keep their metric in the registry even when the entity ID was renamed.
    const home = mapHome({
      [ids[0]]: running(ids[0], "Example dryer Running"), [ids[1]]: running(ids[1], "Example car Climate"), [ids[2]]: running(ids[2], "Example car Sentry Mode"),
      [ids[3]]: running(ids[3], "Example car Preconditioning"), [ids[4]]: running(ids[4], "Example car Service Mode"), [ids[5]]: running(ids[5], "Example heat pump Compressor"),
      "binary_sensor.example_car_renamed": running("binary_sensor.example_car_renamed", "Example car Cabin"),
    }, { areas: [], devices: [], entities: [{ id: "renamed", entity_id: "binary_sensor.example_car_renamed", original_name: "Climate" }] }, "home").entities;
    expect(defaultActivitySources(home)).toEqual([id(ids[0])]);
    const events = [...ids, "binary_sensor.example_car_renamed"].flatMap((entityId, index) => [event(entityId, "on", 20 + index), event(entityId, "off", 10 - index)]);
    const items = curateActivity(events, home, { mode: "full", language: "en", people: false });
    expect(items.filter(item => item.kind === "finished").map(item => item.entityId)).toEqual([ids[0]]);
    expect(items.filter(item => item.kind === "started").map(item => item.entityId)).toEqual([ids[0]]);
    expect(sentences(items.filter(item => item.entityId === ids[1]), norwegian)).toEqual(["Example car Climate ble slått av", "Example car Climate ble slått på"]);
    // An added source still reports its changes, as turned on and off.
    expect(sentences(curateActivity(events, home, { mode: "curated", language: "en", people: false, sources: home.map(entity => entity.preferenceId) })))
      .toEqual(expect.arrayContaining(["Example dryer Running finished", "Example car Climate turned off", "Example car Cabin turned off"]));
  });

  it("writes logged dates, times, readings and states in the dashboard language and hides values it cannot read", () => {
    const logged = mapHome({
      "sensor.example_seen": state("sensor.example_seen", "2026-10-06T09:00:00+00:00", { device_class: "timestamp", friendly_name: "Example car Last seen" }),
      "sensor.example_summary": state("sensor.example_summary", "2026-10-06", { friendly_name: "Example summary" }),
      "input_datetime.example_made": state("input_datetime.example_made", "2026-10-06 08:00:23", { friendly_name: "Example clip made" }),
      "sensor.example_bass": state("sensor.example_bass", "2", { friendly_name: "Example speaker Bass", unit_of_measurement: "dB" }),
      "sensor.example_state": state("sensor.example_state", "charging", { friendly_name: "Example car State" }),
      "select.example_mode": state("select.example_mode", "previous", { friendly_name: "Example plug Startup", options: ["previous", "on"] }),
      "input_select.example_scene": state("input_select.example_scene", "Movie night", { friendly_name: "Example living mode", options: ["Movie night"] }),
      "scene.example_morning": state("scene.example_morning", "2026-10-06T05:00:00+00:00", { friendly_name: "Example morning" }),
      "button.example_identify": state("button.example_identify", "2026-10-06T05:00:00+00:00", { friendly_name: "Example identify" }),
    }, emptyRegistries, "home").entities;
    const log = (language: "en" | "nb") => sentences(curateActivity([
      event("sensor.example_seen", "2026-10-06T09:47:16.178+0000", 1), event("sensor.example_summary", "2026-10-06", 2), event("input_datetime.example_made", "2026-10-06 08:00:23", 3),
      event("sensor.example_bass", "-1", 4), event("sensor.example_state", "charging", 5), event("sensor.example_state", "OnOffSwitch", 6), event("sensor.example_state", "70d07efffea63716", 7),
      event("select.example_mode", "previous", 8), event("input_select.example_scene", "Movie night", 9), event("scene.example_morning", "2026-10-06T05:00:00+00:00", 10),
      event("button.example_identify", "2026-10-06T05:00:00+00:00", 11), event("sensor.example_gone", "suspended", 12),
    ], logged, { mode: "full", language, people: false, timeZone: "Europe/Oslo" }), createI18n(language));
    expect(log("en")).toEqual([
      "Example car Last seen changed to 6 Oct 2026, 11:47", "Example summary changed to 6 Oct 2026", "Example clip made changed to 6 Oct 2026, 08:00",
      "Example speaker Bass changed to -1 dB", "Example car State changed to Charging", "Example car State changed status", "Example car State changed status",
      "Example plug Startup changed to Previous", "Example living mode changed to Movie night", "Example morning was activated", "Example identify was pressed",
      "sensor.example_gone changed to Suspended",
    ]);
    expect(log("nb")).toEqual([
      "Example car Last seen endret til 6. okt. 2026, 11:47", "Example summary endret til 6. okt. 2026", "Example clip made endret til 6. okt. 2026, 08:00",
      "Example speaker Bass endret til −1 dB", "Example car State endret status", "Example car State endret status", "Example car State endret status",
      "Example plug Startup endret status", "Example living mode endret til Movie night", "Example morning ble aktivert", "Example identify ble trykket",
      "sensor.example_gone endret status",
    ]);
  });

  it("names openings by device and translated class when Home Assistant has no translation for the entity part", () => {
    // Fictional devices; Home Assistant fills untranslated integration names with English.
    const devices = [{ id: "dishwasher", name: "Example dishwasher" }, { id: "car", name: "Example car" }, { id: "own", name: "Example shed", name_by_user: "Our shed" }];
    const entries = [
      { id: "e1", entity_id: "binary_sensor.example_dishwasher_door", platform: "example_appliance", device_id: "dishwasher", original_name: "Door", translation_key: "door_status" },
      { id: "e2", entity_id: "binary_sensor.example_car_doors", platform: "example_mqtt", device_id: "car", original_name: "Doors" },
      { id: "e3", entity_id: "binary_sensor.example_car_driver_front", platform: "example_mqtt", device_id: "car", original_name: "Door (Driver Front)" },
      { id: "e4", entity_id: "cover.example_car_charger_door", platform: "example_car", device_id: "car", original_name: "Charger door" },
      { id: "e5", entity_id: "binary_sensor.example_shed_door", platform: "example_mqtt", device_id: "own", original_name: "Door", name: "Shed hatch" },
      { id: "e6", entity_id: "cover.example_car_frunk", platform: "example_car", device_id: "car", original_name: "Frunk" },
      { id: "e7", entity_id: "cover.example_car_trunk", platform: "example_car", device_id: "car", original_name: "Trunk" },
      { id: "e8", entity_id: "binary_sensor.example_car_rear_hatch", platform: "example_mqtt", device_id: "car", original_name: "Door (Rear Hatch)" },
    ];
    const opening = (entityId: string, value: string, friendly: string) => state(entityId, value, { device_class: "door", friendly_name: friendly });
    const home = mapHome({
      "binary_sensor.example_dishwasher_door": opening("binary_sensor.example_dishwasher_door", "off", "Example dishwasher Door"),
      "binary_sensor.example_car_doors": opening("binary_sensor.example_car_doors", "off", "Example car Doors"),
      "binary_sensor.example_car_driver_front": opening("binary_sensor.example_car_driver_front", "off", "Example car Door (Driver Front)"),
      "cover.example_car_charger_door": opening("cover.example_car_charger_door", "closed", "Example car Charger door"),
      "binary_sensor.example_shed_door": opening("binary_sensor.example_shed_door", "off", "Shed hatch"),
      "cover.example_car_frunk": opening("cover.example_car_frunk", "closed", "Example car Frunk"),
      "cover.example_car_trunk": opening("cover.example_car_trunk", "closed", "Example car Trunk"),
      "binary_sensor.example_car_rear_hatch": opening("binary_sensor.example_car_rear_hatch", "off", "Example car Door (Rear Hatch)"),
    }, { areas: [], devices, entities: entries }, "home", undefined, undefined, {
      "component.example_appliance.entity.binary_sensor.door_status.name": "Door",
      "component.binary_sensor.entity_component.door.name": "Dør", "component.cover.entity_component.door.name": "Dør", "@language": "nb",
    }).entities;
    const events = [event("binary_sensor.example_dishwasher_door", "on", 6), event("binary_sensor.example_car_doors", "off", 5), event("binary_sensor.example_car_driver_front", "off", 4),
      event("cover.example_car_charger_door", "closed", 3), event("binary_sensor.example_shed_door", "on", 2), event("cover.example_car_frunk", "open", 1),
      event("cover.example_car_trunk", "open", 0.5), event("binary_sensor.example_car_rear_hatch", "on", 0.2)];
    expect(sentences(curateActivity(events, home, { mode: "full", language: "nb", people: false }), norwegian)).toEqual([
      // A position the app cannot translate keeps the reported name, so the car's doors stay apart; the owner's own name is kept.
      "Example car Door (Rear Hatch) ble åpnet", "Example car Bagasjerom ble åpnet", "Example car Frunk ble åpnet", "Shed hatch ble åpnet", "Example car Ladeluke ble lukket",
      "Example car Dør (fører foran) ble lukket", "Example car Dører ble lukket", "Example dishwasher Dør ble åpnet",
    ]);
  });

  it("names a lock left in the integration's words by its doors or the translated lock domain", () => {
    const devices = [{ id: "car", name: "Example car" }, { id: "shed", name: "Example shed" }];
    const entries = [
      { id: "l1", entity_id: "lock.example_car_doors", platform: "example_car", device_id: "car", original_name: "Doors" },
      { id: "l2", entity_id: "lock.example_car_charge_port", platform: "example_car", device_id: "car", original_name: "Charge port lock" },
      { id: "l3", entity_id: "lock.example_shed_lock", platform: "example_lock", device_id: "shed", original_name: "Lock" },
    ];
    const states = Object.fromEntries(entries.map(entry => [entry.entity_id, state(entry.entity_id, "locked", { friendly_name: `${devices.find(device => device.id === entry.device_id)!.name} ${entry.original_name}` })]));
    const events = [event("lock.example_car_doors", "locked", 3), event("lock.example_car_charge_port", "locked", 2), event("lock.example_shed_lock", "unlocked", 1)];
    const log = (translations: Record<string, string>, language: "en" | "nb") => sentences(curateActivity(events,
      mapHome(states, { areas: [], devices, entities: entries }, "home", undefined, undefined, translations).entities, { mode: "full", language, people: false }), createI18n(language));
    expect(log({ "component.binary_sensor.entity_component.door.name": "Dør", "component.lock.entity_component._.name": "Lås", "@language": "nb" }, "nb"))
      .toEqual(["Example shed Lås ble låst opp", "Example car Charge port lock ble låst", "Example car Dører ble låst"]);
    expect(log({ "component.binary_sensor.entity_component.door.name": "Door", "component.lock.entity_component._.name": "Lock", "@language": "en" }, "en"))
      .toEqual(["Example shed Lock unlocked", "Example car Charge port lock locked", "Example car Doors locked"]);
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

describe("Latest events", () => {
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
  const panel = () => within(screen.getByRole("region", { name: "Latest events" }));
  const rows = () => panel().queryAllByRole("listitem").map(row => row.textContent);
  beforeEach(() => {
    subscribers = [];
    subscribeLogbook.mockClear();
    family.value = { activity: { panel: true, people: false }, now, cameras: { items: [] } };
  });

  it("subscribes to the curated sources, shows the six newest items of the last 24 hours and updates live", () => {
    render(view());
    expect(panel().getByText("Loading activity…")).toBeVisible();
    const [{ options, receive }] = subscribers;
    expect(options.entityIds).toEqual(curatedActivityEntityIds(activityEntities, { people: false }));
    expect(options.entityIds).not.toContain("person.example_parent");
    // The whole backfill, so the oldest shown changes can be compared with the state before them.
    expect(Date.now() - options.start.getTime()).toBeGreaterThanOrEqual(MAX_LOGBOOK_BACKFILL_MS - 60000);
    act(() => receive([1, 2, 3, 4, 5, 6, 7].map(step => event("binary_sensor.example_garage", step % 2 ? "on" : "off", step * 10))));
    expect(rows()).toHaveLength(6);
    expect(rows()[0]).toBe("Garage door opened10 minutes ago");
    expect(panel().getAllByRole("link", { name: "Garage door opened" })[0]).toHaveAttribute("href", "/entities/binary_sensor.example_garage");
    act(() => receive([event("lock.example_front", "unlocked", 1)]));
    expect(rows()[0]).toBe("Front door unlocked1 minute ago");
    expect(rows()).toHaveLength(6);
    // Older events only tell the panel what came before: unlocking again after an unlock a day and a half ago is no change.
    cleanup();
    render(view());
    act(() => subscribers[1].receive([event("lock.example_front", "unlocked", 36 * 60), event("lock.example_front", "unlocked", 5), event("binary_sensor.example_garage", "on", 25 * 60)]));
    expect(panel().getByText("Nothing has happened in the last 24 hours.")).toBeVisible();
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
    expect(screen.queryByRole("region", { name: "Latest events" })).toBeNull();
    expect(subscribeLogbook).not.toHaveBeenCalled();
  });

  it("shows on Today with the same sources and people choice even when hidden on Smart home", () => {
    family.value = { ...family.value, activity: { panel: false, people: false } };
    render(<AppContext.Provider value={app() as never}><MemoryRouter><RecentActivity placement="today" /></MemoryRouter></AppContext.Provider>);
    const [{ options, receive }] = subscribers;
    expect(options.entityIds).toEqual(curatedActivityEntityIds(activityEntities, { people: false }));
    expect(options.entityIds).not.toContain("person.example_parent");
    expect(panel().getByText("Loading activity…")).toBeVisible();
    act(() => receive([event("person.example_parent", "home", 4), event("binary_sensor.example_garage", "on", 3)]));
    expect(rows()).toEqual(["Garage door opened3 minutes ago"]);
    expect(panel().getByRole("link", { name: "All activity" })).toHaveAttribute("href", "/settings/activity");
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
    family.value = { activity: { panel: true, people: false }, dashboard: { recentActivity: false }, now: new Date(base), today: "2026-10-06", cameras: { items: [] } };
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

describe("Latest events settings", () => {
  const setActivity = vi.fn(() => true);
  const view = () => <AppContext.Provider value={{ homeOnline: true, subscribeLogbook: vi.fn(() => () => {}), haUrl: "", currentHome: { entities: activityEntities, areas: [], timeZone: "Europe/Oslo" } } as never}>
    <MemoryRouter initialEntries={["/settings/activity?panel=recent"]}><History /></MemoryRouter></AppContext.Provider>;
  beforeEach(() => {
    setActivity.mockClear();
    family.value = { activity: { panel: true, people: false }, dashboard: { recentActivity: false }, setActivity, now: new Date(base), today: "2026-10-06", cameras: { items: [] } };
  });

  it("turns the panel off and people on, with people off by default", () => {
    render(view());
    const panel = screen.getByRole("switch", { name: "Show on Smart home" }), people = screen.getByRole("switch", { name: "Include people coming and going" });
    expect(panel).toBeChecked();
    expect(people).not.toBeChecked();
    fireEvent.click(panel);
    expect(setActivity).toHaveBeenLastCalledWith({ panel: false });
    fireEvent.click(people);
    expect(setActivity).toHaveBeenLastCalledWith({ people: true });
  });

  it("names where the panel is shown, including Today", () => {
    const { unmount } = render(view());
    expect(screen.getByText("Shown on Smart home")).toBeInTheDocument();
    unmount();
    family.value = { ...family.value, activity: { panel: false, people: false }, dashboard: { recentActivity: true } };
    const second = render(view());
    expect(screen.getByText("Shown on Today")).toBeInTheDocument();
    second.unmount();
    family.value = { ...family.value, activity: { panel: true, people: false } };
    render(view());
    expect(screen.getByText("Shown on Smart home and Today")).toBeInTheDocument();
  });

  it("adds a source to the suggested ones and restores the suggestions", () => {
    const { unmount } = render(view());
    expect(screen.queryByRole("button", { name: "Use suggested sources" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Choose activity sources" }));
    const picker = within(screen.getByRole("dialog", { name: "Choose activity sources" }));
    fireEvent.change(picker.getByRole("searchbox", { name: "Search devices and entities" }), { target: { value: "light.example_lamp" } });
    fireEvent.click(picker.getByRole("checkbox", { name: "Reading lamp" }));
    fireEvent.click(picker.getByRole("button", { name: "Done" }));
    const [[{ sources }]] = setActivity.mock.calls as unknown as [[{ sources: string[] }]];
    expect(sources).toEqual(expect.arrayContaining([...defaultActivitySources(activityEntities), id("light.example_lamp")]));
    unmount();
    family.value = { ...family.value, activity: { panel: true, people: false, sources: [id("light.example_lamp")] } };
    render(view());
    fireEvent.click(screen.getByRole("button", { name: "Use suggested sources" }));
    expect(setActivity).toHaveBeenLastCalledWith({ sources: undefined });
  });
});
