import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import * as ha from "home-assistant-js-websocket";
import type { Connection } from "home-assistant-js-websocket";
import { HomeAssistantClient } from "@/lib/home-assistant";
import { config, registries, services, states, user } from "./ha-fixtures";

vi.mock("home-assistant-js-websocket", async importOriginal => ({
  ...await importOriginal<typeof import("home-assistant-js-websocket")>(),
  createConnection: vi.fn(), subscribeEntities: vi.fn(), getConfig: vi.fn(), getUser: vi.fn(), getServices: vi.fn(),
}));

// Fictional integration strings; real catalogues are much larger.
const catalogues: Record<string, Record<string, Record<string, string>>> = {
  nb: {
    entity: {
      "component.example_car.entity.sensor.charging_state.name": "Ladestatus",
      "component.example_car.entity.sensor.charging_state.state.complete": "Lading fullført",
      "component.example_car.entity.sensor.charging_state.description": "Not used by the dashboard",
    },
    entity_component: { "component.vacuum.entity_component._.state.error": "Feil" },
  },
  en: { entity: { "component.example_car.entity.sensor.charging_state.name": "Charging state" }, entity_component: {} },
};

class FakeConnection {
  connected = true;
  haVersion = "2026.10.0";
  failTranslations = false;
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  subscribeEvents = vi.fn(async () => async () => {});
  close = vi.fn(() => { this.connected = false; });
  sendMessagePromise = vi.fn(async (message: { type: string; language?: string; category?: string }): Promise<unknown> => {
    if (message.type === "frontend/get_translations") {
      if (this.failTranslations) throw { code: "unknown_command" };
      return { resources: catalogues[message.language]?.[message.category] ?? {} };
    }
    return ({ "config/area_registry/list": registries.areas, "config/device_registry/list": registries.devices, "config/entity_registry/list": registries.entities })[message.type];
  });
}
let conn: FakeConnection;
let client: HomeAssistantClient;
const translationRequests = () => conn.sendMessagePromise.mock.calls.map(([message]) => message).filter(message => message.type === "frontend/get_translations");

beforeEach(() => {
  conn = new FakeConnection();
  client = new HomeAssistantClient();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ homeAssistantUrl: "http://ha.local:8123" }))));
  vi.mocked(ha.createConnection).mockResolvedValue(conn as unknown as Connection);
  vi.mocked(ha.subscribeEntities).mockImplementation((_conn, callback) => { callback(states); return () => {}; });
  vi.mocked(ha.getConfig).mockResolvedValue(config);
  vi.mocked(ha.getUser).mockResolvedValue(user);
  vi.mocked(ha.getServices).mockResolvedValue(services);
});
afterEach(() => { client.dispose(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("Home Assistant translations", () => {
  it("loads entity and core state labels for the dashboard language after connecting", async () => {
    client.setLanguage("nb");
    await client.connect();
    await waitFor(() => expect(client.getSnapshot().translations).toEqual({
      "component.example_car.entity.sensor.charging_state.name": "Ladestatus",
      "component.example_car.entity.sensor.charging_state.state.complete": "Lading fullført",
      "component.vacuum.entity_component._.state.error": "Feil",
    }));
    expect(translationRequests()).toEqual([
      { type: "frontend/get_translations", language: "nb", category: "entity" },
      { type: "frontend/get_translations", language: "nb", category: "entity_component" },
    ]);
  });

  it("switches languages without showing stale labels and reuses each language from memory", async () => {
    client.setLanguage("nb");
    await client.connect();
    await waitFor(() => expect(client.getSnapshot().translations["component.example_car.entity.sensor.charging_state.name"]).toBe("Ladestatus"));
    client.setLanguage("en");
    expect(client.getSnapshot().translations).toEqual({});
    await waitFor(() => expect(client.getSnapshot().translations["component.example_car.entity.sensor.charging_state.name"]).toBe("Charging state"));
    client.setLanguage("nb");
    await waitFor(() => expect(client.getSnapshot().translations["component.example_car.entity.sensor.charging_state.name"]).toBe("Ladestatus"));
    expect(translationRequests().map(message => message.language)).toEqual(["nb", "nb", "en", "en"]);
  });

  it("keeps the app's own labels when Home Assistant cannot provide translations", async () => {
    conn.failTranslations = true;
    client.setLanguage("nb");
    await client.connect();
    await waitFor(() => expect(client.getSnapshot().status).toBe("connected"));
    await waitFor(() => expect(translationRequests()).toHaveLength(2));
    expect(client.getSnapshot().translations).toEqual({});
    expect(client.getSnapshot().warnings).toEqual([]);
  });
});
