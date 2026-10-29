import { describe, expect, it } from "vitest";
import { notificationRuleSchema, notificationSettingsSchema, type NotificationRule } from "../../shared/notifications";
import { emptyConfiguration, parseConfiguration } from "../../shared/configuration";
import { matchesState, notificationProgress, notificationReadings, NotificationEngine } from "@/lib/notifications";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";

const rule = (overrides: Partial<NotificationRule> = {}) => notificationRuleSchema.parse({ id: "example-rule", title: "Example appliance", kind: "ongoing", trigger: { type: "state", entity: "home|sensor.example", operator: "gt", value: "5" }, ...overrides });
const entities = (value: string, attributes = {}, id = "sensor.example") => mapHome({ [id]: state(id, value, attributes) }, emptyRegistries, "home").entities;
const now = Date.parse("2026-10-24T12:00:00Z");
const zone = "Europe/Oslo";

describe("notification configuration", () => {
  it("migrates single readings, preserves multiple selections and honors explicit clearing", () => {
    const { detailEntities: _details, ...legacy } = rule();
    const migrated = notificationRuleSchema.parse({ ...legacy, detailEntity: "home|sensor.remaining" });
    expect(migrated.detailEntities).toEqual(["home|sensor.remaining"]);
    expect(migrated).not.toHaveProperty("detailEntity");
    expect(notificationRuleSchema.parse(legacy).detailEntities).toEqual([]);
    expect(notificationRuleSchema.parse({ ...legacy, detailEntity: "" }).detailEntities).toEqual([]);
    expect(notificationRuleSchema.parse({ ...legacy, detailEntity: "home|sensor.remaining", detailEntities: [] }).detailEntities).toEqual([]);
    const config = emptyConfiguration();
    config.settings.notifications.rules = [migrated, rule({ id: "multiple", detailEntities: ["home|sensor.remaining", "home|sensor.progress"] })];
    expect(parseConfiguration(JSON.stringify(config))).toEqual(config);
    for (const detailEntities of [null, "sensor.example", [""], ["x".repeat(513)], ["same", "same"], Array.from({ length: 101 }, (_, i) => `sensor.example_${i}`)]) {
      expect(notificationRuleSchema.safeParse({ ...legacy, detailEntities }).success).toBe(false);
    }
  });
  it("defaults to no rules and preserves configured rules through backups", () => {
    const config = emptyConfiguration();
    delete config.settings.notifications;
    expect(parseConfiguration(JSON.stringify(config)).settings.notifications).toEqual({ enabled: true, presentation: "section", pages: "main", rules: [] });
    config.settings.notifications = { enabled: true, presentation: "banner", pages: "today", rules: [rule()] };
    expect(parseConfiguration(JSON.stringify(config))).toEqual(config);
    for (const invalid of [{ presentation: "toast" }, { pages: "settings" }]) expect(notificationSettingsSchema.safeParse(invalid).success).toBe(false);
  });
  it("rejects duplicate IDs, invalid ranges, camera-less popups and incompatible triggers", () => {
    expect(notificationSettingsSchema.safeParse({ rules: [rule(), rule()] }).success).toBe(false);
    for (const changes of [{ kind: "camera" }, { durationSeconds: 0 }, { cooldownSeconds: -1 }, { title: " " },
      { trigger: { type: "state", entity: "example", operator: "gt", value: "NaN" } },
      { trigger: { type: "ha-event", eventType: "example_event", filters: { nested: {} } } },
      { trigger: { type: "entity-event", entity: "example" } }]) {
      expect(notificationRuleSchema.safeParse({ ...rule(), ...changes }).success).toBe(false);
    }
  });
});

describe("notification lifecycle", () => {
  it("shows active tasks immediately, updates from attributes, and clears completed or unavailable tasks", () => {
    const engine = new NotificationEngine();
    const update = (value: string) => engine.update([rule()], entities(value), {}, true, now, zone);
    expect(update("10")).toHaveLength(1);
    expect(update("11")[0].id).toBe(update("12")[0].id);
    expect(update("0")).toHaveLength(0);
    expect(update("unknown")).toHaveLength(0);
    expect(update("unavailable")).toHaveLength(0);
    const attrRule = rule({ trigger: { type: "state", entity: "home|sensor.example", attribute: "progress", operator: "lt", value: "100" } });
    expect(matchesState(attrRule, entities("running", { progress: 40 })[0])).toBe(true);
    for (const value of [undefined, null, "", " ", true, {}, "unknown"]) expect(matchesState(attrRule, entities("running", { progress: value })[0])).toBe(false);
  });
  it("keeps current alerts dismissed until the condition clears, and removes disabled or edited rules", () => {
    const engine = new NotificationEngine(), current = rule({ kind: "current" });
    const update = (value: string, rules = [current]) => engine.update(rules, entities(value), {}, true, now, zone);
    engine.dismiss(update("10")[0].id);
    expect(update("11")).toHaveLength(0);
    update("0");
    expect(update("10")).toHaveLength(1);
    expect(update("10", [{ ...current, enabled: false }])).toHaveLength(0);
    expect(update("10", [{ ...current, trigger: { type: "state", entity: "home|sensor.example", operator: "gt", value: "20", attribute: "" } }])).toHaveLength(0);
  });
  it("opens cameras only on fresh transitions, expires them, and never replays on reconnect or sensor recovery", () => {
    const engine = new NotificationEngine(), camera = rule({ kind: "camera", cameraEntity: "home|camera.example", durationSeconds: 10 });
    const update = (value: string, offset = 0, online = true) => engine.update([camera], entities(value), {}, online, now + offset, zone);
    expect(update("10")).toHaveLength(0);
    update("0");
    expect(update("10")[0].popup).toBe(true);
    expect(update("10", 10001)).toHaveLength(0);
    update("0", 11000, false);
    expect(update("10", 12000)).toHaveLength(0);
    update("unavailable", 13000);
    expect(update("10", 14000)).toHaveLength(0);
    update("0", 15000);
    expect(update("10", 16000)).toHaveLength(1);
  });
  it("uses event timestamps, supports the first event from unknown, filters event types and applies cooldown", () => {
    const engine = new NotificationEngine(), eventRule = rule({ kind: "current", trigger: { type: "entity-event", entity: "home|event.example", eventType: "pressed" } });
    const update = (value: string, type = "pressed", offset = 0) => engine.update([eventRule], entities(value, { event_type: type }, "event.example"), {}, true, now + offset, zone);
    expect(update("unknown")).toHaveLength(0);
    const first = update(new Date(now).toISOString())[0];
    expect(first).toBeDefined();
    expect(update(new Date(now + 1000).toISOString())[0].id).toBe(first.id);
    expect(update(new Date(now + 20000).toISOString(), "released", 20000)[0].id).toBe(first.id);
    expect(update(new Date(now + 21000).toISOString(), "pressed", 21000)[0].id).not.toBe(first.id);
  });
  it("matches raw events by type and exact filters without retaining the payload", () => {
    const engine = new NotificationEngine(), eventRule = rule({ kind: "camera", cameraEntity: "home|camera.example", trigger: { type: "ha-event", eventType: "example_event", filters: { action: "pressed", device_id: "fictional-device" } } });
    engine.update([eventRule], [], {}, true, now, zone);
    expect(engine.receive([eventRule], { event_type: "example_event", data: { action: "released", device_id: "fictional-device" } }, now)).toEqual([]);
    const result = engine.receive([eventRule], { event_type: "example_event", data: { action: "pressed", device_id: "fictional-device", private_payload: "never retain" } }, now);
    expect(result).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("private_payload");
    engine.camera(result[0].id, false);
    expect(engine.list()[0].popup).toBe(false);
    engine.camera(result[0].id, true);
    expect(engine.list()[0].popup).toBe(true);
  });
  it("handles overlapping calendar events, lead time, dismissal and exclusive ends in the home timezone", () => {
    const engine = new NotificationEngine(), calendarRule = rule({ kind: "current", trigger: { type: "calendar", entity: "home|calendar.example", leadMinutes: 15 } });
    const calendar = entities("on", {}, "calendar.example");
    const plans = [
      { uid: "example-one", summary: "Example event", start: "2026-10-24T12:10:00Z", end: "2026-10-24T13:00:00Z" },
      { uid: "example-two", summary: "Example all-day", start: { date: "2026-10-24" }, end: { date: "2026-10-25" } },
    ];
    const update = (time: number) => engine.update([calendarRule], calendar, { "calendar.example": plans }, true, time, zone);
    expect(update(now)).toHaveLength(2);
    plans[0].summary = "Updated example event";
    expect(update(now)[0].eventTitle).toBe("Updated example event");
    engine.dismiss(update(now)[0].id);
    plans[0].summary = "Another example title";
    expect(update(now + 1000)).toHaveLength(1);
    expect(update(Date.parse("2026-10-24T22:00:00Z"))).toHaveLength(0);
  });
});

describe("notification progress", () => {
  const progress = { current: { type: "entity" as const, entity: "home|sensor.example", attribute: "" }, start: { type: "value" as const, value: 0 }, end: { type: "value" as const, value: 100 } };
  it("supports decimal readings, count-up, countdown, attributes and live total entities", () => {
    expect(notificationProgress(progress, entities("42.5"))).toMatchObject({ current: 42.5, percent: 42.5 });
    const countdown = { ...progress, start: { type: "entity" as const, entity: "home|sensor.example", attribute: "total" }, end: { type: "value" as const, value: 0 } };
    expect(notificationProgress(countdown, entities("30", { total: 120 }))).toMatchObject({ percent: 75 });
    expect(notificationProgress(countdown, entities("30", { total: 60 }))).toMatchObject({ percent: 50 });
    expect(notificationProgress({ ...progress, current: { ...progress.current, attribute: "done" }, end: { type: "entity", entity: "home|sensor.example", attribute: "total" } }, entities("running", { done: 12, total: 80 }))).toMatchObject({ percent: 15 });
    expect(notificationProgress(progress, entities("-1"))?.percent).toBe(0);
    expect(notificationProgress(progress, entities("200"))?.percent).toBe(100);
    expect(notificationProgress(countdown, entities("-1", { total: 60 }))?.percent).toBe(100);
  });
  it("never invents progress for missing, invalid, private or equal readings", () => {
    for (const value of ["", " ", "unknown", "unavailable", "missing", "NaN", "Infinity", "on"]) expect(notificationProgress(progress, entities(value))).toBeUndefined();
    expect(notificationProgress(progress, [])).toBeUndefined();
    expect(notificationProgress(progress, entities("40", { mode: "password" }))).toBeUndefined();
    expect(notificationProgress({ ...progress, end: progress.start }, entities("40"))).toBeUndefined();
    for (const value of [true, false, null, {}, [], ""]) expect(notificationProgress({ ...progress, current: { ...progress.current, attribute: "done" } }, entities("running", { done: value }))).toBeUndefined();
  });
  it("validates progress and activity styles and preserves them through configuration backups", () => {
    const configured = rule({ progress, icon: "washing", animateIcon: false });
    const config = emptyConfiguration();
    config.settings.notifications = { ...config.settings.notifications, presentation: "activity", rules: [configured] };
    expect(parseConfiguration(JSON.stringify(config))).toEqual(config);
    expect(rule().progress).toBeUndefined();
    for (const changes of [{ progress: { ...progress, end: progress.start } }, { progress: { ...progress, current: { type: "value", value: 1 } } }, { progress: { ...progress, end: { type: "value", value: Infinity } } }, { progress: { ...progress, current: { ...progress.current, entity: "" } } }, { kind: "current", progress }, { icon: "custom-script" }]) expect(notificationRuleSchema.safeParse({ ...configured, ...changes }).success).toBe(false);
  });
});


it("validates entity display settings and combines repeated references without merging distinct attributes", () => {
  const configured = rule({ detailEntities: ["home|sensor.example"], progress: {
    current: { type: "entity", entity: "home|sensor.example", attribute: "progress" }, start: { type: "value", value: 0 }, end: { type: "value", value: 100 },
  }, entityDisplay: [{ entity: "home|sensor.example", attribute: "progress", name: "Completion", placement: "right" }] });
  const readings = notificationReadings(configured);
  expect(readings).toHaveLength(2);
  expect(readings[0]).toMatchObject({ defaultPlacement: "left", roles: ["Source entity", "Additional reading"] });
  expect(readings[1]).toMatchObject({ name: "Completion", placement: "right", roles: ["Current value"] });
  const entry = { entity: "home|sensor.example", name: "Example" };
  for (const entityDisplay of [[{ ...entry, placement: "elsewhere" }], [entry, entry], [{ ...entry, name: "x".repeat(101) }], [{ ...entry, attribute: "x".repeat(101) }], [{ ...entry, hideName: "yes" }]]) {
    expect(notificationRuleSchema.safeParse({ ...configured, entityDisplay }).success).toBe(false);
  }
  expect(notificationRuleSchema.parse({ ...configured, entityDisplay: [entry] }).entityDisplay[0]).toEqual({ ...entry, attribute: "", placement: "auto" });
  const config = emptyConfiguration();
  config.settings.notifications.rules = [notificationRuleSchema.parse({ ...configured, entityDisplay: [{ ...entry, hideName: true }] })];
  expect(parseConfiguration(JSON.stringify(config))).toEqual(config);
});
