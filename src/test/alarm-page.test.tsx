import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppContext } from "@/contexts/AppContext";
import { alarmStateAction } from "@/lib/alarm-actions";
import type { Entity } from "@/types/api";
import Alarm from "@/pages/Alarm";
import { SmartHomeCard } from "@/components/devices/SmartHomeCard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { services } from "./ha-fixtures";
import { cardEntity } from "./device-card-fixtures";

const mocks = vi.hoisted(() => ({ app: {} as Record<string, unknown>, command: vi.fn() }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ selectedAlarm: undefined, setSelectedAlarm: vi.fn() }) }));

// Home (1), away (2), night (4), trigger (8), custom bypass (16) and vacation (32).
const alarm = (state: string) => cardEntity("alarm_control_panel", state, { supported_features: 63, code_format: "number", code_arm_required: true });
const view = (entity: Entity) => <AppContext.Provider value={{ ...mocks.app, currentHome: { entities: [entity], areas: [], timeZone: "UTC" } } as never}><MemoryRouter><Alarm /></MemoryRouter></AppContext.Provider>;
const actions = ["Disarm", "Arm home", "Arm away", "Arm night", "Arm vacation", "Arm custom bypass", "Trigger"];

beforeEach(() => {
  mocks.command.mockReset().mockResolvedValue(undefined);
  mocks.app = { homeOnline: true, services, commands: {}, command: mocks.command, haUrl: "" };
});
afterEach(cleanup);

it.each([
  ["disarmed", "Disarmed", "Disarm", "Arm home"],
  ["armed_home", "Armed home", "Arm home", "Disarm"],
  ["armed_away", "Armed away", "Arm away", "Disarm"],
  ["armed_night", "Armed night", "Arm night", "Disarm"],
  ["armed_vacation", "Armed vacation", "Arm vacation", "Disarm"],
  ["armed_custom_bypass", "Armed custom bypass", "Arm custom bypass", "Disarm"],
  ["triggered", "Triggered", "Trigger", "Disarm"],
])("leads with the %s state and disables only the action that matches it", (state, label, redundant, primary) => {
  render(view(alarm(state)));
  const status = screen.getByRole("status", { name: "Current state" });
  expect(within(status).getByText(label).tagName).toBe("STRONG");
  expect(status).toHaveTextContent(/Since .*2026/);
  for (const name of actions) {
    const button = screen.getByRole("button", { name });
    if (name === redundant) {
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription("The alarm is already in this state.");
    } else {
      expect(button).toBeEnabled();
      expect(button).not.toHaveAccessibleDescription();
    }
    expect(button).toHaveClass(name === primary ? "bg-primary" : "border-input");
  }
  expect(mocks.command).not.toHaveBeenCalled();
});

it("keeps every action available while arming and names which state blocks it", () => {
  render(view(alarm("arming")));
  expect(screen.getByRole("status", { name: "Current state" })).toHaveTextContent("Arming");
  for (const name of actions) expect(screen.getByRole("button", { name })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Disarm" })).toHaveClass("bg-primary");
});

it("groups actions by intent and keeps Trigger apart from the everyday actions", () => {
  render(view(alarm("disarmed")));
  expect(within(screen.getByRole("group", { name: "Turn off the alarm" })).getAllByRole("button").map(button => button.textContent)).toEqual(["Disarm"]);
  expect(within(screen.getByRole("group", { name: "Turn on the alarm" })).getAllByRole("button").map(button => button.textContent)).toEqual(["Arm home", "Arm away", "Arm night", "Arm vacation", "Arm custom bypass"]);
  expect(within(screen.getByRole("group", { name: "Emergency" })).getByRole("button", { name: "Trigger" })).not.toHaveClass("bg-primary");
});

it.each([
  ["offline", { homeOnline: false }, "disarmed", "Home Assistant is offline."],
  ["unavailable", {}, "unavailable", "This alarm is unavailable."],
  ["pending", { commands: { "alarm_control_panel.example": { pending: true } } }, "disarmed", "Waiting for the alarm to respond."],
])("explains why every action is disabled while %s", (condition, app, state, reason) => {
  Object.assign(mocks.app, app);
  render(view(alarm(state)));
  for (const name of actions) {
    expect(screen.getByRole("button", { name })).toBeDisabled();
    expect(screen.getByRole("button", { name })).toHaveAccessibleDescription(reason);
  }
  // A reported state keeps its start time; a stale one does not claim it.
  expect(screen.getByRole("status", { name: "Current state" })).toHaveTextContent(condition === "pending" ? /Since/ : /^Current state(Offline|Unavailable)$/);
});

it("keeps the code gate and never replays an arm request after reconnecting", async () => {
  const entity = alarm("disarmed");
  const page = render(view(entity));
  fireEvent.click(screen.getByRole("button", { name: "Arm away" }));
  const dialog = screen.getByRole("dialog", { name: /Arm away/ });
  expect(dialog).toHaveTextContent("Enter your alarm code to continue.");
  expect(within(dialog).getByRole("button", { name: "Confirm" })).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText("Code"), { target: { value: "1234" } });
  mocks.app.homeOnline = false;
  page.rerender(view(entity));
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm" })).toBeDisabled();
  mocks.app.homeOnline = true;
  page.rerender(view(entity));
  expect(mocks.command).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(mocks.command).toHaveBeenCalledExactlyOnceWith(entity.entityId, "alarm_arm_away", undefined, "1234"));
});

it("maps each reported alarm state to the command that would repeat it", () => {
  expect(["disarmed", "armed_home", "armed_away", "armed_night", "armed_vacation", "armed_custom_bypass", "triggered", "arming", "pending", "armed_unknown"].map(alarmStateAction))
    .toEqual(["alarm_disarm", "alarm_arm_home", "alarm_arm_away", "alarm_arm_night", "alarm_arm_vacation", "alarm_arm_custom_bypass", "alarm_trigger", undefined, undefined, undefined]);
});

it("keeps Trigger on the alarm card's secondary controls only while it would change the state", () => {
  for (const state of ["disarmed", "triggered"]) {
    const entity = alarm(state);
    const card = render(<AppContext.Provider value={{ ...mocks.app, currentHome: { entities: [entity], areas: [] } } as never}><MemoryRouter><TooltipProvider><SmartHomeCard entity={entity} /></TooltipProvider></MemoryRouter></AppContext.Provider>);
    expect(!!screen.queryByRole("button", { name: "More controls" })).toBe(state === "disarmed");
    expect(screen.getByRole("button", { name: state === "disarmed" ? "Arm home" : "Disarm" })).toBeEnabled();
    card.unmount();
  }
  expect(mocks.command).not.toHaveBeenCalled();
});
