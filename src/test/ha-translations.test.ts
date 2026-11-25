import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import * as ha from "home-assistant-js-websocket";
import type { Connection } from "home-assistant-js-websocket";
import { HomeAssistantClient } from "@/lib/home-assistant";
import { entityStateLabel, mapHome } from "@/lib/ha-model";
import { createAppStore } from "@/contexts/AppContext";
import type { EntityRegistryEntry } from "@/types/api";
import { config, registries, services, state, states, user } from "./ha-fixtures";

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
    return ({ "config/area_registry/list": registries.areas, "config/device_registry/list": [...registries.devices, device], "config/entity_registry/list": [...registries.entities, entry] })[message.type];
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
  vi.mocked(ha.subscribeEntities).mockImplementation((_conn, callback) => { callback({ ...states, [entry.entity_id]: state(entry.entity_id, "complete", { friendly_name: "Example car Charging state" }) }); return () => {}; });
  vi.mocked(ha.getConfig).mockResolvedValue(config);
  vi.mocked(ha.getUser).mockResolvedValue(user);
  vi.mocked(ha.getServices).mockResolvedValue(services);
});
afterEach(() => { client.dispose(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const device = { id: "car-1", name: "Example car" };
const entry = { id: "charge-entry", entity_id: "sensor.example_car_charging_state", platform: "example_car", device_id: device.id, translation_key: "charging_state", original_name: "Charging state" };
const translations = catalogues.nb.entity;
const mapped = (registered: Partial<EntityRegistryEntry> = {}, attributes: Record<string, unknown> = { friendly_name: "Example car Charging state" }, value = "complete") => mapHome(
  { [entry.entity_id]: state(entry.entity_id, value, attributes) },
  { areas: [], devices: [device], entities: [{ ...entry, ...registered }] }, "home", undefined, undefined, translations,
).entities[0];

describe("translated entity names", () => {
  it("replaces Home Assistant's entity part and keeps the device name", () => {
    expect(mapped().name).toBe("Example car Ladestatus");
    expect(mapped({}, {}).name).toBe("Ladestatus");
    expect(mapHome({ [entry.entity_id]: state(entry.entity_id, "complete", { friendly_name: "Example car Charging state" }) }, { areas: [], devices: [device], entities: [entry] }, "home").entities[0].name).toBe("Example car Charging state");
  });

  it("keeps names chosen by the user, customised friendly names and unknown or parameterised keys", () => {
    expect(mapped({ name: "Garage car charge" }).name).toBe("Garage car charge");
    expect(mapped({}, { friendly_name: "Our car" }).name).toBe("Our car");
    expect(mapped({ translation_key: "range" }).name).toBe("Example car Charging state");
    expect(mapped({ translation_key: null }).name).toBe("Example car Charging state");
    const parameterised = mapHome({ [entry.entity_id]: state(entry.entity_id, "1", { friendly_name: "Example car Charging state" }) },
      { areas: [], devices: [device], entities: [entry] }, "home", undefined, undefined, { "component.example_car.entity.sensor.charging_state.name": "Lader {number}" }).entities[0];
    expect(parameterised.name).toBe("Example car Charging state");
  });

  it("translates names Home Assistant took from the device class", () => {
    const door = { id: "door-entry", entity_id: "binary_sensor.example_washer_door", platform: "example_appliance", device_id: "washer", original_name: "Door" };
    const classTranslations = { "component.binary_sensor.entity_component.door.name": "Dør", "component.binary_sensor.entity_component.garage_door.name": "Garasjeport" };
    const named = (registered: Partial<EntityRegistryEntry>, attributes: Record<string, unknown>) => mapHome(
      { [door.entity_id]: state(door.entity_id, "off", attributes) },
      { areas: [], devices: [{ id: "washer", name: "Example washer" }], entities: [{ ...door, ...registered }] }, "home", undefined, undefined, classTranslations,
    ).entities[0].name;
    expect(named({}, { friendly_name: "Example washer Door", device_class: "door" })).toBe("Example washer Dør");
    expect(named({ original_name: "Garage door" }, { friendly_name: "Example washer Garage door", device_class: "garage_door" })).toBe("Example washer Garasjeport");
    // A name of the integration's own, a name the user chose and an unknown class stay as reported.
    expect(named({ original_name: "Lid" }, { friendly_name: "Example washer Lid", device_class: "door" })).toBe("Example washer Lid");
    expect(named({ name: "Washer door" }, { friendly_name: "Washer door", device_class: "door" })).toBe("Washer door");
    expect(named({}, { friendly_name: "Example washer Door", device_class: "opening" })).toBe("Example washer Door");
  });
});

describe("translated states", () => {
  const vacuum = (value: string) => mapHome({ "vacuum.example": state("vacuum.example", value) }, { areas: [], devices: [], entities: [] }, "home", undefined, undefined,
    { ...catalogues.nb.entity_component, "component.vacuum.entity_component._.state.docked": "Ladestasjon" }).entities[0];

  it("uses the integration's label for enum states and the reported text without one", () => {
    expect(entityStateLabel(mapped(), "nb")).toBe("Lading fullført");
    expect(entityStateLabel(mapped({}, undefined, "no_error"), "nb")).toBe("No error");
    expect(entityStateLabel(mapped({ translation_key: null }), "nb")).toBe("Complete");
  });

  it("keeps the app's labels for core states and fills other core states from Home Assistant", () => {
    expect(entityStateLabel(vacuum("docked"), "nb")).toBe("I ladestasjonen");
    expect(entityStateLabel(vacuum("error"), "nb")).toBe("Feil");
  });
});

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

  it("renames entities in the app store when the language changes", async () => {
    const store = createAppStore();
    const name = () => store.getSnapshot().currentHome.entities.find(entity => entity.entityId === entry.entity_id)?.name;
    store.setLanguage("nb");
    store.start();
    try {
      await waitFor(() => expect(name()).toBe("Example car Ladestatus"));
      store.setLanguage("en");
      expect(name()).toBe("Example car Charging state");
    } finally { store.dispose(); }
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
