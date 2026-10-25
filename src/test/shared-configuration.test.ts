import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { SharedConfiguration } from "@/lib/shared-configuration";
import { emptyConfiguration, emptyPlanner, parseConfiguration, type Configuration, type TimetableSettings } from "../../shared/configuration";

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

it("shares notification rules across screens and restores them with the existing backup flow", async () => {
  const backend = server(), a = await backend.start(), b = await backend.start();
  a.updateSettings(p => ({ ...p, notifications: { enabled: true, presentation: "banner", pages: "today", rules: [{ id: "fictional-rule", title: "Example task", message: "", enabled: true, kind: "ongoing", trigger: { type: "state", entity: "home|example", attribute: "", operator: "eq", value: "running" }, cameraEntity: "", detailEntity: "", durationSeconds: 60, cooldownSeconds: 10 }] } }));
  await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
  await b.refresh();
  const backup = parseConfiguration(JSON.stringify(b.getSnapshot().config));
  expect(backup.settings.notifications.rules[0].title).toBe("Example task");
  expect(backup.settings.notifications).toMatchObject({ presentation: "banner", pages: "today" });
  await b.replace(emptyConfiguration());
  await b.replace(backup);
  await a.refresh();
  expect(a.getSnapshot().config.settings.notifications).toEqual(backup.settings.notifications);
});

it("keeps legacy visibility migratable and starts new configurations with no enabled entities", () => {
  const config = emptyConfiguration();
  const { smartHome, ...oldSettings } = config.settings;
  expect(parseConfiguration(JSON.stringify({ ...config, settings: oldSettings })).settings.smartHome).toEqual({ hiddenDevices: [], hiddenEntities: [], cardDensities: {}, cards: {} });
  const read = (smartHome: unknown) => parseConfiguration(JSON.stringify({ ...config, settings: { ...oldSettings, smartHome } }));
  expect(smartHome.knownEntities).toEqual([]);
  expect(read({ hiddenDevices: ["example-device"] }).settings.smartHome).toEqual({ hiddenEntities: [], hiddenDevices: ["example-device"], cardDensities: {}, cards: {} });
  for (const invalid of [{ hiddenDevices: "device" }, { hiddenEntities: [1] }, { knownEntities: [1] }, { knownEntities: [""] }, { knownEntities: "entity" }, { hiddenEntities: [""] }, { unknown: [] }, null]) expect(() => read(invalid)).toThrow();
});

it("shares smart home visibility across screens and restores it from backups", async () => {
  const backend = server();
  const a = await backend.start(), b = await backend.start();
  const smartHome = { cardDensities: {}, cards: {}, hiddenDevices: ["example-device"], hiddenEntities: ["home|example-entity"], knownEntities: ["home|example-entity", "home|example-light"] };
  a.updateSettings(p => ({ ...p, smartHome }));
  await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
  await b.refresh();
  expect(b.getSnapshot().config.settings.smartHome).toEqual(smartHome);
  const backup = parseConfiguration(JSON.stringify(b.getSnapshot().config));
  b.updateSettings(p => ({ ...p, smartHome: { hiddenDevices: [], hiddenEntities: [] } }));
  await waitFor(() => expect(b.getSnapshot().dirty).toBe(false));
  await b.replace(backup);
  await a.refresh();
  expect(a.getSnapshot().config.settings.smartHome).toEqual(smartHome);
});

it("validates per-card density and shares it across screens and backups without changing visibility", async () => {
  const config = emptyConfiguration();
  const read = (cardDensities: unknown) => parseConfiguration(JSON.stringify({ ...config, settings: { ...config.settings, smartHome: { ...config.settings.smartHome, cardDensities } } }));
  expect(config.settings.smartHome.cardDensities).toEqual({});
  expect(read({ "home|example": "supercompact" }).settings.smartHome.cardDensities).toEqual({ "home|example": "supercompact" });
  for (const invalid of [{ "home|example": "large" }, { "home|example": true }, { "": "compact" }, { constructor: "compact" }, [], null]) expect(() => read(invalid)).toThrow();
  const backend = server();
  const a = await backend.start(), b = await backend.start();
  a.updateSettings(p => ({ ...p, smartHome: { ...p.smartHome, cardDensities: { "home|example": "compact", "home|other": "original" } } }));
  await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
  await b.refresh();
  const backup = parseConfiguration(JSON.stringify(b.getSnapshot().config));
  expect(backup.settings.smartHome.cardDensities).toEqual({ "home|example": "compact", "home|other": "original" });
  expect(backup.settings.smartHome.knownEntities).toEqual([]);
  await b.replace(config);
  await b.replace(backup);
  await a.refresh();
  expect(a.getSnapshot().config.settings.smartHome).toEqual(backup.settings.smartHome);
});

it("preserves the current dashboard for older backups and validates section choices", () => {
  const config = emptyConfiguration();
  const { dashboard, ...oldSettings } = config.settings;
  expect(parseConfiguration(JSON.stringify({ ...config, settings: oldSettings })).settings.dashboard).toEqual(dashboard);
  const { showTomorrow, ...sections } = dashboard;
  expect(showTomorrow).toBe(false);
  expect(Object.values(sections).every(Boolean)).toBe(true);
  const read = (dashboard: unknown) => parseConfiguration(JSON.stringify({ ...config, settings: { ...oldSettings, dashboard } }));
  expect(read({ shopping: false }).settings.dashboard).toEqual({ ...dashboard, shopping: false });
  const { day: _day, ...oldDashboard } = sections;
  expect(read({ ...oldDashboard, week: false }).settings.dashboard).toEqual({ ...dashboard, week: false });
  for (const invalid of [{ shopping: "false" }, { showTomorrow: "true" }, { unknown: true }, null, []]) expect(() => read(invalid)).toThrow();
});

it("shares dashboard sections across screens and restores them from backups", async () => {
  const backend = server();
  const a = await backend.start(), b = await backend.start();
  a.updateSettings(p => ({ ...p, dashboard: { ...p.dashboard, day: false, showTomorrow: true, week: false, shopping: false } }));
  await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
  await b.refresh();
  expect(b.getSnapshot().config.settings.dashboard).toEqual({ ...emptyPlanner().dashboard, day: false, showTomorrow: true, week: false, shopping: false });
  const backup = parseConfiguration(JSON.stringify(b.getSnapshot().config));
  b.updateSettings(p => ({ ...p, dashboard: { ...p.dashboard, shopping: true } }));
  await waitFor(() => expect(b.getSnapshot().dirty).toBe(false));
  await b.replace(backup);
  await a.refresh();
  expect(a.getSnapshot().config.settings.dashboard).toEqual(backup.settings.dashboard);
});

it("defaults old timetables to images and validates calendar roles without accepting event content", () => {
  const config = emptyConfiguration();
  delete config.settings.timetableSettings;
  expect(parseConfiguration(JSON.stringify(config)).settings.timetableSettings).toEqual({});
  expect(parseConfiguration(JSON.stringify({ ...config, settings: { ...config.settings, timetableSettings: { example: { type: "calendar" } } } })).settings.timetableSettings.example.education).toBe("school");
  for (const settings of [{ type: "unknown" }, { education: "unknown" }, { type: "calendar", calendars: { example: "unknown" } }, { type: "calendar", events: [] }]) {
    expect(() => parseConfiguration(JSON.stringify({ ...config, settings: { ...config.settings, timetableSettings: { example: settings } } }))).toThrow();
  }
});

it("shares timetable types and source roles, backs them up and keeps image pages when switching", async () => {
  const backend = server();
  const a = await backend.start(), b = await backend.start();
  const settings: TimetableSettings = { type: "calendar", education: "kindergarten", calendars: { example: ["events", "popupActivities"], notices: ["message", "popupMessages"], closed: ["closures", "popupClosures"], opening: ["hours", "popupHours"], extra: ["events", "popupMeetings"] } };
  a.updateSettings(p => ({ ...p, timetables: { example: ["/example.png"] }, timetableSettings: { example: settings } }));
  await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
  await b.refresh();
  expect(b.getSnapshot().config.settings.timetableSettings.example).toEqual(settings);
  const backup = parseConfiguration(JSON.stringify(b.getSnapshot().config));
  b.updateSettings(p => ({ ...p, timetableSettings: { example: { ...settings, type: "images" } } }));
  await waitFor(() => expect(b.getSnapshot().dirty).toBe(false));
  expect(b.getSnapshot().config.settings.timetables.example).toEqual(["/example.png"]);
  await b.replace(backup);
  await a.refresh();
  expect(a.getSnapshot().config.settings.timetableSettings.example).toEqual(settings);
});

it("uses School sections for both views and migrates older week-only settings", () => {
  const config = emptyConfiguration();
  const read = (calendars: unknown) => parseConfiguration(JSON.stringify({ ...config, settings: { ...config.settings, timetableSettings: { example: { type: "calendar", calendars } } } })).settings.timetableSettings.example.calendars;
  expect(read({ activities: "events", notices: "message", closed: "closures", opening: "hours" })).toEqual({
    activities: ["events", "popupActivities"], notices: ["message", "popupMessages"], closed: ["closures", "popupClosures"], opening: ["hours", "popupHours"],
  });
  expect(read({ activities: ["events"], notices: ["message", "popup"], extra: ["popup"] })).toEqual({ notices: ["message", "popupMessages"], extra: ["events", "popupActivities"] });
  expect(read({ meetings: ["popupMeetings"], old: ["hours"], mixed: ["closures", "popupHours"] })).toEqual({ meetings: ["events", "popupMeetings"], mixed: ["hours", "popupHours"] });
  expect(read({ activities: ["events"], notices: ["message"] })).toEqual({ activities: ["events", "popupActivities"], notices: ["message", "popupMessages"] });
  expect(read({})).toEqual({});
  const categories = { example: ["events", "popupActivities", "popupMeetings", "hours", "popupHours", "closures", "popupClosures", "message", "popupMessages"] };
  expect(read(categories)).toEqual(categories);
  expect(read(read({ closed: ["closures", "popup"], opening: ["hours", "popup"] }))).toEqual({ closed: ["closures", "popupClosures"], opening: ["hours", "popupHours"] });
  for (const roles of [[], ["unknown"], ["events", "events"], ["popup", "unknown"], "popup"]) expect(() => read({ example: roles })).toThrow();
});

it("defaults older settings to Pearl and rejects unknown palettes", () => {
  const config = emptyConfiguration();
  const { colorPalette: _colorPalette, ...oldAppearance } = config.settings.appearance;
  expect(parseConfiguration(JSON.stringify({ ...config, settings: { ...config.settings, appearance: oldAppearance } })).settings.appearance.colorPalette).toBe("pearl");
  config.settings.appearance.colorPalette = "unknown" as never;
  expect(() => parseConfiguration(JSON.stringify(config))).toThrow();
});

it.each(["pearl", "sage", "sand", "dusk", "mist", "rose", "olive", "clay", "lavender", "seafoam", "honey", "slate"] as const)("shares the %s palette and includes it in backups", async colorPalette => {
  const backend = server();
  const a = await backend.start(), b = await backend.start();
  a.updateSettings(p => ({ ...p, appearance: { ...p.appearance, colorPalette } }));
  await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
  await b.refresh();
  expect(b.getSnapshot().config.settings.appearance.colorPalette).toBe(colorPalette);
  const backup = parseConfiguration(JSON.stringify(b.getSnapshot().config));
  expect(backup.settings.appearance.colorPalette).toBe(colorPalette);
  expect(backup.settings.appearance.theme).toBe("dark");
});

describe("shared configuration", () => {
  it("polls upload errors without discarding unsaved settings or their conflict", async () => {
    const backend = server();
    let timetableError = null;
    const send = vi.fn(async (method: "GET" | "PUT", body?: string, revision?: string) => {
      if (method === "PUT") return response(409, {});
      const result = await backend.request(method, body, revision);
      return response(200, { ...await result.json(), timetableError });
    });
    const store = await backend.start(send);
    store.updateSettings(p => ({ ...p, memberOrder: ["unsaved"] }));
    await waitFor(() => expect(store.getSnapshot().error).toMatch(/Another screen/));
    timetableError = { id: "upload-one", member: "home|person.one", message: "This PDF could not be converted." };
    await store.refresh();
    expect(store.getSnapshot()).toMatchObject({ timetableError, dirty: true, error: expect.stringMatching(/Another screen/) });
    expect(store.getSnapshot().config.settings.memberOrder).toEqual(["unsaved"]);
    timetableError = null;
    await store.refresh();
    expect(store.getSnapshot().timetableError).toBeNull();
    expect(send.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(1);
  });

  it("shares settings across devices without uploading a browser's defaults", async () => {
    const backend = server();
    const a = await backend.start(), b = await backend.start();
    expect(backend.request.mock.calls.every(([method]) => method === "GET")).toBe(true);
    a.updateSettings(planner => ({ ...planner, memberOrder: [`${url}|person.one`], hiddenMembers: [`${url}|person.one`] }));
    await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
    await b.refresh();
    expect(b.getSnapshot().config).toEqual(a.getSnapshot().config);
    expect(b.getSnapshot().config.settings.hiddenMembers).toEqual([`${url}|person.one`]);
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
    store.updateSettings(p => ({ ...p, memberOrder: ["one"] }));
    const firstResult = await pending.promise;
    store.updateSettings(p => ({ ...p, timetableEnabled: { one: true } }));
    hold.resolve(firstResult);
    await waitFor(() => expect(store.getSnapshot().dirty).toBe(false));
    expect(backend.current().settings).toMatchObject({ memberOrder: ["one"], timetableEnabled: { one: true } });
    expect(send.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(2);
  });

  it("preserves an unsaved draft on conflict and only discards it on explicit reload", async () => {
    const backend = server();
    const a = await backend.start(), b = await backend.start();
    a.updateSettings(p => ({ ...p, memberOrder: ["one"] }));
    await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
    b.updateSettings(p => ({ ...p, memberOrder: ["two"] }));
    await waitFor(() => expect(b.getSnapshot().error).toMatch(/Another screen/));
    expect(b.getSnapshot().config.settings.memberOrder).toEqual(["two"]);
    expect(b.getSnapshot().dirty).toBe(true);
    await b.refresh();
    expect(b.getSnapshot().dirty).toBe(true);
    expect(backend.current().settings.memberOrder).toEqual(["one"]);
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
    store.updateSettings(p => ({ ...p, memberOrder: ["one"] }));
    await waitFor(() => expect(store.getSnapshot().error).toBe("Network unavailable"));
    await store.refresh();
    expect(send.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(1);
    failing = false;
    await store.retry();
    expect(store.getSnapshot().dirty).toBe(false);
    expect(backend.current().settings.memberOrder).toEqual(["one"]);
  });

  it("does not let a stale read or stopped session overwrite a newer draft", async () => {
    const backend = server(), waiting = deferred<Response>();
    let delay = false;
    const send = vi.fn(async (method: "GET" | "PUT", body?: string, revision?: string) => delay && method === "GET" ? waiting.promise : backend.request(method, body, revision));
    const store = await backend.start(send);
    delay = true;
    const refresh = store.refresh();
    store.updateSettings(p => ({ ...p, memberOrder: ["one"] }));
    store.stop();
    waiting.resolve(response(200, { revision: "0".repeat(64), config: emptyConfiguration() }));
    await refresh;
    expect(store.getSnapshot().config.settings.memberOrder).toEqual(["one"]);
    expect(store.getSnapshot().dirty).toBe(true);
  });

  it("ignores a stale read that arrives after a successful save", async () => {
    const backend = server(), waiting = deferred<Response>();
    let delay = false;
    const send = vi.fn(async (method: "GET" | "PUT", body?: string, revision?: string) => delay && method === "GET" ? waiting.promise : backend.request(method, body, revision));
    const store = await backend.start(send);
    delay = true;
    const refresh = store.refresh();
    store.updateSettings(p => ({ ...p, memberOrder: ["one"] }));
    await waitFor(() => expect(store.getSnapshot().dirty).toBe(false));
    waiting.resolve(response(200, { revision: "0".repeat(64), config: emptyConfiguration() }));
    await refresh;
    expect(store.getSnapshot().config).toEqual(backend.current());
    store.updateSettings(p => ({ ...p, timetableEnabled: { one: true } }));
    await waitFor(() => expect(store.getSnapshot().dirty).toBe(false));
    expect(store.getSnapshot().error).toBe("");
  });
});

it("rejects invalid or unsupported backup files instead of silently dropping their fields", () => {
  const config: Configuration = emptyConfiguration();
  expect(parseConfiguration(JSON.stringify(config))).toEqual(config);
  expect(() => parseConfiguration(JSON.stringify({ ...config, version: 4 }))).toThrow();
  expect(() => parseConfiguration(JSON.stringify({ ...config, refresh_token: "fixture" }))).toThrow();
  config.settings.calendar = { view: "invalid", startDay: "today" } as never;
  expect(() => parseConfiguration(JSON.stringify(config))).toThrow();
});

it("rejects old formats and HA data in settings backups", () => {
  const config = emptyConfiguration();
  expect(() => parseConfiguration(JSON.stringify({ ...config, version: 1 }))).toThrow();
  for (const field of ["events", "items", "people", "states"]) {
    const input = structuredClone(config);
    Object.assign(input.settings, { [field]: [] });
    expect(() => parseConfiguration(JSON.stringify(input))).toThrow();
  }
});

it("shares person colors across screens and restores them from backups", async () => {
  const backend = server();
  const a = await backend.start(), b = await backend.start();
  a.updateSettings(p => ({ ...p, memberColors: { "home|person.example": "#123456" } }));
  await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
  await b.refresh();
  expect(b.getSnapshot().config.settings.memberColors).toEqual({ "home|person.example": "#123456" });
  const backup = parseConfiguration(JSON.stringify(b.getSnapshot().config));
  a.updateSettings(p => ({ ...p, memberColors: { "home|person.example": "#abcdef" } }));
  await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
  await b.refresh();
  await b.replace(backup);
  await a.refresh();
  expect(a.getSnapshot().config.settings.memberColors).toEqual(backup.settings.memberColors);
});

it("shares language changes, keeps conflicting drafts, and restores the language from backups", async () => {
  const backend = server();
  const a = await backend.start(), b = await backend.start();
  a.updateSettings(p => ({ ...p, language: "nb" }));
  await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
  b.updateSettings(p => ({ ...p, appearance: { ...p.appearance, compactMode: true } }));
  await waitFor(() => expect(b.getSnapshot().error).toMatch(/Another screen/));
  expect(backend.current().settings.language).toBe("nb");
  await b.refresh(true);
  expect(b.getSnapshot().config.settings.language).toBe("nb");
  const backup = structuredClone(b.getSnapshot().config);
  a.updateSettings(p => ({ ...p, language: "en" }));
  await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
  await b.refresh();
  expect(b.getSnapshot().config.settings.language).toBe("en");
  await b.replace(backup);
  await a.refresh();
  expect(a.getSnapshot().config.settings.language).toBe("nb");
});


it("shares grouped device cards with linked entities and restores them from backups", async () => {
  const backend = server(), a = await backend.start(), b = await backend.start();
  const cards = { "device:example": { mainEntity: "home|vacuum", linkedEntities: ["home|map", "home|maintenance"], group: "Cleaning" } };
  a.updateSettings(p => ({ ...p, smartHome: { ...p.smartHome, cards } }));
  await waitFor(() => expect(a.getSnapshot().dirty).toBe(false));
  await b.refresh();
  expect(b.getSnapshot().config.settings.smartHome.cards).toEqual(cards);
  const backup = parseConfiguration(JSON.stringify(b.getSnapshot().config));
  b.updateSettings(p => ({ ...p, smartHome: { ...p.smartHome, cards: {} } }));
  await waitFor(() => expect(b.getSnapshot().dirty).toBe(false));
  await b.replace(backup); await a.refresh();
  expect(a.getSnapshot().config.settings.smartHome.cards).toEqual(cards);
});
