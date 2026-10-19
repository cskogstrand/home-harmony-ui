import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";

const readExample = name => readFileSync(new URL(`../examples/home-assistant/${name}`, import.meta.url), "utf8");

// The automation UI uses ordinary YAML parsing and rejects HA-specific tags.
const automation = yaml.load(readExample("morning-summary.yaml"));
const exampleSecrets = yaml.load(readExample("morning-summary-secrets.example.yaml"));
const secrets = new Set();
const schema = yaml.DEFAULT_SCHEMA.extend([
  new yaml.Type("!secret", { kind: "scalar", construct(name) {
    secrets.add(name);
    assert.ok(Object.hasOwn(exampleSecrets, name), `Missing example secret: ${name}`);
    return exampleSecrets[name];
  } }),
]);
const config = yaml.load(readExample("morning-summary-config.yaml"), { schema });
assert.deepEqual([...secrets].sort(), Object.keys(exampleSecrets).sort());
const call = automation.actions.find(action => action.action?.startsWith("script."));
assert.ok(config["script morning_summary"][call.action.slice("script.".length)], "The automation must call the file-loaded script");
const trigger = config["automation morning_summary_trigger"][0];
assert.equal(trigger.triggers[0].entity_id, exampleSecrets.home_harmony_morning_scene);
assert.equal(trigger.actions[0].event, automation.triggers[0].event_type);
const publicationIndex = automation.actions.findIndex(action => action.event === "home_harmony_morning_summary_ready");
const publication = automation.actions[publicationIndex];
const notificationIndex = automation.actions.findIndex(action => action.action === "{{ timetable_response.main_notify_device }}");
assert.ok(publicationIndex >= 0 && publicationIndex < notificationIndex, "Save the summary before attempting phone delivery");
assert.equal(publication.event_data.message, automation.actions[notificationIndex].data.message);
assert.equal(publication.event_data.date, "{{ day_start[:10] }}");
const summaryTemplate = config.template.find(template => template.triggers[0].event_type === publication.event);
assert.equal(summaryTemplate.sensor[0].default_entity_id, "sensor.afterglow_morning_summary");
assert.equal(summaryTemplate.sensor[0].state, "{{ trigger.event.data.date }}");
assert.equal(summaryTemplate.sensor[0].attributes.message, "{{ trigger.event.data.message }}");
const settings = config["script morning_summary"].family_timetables.sequence.find(action => action.variables)?.variables.result;
assert.deepEqual(settings.summary_groups, exampleSecrets.home_harmony_summary_groups);
assert.deepEqual(settings.weekly_reminders, exampleSecrets.home_harmony_weekly_reminders);
assert.equal(settings.calendar_prefix, exampleSecrets.home_harmony_calendar_prefix);
assert.ok(settings.summary_groups.length > 0);
assert.equal(new Set(settings.summary_groups.map(group => group.name)).size, settings.summary_groups.length);
for (const group of settings.summary_groups) {
  assert.ok(group.name.trim() && !/[:\r\n]/.test(group.name));
  assert.ok(group.emoji.trim());
}
// Personal values must be fixtures in the secrets example, never part of the logic.
const genericFiles = readExample("morning-summary.yaml") + readExample("morning-summary-config.yaml");
for (const value of [
  ...settings.summary_groups.slice(1).map(group => group.name),
  ...Object.values(settings.weekly_reminders),
  exampleSecrets.home_harmony_morning_scene,
  settings.calendar_prefix,
]) {
  assert.ok(!genericFiles.includes(value), `Personal setting leaked into generic YAML: ${value}`);
}
assert.equal(automation.initial_state, false);
console.log("Morning summary YAML passes: UI-safe automation, secret-backed scene/settings, and no hardcoded household details.");
