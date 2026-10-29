"""Render the actual automation templates offline; requires Jinja2 and PyYAML."""

from ast import literal_eval
from pathlib import Path
import re

from jinja2 import StrictUndefined
from jinja2.sandbox import ImmutableSandboxedEnvironment
import yaml


automation = yaml.safe_load(
    (Path(__file__).resolve().parents[1] / "examples/home-assistant/morning-summary.yaml").read_text()
)
actions = automation["actions"]
generate_index = next(i for i, action in enumerate(actions) if action.get("action") == "ai_task.generate_data")
generate = actions[generate_index]
guard = actions[generate_index + 1]
assert guard["then"][0]["error"] is True
assert "notification_message" in actions[generate_index + 2]["variables"]

env = ImmutableSandboxedEnvironment(undefined=StrictUndefined)
env.filters["regex_replace"] = lambda value, pattern, replacement: re.sub(pattern, replacement, value)
structure = env.from_string(generate["data"]["structure"])
invalid = env.from_string(guard["if"][0]["value_template"])
message = env.from_string(actions[generate_index + 2]["variables"]["notification_message"])

# Fictional groups and activities; no household data belongs in these fixtures.
groups = [{"name": name, "emoji": emoji} for name, emoji in [
    ("Felles", "🏡"), ("Person A", "🧑"), ("Person B", "🧑"), ("Person C", "🧒"),
]]
groups[2]["timetable_member"] = "home|person.example_second"
groups[3]["timetable_member"] = "home|person.example_first"

owner_guard = next(action for action in actions if action.get("then", [{}])[0].get("stop", "").startswith("Each enabled timetable"))
assert owner_guard["then"][0]["error"] is True
owner_invalid = env.from_string(owner_guard["if"][0]["value_template"])
page_template = env.from_string(next(action["variables"]["timetable_pages"] for action in actions if "timetable_pages" in action.get("variables", {})))
timetables = [
    {"member": groups[3]["timetable_member"], "enabled": True, "pages": [
        "/api/timetables/example/1-dark.svg", "https://school.example/notices.png", "https://school.example/homework.png",
    ]},
    {"member": groups[2]["timetable_member"], "enabled": True, "pages": ["https://school.example/other-child.png"]},
    {"member": "unmapped-disabled", "enabled": False, "pages": ["https://school.example/disabled.png"]},
    {"member": "unmapped-empty", "enabled": True, "pages": []},
]
page_context = {"summary_groups": groups, "timetable_response": {
    "content": {"timetables": timetables}, "dashboard_origin": "https://dashboard.example",
}}
assert literal_eval(owner_invalid.render(**page_context).strip()) is False
pages = literal_eval(page_template.render(**page_context).strip())
assert [page["group"] for page in pages] == ["Person C", "Person C", "Person C", "Person B"]
assert [page["page"] for page in pages] == [1, 2, 3, 1]
assert [page["filename"] for page in pages] == ["1.png", "2.png", "3.png", "4.png"]
assert pages[0]["url"] == "https://dashboard.example/api/timetables/example/1.png"
for wrong_groups in [
    groups[:3],
    [*groups, {"name": "Duplicate", "timetable_member": groups[3]["timetable_member"]}],
    [{**groups[0], "timetable_member": groups[3]["timetable_member"]}, *groups[1:3]],
]:
    assert literal_eval(owner_invalid.render(**{**page_context, "summary_groups": wrong_groups}).strip()) is True

fields = literal_eval(structure.render(summary_groups=groups).strip())
assert list(fields) == [group["name"] for group in groups]
assert all(field["required"] is True and "text" in field["selector"] for field in fields.values())

empty = {group["name"]: "" for group in groups}
data = {**empty, "Felles": "Heldagsoppgave.\n\nHusk eksempelutstyr.", "Person C": (
    "Eksempelaktivitet 15:10–16:20 (Oppmøte senest 15:10)\n\n"
    "Turinfo: Eksempeltur.\nHusk regntøy og refleks."
)}
context = {"summary_groups": groups, "daily_summary": {"data": data}, "daily_reminder": ""}
assert literal_eval(invalid.render(**context).strip()) is False
assert message.render(**context) == (
    "🏡 Felles: Heldagsoppgave. Husk eksempelutstyr.\n\n"
    "🧒 Person C: Eksempelaktivitet 15:10–16:20 (Oppmøte senest 15:10) "
    "Turinfo: Eksempeltur. Husk regntøy og refleks."
)

for bad in [None, "Felles: plain text", [], {}, {**data, "Unknown": "Extra group"},
            {**empty, "Person A": None}, {**empty, "Person A": 123},
            {**empty, "Person A": ["Nested text"]},
            {**empty, "Person A": {"text": "Nested text"}},
            {"Felles": "", "Person A": "", "Person B": "", "Unknown": ""}]:
    assert literal_eval(invalid.render(**{**context, "daily_summary": {"data": bad}}).strip()) is True

context["daily_summary"] = {"data": empty}
assert message.render(**context) == ""
context["daily_reminder"] = "Fast eksempelpåminnelse."
assert message.render(**context) == "🏡 Felles: Fast eksempelpåminnelse."
context["daily_summary"] = {"data": {**empty, "Felles": context["daily_reminder"]}}
assert message.render(**context) == "🏡 Felles: Fast eksempelpåminnelse."

for shared_text in [
    "Fast eksempelpåminnelse. Annen beskjed.",
    "Annen beskjed. Fast eksempelpåminnelse.",
    "Første beskjed. Fast\n  eksempelpåminnelse. Siste beskjed.",
]:
    context["daily_summary"] = {"data": {**empty, "Felles": shared_text}}
    rendered = message.render(**context)
    assert rendered.count(context["daily_reminder"]) == 1
    assert rendered == "🏡 Felles: " + " ".join(shared_text.split())

long_text = "Eksempeldetalj. " * 30 + "Avtale 19:25–20:10."
context["daily_summary"] = {"data": {**empty, "Person C": long_text}}
rendered = message.render(**context)
assert len(rendered) > 350 and rendered.endswith(long_text)
assert rendered.startswith("🏡 Felles: Fast eksempelpåminnelse.\n\n🧒 Person C:")
print("Morning summary templates pass: structured groups, multiline text, empty groups, reminders, times and invalid responses.")


class VoiceLoader(yaml.SafeLoader):
    pass


VoiceLoader.add_constructor("!secret", lambda loader, node: loader.construct_scalar(node))
voice = yaml.load(
    (Path(__file__).resolve().parents[1] / "examples/home-assistant/morning-summary-voice.yaml").read_text(),
    Loader=VoiceLoader,
)["morning_summary_voice"]["sequence"]
source = env.from_string(voice[0]["variables"]["summary_entity"])
assert source.render() == "sensor.afterglow_morning_summary"
assert source.render(summary_entity="sensor.example") == "sensor.example"
spoken_source = env.from_string(voice[1]["variables"]["summary"])
entries = [
    {"key": "example_second", "name": "Person B", "emoji": "🧒", "text": "First line.\nSecond line."},
    {"key": "example_first", "name": "Person A", "emoji": "🧑", "text": "Another message."},
]
attributes = {"messages": entries, "message": "Legacy block."}


def state_attr(entity_id, attribute):
    assert entity_id == "sensor.example"
    return attributes.get(attribute)


def render_voice():
    return spoken_source.render(summary_entity="sensor.example", state_attr=state_attr).strip()


assert render_voice() == "Person B: First line.\nSecond line.\n\nPerson A: Another message."
attributes["messages"] = [None, 42, {}, {**entries[0], "text": " "}, *entries]
assert render_voice() == "Person B: First line.\nSecond line.\n\nPerson A: Another message."
for invalid_messages in [None, [], "[]", {}, [None, {"text": "Invalid entry"}]]:
    attributes["messages"] = invalid_messages
    assert render_voice() == "Legacy block."
print("Voice source templates pass: selected/default sensor, ordered messages, malformed entries and legacy fallback.")
