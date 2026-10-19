"""Render the actual automation templates offline; requires Jinja2 and PyYAML."""

from ast import literal_eval
from pathlib import Path

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
structure = env.from_string(generate["data"]["structure"])
invalid = env.from_string(guard["if"][0]["value_template"])
message = env.from_string(actions[generate_index + 2]["variables"]["notification_message"])

# Fictional groups and activities; no household data belongs in these fixtures.
groups = [{"name": name, "emoji": emoji} for name, emoji in [
    ("Felles", "🏡"), ("Person A", "🧑"), ("Person B", "🧑"), ("Person C", "🧒"),
]]
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
