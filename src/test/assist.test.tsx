import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as ha from "home-assistant-js-websocket";
import type { Connection } from "home-assistant-js-websocket";
import { HomeAssistantClient } from "@/lib/home-assistant";
import { config, services, states, user } from "./ha-fixtures";

vi.mock("home-assistant-js-websocket", async importOriginal => ({
  ...await importOriginal<typeof import("home-assistant-js-websocket")>(),
  createConnection: vi.fn(), subscribeEntities: vi.fn(), getConfig: vi.fn(), getUser: vi.fn(), getServices: vi.fn(),
}));

// Assist can act on the home, so every request here goes to a fake connection with fictional answers.
class FakeConnection {
  connected = true;
  haVersion = "2026.10.0";
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn(() => { this.connected = false; });
  subscribeEvents = vi.fn(async () => async () => {});
  sendMessagePromise = vi.fn(async ({ type }: { type: string }): Promise<unknown> => type.endsWith("_registry/list") ? [] : undefined);
}
let conn: FakeConnection;
let clients: HomeAssistantClient[] = [];
const connectedClient = async () => {
  const client = new HomeAssistantClient();
  clients.push(client);
  await client.connect();
  await waitFor(() => expect(client.getSnapshot().status).toBe("connected"));
  return client;
};
const answer = (type: string, speech: string, conversationId: string | null = "conversation-1", data: unknown = {}) =>
  ({ conversation_id: conversationId, response: { response_type: type, language: "nb", speech: { plain: { speech, extra_data: null } }, data } });

beforeEach(() => {
  conn = new FakeConnection();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ homeAssistantUrl: "http://ha.local:8123" }))));
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  vi.mocked(ha.getConfig).mockResolvedValue(config);
  vi.mocked(ha.getUser).mockResolvedValue(user);
  vi.mocked(ha.getServices).mockResolvedValue(services);
  vi.mocked(ha.subscribeEntities).mockImplementation((_connection, callback) => { queueMicrotask(() => callback(states)); return () => {}; });
});
afterEach(() => { clients.forEach(client => client.dispose()); clients = []; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("sends the sentence, language, agent and conversation to Assist and reads the answer", async () => {
  const client = await connectedClient();
  conn.sendMessagePromise.mockResolvedValueOnce(answer("query_answer", "To lys er på."));
  await expect(client.assist("  Hvilke lys er på?  ", { language: "nb", agentId: "conversation.home_assistant" }))
    .resolves.toEqual({ type: "query_answer", speech: "To lys er på.", conversationId: "conversation-1" });
  expect(conn.sendMessagePromise).toHaveBeenLastCalledWith({ type: "conversation/process", text: "Hvilke lys er på?", language: "nb", agent_id: "conversation.home_assistant" });

  conn.sendMessagePromise.mockResolvedValueOnce(answer("action_done", "Slo på lyset.", "conversation-1"));
  await expect(client.assist("Slå på lyset", { language: "nb", conversationId: "conversation-1" }))
    .resolves.toEqual({ type: "action_done", speech: "Slo på lyset.", conversationId: "conversation-1" });
  expect(conn.sendMessagePromise).toHaveBeenLastCalledWith({ type: "conversation/process", text: "Slå på lyset", language: "nb", conversation_id: "conversation-1" });

  conn.sendMessagePromise.mockResolvedValueOnce(answer("error", "Beklager, jeg forstod ikke.", null, { code: "no_intent_match" }));
  await expect(client.assist("Hva er klokka på månen?", { language: "nb" }))
    .resolves.toEqual({ type: "error", speech: "Beklager, jeg forstod ikke.", code: "no_intent_match" });
});

it("maps failures to plain language and never resends a question", async () => {
  const client = await connectedClient();
  const sent = () => conn.sendMessagePromise.mock.calls.filter(([message]) => message.type === "conversation/process").length;
  await expect(client.assist("   ", { language: "en" })).rejects.toThrow("Type a question first.");
  conn.sendMessagePromise.mockRejectedValueOnce({ code: "unknown_error", message: "Agent failed" });
  await expect(client.assist("Which lights are on?", { language: "en" })).rejects.toThrow("Check that Assist is set up");
  conn.sendMessagePromise.mockResolvedValueOnce({ response: { response_type: "unexpected" } });
  await expect(client.assist("Which lights are on?", { language: "en" })).rejects.toThrow("cannot read");
  conn.sendMessagePromise.mockImplementationOnce(async () => { conn.connected = false; throw ha.ERR_CONNECTION_LOST; });
  await expect(client.assist("Turn on the light", { language: "en" })).rejects.toThrow("may already have happened");
  expect(sent()).toBe(3);
  client.disconnect();
  await expect(client.assist("Which lights are on?", { language: "en" })).rejects.toThrow("was not sent");
  expect(sent()).toBe(3);
});

it("lists only the conversation agents that understand the dashboard language", async () => {
  const client = await connectedClient();
  conn.sendMessagePromise.mockResolvedValueOnce({ agents: [
    { id: "conversation.home_assistant", name: "Home Assistant", supported_languages: ["nb"] },
    { id: "conversation.example_llm", name: "Example LLM", supported_languages: "*" },
    { id: "conversation.example_english", name: "Example English", supported_languages: [] },
    { id: "01EXAMPLEAGENT", name: " ", supported_languages: ["nb"] },
  ] });
  await expect(client.assistAgents("nb")).resolves.toEqual([
    { id: "conversation.home_assistant", name: "Home Assistant" }, { id: "conversation.example_llm", name: "Example LLM" }, { id: "01EXAMPLEAGENT", name: "01EXAMPLEAGENT" },
  ]);
  expect(conn.sendMessagePromise).toHaveBeenLastCalledWith({ type: "conversation/agent/list", language: "nb" });
  conn.sendMessagePromise.mockResolvedValueOnce({ agents: "none" });
  await expect(client.assistAgents("nb")).rejects.toThrow("could not be loaded");
  client.disconnect();
  await expect(client.assistAgents("nb")).rejects.toThrow("could not be loaded");
});

it("reports an unanswered question as possibly still running", async () => {
  const client = await connectedClient();
  vi.useFakeTimers();
  try {
    conn.sendMessagePromise.mockReturnValueOnce(new Promise(() => {}));
    const pending = client.assist("Turn on the light", { language: "en" });
    const result = expect(pending).rejects.toThrow("may still happen");
    await vi.advanceTimersByTimeAsync(30000);
    await result;
  } finally { vi.useRealTimers(); }
});
