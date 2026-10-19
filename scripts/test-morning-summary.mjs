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
assert.equal(settings.ai_task_entity, exampleSecrets.main_ai_task_entity);
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

// Keep the standalone voice script wired to the published sensor and AI response.
const voiceScripts = yaml.load(readExample("morning-summary-voice.yaml"), { schema });
assert.deepEqual([...secrets].sort(), Object.keys(exampleSecrets).sort());
assert.deepEqual(Object.keys(voiceScripts), ["morning_summary_voice"], "scripts.yaml needs a script ID above variables/sequence, or HA treats settings as scripts");
const voice = voiceScripts.morning_summary_voice;
assert.ok(Array.isArray(voice.sequence), "The named script must contain its action sequence");
assert.equal(voice.variables.ai_task_entity, exampleSecrets.main_ai_task_entity);
assert.equal(voice.variables.speaker_entity, exampleSecrets.main_announcement_speaker);
assert.equal(voice.mode, "single");
assert.ok(!voice.triggers, "Installing the voice script must not schedule playback");
const source = voice.sequence[0].variables;
const sensorId = summaryTemplate.sensor[0].default_entity_id;
assert.equal(source.summary, `{{ state_attr('${sensorId}', 'message') }}`);
assert.equal(source.summary_date, `{{ states('${sensorId}') }}`);
const generateIndex = voice.sequence.findIndex(action => action.action === "ai_task.generate_data");
const speakIndex = voice.sequence.findIndex(action => action.action === "tts.speak");
assert.ok(generateIndex > 1 && speakIndex > generateIndex);
assert.equal(voice.sequence[1].then[0].error, true, "Reject missing/stale source before generation");
assert.equal(voice.sequence[speakIndex - 1].then[0].error, true, "Reject invalid AI output before playback");
assert.equal(voice.variables.tts_entity, "tts.home_assistant_cloud");
assert.equal(voice.sequence[speakIndex].target.entity_id, "{{ tts_entity }}");
assert.equal(voice.sequence[speakIndex].data.media_player_entity_id, "{{ speaker_entity }}");
assert.equal(voice.sequence[speakIndex].data.language, "nb-NO");
assert.equal(voice.sequence[speakIndex].data.options, undefined);
assert.equal(voice.sequence[speakIndex].data.message, `{{ ${voice.sequence[generateIndex].response_variable}.data | trim }}`);
console.log("Morning summary YAML passes: UI-safe automation, secret-backed scripts/settings, sensor publication and voice wiring.");
