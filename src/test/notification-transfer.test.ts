import { describe, expect, it } from "vitest";
import { createI18n } from "@/lib/i18n";
import {
  applyNotificationImport, compareVersions, exportNotificationRules, importConflict, notificationRuleReferences, notificationRulesFileName,
  parseNotificationRules, serializeNotificationRules, uniqueRuleTitle, NOTIFICATION_RULES_TYPE,
} from "@/lib/notification-transfer";
import { notificationRuleSchema, notificationSettingsSchema, type NotificationRule } from "../../shared/notifications";

const { message } = createI18n("en");
const washer = () => notificationRuleSchema.parse({
  id: "rule-washer", title: "Example washer", kind: "ongoing",
  trigger: { type: "state", entity: "home|sensor.example_washer_state", operator: "eq", value: "running" },
  hideTrigger: { type: "state", entity: "home|sensor.example_washer_state", operator: "eq", value: "finished", delayMinutes: 5 },
  detailEntities: ["home|sensor.example_washer_remaining"],
  progress: { current: { type: "entity", entity: "home|sensor.example_washer_percent" }, start: { type: "value", value: 0 }, end: { type: "value", value: 100 } },
  widget: { slots: [{ type: "reading", entity: "home|sensor.example_washer_power" }], media: { type: "live", cameraId: "example-camera" } },
});
const salt = () => notificationRuleSchema.parse({
  id: "rule-salt", title: "Example salt", kind: "current", dismissible: false,
  trigger: { type: "state", entity: "home|binary_sensor.example_salt", operator: "eq", value: "on" },
  shoppingAction: { list: "home|todo.example_shopping", item: "Example salt" },
});
const doorbell = () => notificationRuleSchema.parse({
  id: "rule-door", title: "Example doorbell", kind: "camera", cameraEntity: "example-camera",
  trigger: { type: "entity-event", entity: "home|event.example_doorbell" },
  additionalTriggers: [{ type: "ha-event", eventType: "example_press", filters: { action: "single" } }],
});
const file = (rules: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ type: NOTIFICATION_RULES_TYPE, version: 1, app: "0.11.0", rules, ...extra });
const ok = (text: string) => {
  const result = parseNotificationRules(text);
  if ("error" in result) throw new Error(message(result.error));
  return result.value;
};
const error = (text: string) => {
  const result = parseNotificationRules(text);
  if (!("error" in result)) throw new Error("Expected the import to fail.");
  return message(result.error);
};

describe("export", () => {
  it("wraps one rule in a small versioned envelope with only the rule", () => {
    const rule = salt();
    expect(exportNotificationRules([rule], "0.11.0")).toEqual({ type: "afterglow.notification-rules", version: 1, app: "0.11.0", rules: [rule] });
    const text = serializeNotificationRules([rule], "0.11.0");
    expect(Object.keys(JSON.parse(text))).toEqual(["type", "version", "app", "rules"]);
    expect(JSON.parse(text).rules[0]).toMatchObject({ id: "rule-salt", dismissible: false, shoppingAction: { item: "Example salt" } });
    expect(notificationRulesFileName([rule], "2026-11-26")).toBe("afterglow-notification-example-salt-2026-11-26.json");
  });

  it("exports every rule in order and names the file for all rules", () => {
    const rules = [washer(), salt(), doorbell()];
    const parsed = JSON.parse(serializeNotificationRules(rules, "0.11.0"));
    expect(parsed.rules.map((rule: NotificationRule) => rule.id)).toEqual(["rule-washer", "rule-salt", "rule-door"]);
    expect(notificationRulesFileName(rules, "2026-11-26")).toBe("afterglow-notification-rules-2026-11-26.json");
    expect(notificationRulesFileName([{ ...salt(), title: "Æ / ø!" }], "2026-11-26")).toMatch(/^afterglow-notification-[\p{L}-]+-2026-11-26\.json$/u);
    expect(notificationRulesFileName([{ ...salt(), title: "!!!" }], "2026-11-26")).toBe("afterglow-notification-rule-2026-11-26.json");
  });

  it("round-trips to identical rules, keeping dismissible", () => {
    const rules = [washer(), salt(), doorbell()];
    const imported = ok(serializeNotificationRules(rules, "0.11.0"));
    expect(imported.rejected).toEqual([]);
    expect(imported.rules.map(item => item.rule)).toEqual(rules);
    expect(imported.rules[1].rule.dismissible).toBe(false);
    const { rules: merged } = applyNotificationImport([], imported.rules, () => "unused");
    expect(merged).toEqual(rules);
    expect(notificationSettingsSchema.parse({ rules: merged }).rules).toEqual(rules);
  });
});

describe("import errors", () => {
  it("explains invalid JSON, the wrong type and unsupported versions", () => {
    expect(error("")).toBe("Paste exported rules or choose a file.");
    expect(error("{ not json")).toMatch(/isn’t valid JSON/);
    expect(error(JSON.stringify({ type: "something-else", version: 1, rules: [] }))).toBe("This isn’t an Afterglow notification rules export.");
    expect(error(JSON.stringify([salt()]))).toBe("This isn’t an Afterglow notification rules export.");
    expect(error(JSON.stringify({ version: 3, settings: {} }))).toMatch(/full configuration backup/);
    expect(error(file([salt()], { version: 2 }))).toMatch(/export format 2 from a newer version of Afterglow\. Update Afterglow/);
    expect(error(file([salt()], { version: 0 }))).toBe("Export format 0 isn’t supported.");
    expect(error(file([salt()], { version: "1" }))).toBe("This isn’t an Afterglow notification rules export.");
    expect(error(file([]))).toBe("The file contains no notification rules.");
    expect(error(file([salt()], { rules: "x" }))).toBe("This isn’t an Afterglow notification rules export.");
    expect(error(file(Array.from({ length: 101 }, () => salt())))).toBe("A file can contain up to 100 rules.");
  });

  it("asks to update the app for unknown fields from a newer release", () => {
    expect(error(file([salt()], { exportedBy: "x" }))).toMatch(/doesn’t recognise \(exportedBy\)\. Update Afterglow/);
    const result = ok(file([{ ...salt(), snooze: 5 }, { ...doorbell(), trigger: { ...doorbell().trigger, repeat: true } }, washer()]));
    expect(result.rules.map(item => item.rule.id)).toEqual(["rule-washer"]);
    expect(result.rejected.map(item => [item.title, message(item.reasons[0])])).toEqual([
      ["Example salt", expect.stringMatching(/doesn’t recognise \(snooze\)\. Update Afterglow on this installation/)],
      ["Example doorbell", expect.stringMatching(/doesn’t recognise \(trigger\.repeat\)/)],
    ]);
  });

  it("imports the valid rules while naming the ones that fail", () => {
    const result = ok(file([salt(), { ...washer(), title: "" }, 7, { ...doorbell(), kind: "camera", cameraEntity: "" }, salt()]));
    expect(result.app).toBe("0.11.0");
    expect(result.rules.map(item => item.index)).toEqual([0]);
    expect(result.rejected.map(item => [item.index, item.title, item.reasons.map(reason => message(reason)).join(" | ")])).toEqual([
      [1, "#2", expect.stringMatching(/^title: /)],
      [2, "#3", "This entry isn’t a notification rule."],
      [3, "Example doorbell", "cameraEntity: Choose a camera."],
      [4, "Example salt", "This rule appears more than once in the file."],
    ]);
  });
});

describe("conflicts", () => {
  const imported = () => ok(file([
    { ...salt(), message: "Updated" }, // same ID
    { ...washer(), id: "rule-other" }, // same name, other ID
    { ...doorbell(), id: "rule-new", title: "Example new" }, // no conflict
  ])).rules;

  it("finds a conflict by ID first, then by name", () => {
    const existing = [salt(), washer()];
    expect(importConflict({ ...salt(), title: "Example washer" }, existing)?.id).toBe("rule-salt");
    expect(importConflict({ ...washer(), id: "x", title: " example WASHER " }, existing)?.id).toBe("rule-washer");
    expect(importConflict({ ...washer(), id: "x", title: "Else" }, existing)).toBeUndefined();
  });

  it("replaces a saved rule in place", () => {
    const [same, byName, fresh] = imported();
    const result = applyNotificationImport([salt(), washer()], [
      { rule: same.rule, choice: "replace" }, { rule: byName.rule, choice: "replace" }, { rule: fresh.rule },
    ], () => "generated");
    expect(result.rules.map(rule => [rule.id, rule.title])).toEqual([["rule-salt", "Example salt"], ["rule-other", "Example washer"], ["rule-new", "Example new"]]);
    expect(result.rules[0].message).toBe("Updated");
    expect(result).toMatchObject({ added: 1, replaced: 2, kept: 0, skipped: 0 });
  });

  it("keeps both with a new ID and a numbered name", () => {
    const [same, byName] = imported();
    let next = 0;
    const result = applyNotificationImport([salt(), washer(), { ...doorbell(), id: "rule-copy", title: "Example washer (2)" }], [
      { rule: same.rule, choice: "keep-both" }, { rule: byName.rule, choice: "keep-both" },
    ], () => `generated-${++next}`);
    expect(result.rules.slice(3).map(rule => [rule.id, rule.title, rule.message])).toEqual([
      ["generated-1", "Example salt (2)", "Updated"], ["generated-2", "Example washer (3)", ""],
    ]);
    expect(result.rules.slice(0, 3)).toEqual([salt(), washer(), { ...doorbell(), id: "rule-copy", title: "Example washer (2)" }]);
    expect(result).toMatchObject({ added: 0, replaced: 0, kept: 2, skipped: 0 });
    expect(notificationSettingsSchema.safeParse({ rules: result.rules }).success).toBe(true);
  });

  it("skips a rule and leaves the saved one untouched", () => {
    const [same, byName, fresh] = imported();
    const result = applyNotificationImport([salt(), washer()], [
      { rule: same.rule, choice: "skip" }, { rule: byName.rule, choice: "skip" }, { rule: fresh.rule, choice: "skip" },
    ], () => "generated");
    expect(result.rules).toEqual([salt(), washer(), fresh.rule]);
    expect(result).toMatchObject({ added: 1, replaced: 0, kept: 0, skipped: 2 });
  });

  it("defaults to replacing the same rule and keeping both for a name match", () => {
    const [same, byName] = imported();
    const result = applyNotificationImport([salt(), washer()], [{ rule: same.rule }, { rule: byName.rule }], () => "generated");
    expect(result.rules.map(rule => rule.title)).toEqual(["Example salt", "Example washer", "Example washer (2)"]);
    expect(result.rules[0].message).toBe("Updated");
  });

  it("keeps a second replacement of the same saved rule instead of overwriting the first", () => {
    const first = { ...washer(), id: "a" }, second = { ...washer(), id: "b", message: "Second" };
    const result = applyNotificationImport([washer()], [{ rule: first, choice: "replace" }, { rule: second, choice: "replace" }], () => "generated");
    expect(result.rules.map(rule => [rule.id, rule.title])).toEqual([["a", "Example washer"], ["generated", "Example washer (2)"]]);
  });

  it("numbers names within the title limit", () => {
    expect(uniqueRuleTitle("Example", ["Example", "example (2)"])).toBe("Example (3)");
    expect(uniqueRuleTitle("x".repeat(100), [])).toHaveLength(100);
  });
});

it("lists every entity and camera a rule refers to", () => {
  expect(notificationRuleReferences(washer())).toEqual({
    entities: ["home|sensor.example_washer_state", "home|sensor.example_washer_remaining", "home|sensor.example_washer_percent", "home|sensor.example_washer_power"],
    cameras: ["example-camera"],
  });
  expect(notificationRuleReferences(salt())).toEqual({ entities: ["home|binary_sensor.example_salt", "home|todo.example_shopping"], cameras: [] });
  expect(notificationRuleReferences(doorbell())).toEqual({ entities: ["home|event.example_doorbell"], cameras: ["example-camera"] });
});

it("compares release numbers", () => {
  expect(compareVersions("0.12.0", "0.11.9")).toBe(1);
  expect(compareVersions("0.11.0", "0.11")).toBe(0);
  expect(compareVersions("0.9.0", "0.11.0")).toBe(-1);
  expect(compareVersions("dev", "0.11.0")).toBeUndefined();
});
