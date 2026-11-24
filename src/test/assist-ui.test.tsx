import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistSettings } from "@/components/AssistSettings";
import type { AssistAgent } from "@/lib/home-assistant";

const mocks = vi.hoisted(() => ({
  online: true, loaded: true, language: "en" as "en" | "nb",
  assist: { enabled: false, agentId: "" },
  setAssist: vi.fn(() => true),
  assistAgents: vi.fn<(language: string) => Promise<AssistAgent[]>>(),
}));
vi.mock("@/contexts/AppContext", () => ({ useApp: (select = (app: unknown) => app) => select({ homeOnline: mocks.online, assistAgents: mocks.assistAgents }) }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ assist: mocks.assist, setAssist: mocks.setAssist, language: mocks.language }) }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => ({ state: { loaded: mocks.loaded, error: "" } }) }));

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
