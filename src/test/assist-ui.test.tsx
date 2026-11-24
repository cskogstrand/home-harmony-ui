import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistSettings } from "@/components/AssistSettings";
import { AskTheHouse } from "@/components/AskTheHouse";
import type { AssistAgent, AssistAnswer } from "@/lib/home-assistant";

const mocks = vi.hoisted(() => ({
  online: true, loaded: true, language: "en" as "en" | "nb",
  assist: { enabled: false, agentId: "" },
  setAssist: vi.fn(() => true),
  assistAgents: vi.fn<(language: string) => Promise<AssistAgent[]>>(),
  send: vi.fn<(text: string, options: { agentId?: string; conversationId?: string; language: string }) => Promise<AssistAnswer>>(),
}));
vi.mock("@/contexts/AppContext", () => ({ useApp: (select = (app: unknown) => app) => select({ homeOnline: mocks.online, assistAgents: mocks.assistAgents, assist: mocks.send }) }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ assist: mocks.assist, setAssist: mocks.setAssist, language: mocks.language }) }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => ({ state: { loaded: mocks.loaded, error: "", config: { settings: { language: mocks.language } } } }) }));

beforeEach(() => {
  mocks.online = true; mocks.loaded = true; mocks.language = "en";
  mocks.assist = { enabled: false, agentId: "" };
  mocks.assistAgents.mockResolvedValue([{ id: "conversation.home_assistant", name: "Home Assistant" }, { id: "conversation.example_llm", name: "Example LLM" }]);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("is off by default and saves the switch and the chosen agent", async () => {
  render(<AssistSettings />);
  const toggle = screen.getByRole("switch", { name: "Show Ask the house" });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  expect(mocks.setAssist).toHaveBeenCalledWith({ enabled: true });
  const agent = screen.getByRole("combobox", { name: "Conversation agent" });
  await screen.findByRole("option", { name: "Example LLM" });
  // The built-in agent is the empty default, not a second entry.
  expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Home Assistant (built-in)", "Example LLM"]);
  fireEvent.change(agent, { target: { value: "conversation.example_llm" } });
  expect(mocks.setAssist).toHaveBeenLastCalledWith({ agentId: "conversation.example_llm" });
  expect(mocks.assistAgents).toHaveBeenCalledWith("en");
  expect(screen.getByText(/exposed to it in Home Assistant/)).toBeVisible();
});

it("keeps a saved agent visible while offline or after it disappears", async () => {
  mocks.assist = { enabled: true, agentId: "conversation.removed_agent" };
  mocks.online = false;
  const view = render(<AssistSettings />);
  expect(screen.getByRole("combobox", { name: "Conversation agent" })).toHaveValue("conversation.removed_agent");
  expect(screen.getByRole("status")).toHaveTextContent("Connect to Home Assistant");
  expect(mocks.assistAgents).not.toHaveBeenCalled();
  mocks.online = true;
  view.rerender(<AssistSettings />);
  expect(await screen.findByRole("option", { name: "Selected agent unavailable" })).toBeInTheDocument();
});

it("explains when the agents cannot be loaded and disables changes until settings load", async () => {
  mocks.assistAgents.mockRejectedValue(new Error("Conversation agents could not be loaded. Check the connection to Home Assistant."));
  mocks.loaded = false;
  render(<AssistSettings />);
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
  expect(screen.getByRole("switch", { name: "Show Ask the house" })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "Conversation agent" })).toBeDisabled();
});

const deferred = <T,>() => { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const openDialog = (name = "Ask the house") => { fireEvent.click(screen.getByRole("button", { name })); return within(screen.getByRole("dialog")); };
const question = () => screen.getByRole("textbox", { name: /Question for Home Assistant|Spørsmål til Home Assistant/ });
const send = async (text: string) => {
  fireEvent.change(question(), { target: { value: text } });
  await act(async () => { fireEvent.submit(question().closest("form")!); });
};

it("appears only when turned on", () => {
  const view = render(<AskTheHouse />);
  expect(screen.queryByRole("button", { name: "Ask the house" })).not.toBeInTheDocument();
  mocks.assist = { enabled: true, agentId: "" };
  view.rerender(<AskTheHouse />);
  expect(screen.getByRole("button", { name: "Ask the house" })).toBeVisible();
});

it("asks in Bokmål, shows the answers and keeps the conversation for follow-ups until cleared", async () => {
  mocks.language = "nb";
  mocks.assist = { enabled: true, agentId: "conversation.example_llm" };
  render(<AskTheHouse />);
  const dialog = openDialog("Spør huset");
  expect(question()).toHaveFocus();
  mocks.send.mockResolvedValueOnce({ type: "query_answer", speech: "To lys er på.", conversationId: "conversation-1" });
  await send("Hvilke lys er på?");
  expect(mocks.send).toHaveBeenLastCalledWith("Hvilke lys er på?", { language: "nb", agentId: "conversation.example_llm", conversationId: undefined });
  const log = within(dialog.getByRole("log", { name: "Samtale" }));
  expect(log.getByText("Hvilke lys er på?")).toBeVisible();
  expect(log.getByText("To lys er på.")).toBeVisible();
  expect(question()).toHaveValue("");

  mocks.send.mockResolvedValueOnce({ type: "action_done", speech: "Slo av lyset.", conversationId: "conversation-1" });
  await send("Slå det av");
  expect(mocks.send).toHaveBeenLastCalledWith("Slå det av", { language: "nb", agentId: "conversation.example_llm", conversationId: "conversation-1" });
  // A subtle confirmation: a check icon and a spoken "Ferdig" before the answer.
  const done = log.getByText("Slo av lyset.").closest("p");
  expect(done).toHaveTextContent("Ferdig: Slo av lyset.");
  expect(done).toHaveAttribute("data-kind", "action_done");

  fireEvent.click(dialog.getByRole("button", { name: "Tøm samtalen" }));
  expect(dialog.queryByRole("log")).not.toBeInTheDocument();
  mocks.send.mockResolvedValueOnce({ type: "query_answer", speech: "Ingen lys er på.", conversationId: "conversation-2" });
  await send("Hvilke lys er på nå?");
  expect(mocks.send).toHaveBeenLastCalledWith("Hvilke lys er på nå?", { language: "nb", agentId: "conversation.example_llm", conversationId: undefined });
});

it("keeps the typed text when a request fails and resends only on Try again", async () => {
  mocks.assist = { enabled: true, agentId: "" };
  render(<AskTheHouse />);
  const dialog = openDialog();
  const pending = deferred<AssistAnswer>();
  mocks.send.mockReturnValueOnce(pending.promise);
  await send("Turn on the hallway light");
  expect(dialog.getByText("Waiting for Home Assistant…")).toBeVisible();
  expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();
  await act(async () => { pending.reject(new Error("Home Assistant did not answer in time. Anything you asked for may still happen; check before asking again.")); });
  expect(dialog.getByRole("alert")).toHaveTextContent("may still happen");
  expect(question()).toHaveValue("Turn on the hallway light");
  expect(mocks.send).toHaveBeenCalledTimes(1);

  mocks.send.mockResolvedValueOnce({ type: "action_done", speech: "Turned on the light." });
  await act(async () => { fireEvent.click(dialog.getByRole("button", { name: "Try again" })); });
  expect(mocks.send).toHaveBeenCalledTimes(2);
  expect(mocks.send).toHaveBeenLastCalledWith("Turn on the hallway light", { language: "en", agentId: undefined, conversationId: undefined });
  expect(dialog.queryByRole("alert")).not.toBeInTheDocument();
  expect(dialog.getAllByText("Turn on the hallway light")).toHaveLength(1);
  expect(dialog.getByText("Turned on the light.")).toBeVisible();
});

it("shows Home Assistant's error answer in its words and offers the sentence again", async () => {
  mocks.assist = { enabled: true, agentId: "" };
  render(<AskTheHouse />);
  const dialog = openDialog();
  mocks.send.mockResolvedValueOnce({ type: "error", speech: "Sorry, I couldn't understand that", code: "no_intent_match", conversationId: "conversation-1" });
  await send("Make it cosy");
  expect(dialog.getByRole("alert")).toHaveTextContent("Sorry, I couldn't understand that");
  expect(dialog.getByRole("button", { name: "Try again" })).toBeEnabled();
  expect(question()).toHaveValue("Make it cosy");
});

it("is disabled with a reason while Home Assistant is offline", async () => {
  mocks.assist = { enabled: true, agentId: "" };
  mocks.online = false;
  const view = render(<AskTheHouse />);
  const trigger = screen.getByRole("button", { name: "Ask the house · Home Assistant is offline" });
  expect(trigger).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(trigger);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  mocks.online = true;
  view.rerender(<AskTheHouse />);
  const dialog = openDialog();
  fireEvent.change(question(), { target: { value: "Which lights are on?" } });
  mocks.online = false;
  view.rerender(<AskTheHouse />);
  expect(dialog.getByRole("status")).toHaveTextContent("Home Assistant is offline. You can ask again when it reconnects.");
  expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();
  await act(async () => { fireEvent.submit(question().closest("form")!); });
  expect(mocks.send).not.toHaveBeenCalled();
  expect(question()).toHaveValue("Which lights are on?");
});

it("closes with Escape and returns focus to the header button", async () => {
  mocks.assist = { enabled: true, agentId: "" };
  render(<AskTheHouse />);
  openDialog();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Ask the house" })).toHaveFocus();
});
