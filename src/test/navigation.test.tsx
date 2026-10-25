import { chooseEntity } from "./entity-picker-helpers";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import App from "@/App";
import { emptyConfiguration, parseConfiguration } from "../../shared/configuration";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { addDays, homeDate, weekStart, isPlannerDate } from "@/contexts/FamilyContext";

const app = vi.hoisted(() => ({ currentHome: null, haUrl: "http://ha.local:8123", homeOnline: true, connectionStatus: "connected", metadataWarnings: [], services: {}, commands: {}, connect: vi.fn(), disconnect: vi.fn(), configurationRequest: vi.fn(), storageRequest: vi.fn(), watchCalendarEvents: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("../../config.yaml?raw", () => ({ default: 'name: Home Harmony UI\nversion: "9.8.7"\n' }));
vi.mock("@/contexts/AppProvider", () => ({ AppProvider: ({ children }) => children }));
let settings = emptyConfiguration();
beforeEach(() => {
  settings = emptyConfiguration();
  delete settings.settings.smartHome.knownEntities;
  app.watchCalendarEvents.mockReset();
  app.homeOnline = true;
  app.connectionStatus = "connected";
  app.haUrl = "http://ha.local:8123";
  app.currentHome = mapHome({ "person.emma": state("person.emma", "home", { friendly_name: "Emma" }), "person.leo": state("person.leo", "home", { friendly_name: "Leo" }) }, emptyRegistries, "home");
  app.configurationRequest.mockImplementation(async (method, body) => {
    if (method === "PUT") settings = parseConfiguration(body);
    return { ok: true, json: async () => ({ revision: "a".repeat(64), config: structuredClone(settings) }) };
  });
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Reflect.deleteProperty(document, "execCommand"); });
const pageReady = () => waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
const navigate = async (name: string) => {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name }));
  await screen.findByRole("heading", { level: 1, name: name === "Our week" ? "Our week." : name });
};
const saved = async () => {
  await waitFor(() => expect(screen.getByRole("status", { name: "Settings storage" })).toHaveTextContent("Shared settings saved."));
  await pageReady();
};
const confirmVisibility = async (name: "Show group" | "Hide group" | "Show all matches" | "Hide all matches") => {
  fireEvent.click(within(screen.getByRole("alertdialog", { name: "Are you sure?" })).getByRole("button", { name }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
};

it("uses only Home Assistant people and lets old shared assignments move to a real person", async () => {
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Example person" }),
    "calendar.shared": state("calendar.shared", "off"),
    "todo.shared": state("todo.shared", "0"),
    "todo.shopping": state("todo.shopping", "0"),
  }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.shared": "everyone" };
  settings.settings.todoLists = {
    "home|todo.shared": { kind: "tasks", member: "everyone" },
    "home|todo.shopping": { kind: "shopping", member: "everyone" },
  };
  window.history.replaceState(null, "", "/settings/lists");
  render(<App />); await saved();
  expect(screen.queryByRole("button", { name: "Color for Everyone" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add calendar for Everyone" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tasks for Everyone" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "To-do lists for Person unavailable" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Shared shopping list" })).toHaveTextContent("Shopping");
  await navigate("Our week");
  expect(screen.getAllByRole("rowheader")).toHaveLength(1);
  expect(screen.getByRole("rowheader", { name: "Example person" })).toBeInTheDocument();
  expect(app.watchCalendarEvents).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Add a plan" }));
  expect(screen.getByLabelText("Who’s going?")).toHaveValue("home|person.example");
  expect(screen.queryByRole("option", { name: "Everyone" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Open app settings" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: "All settings" }));
  await pageReady();
  fireEvent.click(screen.getByRole("link", { name: /Calendars Connect calendars/ }));
  await pageReady();
  chooseEntity(screen.getByRole("button", { name: "Add calendar for Example person" }), "calendar.shared");
  fireEvent.click(screen.getByRole("button", { name: "Move calendar" }));
  await saved();
  fireEvent.click(within(screen.getByRole("navigation", { name: "Settings navigation" })).getByRole("link", { name: "To-do lists" }));
  await pageReady();
  chooseEntity(screen.getByRole("button", { name: "Tasks for Example person" }), "todo.shared");
  fireEvent.click(screen.getByRole("button", { name: "Change list" }));
  await saved();
  expect(settings.settings.calendarMembers["home|calendar.shared"]).toBe("home|person.example");
  expect(settings.settings.todoLists["home|todo.shared"]).toEqual({ kind: "tasks", member: "home|person.example" });
  expect(settings.settings.todoLists["home|todo.shopping"]).toEqual({ kind: "shopping", member: "everyone" });
});

it("does not invent a person or allow saving a plan when Home Assistant has no people", async () => {
  app.currentHome = mapHome({}, emptyRegistries, "home");
  window.history.replaceState(null, "", "/calendar");
  render(<App />); await saved();
  expect(screen.queryByRole("rowheader")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add a plan" }));
  expect(screen.getByLabelText("Who’s going?")).toHaveValue("");
  expect(screen.getByRole("option", { name: "No people available." })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save plan" })).toBeDisabled();
});

it("migrates existing choices once after a complete sync and keeps later discoveries hidden after reload", async () => {
  const initial = mapHome({ "light.example": state("light.example", "on", { friendly_name: "Example lamp" }) }, {
    areas: [], devices: [{ id: "example-device", name: "Example hub" }],
    entities: [{ id: "example-light", entity_id: "light.example", device_id: "example-device" }],
  }, "home");
  app.currentHome = initial;
  app.metadataWarnings = ["Registry unavailable"];
  window.history.replaceState(null, "", "/settings/smart-home");
  const view = render(<App />); await saved();
  expect(settings.settings.smartHome.knownEntities).toBeUndefined();
  app.metadataWarnings = [];
  app.homeOnline = false;
  view.rerender(<App />);
  expect(settings.settings.smartHome.knownEntities).toBeUndefined();
  app.homeOnline = true;
  view.rerender(<App />); await saved();
  expect(settings.settings.smartHome.knownEntities).toEqual(["home|example-light"]);
  app.currentHome = { ...initial, entities: [...initial.entities, { ...initial.entities[0], entityId: "light.new", preferenceId: "home|new-light", name: "New lamp" }] };
  view.rerender(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
  expect(screen.getByRole("switch", { name: "Show entity Example lamp on Smart home" })).toBeChecked();
  expect(screen.getByRole("switch", { name: "Show entity New lamp on Smart home" })).not.toBeChecked();
  view.unmount();
  render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
  const toggle = screen.getByRole("switch", { name: "Show entity New lamp on Smart home" });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle); await saved();
  expect(settings.settings.smartHome.knownEntities).toEqual(["home|example-light", "home|new-light"]);
});

it("starts fresh devices disabled and enables only their current entities with confirmation", async () => {
  settings = emptyConfiguration();
  app.currentHome = mapHome({ "light.example": state("light.example", "on", { friendly_name: "Example lamp" }) }, {
    areas: [], devices: [{ id: "example-device", name: "Example hub" }],
    entities: [{ id: "example-light", entity_id: "light.example", device_id: "example-device" }],
  }, "home");
  window.history.replaceState(null, "", "/settings/smart-home");
  render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
  const device = screen.getByRole("switch", { name: "Show device Example hub on Smart home" });
  expect(device).not.toBeChecked();
  expect(screen.getByRole("switch", { name: "Show entity Example lamp on Smart home" })).not.toBeChecked();
  fireEvent.click(device);
  await confirmVisibility("Show group"); await saved();
  expect(settings.settings.smartHome.knownEntities).toEqual(["home|example-light"]);
  expect(screen.getByRole("switch", { name: "Show entity Example lamp on Smart home" })).toBeChecked();
});

it("saves device and entity visibility, restores individual choices, and filters Smart home after reload", async () => {
  app.currentHome = mapHome({
    "light.example": state("light.example", "on", { friendly_name: "Example lamp" }),
    "sensor.example": state("sensor.example", "20", { friendly_name: "Example temperature" }),
    "scene.example": state("scene.example", "unknown", { friendly_name: "Example scene" }),
    "switch.example": state("switch.example", "off", { friendly_name: "Example switch" }),
  }, {
    areas: [{ area_id: "example-area", name: "Example room" }],
    devices: [{ id: "example-device", name: "Example hub", area_id: "example-area" }],
    entities: [
      { id: "example-light", entity_id: "light.example", device_id: "example-device" },
      { id: "example-temperature", entity_id: "sensor.example", device_id: "example-device" },
    ],
  }, "home");
  settings.settings.smartHome.hiddenEntities = ["home|unavailable-example"];
  settings.settings.homeEntities = ["home|example-light"];
  window.history.replaceState(null, "", "/settings/smart-home");
  const first = render(<App />); await saved();
  const region = within(screen.getByRole("region", { name: "Smart home visibility" }));
  fireEvent.change(region.getByRole("combobox", { name: "Group by" }), { target: { value: "device" } });
  fireEvent.change(region.getByRole("searchbox"), { target: { value: "Example" } });
  const lamp = () => region.getByRole("switch", { name: "Show entity Example lamp on Smart home" });
  const temperature = () => region.getByRole("switch", { name: "Show entity Example temperature on Smart home" });
  const device = () => region.getByRole("switch", { name: "Show device Example hub on Smart home" });
  expect(lamp()).toBeChecked();
  fireEvent.click(temperature());
  const lampBeforeConfirmation = lamp();
  fireEvent.click(device());
  expect(lampBeforeConfirmation).toBeChecked();
  await confirmVisibility("Hide group");
  expect(lamp()).not.toBeChecked();
  expect(lamp()).toBeDisabled();
  fireEvent.click(device());
  await confirmVisibility("Show group");
  expect(lamp()).toBeChecked();
  expect(temperature()).not.toBeChecked();
  fireEvent.click(device());
  await confirmVisibility("Hide group");
  fireEvent.click(region.getByRole("switch", { name: "Show entity Example scene on Smart home" }));
  await saved();
  expect(settings.settings.smartHome).toMatchObject({ hiddenDevices: ["example-device"], hiddenEntities: ["home|unavailable-example", "home|example-temperature", "home|scene.example"] });
  expect(settings.settings.homeEntities).toEqual(["home|example-light"]);
  await navigate("Smart home");
  expect(screen.queryByText("Example lamp")).not.toBeInTheDocument();
  expect(screen.queryByText("Example temperature")).not.toBeInTheDocument();
  expect(screen.queryByText("Example scene")).not.toBeInTheDocument();
  expect(screen.getByText("Example switch")).toBeInTheDocument();
  expect(screen.getByText("0 visible lights on")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Example room" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Unassigned" })).toBeInTheDocument();
  first.unmount();
  render(<App />); await saved();
  expect(screen.queryByText("Example lamp")).not.toBeInTheDocument();
  expect(screen.getByText("Example switch")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Smart home settings" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Smart home settings" })).getByRole("link", { name: "Choose visible devices" }));
  await screen.findByRole("heading", { level: 1, name: "Smart home" });
  expect(window.location.pathname).toBe("/settings/smart-home");
  expect(window.location.hash).toBe("");
  fireEvent.change(screen.getByRole("combobox", { name: "Group by" }), { target: { value: "device" } });
  fireEvent.click(screen.getByRole("switch", { name: "Show device Example hub on Smart home" }));
  await confirmVisibility("Show group");
  await saved();
  await navigate("Smart home");
  expect(screen.getByText("Example lamp")).toBeInTheDocument();
  expect(screen.queryByText("Example temperature")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Example room" })).toBeInTheDocument();
});

it("offers only rooms containing selected cards and clears a room filter when its last card disappears", async () => {
  const home = mapHome({
    "light.selected": state("light.selected", "off", { friendly_name: "Selected lamp" }),
    "sensor.support": state("sensor.support", "20", { friendly_name: "Supporting sensor" }),
    "light.hidden": state("light.hidden", "off"),
    "light.new": state("light.new", "off"),
    "scene.example": state("scene.example", "unknown"),
    "switch.unassigned": state("switch.unassigned", "off", { friendly_name: "Unassigned switch" }),
  }, {
    areas: ["selected", "support", "hidden", "new", "scene", "empty"].map(id => ({ area_id: id, name: `Example ${id} room` })),
    devices: [{ id: "example-device", name: "Example device", area_id: "selected" }],
    entities: [
      { id: "selected", entity_id: "light.selected", device_id: "example-device" },
      { id: "support", entity_id: "sensor.support", device_id: "example-device", area_id: "support" },
      ...["hidden", "new"].map(id => ({ id, entity_id: `light.${id}`, area_id: id })),
      { id: "scene", entity_id: "scene.example", area_id: "scene" },
    ],
  }, "home");
  app.currentHome = home;
  settings.settings.smartHome.knownEntities = home.entities.map(entity => entity.preferenceId).filter(id => id !== "home|new");
  settings.settings.smartHome.hiddenEntities = ["home|hidden"];
  window.history.replaceState(null, "", "/home");
  const view = render(<App />); await saved();
  for (const room of ["support", "hidden", "new", "scene", "empty"]) expect(screen.queryByRole("button", { name: `Example ${room} room` })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Unassigned" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Example selected room" }));
  expect(screen.getByRole("article", { name: "Selected lamp" })).toBeInTheDocument();
  expect(screen.queryByRole("article", { name: "Unassigned switch" })).not.toBeInTheDocument();
  app.currentHome = { ...home, entities: home.entities.filter(entity => !entity.device) };
  view.rerender(<App />);
  expect(screen.queryByRole("button", { name: "Example selected room" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "All areas" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("article", { name: "Unassigned switch" })).toBeInTheDocument();
  app.currentHome = home; view.rerender(<App />);
  expect(screen.getByRole("button", { name: "All areas" })).toHaveAttribute("aria-pressed", "true");
});

it.each(["entity", "device", "new"])("selects and saves a hidden main entity (%s) without enabling hidden siblings", async hiddenBy => {
  app.currentHome = mapHome({
    "light.example": state("light.example", "on", { friendly_name: "Example lamp" }),
    "sensor.example": state("sensor.example", "20", { friendly_name: "Example temperature" }),
    "sensor.other": state("sensor.other", "50", { friendly_name: "Example humidity" }),
  }, {
    areas: [], devices: [{ id: "example-device", name: "Example hub" }],
    entities: [
      { id: "example-light", entity_id: "light.example", device_id: "example-device" },
      { id: "example-temperature", entity_id: "sensor.example", device_id: "example-device" },
      { id: "example-humidity", entity_id: "sensor.other", device_id: "example-device" },
    ],
  }, "home");
  const main = "home|example-temperature";
  settings.settings.smartHome.knownEntities = app.currentHome.entities.map(entity => entity.preferenceId).filter(id => hiddenBy !== "new" || id !== main);
  settings.settings.smartHome.hiddenEntities = ["home|example-humidity", ...(hiddenBy === "entity" ? [main] : [])];
  settings.settings.smartHome.hiddenDevices = hiddenBy === "device" ? ["example-device"] : [];
  window.history.replaceState(null, "", "/settings/smart-home");
  const view = render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
  const picker = () => screen.getByRole("button", { name: "Main entity for Example hub" });
  expect(screen.getByRole("switch", { name: "Show entity Example temperature on Smart home" })).not.toBeChecked();
  chooseEntity(picker(), "sensor.example"); await saved();
  expect(picker()).toHaveTextContent("Example temperature");
  expect(screen.getByRole("switch", { name: "Show entity Example temperature on Smart home" })).toBeChecked();
  expect(screen.getByRole("switch", { name: "Show entity Example humidity on Smart home" })).not.toBeChecked();
  expect(settings.settings.smartHome.cards["device:example-device"].mainEntity).toBe(main);
  expect(settings.settings.smartHome.knownEntities).toContain(main);
  view.unmount(); render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
  expect(picker()).toHaveTextContent("Example temperature");
  await navigate("Smart home");
  expect(screen.getByRole("link", { name: "Example temperature details" }).closest(".dg-card")).toHaveAttribute("data-card-kind", "sensor");
  expect(screen.queryByText("Example humidity")).not.toBeInTheDocument();
});

it("labels summaries as visible selections when all lights, climate and alarms are hidden", async () => {
  app.currentHome = mapHome({
    "light.example": state("light.example", "on"),
    "climate.example": state("climate.example", "heat", { current_temperature: 25 }),
    "alarm_control_panel.example": state("alarm_control_panel.example", "armed_away"),
  }, emptyRegistries, "home");
  settings.settings.smartHome.hiddenEntities = app.currentHome.entities.map(entity => entity.preferenceId);
  window.history.replaceState(null, "", "/home");
  render(<App />); await saved();
  expect(screen.getByRole("link", { name: "Lighting 0 visible lights on" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Climate No visible climate device" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Security No visible alarm" })).toBeInTheDocument();
  expect(screen.queryByText("Armed away")).not.toBeInTheDocument();
  expect(screen.getByText("No devices visible on Smart home.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Unassigned" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "All areas" })).toHaveAttribute("aria-pressed", "true");
});

it("configures card order across room filters, size and grouping on Smart home and saves after reload", async () => {
  app.currentHome = mapHome(Object.fromEntries(["alpha", "beta", "gamma"].map(name => [`light.${name}`, state(`light.${name}`, "off", { friendly_name: `Example ${name}` })])), {
    areas: [{ area_id: "room-a", name: "Example room A" }, { area_id: "room-b", name: "Example room B" }], devices: [],
    entities: ["alpha", "beta", "gamma"].map(name => ({ id: name, entity_id: `light.${name}`, area_id: name === "beta" ? "room-b" : "room-a" })),
  }, "home");
  settings.settings.smartHome.cards = Object.fromEntries(["alpha", "beta", "gamma"].map(name => [`home|${name}`, { group: "Comfort", linkedEntities: [] }]));
  window.history.replaceState(null, "", "/home");
  const view = render(<App />); await saved();
  expect(screen.queryByRole("button", { name: "Configure" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Smart home settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Configure" }));
  expect(screen.queryByRole("dialog", { name: "Smart home settings" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Example room A" }));
  fireEvent.click(screen.getByRole("button", { name: "Move Example gamma earlier" })); await saved();
  expect(settings.settings.smartHome.cards["home|gamma"].order).toBe(0);
  expect(settings.settings.smartHome.cards["home|alpha"].order).toBe(1);
  expect(settings.settings.smartHome.cards["home|beta"].order).toBe(2);
  fireEvent.change(screen.getByRole("combobox", { name: "Card size for Example gamma" }), { target: { value: "original" } });
  expect(document.querySelector<HTMLElement>('[data-smart-card="home|gamma"] .smart-card-preview').inert).toBe(true);
  expect(document.querySelector('[data-smart-card="home|gamma"] .dg-card')).toHaveAttribute("data-variant", "Original");
  fireEvent.change(screen.getByRole("textbox", { name: "New group name" }), { target: { value: "Reading" } });
  fireEvent.click(screen.getByRole("button", { name: "Add group" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Card group for Example gamma" }), { target: { value: "Reading" } }); await saved();
  expect(settings.settings.smartHome.cards["home|gamma"].group).toBe("Reading");
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("combobox", { name: "Card size for Example gamma" })).not.toBeInTheDocument();
  view.unmount(); render(<App />); await saved();
  expect(within(screen.getByRole("region", { name: "Reading" })).getByRole("article", { name: "Example gamma" })).toHaveAttribute("data-variant", "Original");
  expect(within(screen.getByRole("region", { name: "Comfort" })).getAllByRole("article").map(card => card.getAttribute("aria-label"))).toEqual(["Example alpha", "Example beta"]);
});

it("keeps layout edits visible on a save conflict and blocks further moves", async () => {
  app.currentHome = mapHome({ "light.example": state("light.example", "off", { friendly_name: "Example lamp" }) }, emptyRegistries, "home");
  window.history.replaceState(null, "", "/home");
  render(<App />); await saved();
  expect(screen.queryByRole("button", { name: "Configure" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Smart home settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Configure" }));
  expect(screen.queryByRole("dialog", { name: "Smart home settings" })).not.toBeInTheDocument();
  app.configurationRequest.mockResolvedValue({ ok: false, status: 409 });
  fireEvent.change(screen.getByRole("combobox", { name: "Card size for Example lamp" }), { target: { value: "original" } });
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Another screen changed the configuration"));
  expect(screen.getByRole("combobox", { name: "Card size for Example lamp" })).toHaveValue("original");
  expect(screen.getByRole("combobox", { name: "Card group for Example lamp" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "New group name" })).toBeDisabled();
  expect(screen.getByRole("link", { name: "Storage and backups" })).toBeInTheDocument();
});

it("keeps smart home visibility drafts on save failure and disables further changes", async () => {
  app.currentHome = mapHome({ "switch.example": state("switch.example", "off", { friendly_name: "Example switch" }) }, emptyRegistries, "home");
  window.history.replaceState(null, "", "/settings/smart-home");
  render(<App />); await saved();
  const region = within(screen.getByRole("region", { name: "Smart home visibility" }));
  fireEvent.click(region.getByRole("button", { name: "Expand all" }));
  app.configurationRequest.mockResolvedValue({ ok: false, status: 409 });
  const toggle = region.getByRole("switch", { name: "Show entity Example switch on Smart home" });
  fireEvent.click(toggle);
  await waitFor(() => expect(region.getByRole("alert")).toHaveTextContent("Another screen changed the configuration"));
  expect(toggle).not.toBeChecked();
  expect(toggle).toBeDisabled();
  expect(region.getByRole("switch", { name: "Show all matching entities" })).toBeDisabled();
  expect(region.getByText("Unsaved changes on this screen.")).toBeInTheDocument();
  expect(settings.settings.smartHome.hiddenEntities).toEqual([]);
  expect(region.getByRole("link", { name: "Storage and backups" })).toBeInTheDocument();
});

it("groups visibility by domain, integration and device, and confirms only the filtered branch", async () => {
  app.currentHome = mapHome({
    "light.example": state("light.example", "on", { friendly_name: "Example lamp" }),
    "sensor.example": state("sensor.example", "20", { friendly_name: "Example reading" }),
    "light.other": state("light.other", "off", { friendly_name: "Other lamp" }),
  }, { areas: [], devices: [{ id: "example-device", name: "Example hub" }], entities: [
    { id: "example-light", entity_id: "light.example", device_id: "example-device", platform: "mqtt" },
    { id: "example-reading", entity_id: "sensor.example", device_id: "example-device", platform: "mqtt", entity_category: "diagnostic" },
    { id: "other-light", entity_id: "light.other", platform: "hue" },
  ] }, "home");
  window.history.replaceState(null, "", "/settings/smart-home");
  render(<App />); await saved();
  const region = within(screen.getByRole("region", { name: "Smart home visibility" }));
  expect(region.getByRole("combobox", { name: "Group by" })).toHaveValue("device");
  fireEvent.change(region.getByRole("combobox", { name: "Group by" }), { target: { value: "domain" } });
  fireEvent.click(region.getByRole("button", { name: "Expand all" }));
  const lamp = region.getByRole("switch", { name: "Show entity Example lamp on Smart home" });
  const branch = lamp.closest("li").parentElement.closest("li");
  expect(branch.querySelector("summary")).toHaveTextContent("Example hub");
  expect(branch.parentElement.closest("li").querySelector("summary")).toHaveTextContent("mqtt");
  expect(branch.parentElement.closest("li").parentElement.closest("li").querySelector("summary")).toHaveTextContent("Light");
  fireEvent.change(region.getByRole("combobox", { name: "Integration" }), { target: { value: "mqtt" } });
  const toggle = () => region.getByRole("switch", { name: "Show group Light on Smart home" });
  const toggleBeforeConfirmation = toggle();
  fireEvent.click(toggle());
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Hide the 1 matching entities in Light?");
  expect(toggleBeforeConfirmation).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(toggle()).toBeChecked();
  expect(settings.settings.smartHome).toMatchObject({ hiddenDevices: [], hiddenEntities: [] });
  fireEvent.click(toggle());
  await confirmVisibility("Hide group");
  await saved();
  expect(settings.settings.smartHome).toMatchObject({ hiddenDevices: [], hiddenEntities: ["home|example-light"] });
  expect(region.getByRole("switch", { name: "Show entity Example reading on Smart home" })).toBeChecked();
  fireEvent.change(region.getByRole("combobox", { name: "Visibility" }), { target: { value: "hidden" } });
  expect(region.getByText("1 of 3 entities")).toBeInTheDocument();
  expect(region.queryByRole("switch", { name: "Show entity Example reading on Smart home" })).not.toBeInTheDocument();
  fireEvent.click(toggle());
  await confirmVisibility("Show group");
  await saved();
  expect(region.getByText("No matching entities. Change or clear the filters.")).toBeInTheDocument();
  fireEvent.click(region.getByRole("button", { name: "Clear filters" }));
  fireEvent.change(region.getByRole("combobox", { name: "Entity category" }), { target: { value: "diagnostic" } });
  expect(region.getByText("1 of 3 entities")).toBeInTheDocument();
  expect(region.getByRole("switch", { name: "Show entity Example reading on Smart home" })).toBeChecked();
  fireEvent.change(region.getByRole("combobox", { name: "Group by" }), { target: { value: "none" } });
  fireEvent.click(region.getByRole("switch", { name: "Show entity Example reading on Smart home" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  await saved();
});

it("toggles all filtered entities with confirmation independently of grouping", async () => {
  app.currentHome = mapHome({
    "light.example": state("light.example", "on"),
    "sensor.example": state("sensor.example", "20"),
    "light.other": state("light.other", "off"),
  }, { areas: [], devices: [{ id: "example-device", name: "Example hub" }], entities: [
    { id: "example-light", entity_id: "light.example", device_id: "example-device", platform: "mqtt" },
    { id: "example-reading", entity_id: "sensor.example", device_id: "example-device", platform: "mqtt" },
    { id: "other-light", entity_id: "light.other", platform: "hue" },
  ] }, "home");
  settings.settings.smartHome.hiddenDevices = ["example-device"];
  window.history.replaceState(null, "", "/settings/smart-home");
  render(<App />); await saved();
  const region = within(screen.getByRole("region", { name: "Smart home visibility" }));
  const filters = within(region.getByRole("group", { name: "Filters" }));
  const grouping = within(region.getByRole("group", { name: "Grouping" }));
  expect(filters.queryByRole("combobox", { name: "Group by" })).not.toBeInTheDocument();
  expect(grouping.queryByRole("combobox", { name: "Domain" })).not.toBeInTheDocument();
  fireEvent.change(filters.getByRole("combobox", { name: "Domain" }), { target: { value: "light" } });
  const toggle = () => region.getByRole("switch", { name: "Show all matching entities" });
  expect(toggle()).not.toBeChecked();
  expect(region.getByText("2 of 3 entities")).toBeInTheDocument();
  fireEvent.change(grouping.getByRole("combobox", { name: "Group by" }), { target: { value: "none" } });
  expect(region.getByText("2 of 3 entities")).toBeInTheDocument();
  fireEvent.click(toggle());
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Show all entities matching the filters (2)?");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(toggle()).not.toBeChecked();
  expect(settings.settings.smartHome.hiddenDevices).toEqual(["example-device"]);
  fireEvent.click(toggle());
  await confirmVisibility("Show all matches");
  await saved();
  expect(toggle()).toBeChecked();
  expect(settings.settings.smartHome).toMatchObject({ hiddenDevices: [], hiddenEntities: ["home|example-reading"] });
  fireEvent.click(toggle());
  await confirmVisibility("Hide all matches");
  await saved();
  expect(toggle()).not.toBeChecked();
  expect(settings.settings.smartHome.hiddenEntities).toEqual(["home|example-reading", "home|example-light", "home|other-light"]);
  fireEvent.change(filters.getByRole("combobox", { name: "Visibility" }), { target: { value: "hidden" } });
  fireEvent.click(toggle());
  await confirmVisibility("Show all matches");
  await saved();
  expect(toggle()).toBeDisabled();
  expect(toggle()).not.toBeChecked();
  expect(region.getByText("0 of 3 entities")).toBeInTheDocument();
  fireEvent.click(filters.getByRole("button", { name: "Clear filters" }));
  expect(grouping.getByRole("combobox", { name: "Group by" })).toHaveValue("none");
  expect(region.getByText("3 of 3 entities")).toBeInTheDocument();
  expect(toggle()).toBeEnabled();
});

it("confirms single-child device groups and disables confirmation if shared settings fail", async () => {
  app.currentHome = mapHome({ "light.example": state("light.example", "on", { friendly_name: "Example lamp" }) }, {
    areas: [], devices: [{ id: "example-device", name: "Example device" }],
    entities: [{ id: "example-light", entity_id: "light.example", device_id: "example-device" }],
  }, "home");
  window.history.replaceState(null, "", "/settings/smart-home");
  render(<App />); await saved();
  const region = within(screen.getByRole("region", { name: "Smart home visibility" }));
  fireEvent.click(region.getByRole("button", { name: "Expand all" }));
  const toggle = region.getByRole("switch", { name: "Show device Example device on Smart home" });
  app.configurationRequest.mockResolvedValue({ ok: false, status: 409 });
  fireEvent.click(region.getByRole("switch", { name: "Show entity Example lamp on Smart home" }));
  fireEvent.click(toggle);
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Hide group" })).toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(toggle).toBeDisabled();
  expect(settings.settings.smartHome).toMatchObject({ hiddenDevices: [], hiddenEntities: [] });
});

it("hides each Today section, persists the choices and keeps hidden content available on other pages", async () => {
  const today = homeDate(new Date(), "UTC");
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Example person" }),
    "sensor.afterglow_morning_summary": state("sensor.afterglow_morning_summary", today, { message: "Example summary" }),
  }, emptyRegistries, "home");
  app.currentHome.timeZone = "UTC";
  settings.settings.timetables = { "home|person.example": ["/example.png"] };
  settings.settings.dashboard.showTomorrow = true;
  const originalTimetables = structuredClone(settings.settings.timetables);
  const first = render(<App />); await saved();
  const headings = ["Morning summary", "Everyone’s day", "Everyone’s week", "Daily rhythm", "Shopping", "School", "Just right at home"];
  for (const name of headings) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Next family plan" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  const dialog = screen.getByRole("dialog", { name: "Customize Today" });
  const toggles = within(dialog).getAllByRole("switch").filter(toggle => toggle.getAttribute("aria-label") !== "Show tomorrow’s plans");
  expect(toggles).toHaveLength(8);
  for (const toggle of toggles) { expect(toggle).toBeChecked(); fireEvent.click(toggle); }
  expect(within(dialog).getByRole("switch", { name: "Show tomorrow’s plans" })).toBeDisabled();
  await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent("Shared configuration saved."));
  fireEvent.keyDown(dialog, { key: "Escape" });
  await saved();
  for (const name of headings) expect(screen.queryByRole("heading", { name })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Next family plan" })).not.toBeInTheDocument();
  expect(screen.getByText("All sections are hidden. Use the settings cog to show them again.")).toBeInTheDocument();
  expect(settings.settings.dashboard.showTomorrow).toBe(true);
  expect(Object.entries(settings.settings.dashboard).filter(([key]) => key !== "showTomorrow").every(([, value]) => !value)).toBe(true);
  expect(settings.settings.timetables).toEqual(originalTimetables);
  first.unmount();
  render(<App />); await saved();
  expect(screen.queryByRole("heading", { name: "Everyone’s week" })).not.toBeInTheDocument();
  await navigate("Lists");
  expect(screen.getByRole("heading", { name: "Shopping" })).toBeInTheDocument();
  await navigate("School");
  expect(screen.getByRole("img", { name: "Example person’s school timetable" })).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Today" }));
  fireEvent.click(await screen.findByRole("button", { name: "Customize Today" }));
  fireEvent.click(screen.getByRole("switch", { name: "Shopping" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await saved();
  expect(screen.getByRole("heading", { name: "Shopping" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Everyone’s week" })).not.toBeInTheDocument();
  expect(settings.settings.dashboard).toEqual({ morningSummary: false, nextPlan: false, day: false, showTomorrow: true, week: false, daily: false, shopping: true, school: false, home: false });
});

it("translates Today settings and keeps a failed save visible and recoverable", async () => {
  settings.settings.language = "nb";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Tilpass I dag" }));
  const dialog = screen.getByRole("dialog", { name: "Tilpass I dag" });
  expect(within(dialog).getByRole("switch", { name: "Dagen vår" })).toBeChecked();
  expect(within(dialog).getByRole("switch", { name: "Vis morgendagens planer" })).not.toBeChecked();
  await waitFor(() => expect(within(dialog).getByRole("switch", { name: "Handleliste" })).toBeEnabled());
  app.configurationRequest.mockResolvedValue({ ok: false, status: 409 });
  fireEvent.click(within(dialog).getByRole("switch", { name: "Handleliste" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("En annen skjerm");
  expect(within(dialog).getByRole("switch", { name: "Handleliste" })).not.toBeChecked();
  for (const toggle of within(dialog).getAllByRole("switch")) expect(toggle).toBeDisabled();
  expect(within(dialog).getByRole("status")).toHaveTextContent("Ulagrede endringer");
  expect(settings.settings.dashboard.shopping).toBe(true);
  fireEvent.click(within(dialog).getByRole("link", { name: "Lagring og sikkerhetskopier" }));
  expect(await screen.findByRole("button", { name: "Last felles versjon" })).toBeInTheDocument();
});

it.each(["today", "monday"] as const)("groups today's assigned calendar events by person when the week starts on %s", async startDay => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T22:30:00Z"));
  app.currentHome = mapHome(Object.fromEntries([
    ["person.everyone", state("person.everyone", "home", { friendly_name: "Everyone" })],
    ...["a", "b", "c", "hidden"].map(id => [`person.${id}`, state(`person.${id}`, "home", { friendly_name: `Example ${id.toUpperCase()}` })]),
    ...["a", "extra", "b", "shared", "hidden", "unselected"].map(id => [`calendar.${id}`, state(`calendar.${id}`, "off")]),
  ]), emptyRegistries, "home");
  app.currentHome.timeZone = "Europe/Oslo";
  settings.settings.calendar.startDay = startDay;
  settings.settings.calendarMembers = { "home|calendar.a": "home|person.a", "home|calendar.extra": "home|person.a", "home|calendar.b": "home|person.b", "home|calendar.shared": "home|person.everyone", "home|calendar.hidden": "home|person.hidden" };
  settings.settings.hiddenMembers = ["home|person.hidden"];
  settings.settings.memberOrder = ["home|person.everyone", "home|person.b", "home|person.a", "home|person.c"];
  const events = {
    "calendar.a": [
      { summary: "Later example", start: "2026-10-21T14:00:00Z", end: "2026-10-21T15:00:00Z", description: "Example preparation details", location: "Example hall" },
      { summary: "Previous day example", start: "2026-10-20T18:00:00Z", end: "2026-10-20T22:00:00Z" },
      { summary: "Next day example", start: "2026-10-22T08:00:00Z", end: "2026-10-22T09:00:00Z" },
      { summary: "Overnight example", start: "2026-10-20T20:00:00Z", end: "2026-10-21T05:00:00Z" },
    ],
    "calendar.extra": [{ summary: "Early example", start: "2026-10-20T22:15:00Z", end: "2026-10-20T22:25:00Z" }],
    "calendar.shared": [{ summary: "Shared example", start: "2026-10-20", end: "2026-10-23" }],
  };
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, receive) => receive(events[id] ?? []));
  render(<App />); await saved();
  const day = within(screen.getByRole("region", { name: "Everyone’s day" }));
  expect(day.getAllByRole("group").map(group => group.getAttribute("aria-label"))).toEqual(["Everyone", "Example B", "Example A", "Example C"]);
  const person = within(day.getByRole("group", { name: "Example A" }));
  expect(person.getAllByRole("button").map(button => button.querySelector("strong")?.textContent)).toEqual(["Overnight example", "Early example", "Later example"]);
  expect(person.getByRole("button", { name: /Early example/ })).toHaveTextContent("00:15 – 00:25");
  expect(person.getByRole("button", { name: /Overnight example/ })).toHaveTextContent("Continues – 07:00");
  expect(person.getByRole("button", { name: /Later example/ })).toHaveTextContent("Example A · Example hall");
  expect(day.queryByText("Previous day example")).not.toBeInTheDocument();
  expect(day.queryByText("Next day example")).not.toBeInTheDocument();
  expect(within(day.getByRole("group", { name: "Everyone" })).getByRole("button", { name: /Shared example/ })).toHaveTextContent("All day");
  expect(day.getAllByText("Shared example")).toHaveLength(1);
  const emptyToday = day.getByRole("group", { name: "Example B" });
  expect(within(emptyToday).getByRole("img", { name: "No plans today." })).toBeInTheDocument();
  expect(emptyToday).toHaveTextContent(/^$/);
  expect(day.getByRole("group", { name: "Example C" })).toHaveTextContent(/^No calendars selected$/);
  expect(app.watchCalendarEvents.mock.calls.map(([id]) => id).sort()).toEqual(["calendar.a", "calendar.b", "calendar.extra", "calendar.shared"]);
  const refresh = day.getByRole("button", { name: "Refresh calendars" });
  expect(refresh).toHaveAttribute("title", "Refresh calendars");
  expect(refresh).toHaveTextContent(/^$/);
  expect(day.queryByRole("link", { name: "Open calendar" })).not.toBeInTheDocument();
  fireEvent.click(refresh);
  await waitFor(() => expect(app.watchCalendarEvents).toHaveBeenCalledTimes(8));
  fireEvent.click(person.getByRole("button", { name: /Later example/ }));
  expect(screen.getByRole("dialog", { name: "Later example" })).toHaveTextContent("Example preparation details");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show tomorrow’s plans" }));
  fireEvent.click(screen.getByRole("switch", { name: "Everyone’s week" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await saved();
  expect(screen.getByRole("region", { name: "Everyone’s day" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Everyone’s week" })).not.toBeInTheDocument();
  const emptyTomorrow = within(day.getByRole("region", { name: "Tomorrow" })).getByRole("group", { name: "Example B" });
  expect(within(emptyTomorrow).getByRole("img", { name: "No plans tomorrow." })).toBeInTheDocument();
  expect(emptyTomorrow).toHaveTextContent(/^$/);
  expect(within(day.getByRole("region", { name: "Tomorrow" })).getByRole("group", { name: "Example C" })).toHaveTextContent("No calendars selected");
});

it.each([
  ["2026-10-25", "monday"],
  ["2026-10-25", "today"],
  ["2026-12-31", "monday"],
] as const)("optionally shows tomorrow after %s with the week starting on %s", async (today, startDay) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${today}T12:00:00Z`));
  const tomorrow = addDays(today, 1), afterTomorrow = addDays(today, 2);
  app.currentHome = mapHome({
    "person.everyone": state("person.everyone", "home", { friendly_name: "Everyone" }),
    "person.example": state("person.example", "home", { friendly_name: "Example person" }),
    "calendar.example": state("calendar.example", "off"), "calendar.shared": state("calendar.shared", "off"),
  }, emptyRegistries, "home");
  app.currentHome.timeZone = "Europe/Oslo";
  settings.settings.calendar.startDay = startDay;
  settings.settings.dashboard.week = false;
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example", "home|calendar.shared": "home|person.everyone" };
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, receive) => receive(id === "calendar.example" ? [
    { summary: "Tomorrow later", start: `${tomorrow}T14:00:00Z`, end: `${tomorrow}T15:00:00Z`, description: "Example preparation" },
    { summary: "Tomorrow early", start: `${tomorrow}T08:00:00Z`, end: `${tomorrow}T09:00:00Z` },
    { summary: "Overnight example", start: `${today}T21:00:00Z`, end: `${tomorrow}T05:00:00Z` },
    { summary: "Beyond tomorrow", start: afterTomorrow, end: addDays(today, 3) },
  ] : [{ summary: "Shared two-day plan", start: today, end: afterTomorrow }]));
  const first = render(<App />); await saved();
  let day = within(screen.getByRole("region", { name: "Everyone’s day" }));
  expect(day.queryByText("Tomorrow early")).not.toBeInTheDocument();
  expect(day.queryByRole("region", { name: "Tomorrow" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show tomorrow’s plans" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await saved();
  expect(day.getAllByRole("region").map(row => row.getAttribute("aria-label"))).toEqual(["Today", "Tomorrow"]);
  expect(day.getAllByRole("heading", { name: /^Today / })).toHaveLength(1);
  expect(day.getAllByRole("heading", { name: /^Tomorrow / })).toHaveLength(1);
  const todayRow = within(day.getByRole("region", { name: "Today" }));
  const tomorrowRow = within(day.getByRole("region", { name: "Tomorrow" }));
  for (const row of [todayRow, tomorrowRow]) expect(row.getAllByRole("group").map(group => group.getAttribute("aria-label"))).toEqual(["Everyone", "Example person"]);
  expect(within(todayRow.getByRole("group", { name: "Example person" })).getAllByRole("button")).toHaveLength(1);
  const nextDay = within(tomorrowRow.getByRole("group", { name: "Example person" }));
  expect(nextDay.getAllByRole("button").map(button => button.querySelector("strong")?.textContent)).toEqual(["Overnight example", "Tomorrow early", "Tomorrow later"]);
  expect(nextDay.getByRole("button", { name: /Overnight example/ })).toHaveTextContent("Continues – 06:00");
  expect(nextDay.getByRole("button", { name: /Tomorrow early/ })).toHaveTextContent("09:00 – 10:00");
  expect(day.queryByText("Beyond tomorrow")).not.toBeInTheDocument();
  for (const row of [todayRow, tomorrowRow]) expect(within(row.getByRole("group", { name: "Everyone" })).getByRole("button", { name: /Shared two-day plan/ })).toBeInTheDocument();
  const expectedEnd = startDay === "today" ? addDays(today, 7) : [addDays(weekStart(today), 7), afterTomorrow].sort()[1];
  expect(app.watchCalendarEvents.mock.calls.slice(-2).every(([, , to]) => homeDate(new Date(to), app.currentHome.timeZone) === expectedEnd)).toBe(true);
  expect(app.watchCalendarEvents).toHaveBeenCalledTimes(today === "2026-10-25" && startDay === "monday" ? 4 : 2);
  fireEvent.click(nextDay.getByRole("button", { name: /Tomorrow later/ }));
  expect(screen.getByRole("dialog", { name: "Tomorrow later" })).toHaveTextContent("Example preparation");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  first.unmount();
  render(<App />); await saved();
  day = within(screen.getByRole("region", { name: "Everyone’s day" }));
  expect(day.getByRole("button", { name: /Tomorrow early/ })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  expect(screen.getByRole("switch", { name: "Show tomorrow’s plans" })).toBeChecked();
  fireEvent.click(screen.getByRole("switch", { name: "Show tomorrow’s plans" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await saved();
  expect(day.queryByRole("region", { name: "Tomorrow" })).not.toBeInTheDocument();
  expect(settings.settings.dashboard.showTomorrow).toBe(false);
});

it.each(["loading", "failed", "offline", "missing"])("does not claim daily plans are empty when a calendar is %s", async condition => {
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example person" }),
    ...(condition === "missing" ? {} : { "calendar.example": state("calendar.example", "off") }),
  }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example" };
  settings.settings.dashboard.showTomorrow = true;
  if (condition === "offline") app.homeOnline = false;
  if (condition === "failed") app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive(null));
  render(<App />); await saved();
  const day = within(screen.getByRole("region", { name: "Everyone’s day" }));
  for (const label of ["Today", "Tomorrow"]) {
    const person = within(day.getByRole("region", { name: label })).getByRole("group", { name: "Example person" });
    expect(person).toHaveTextContent(condition === "loading" ? "Loading plans…" : condition === "offline" ? "Calendars unavailable while offline." : "Some calendars could not be loaded.");
    expect(person).not.toHaveTextContent("Example person");
    expect(within(person).queryByRole("img")).not.toBeInTheDocument();
  }
  expect(day.queryByText("No plans today.")).not.toBeInTheDocument();
  expect(day.queryByText("No plans tomorrow.")).not.toBeInTheDocument();
});

it("configures calendars in settings, shows today's agenda on School and keeps the full week accessible", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Example child" }),
    ...Object.fromEntries(["Activities", "Invitations", "Pedagogy", "Closures", "Hours"].map(name => [`calendar.${name.toLowerCase()}`, state(`calendar.${name.toLowerCase()}`, "off", { friendly_name: name })])),
  }, emptyRegistries, "home");
  const child = "home|person.example";
  settings.settings.timetableEnabled = { [child]: true };
  settings.settings.timetables = { [child]: ["/sample.png"] };
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, receive) => {
    const activity = { summary: "Example activity", start: "2026-10-26T09:00:00Z", end: "2026-10-26T10:00:00Z" };
    receive(id === "calendar.activities" || id === "calendar.invitations" ? [activity]
      : [{ summary: id === "calendar.pedagogy" ? "Shared focus" : id === "calendar.closures" ? "Planning day" : "Regular hours", description: id === "calendar.pedagogy" ? "A long educational message.\nA second paragraph." : "", start: "2026-10-26", end: "2026-10-27" }]);
  });
  window.history.replaceState(null, "", "/settings#timetables");
  const view = render(<App />); await saved();
  expect(screen.getByLabelText("School or kindergarten for Example child")).toHaveValue("school");
  fireEvent.change(screen.getByLabelText("School or kindergarten for Example child"), { target: { value: "kindergarten" } });
  fireEvent.change(screen.getByLabelText("Timetable type for Example child"), { target: { value: "calendar" } });
  expect(screen.getAllByRole("button", { name: /^School day view ·/ })).toHaveLength(5);
  expect(within(screen.getByRole("tabpanel")).getAllByText("No calendars selected")).toHaveLength(3);
  expect(app.watchCalendarEvents).not.toHaveBeenCalled();
  expect(within(screen.getByRole("tabpanel")).queryByText(/popup/i)).not.toBeInTheDocument();
  expect(screen.queryByText("Dashboard week view")).not.toBeInTheDocument();
  for (const [category, names] of [["School day view · Activities", ["Activities", "Invitations"]], ["School day view · Meetings", ["Invitations"]], ["School day view · Messages (Pedagogy)", ["Pedagogy"]], ["School day view · Closure days", ["Closures"]], ["School day view · Opening hours", ["Hours"]]] as const) {
    fireEvent.click(screen.getByRole("button", { name: `${category} calendars for Example child` }));
    const picker = screen.getByRole("dialog", { name: `${category} calendars for Example child` });
    for (const name of names) fireEvent.click(within(picker).getByRole("checkbox", { name }));
    fireEvent.keyDown(picker, { key: "Escape" });
  }
  await saved();
  expect(settings.settings.timetableSettings[child].calendars["home|calendar.activities"]).toEqual(["events", "popupActivities"]);
  expect(settings.settings.timetableSettings[child].calendars["home|calendar.pedagogy"]).toEqual(["message", "popupMessages"]);
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Monday/ }), { button: 0, ctrlKey: false });
  const preview = screen.getByRole("tabpanel");
  expect(within(within(preview).getByRole("region", { name: "Activities" })).getByText("Example activity")).toBeVisible();
  expect(within(within(preview).getByRole("region", { name: "Messages (Pedagogy)" })).getByText("Shared focus")).toBeVisible();
  expect(app.watchCalendarEvents.mock.calls.every(([, , to]) => homeDate(new Date(to), app.currentHome.timeZone) === "2026-10-31")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "School day view · Activities calendars for Example child" }));
  const popupPicker = screen.getByRole("dialog", { name: "School day view · Activities calendars for Example child" });
  fireEvent.click(within(popupPicker).getByRole("checkbox", { name: "Activities" }));
  fireEvent.click(within(popupPicker).getByRole("checkbox", { name: "Invitations" }));
  fireEvent.keyDown(popupPicker, { key: "Escape" });
  await saved();
  expect(settings.settings.timetableSettings[child].calendars).not.toHaveProperty("home|calendar.activities");
  expect(settings.settings.timetableSettings[child].calendars["home|calendar.invitations"]).toEqual(["events", "popupMeetings"]);
  expect(screen.getByRole("tab", { name: /Monday/ })).toHaveAttribute("aria-selected", "true");
  expect(within(within(preview).getByRole("region", { name: "Activities" })).queryByText("Example activity")).not.toBeInTheDocument();
  expect(within(within(preview).getByRole("region", { name: "Activities" })).getByText("No calendars selected")).toBeVisible();
  expect(settings.settings.timetables[child]).toEqual(["/sample.png"]);
  expect(JSON.stringify(settings)).not.toContain("Shared focus");
  await navigate("School");
  const today = await screen.findByRole("tabpanel");
  expect(within(today).queryByText("Shared focus")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Activities for Example child" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Expand timetable" })).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Monday/ }), { button: 0, ctrlKey: false });
  const selectedDay = screen.getByRole("tabpanel");
  expect(within(within(selectedDay).getByRole("region", { name: "Messages (Pedagogy)" })).getByText("Shared focus")).toBeVisible();
  expect(within(within(selectedDay).getByRole("region", { name: "Meetings" })).getByText("Example activity")).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Upload .* timetable PDF/)).not.toBeInTheDocument();
  expect(screen.queryByText("Share from iPhone")).not.toBeInTheDocument();
  const subscriptions = [...app.watchCalendarEvents.mock.calls];
  expect(subscriptions.some(([id, , to]) => id === "calendar.pedagogy" && homeDate(new Date(to), app.currentHome.timeZone) === "2027-10-25")).toBe(true);
  view.unmount();
  expect(subscriptions.every(call => call[3].aborted)).toBe(true);
  window.history.replaceState(null, "", "/");
  render(<App />); await saved();
  expect(await screen.findByText("Shared focus")).toBeInTheDocument();
  expect(screen.getAllByText("Example activity")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Expand timetable" }));
  const dialog = screen.getByRole("dialog", { name: "Example child’s kindergarten week" });
  expect(within(dialog).getAllByText("Example activity")).toHaveLength(1);
  expect(within(dialog).getByText("Planning day")).toBeInTheDocument();
  expect(within(dialog).queryByText("Regular hours")).not.toBeInTheDocument();
  expect(within(dialog).getByText("Next message · Mon 26 Oct")).toBeInTheDocument();

});

it("keeps unavailable source selections editable and suppresses hours when closure data fails", async () => {
  const child = "home|person.emma";
  settings.settings.timetableSettings = { [child]: { type: "calendar", education: "school", calendars: { "home|calendar.hours": ["hours", "popupHours"], "home|calendar.closures": ["closures", "popupClosures"], "home|calendar.removed": ["message", "popupMessages"] } } };
  const start = weekStart(homeDate(new Date(), app.currentHome.timeZone));
  app.currentHome.entities.push(...mapHome({
    "calendar.hours": state("calendar.hours", "off", { friendly_name: "Example hours" }),
    "calendar.closures": state("calendar.closures", "off", { friendly_name: "Example closures" }),
  }, emptyRegistries, "home").entities);
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, receive) => receive(id === "calendar.closures" ? null : [{ summary: "Regular hours", start, end: addDays(start, 14) }]));
  window.history.replaceState(null, "", "/school");
  const view = render(<App />); await saved();
  expect(await screen.findByText(/Some calendars could not be read/)).toHaveTextContent("Example closures");
  expect(screen.queryByText("Regular hours")).not.toBeInTheDocument();
  const calls = app.watchCalendarEvents.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(app.watchCalendarEvents.mock.calls.length).toBeGreaterThan(calls);
  view.unmount();
  app.homeOnline = false;
  window.history.replaceState(null, "", "/settings#timetables");
  render(<App />); await saved();
  expect(screen.getAllByRole("button", { name: /^School day view ·/ })).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "School day view · Messages (Pedagogy) calendars for Emma" }));
  const picker = screen.getByRole("dialog", { name: "School day view · Messages (Pedagogy) calendars for Emma" });
  fireEvent.click(within(picker).getByRole("checkbox", { name: "Unavailable calendar: home|calendar.removed" }));
  fireEvent.keyDown(picker, { key: "Escape" });
  await saved();
  expect(settings.settings.timetableSettings[child].calendars).not.toHaveProperty("home|calendar.removed");
  await navigate("School");
  expect(screen.getByText("Connect to Home Assistant to see this timetable.")).toBeInTheDocument();
  expect(screen.queryByText("Regular hours")).not.toBeInTheDocument();
});

it("uses kindergarten wording for Norwegian image timetables and enlarged views", async () => {
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example child" }) }, emptyRegistries, "home");
  settings.settings.language = "nb";
  settings.settings.timetables = { "home|person.example": ["/sample.png"] };
  settings.settings.timetableSettings = { "home|person.example": { type: "images", education: "kindergarten", calendars: {} } };
  window.history.replaceState(null, "", "/school");
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Example childs barnehageuke" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Example childs barnehagetimeplan" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Forstørr/ }));
  expect(screen.getByRole("dialog", { name: "Example childs barnehageuke" })).toBeInTheDocument();
});

it.each(["/school", "/"])("translates known timetable labels on %s and in settings while preserving source content", async path => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Example child" }),
    "calendar.pedagogy": state("calendar.pedagogy", "off", { friendly_name: "Example nursery Example child Pedagogy" }),
    "calendar.activities": state("calendar.activities", "off", { friendly_name: "Example child Activities" }),
  }, emptyRegistries, "home");
  settings.settings.language = "nb";
  settings.settings.timetableSettings = { "home|person.example": { type: "calendar", education: "kindergarten", calendars: { "home|calendar.pedagogy": ["message", "popupMessages"], "home|calendar.activities": ["events", "popupActivities"] } } };
  const message = { summary: "Daily focus", description: "Daily focus: exploring shapes.", start: "2026-10-20", end: "2026-10-21" };
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, receive) => receive([id === "calendar.pedagogy" ? message : { ...message, summary: "Activities" }]));
  window.history.replaceState(null, "", path);
  const view = render(<App />);
  expect(await screen.findByText("Dagens fokus")).toBeInTheDocument();
  if (path === "/school") {
    expect(screen.getByRole("heading", { name: "Meldinger (pedagogikk)" })).toBeInTheDocument();
    expect(screen.queryByText("Example nursery Example child Pedagogikk")).not.toBeInTheDocument();
  } else expect(screen.getByRole("heading", { name: "Example nursery Example child Pedagogikk" })).toBeInTheDocument();
  expect(screen.getAllByText("Aktiviteter").length).toBeGreaterThan(0);
  expect(screen.getAllByText(message.description).length).toBeGreaterThan(0);
  expect(message.summary).toBe("Daily focus");
  expect(app.currentHome.entities.find(entity => entity.entityId === "calendar.pedagogy").name).toBe("Example nursery Example child Pedagogy");
  view.unmount();
  window.history.replaceState(null, "", "/settings#timetables");
  render(<App />);
  expect(await screen.findByRole("button", { name: "Kalendere i Dagsvisning på Skole · Aktiviteter for Example child" })).toHaveTextContent("Example child Aktiviteter");
  expect(screen.getByRole("button", { name: "Kalendere i Dagsvisning på Skole · Meldinger (pedagogikk) for Example child" })).toHaveTextContent("Example nursery Example child Pedagogikk");
});

it("keeps household records out of the smart-home device overview", async () => {
  app.currentHome = mapHome({
    "light.lamp": state("light.lamp", "off", { friendly_name: "Reading lamp" }),
    "person.example": state("person.example", "home", { friendly_name: "Example person" }),
    "calendar.example": state("calendar.example", "off", { friendly_name: "Example calendar" }),
    "todo.example": state("todo.example", "0", { friendly_name: "Example list" }),
  }, emptyRegistries, "home");
  window.history.replaceState(null, "", "/home");
  render(<App />); await saved();
  expect(screen.getByRole("link", { name: "Reading lamp details" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Example.* details/ })).not.toBeInTheDocument();
});

it.each(["/", "/calendar"])("marks Monday week changes and keeps today's week visible on %s", async path => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-12-31T23:30:00Z"));
  window.history.replaceState(null, "", path);
  render(<App />); await saved();

  expect(screen.getByText("Today · Week 53")).toBeInTheDocument();
  expect(screen.getByText("Week 53").closest("th")).toHaveTextContent("Today1 Jan");
  expect(screen.getByText("Week 1").closest("th")).toHaveTextContent("Mon4 Jan");
  expect(screen.getAllByText(/^Week \d+$/)).toHaveLength(2);

  expect(screen.queryByRole("button", { name: "By person" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Monday" })).not.toBeInTheDocument();
  const calendarSettings = screen.getByRole("button", { name: "Calendar settings" });
  fireEvent.click(calendarSettings);
  fireEvent.click(screen.getByRole("button", { name: "By person" }));
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Calendar settings" }), { key: "Escape" });
  await waitFor(() => expect(calendarSettings).toHaveFocus());
  expect(screen.getByText("Week 53").closest("a, button")).toHaveTextContent("Fri01");
  expect(screen.getByText("Week 1").closest("a, button")).toHaveTextContent("Mon04");
  expect(screen.getAllByText(/^Week \d+$/)).toHaveLength(2);
  if (path === "/calendar") {
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByText("Today · Week 53")).toBeInTheDocument();
    expect(screen.getByText("Week 1").closest("button")).toHaveTextContent("Fri08");
    expect(screen.getByText("Week 2").closest("button")).toHaveTextContent("Mon11");
  }

  fireEvent.click(calendarSettings);
  expect(screen.getByRole("button", { name: "By person", pressed: true })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Weekly grid" }));
  fireEvent.click(screen.getByRole("button", { name: "Monday" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Calendar settings" })).getByRole("button", { name: "Close" }));
  await saved();
  expect(settings.settings.calendar).toEqual({ view: "week", startDay: "monday" });
  expect(screen.queryByRole("button", { name: "Monday" })).not.toBeInTheDocument();
  expect(screen.getAllByText(/^Week \d+$/)).toHaveLength(1);
  expect(screen.getByText("Week 53").closest("th")).toHaveTextContent("Mon28 Dec");
  expect(screen.getByText("Today · Week 53")).toBeInTheDocument();
});

it("offers one setup entry on Today and keeps guidance off the everyday boards", async () => {
  render(<App />); await saved();
  expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/onboarding");
  expect(screen.queryByText(/Set up calendars in this app/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Set up people and calendars" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Set up to-do lists" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Set up school timetables/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Get started" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Get started" })).toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Household setup" }).children).toHaveLength(5);
  expect(screen.queryByRole("navigation", { name: "Smart home navigation" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Smart home" })).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("link", { name: "Add people in Home Assistant" })).toHaveAttribute("href", "http://ha.local:8123/config/person");
  expect(screen.getByText(/Daily lists need a Home Assistant automation/)).toBeInTheDocument();
  for (const [label, section, anchor] of [["Connection settings", "connection", "connection"], ["Choose people", "people", "people-order"], ["Choose calendars", "calendars", "family-calendar"], ["Choose lists", "lists", "family-lists"], ["Configure timetables", "timetables", "timetables"]]) {
    fireEvent.click(screen.getByRole("link", { name: label }));
    expect(window.location.pathname).toBe(`/settings/${section}`);
    expect(window.location.hash).toBe("");
    await pageReady();
    await waitFor(() => expect(document.getElementById(anchor)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("link", { name: "All settings" }));
    fireEvent.click(await screen.findByRole("link", { name: "Get started" }));
    await screen.findByRole("heading", { level: 1, name: "Get started" });
  }
  fireEvent.click(screen.getByRole("link", { name: "Go to Today" }));
  expect(window.location.pathname).toBe("/");
  await navigate("Our week");
  expect(screen.queryByText(/Set up calendars in this app/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Set up people and calendars" })).not.toBeInTheDocument();
  await navigate("Lists");
  expect(screen.getByRole("button", { name: /Shopping/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("link", { name: "Set up to-do lists" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Daily tasks use your selected/)).not.toBeInTheDocument();
});

it.each([
  { calendarMembers: { "home|calendar.family": "everyone" } },
  { todoLists: { "home|todo.shopping": { kind: "shopping" as const, member: "everyone" } } },
  { timetableEnabled: { "home|person.emma": true } },
  { timetables: { "home|person.emma": ["/timetable.png"] } },
  { homeEntities: [] },
  { selectedAlarm: "home|alarm_control_panel.home" },
])("keeps the setup entry in the menu for configured households: %j", async configuration => {
  Object.assign(settings.settings, configuration);
  render(<App />); await saved();
  expect(screen.queryByRole("link", { name: "Get started" })).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("button", { name: "Open app settings" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: "Get started" }));
  expect(window.location.pathname).toBe("/onboarding");
  expect(await screen.findByRole("heading", { name: "Get started" })).toBeInTheDocument();
});

it("keeps onboarding available without a Home Assistant connection", async () => {
  app.haUrl = "";
  app.homeOnline = false;
  window.history.replaceState(null, "", "/onboarding");
  render(<App />); await saved();
  expect(screen.getByText("Home Assistant not connected")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Add people in Home Assistant" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Choose calendars" })).toHaveAttribute("href", "/settings/calendars");
  expect(screen.getByRole("link", { name: "Go to Today" })).toHaveAttribute("href", "/");
});

it("navigates with empty HA data and shows the server-managed connection", async () => {
  app.currentHome = mapHome({}, emptyRegistries, "home");
  render(<App />); await saved();
  expect(screen.getByRole("heading", { level: 1, name: "Good to be home." })).toBeInTheDocument();
  expect(screen.getByRole("contentinfo")).toHaveTextContent("Version 9.8.7");
  await navigate("Smart home");
  fireEvent.click(screen.getByRole("link", { name: /Configure Home Assistant/ }));
  expect(await screen.findByRole("button", { name: "Reconnect" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Home Assistant URL")).not.toBeInTheDocument();
  await navigate("Smart home");
  for (const [link, heading] of [["Devices", "Devices"], ["Areas", "Areas"], ["Zones", "Zones"], ["Security", "Alarm"], ["Automations", "Automations"], ["Scenes", "Scenes"], ["Activity", "History"], ["Integrations", "Integrations"]]) {
    const nav = within(screen.getByRole("navigation", { name: "Smart home navigation" }));
    const direct = nav.queryByRole("link", { name: link });
    if (direct) fireEvent.click(direct);
    else {
      fireEvent.keyDown(nav.getByRole("button"), { key: "Enter" });
      fireEvent.click(await screen.findByRole("menuitem", { name: link }));
    }
    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  }
});

it("shares people visibility, order and timetable preferences with another screen", async () => {
  window.history.replaceState(null, "", "/settings/people");
  const phone = render(<App />); await saved();
  fireEvent.click(screen.getByRole("switch", { name: "Show Emma in family planner" })); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Move Leo up" })); await saved();
  fireEvent.click(screen.getByRole("switch", { name: "Timetable for Leo" })); await saved();
  expect(settings.settings.hiddenMembers).toEqual(["home|person.emma"]);
  expect(settings.settings.memberOrder).toEqual(["home|person.leo", "home|person.emma"]);
  phone.unmount();
  window.history.replaceState(null, "", "/school");
  render(<App />); await saved();
  expect(screen.getByRole("heading", { name: "Leo’s school week" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Emma’s school week" })).not.toBeInTheDocument();
});

it("navigates timetable pages with arrows and keyboard and enlarges the selected page", async () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("aria-roledescription") === "slide" ? [...this.parentElement!.children].indexOf(this) * 400 : 0;
  });
  settings.settings.timetables = { "home|person.emma": ["/first.svg", "/second.svg"] };
  settings.settings.timetableEnabled = { "home|person.emma": true };
  window.history.replaceState(null, "", "/school");
  render(<><style>{'[aria-roledescription="slide"] { margin-right: 0px; }'}</style><App /></>); await saved();
  const carousel = screen.getByRole("region", { name: "Emma’s timetable pages" });
  const next = within(carousel).getByRole("button", { name: "Next timetable page" });
  act(() => next.focus()); fireEvent.click(next);
  expect(carousel).toHaveFocus();
  expect(within(carousel).getByText("Page 2 of 2")).toBeInTheDocument();
  expect(next).toBeDisabled();
  fireEvent.keyDown(carousel, { key: "ArrowLeft" });
  expect(within(carousel).getByText("Page 1 of 2")).toBeInTheDocument();
  fireEvent.keyDown(carousel, { key: "ArrowRight" });
  fireEvent.click(within(carousel).getByRole("button", { name: "Enlarge Emma’s timetable, page 2 of 2" }));
  const dialog = within(screen.getByRole("dialog", { name: "Emma’s school week" }));
  expect(dialog.getByRole("img", { name: "Emma’s school timetable, page 2 of 2" })).toHaveAttribute("src", "/second.svg");
  fireEvent.click(dialog.getByRole("button", { name: "Previous timetable page" }));
  expect(dialog.getByRole("img", { name: "Emma’s school timetable, page 1 of 2" })).toHaveAttribute("src", "/first.svg");
});

it("offers the signed iOS shortcut and copies each person's upload destination", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", Object.create(navigator, { clipboard: { value: { writeText } } }));
  const success = vi.spyOn(toast, "success").mockImplementation(() => "copied");
  settings.settings.timetableEnabled = { "home|person.emma": true, "home|person.leo": true };
  window.history.replaceState(null, "", "/settings/timetables");
  render(<App />); await saved();
  for (const name of ["Emma", "Leo"]) {
    const card = within(screen.getByRole("heading", { name: name }).closest("article")!);
    fireEvent.click(card.getByText("Share from iPhone"));
    expect(card.getByRole("link", { name: "Download iOS shortcut" })).toHaveAttribute("href", "/shortcuts/Upload%20timetable.shortcut");
    const destination = new URL((card.getByLabelText(`${name} upload URL`) as HTMLInputElement).value);
    expect(destination.origin).toBe(window.location.origin);
    expect(destination.pathname).toBe("/api/timetables");
    expect(destination.searchParams.get("member")).toBe(`home|person.${name.toLowerCase()}`);
    fireEvent.click(card.getByRole("button", { name: `Copy ${name} upload URL` }));
    await waitFor(() => expect(success).toHaveBeenCalledWith("Upload URL copied"));
    expect(writeText).toHaveBeenLastCalledWith(destination.href);
    success.mockClear();
  }
});

it.each([
  ["unavailable", true], ["denied", true], ["unavailable", false], ["denied", false],
])("falls back to selected-text copying when clipboard access is %s (copy succeeds: %s)", async (access, copied) => {
  const clipboard = access === "denied" ? { writeText: vi.fn().mockRejectedValue(new Error("Access denied")) } : undefined;
  vi.stubGlobal("navigator", Object.create(navigator, { clipboard: { value: clipboard } }));
  const error = vi.spyOn(toast, "error").mockImplementation(() => "copy-failed");
  const success = vi.spyOn(toast, "success").mockImplementation(() => "copied");
  settings.settings.timetableEnabled = { "home|person.emma": true };
  window.history.replaceState(null, "", "/settings/timetables");
  render(<App />); await saved();
  fireEvent.click(screen.getByText("Share from iPhone"));
  const input = screen.getByLabelText("Emma upload URL") as HTMLInputElement;
  vi.mocked(document.execCommand).mockImplementation(() => {
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    return Boolean(copied);
  });
  fireEvent.click(screen.getByRole("button", { name: "Copy Emma upload URL" }));
  if (copied) {
    await waitFor(() => expect(success).toHaveBeenCalledWith("Upload URL copied"));
    expect(error).not.toHaveBeenCalled();
  } else {
    await waitFor(() => expect(error).toHaveBeenCalledWith("Could not copy. Select the Upload URL and copy it manually."));
    expect(success).not.toHaveBeenCalled();
  }
  expect(document.execCommand).toHaveBeenCalledWith("copy");
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
});

it.each([".png", "-dark.svg"])("colors the original PNG for saved %s timetables across previews and enlarged views", async extension => {
  const imagePath = "/api/timetables/emma/00000000-0000-4000-8000-000000000000/1.png";
  const darkPath = imagePath.replace(/\.png$/, "-dark.svg");
  settings.settings.appearance.theme = "light";
  settings.settings.timetables = { "home|person.emma": [imagePath.replace(/\.png$/, extension)], "home|person.leo": ["/linked.svg"] };
  settings.settings.timetableEnabled = { "home|person.emma": true, "home|person.leo": true };
  app.storageRequest.mockReset().mockImplementation(async path => new Response("image", { headers: { "Content-Type": path.endsWith(".svg") ? "image/svg+xml" : "image/png" } }));
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: vi.fn((blob: Blob) => `blob:${blob.type}`), revokeObjectURL: vi.fn() }));
  window.history.replaceState(null, "", "/user-settings");
  const preferences = render(<App />); await saved();
  const toggle = screen.getByRole("switch", { name: "Toggle dark timetables" });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle); await saved();
  expect(settings.settings.appearance).toMatchObject({ theme: "light", darkTimetables: true });
  preferences.unmount();

  for (const path of ["/", "/school"]) {
    window.history.replaceState(null, "", path);
    const view = render(<App />); await saved();
    await waitFor(() => expect(screen.getByRole("img", { name: "Emma’s school timetable" })).toHaveAttribute("src", "blob:image/png"));
    expect(screen.getByRole("img", { name: "Emma’s school timetable" })).toHaveClass("timetable-image-dark");
    expect(app.storageRequest).toHaveBeenLastCalledWith(imagePath);
    expect(app.storageRequest).not.toHaveBeenCalledWith(darkPath);
    expect(screen.getByRole("img", { name: "Leo’s school timetable" })).toHaveAttribute("src", "/linked.svg");
    expect(screen.getByRole("img", { name: "Leo’s school timetable" })).not.toHaveClass("timetable-image-dark");
    fireEvent.click(screen.getByRole("button", { name: "Enlarge Emma’s timetable" }));
    const dialog = within(screen.getByRole("dialog", { name: "Emma’s school week" }));
    await waitFor(() => expect(dialog.getByRole("img", { name: "Emma’s school timetable" })).toHaveAttribute("src", "blob:image/png"));
    expect(dialog.getByRole("img", { name: "Emma’s school timetable" })).toHaveClass("timetable-image-dark");
    view.unmount();
  }
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:image/png");

  window.history.replaceState(null, "", "/user-settings");
  const nextPreferences = render(<App />); await saved();
  expect(screen.getByRole("switch", { name: "Toggle dark timetables" })).toBeChecked();
  fireEvent.click(screen.getByRole("switch", { name: "Toggle dark timetables" })); await saved();
  nextPreferences.unmount();
  window.history.replaceState(null, "", "/school");
  render(<App />); await saved();
  await waitFor(() => expect(screen.getByRole("img", { name: "Emma’s school timetable" })).toHaveAttribute("src", "blob:image/png"));
  expect(screen.getByRole("img", { name: "Emma’s school timetable" })).not.toHaveClass("timetable-image-dark");
  expect(app.storageRequest).toHaveBeenLastCalledWith(imagePath);
});

it("keeps timetable pages when replacing or hiding them is cancelled", async () => {
  settings.settings.timetables = { "home|person.emma": ["/first.svg"] };
  settings.settings.timetableEnabled = { "home|person.emma": true };
  window.history.replaceState(null, "", "/settings/timetables");
  render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Change timetable images" }));
  fireEvent.change(screen.getByLabelText("Emma timetable image URLs"), { target: { value: "https://school.example/replacement.png" } });
  fireEvent.click(screen.getByRole("button", { name: "Save image URLs" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(settings.settings.timetables["home|person.emma"]).toEqual(["/first.svg"]);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Settings navigation" })).getByRole("link", { name: "People" }));
  fireEvent.click(await screen.findByRole("switch", { name: "Timetable for Emma" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(settings.settings.timetableEnabled["home|person.emma"]).toBe(true);
});

it("uses home time and real calendar dates across month and year boundaries", () => {
  expect(homeDate(new Date("2026-12-31T23:30:00Z"), "Europe/Oslo")).toBe("2027-01-01");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(weekStart("2027-01-01")).toBe("2026-12-28");
  expect(isPlannerDate("2026-02-30")).toBe(false);
  expect(isPlannerDate("2028-02-29")).toBe(true);
});

it("saves the server language, updates navigation and labels, and restores it on reload", async () => {
  window.history.replaceState(null, "", "/settings/language");
  const first = render(<App />); await saved();
  fireEvent.change(screen.getByRole("combobox", { name: "Language" }), { target: { value: "nb" } });
  await waitFor(() => expect(settings.settings.language).toBe("nb"));
  expect(screen.getByRole("heading", { level: 1, name: "Språk" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "I dag" })).toBeInTheDocument();
  for (const name of ["Utseende", "Språk", "Varsler", "Personer", "Kalendere", "Gjøremålslister", "Timeplaner", "Smarthjem", "Tilkobling og konto", "Lagring og sikkerhetskopier"]) {
    expect(within(screen.getByRole("navigation", { name: "Innstillingsmeny" })).getByRole("link", { name })).toBeInTheDocument();
  }
  expect(document.documentElement.lang).toBe("nb");
  expect(document.title).toBe("Afterglow · Familien hjemme");
  first.unmount();
  render(<App />);
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Språk" })).toHaveValue("nb"));
  fireEvent.change(screen.getByRole("combobox", { name: "Språk" }), { target: { value: "en" } });
  await saved();
  expect(document.documentElement.lang).toBe("en");
  expect(screen.getByRole("link", { name: "Today" })).toBeInTheDocument();
});

it("refreshes language from another screen while a confirmation stays open", async () => {
  settings.settings.language = "nb";
  window.history.replaceState(null, "", "/settings/connection");
  render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Koble fra" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Koble fra" }));
  expect(screen.getByRole("alertdialog", { name: "Koble fra Home Assistant?" })).toBeInTheDocument();
  settings.settings.language = "en";
  await waitFor(() => expect(screen.getByRole("alertdialog", { name: "Disconnect Home Assistant?" })).toBeInTheDocument(), { timeout: 6500 });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(app.disconnect).not.toHaveBeenCalled();
}, 10000);


it("applies shared compact density and restores it on reload", async () => {
  window.history.replaceState(null, "", "/user-settings");
  const view = render(<App />); await saved();
  expect(screen.getByRole("main").closest(".afterglow-app")).not.toHaveClass("compact-mode");
  fireEvent.click(screen.getByRole("switch", { name: "Toggle compact mode" }));
  await saved();
  expect(screen.getByRole("main").closest(".afterglow-app")).toHaveClass("compact-mode");
  view.unmount();
  render(<App />); await saved();
  expect(screen.getByRole("main").closest(".afterglow-app")).toHaveClass("compact-mode");
});

it("distinguishes offline plans and security from successful empty reads", async () => {
  app.homeOnline = false;
  app.connectionStatus = "disconnected";
  const view = render(<App />); await saved();
  expect(screen.getByRole("region", { name: "Next family plan" })).toHaveTextContent("Calendars unavailable while offline.");
  expect(screen.getByRole("button", { name: "Add a family plan" })).toBeDisabled();
  await navigate("Smart home");
  expect(screen.queryByText("No visible alarm")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Security Offline" })).toBeInTheDocument();
  view.unmount();
  app.connectionStatus = "connected";
});


it.each([
  ["/devices", "Device settings", "Manage devices in Home Assistant", "/config/devices/dashboard"],
  ["/areas", "Area settings", "Manage areas in Home Assistant", "/config/areas/dashboard"],
  ["/zones", "Zone settings", "Manage zones in Home Assistant", "/config/zone"],
  ["/automations", "Automation settings", "Edit automations in Home Assistant", "/config/automation/dashboard"],
])("discloses management links in the settings cog on %s", async (path, label, link, target) => {
  window.history.replaceState(null, "", path);
  render(<App />); await saved();
  expect(screen.queryByRole("link", { name: link })).not.toBeInTheDocument();
  const trigger = screen.getByRole("button", { name: label });
  fireEvent.click(trigger);
  const settings = screen.getByRole("dialog", { name: label });
  expect(within(settings).getByRole("link", { name: link })).toHaveAttribute("href", app.haUrl + target);
  fireEvent.keyDown(settings, { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole("link", { name: link })).not.toBeInTheDocument();
});

it("translates calendar settings and restores the selected layout after closing", async () => {
  settings.settings.language = "nb";
  window.history.replaceState(null, "", "/calendar?date=2026-10-26");
  render(<App />); await waitFor(() => expect(screen.getByRole("status", { name: "Lagring av innstillinger" })).toHaveTextContent("Fellesinnstillingene er lagret."));
  expect(screen.queryByRole("button", { name: "Uketabell" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Kalenderinnstillinger" }));
  fireEvent.click(screen.getByRole("button", { name: "Etter person" }));
  fireEvent.click(screen.getByRole("button", { name: "Mandag" }));
  expect(window.location.search).toBe("");
  fireEvent.click(within(screen.getByRole("dialog", { name: "Kalenderinnstillinger" })).getByRole("button", { name: "Lukk" }));
  await waitFor(() => expect(screen.getByRole("status", { name: "Lagring av innstillinger" })).toHaveTextContent("Fellesinnstillingene er lagret."));
  fireEvent.click(screen.getByRole("button", { name: "Kalenderinnstillinger" }));
  expect(screen.getByRole("button", { name: "Etter person", pressed: true })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Mandag", pressed: true })).toBeInTheDocument();
});

it("groups all settings, opens each focused subpage, and returns to the hub", async () => {
  window.history.replaceState(null, "", "/settings");
  render(<App />); await saved();
  const destinations = [
    ["Appearance", "appearance"], ["Language", "language"], ["Notifications", "notifications"],
    ["People", "people"], ["Calendars", "calendars"], ["To-do lists", "lists"], ["Timetables", "timetables"],
    ["Smart home", "smart-home"], ["Connection & account", "connection"], ["Storage and backups", "backups"],
  ];
  for (const [title, path] of destinations) {
    const menu = within(screen.getByRole("navigation", { name: "Settings navigation" }));
    expect(menu.getAllByRole("link")).toHaveLength(10);
    expect(menu.getAllByRole("heading").map(heading => heading.textContent)).toEqual(["Preferences", "Household", "System"]);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    fireEvent.click(menu.getByRole("link", { name: new RegExp(`^${title} `) }));
    expect(await screen.findByRole("heading", { name: title, level: 1 })).toHaveFocus();
    expect(window.location.pathname).toBe(`/settings/${path}`);
    expect(within(screen.getByRole("navigation", { name: "Settings navigation" })).getByRole("link", { name: title })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("navigation", { name: "Smart home navigation" })).not.toBeInTheDocument();
    if (path === "appearance") expect(screen.getAllByRole("radio")).toHaveLength(12);
    if (path === "backups") expect(screen.getByRole("button", { name: "Import configuration" })).toBeEnabled();
    fireEvent.click(screen.getByRole("link", { name: "All settings" }));
    expect(await screen.findByRole("heading", { name: "Settings", level: 1 })).toHaveFocus();
  }
});

it.each([
  ["/user-settings", "appearance", "Appearance"],
  ["/settings#connection", "connection", "Connection & account"],
  ["/settings#notifications", "notifications", "Notifications"],
  ["/settings#smart-home-visibility", "smart-home", "Smart home"],
  ["/settings#people-order", "people", "People"],
  ["/settings#family-calendar", "calendars", "Calendars"],
  ["/settings#family-lists", "lists", "To-do lists"],
  ["/settings#timetables", "timetables", "Timetables"],
])("preserves the old settings bookmark %s", async (legacy, path, title) => {
  window.history.replaceState(null, "", legacy);
  render(<App />); await saved();
  expect(await screen.findByRole("heading", { name: title, level: 1 })).toBeInTheDocument();
  expect(window.location.pathname).toBe(`/settings/${path}`);
  expect(window.location.hash).toBe("");
});
