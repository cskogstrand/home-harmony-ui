import { configuredCard } from "./device-card-fixtures";
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
  await screen.findByRole("heading", { level: 1, name });
};
const saved = async () => {
  await waitFor(() => expect(screen.getByRole("status", { name: "Settings storage" })).toHaveTextContent("Shared settings saved."));
  await pageReady();
};

it.each([
  ["en", "2026-10-28", "auto", false, null],
  ["en", "2026-10-29", "auto", true, null],
  ["en", "2026-10-29", "auto", false, "No more plans today. Next up is Thursday."],
  ["en", "2026-10-30", "auto", true, "No plans today or tomorrow. Next up is Friday."],
  ["nb", "2026-10-30", "auto", true, "Ingen planer i dag eller i morgen. Neste er fredag."],
  ["en", "2026-10-30", 3, false, null],
  ["en", "2026-11-01", 3, false, "No plans in the next 3 days. Next up is Sunday."],
] as const)("explains the next family plan in %s on %s (%s, tomorrow %s)", async (language, date, days, showTomorrow, summary) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00Z"));
  settings.settings.language = language;
  settings.settings.dashboard.nextPlanDays = days;
  settings.settings.dashboard.showTomorrow = showTomorrow;
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example person" }), "calendar.example": state("calendar.example", "off") }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example" };
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([
    { summary: "Example activity", start: `${date}T16:00:00Z`, end: `${date}T17:00:00Z` },
  ]));
  render(<App />); await pageReady();
  const next = screen.getByRole("region", { name: language === "nb" ? "Neste familieplan" : "Next family plan" });
  expect(within(next).getByRole("heading", { level: 2, name: language === "nb" ? "Neste familieplan" : "Next family plan" })).toBeVisible();
  expect(await within(next).findByRole("heading", { level: 3, name: "Example activity" })).toBeVisible();
  expect(next.querySelector(".next-plan-summary")?.textContent ?? null).toBe(summary);
  fireEvent.click(within(next).getByRole("button", { name: /Example activity/ }));
  expect(screen.getByRole("dialog", { name: "Example activity" })).toBeVisible();
});

it.each(["ongoing", "loading", "failed", "offline"])("does not claim quiet days with %s calendar data", async mode => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00Z"));
  settings.settings.dashboard.showTomorrow = true;
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example person" }), "calendar.example": state("calendar.example", "off"), "calendar.other": state("calendar.other", "off") }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example", "home|calendar.other": "home|person.example" };
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, receive) => {
    if (id === "calendar.example") receive([{ summary: "Example activity", start: "2026-10-30T16:00:00Z", end: "2026-10-30T17:00:00Z" }]);
    else if (mode === "ongoing") receive([{ summary: "Example ongoing plan", start: "2026-10-28T09:00:00Z", end: "2026-10-28T11:00:00Z" }]);
    else if (mode === "failed") receive(null);
  });
  app.homeOnline = mode !== "offline";
  render(<App />); await saved();
  const next = screen.getByRole("region", { name: "Next family plan" });
  if (mode !== "offline") expect(await within(next).findByRole("heading", { name: "Example activity" })).toBeVisible();
  expect(next.querySelector(".next-plan-summary")).not.toBeInTheDocument();
});

it.each(["2026-10-28", "2026-10-26"])("ignores all-day plans starting %s in the next family plan empty state", async start => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00Z"));
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example person" }), "calendar.example": state("calendar.example", "off") }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example" };
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([
    { summary: "Example all-day plan", start, end: "2026-10-29" },
    { summary: "Example finished plan", start: "2026-10-28T07:00:00Z", end: "2026-10-28T08:00:00Z" },
  ]));
  render(<App />); await saved();
  const next = within(screen.getByRole("region", { name: "Next family plan" }));
  expect(next.getByRole("heading", { level: 2, name: "Next family plan" })).toBeVisible();
  expect(await next.findByText("No more plans today.")).toBeVisible();
  expect(next.queryByText("Example all-day plan")).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Everyone’s day" })).getByText("Example all-day plan")).toBeVisible();
});

it("changes the next-plan summary immediately across a timed plan while ignoring all-day events", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00Z"));
  settings.settings.dashboard.showTomorrow = true;
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example person" }), "calendar.example": state("calendar.example", "off") }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example" };
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([
    { summary: "Example all-day plan", start: "2026-10-28", end: "2026-10-29" },
    { summary: "Example multi-day plan", start: "2026-10-26", end: "2026-11-02" },
    { summary: "Example timed plan", start: "2026-10-30T16:00:00Z", end: "2026-10-30T17:00:00Z" },
  ]));
  render(<App />); await saved();
  const next = screen.getByRole("region", { name: "Next family plan" });
  expect(next.querySelector(".next-plan-summary")).toHaveTextContent("No plans today or tomorrow. Next up is Friday.");
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Look ahead" }), { target: { value: "custom" } });
  const days = screen.getByRole("spinbutton", { name: "Days ahead" });
  fireEvent.change(days, { target: { value: "2" } });
  await waitFor(() => expect(settings.settings.dashboard.nextPlanDays).toBe(2));
  expect(next.querySelector(".next-plan-summary")).not.toBeInTheDocument();
  fireEvent.change(days, { target: { value: "0" } });
  await waitFor(() => expect(settings.settings.dashboard.nextPlanDays).toBe(0));
  expect(next.querySelector(".next-plan-summary")).toHaveTextContent("No more plans today. Next up is Friday.");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(within(next).getByRole("heading", { name: "Example timed plan" })).toBeVisible();
});

it("looks ahead beyond a Monday-based week for the next family plan", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
  settings.settings.calendar.startDay = "monday";
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example person" }), "calendar.example": state("calendar.example", "off") }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example" };
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([
    { summary: "Example activity", start: "2026-11-03T16:00:00Z", end: "2026-11-03T17:00:00Z" },
  ]));
  render(<App />); await saved();
  expect(app.watchCalendarEvents).toHaveBeenCalledWith("calendar.example", "2026-10-25T23:00:00.000Z", "2026-11-07T23:00:00.000Z", expect.any(AbortSignal), expect.any(Function));
  const next = within(screen.getByRole("region", { name: "Next family plan" }));
  expect(await next.findByText("No more plans today. Next up is Tuesday.")).toBeVisible();
});

it("switches calendar periods, loads the whole month, filters people and drills into a multi-day event", async () => {
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Example person" }),
    "person.other": state("person.other", "home", { friendly_name: "Other example" }),
    "calendar.example": state("calendar.example", "off"),
    "calendar.other": state("calendar.other", "off"),
  }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example", "home|calendar.other": "home|person.other" };
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, receive) => receive(id === "calendar.example" ? [
    { uid: "example-trip", summary: "Example trip", start: "2026-10-30", end: "2026-11-03" },
    { uid: "example-meeting", summary: "Example meeting", start: "2026-11-01T14:00:00Z", end: "2026-11-01T15:00:00Z" },
  ] : [{ uid: "other", summary: "Other plan", start: "2026-11-01", end: "2026-11-02" }]));
  window.history.replaceState(null, "", "/calendar?view=month&date=2026-10-31");
  const rendered = render(<App />); await saved();
  expect(screen.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Month", pressed: true })).toBeVisible();
  expect(app.watchCalendarEvents).toHaveBeenCalledWith("calendar.example", "2026-09-27T22:00:00.000Z", "2026-11-01T23:00:00.000Z", expect.any(AbortSignal), expect.any(Function));
  expect(screen.getAllByRole("button", { name: /^Example trip,/ })).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Example person" }));
  expect(screen.queryByRole("button", { name: /^Other plan,/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Sunday, 1 November 2026, 2 plans/ }));
  expect(screen.getByRole("button", { name: "Day", pressed: true })).toBeVisible();
  expect(screen.getByRole("region", { name: "All day" })).toHaveTextContent("Example trip");
  expect(screen.getByRole("region", { name: "Schedule" })).toHaveTextContent("Example meeting");
  expect(screen.queryByRole("button", { name: /^Other plan/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Example trip/ }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Example trip");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Add a plan" }));
  expect(screen.getByLabelText("Date")).toHaveValue("2026-11-01");
  expect(screen.getByLabelText("Who’s going?")).toHaveValue("home|person.example");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  rendered.unmount();
  render(<App />); await saved();
  expect(screen.getByRole("button", { name: "Day", pressed: true })).toBeVisible();
  expect(window.location.search).toContain("date=2026-11-01");
});

it("jumps to a date, pages months and returns to today without changing dashboard settings", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
  window.history.replaceState(null, "", "/calendar");
  render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Month" }));
  fireEvent.click(screen.getByRole("button", { name: /^Jump to date:/ }));
  fireEvent.change(screen.getByLabelText("Jump to date", { selector: "input" }), { target: { value: "2024-01-31" } });
  fireEvent.click(screen.getByRole("button", { name: "Go to date" }));
  expect(screen.getByRole("heading", { name: "January 2024" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  expect(window.location.search).toContain("date=2024-02-29");
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  expect(screen.getByRole("heading", { name: "October 2026" })).toBeVisible();
  expect(settings.settings.calendar).toEqual({ view: "week", startDay: "today" });
  fireEvent.click(screen.getByRole("button", { name: "Week" }));
  fireEvent.click(screen.getByRole("button", { name: "Monday, 26 October 2026" }));
  expect(screen.getByRole("region", { name: "Day view" })).toHaveTextContent("No calendars selected");
  expect(screen.queryByText("No plans for this day.")).not.toBeInTheDocument();
});

it("opens old date links as a day agenda and distinguishes failed data from an empty day", async () => {
  app.currentHome = mapHome({ "person.example": state("person.example", "home"), "calendar.example": state("calendar.example", "off") }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example" };
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive(null));
  window.history.replaceState(null, "", "/calendar?date=2026-10-26");
  render(<App />); await saved();
  expect(screen.getByRole("button", { name: "Day", pressed: true })).toBeVisible();
  expect(screen.getByRole("region", { name: "Day view" })).toHaveTextContent("Some calendars could not be loaded.");
  expect(screen.queryByText("No plans for this day.")).not.toBeInTheDocument();
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([]));
  fireEvent.click(screen.getByRole("button", { name: "Next day" }));
  expect(await screen.findByText("No plans for this day.")).toBeVisible();
});

it("selects weather entities, saves both placement checkboxes across reloads and can hide the widget", async () => {
  app.currentHome = mapHome({
    "weather.example": state("weather.example", "sunny", { friendly_name: "Example forecast", temperature: 18, temperature_unit: "°C" }),
    "sensor.example": state("sensor.example", "21", { friendly_name: "Example sensor" }),
    "sensor.temperature": state("sensor.temperature", "21", { friendly_name: "Example temperature", device_class: "temperature", unit_of_measurement: "°F" }),
    "input_number.temperature": state("input_number.temperature", "280", { friendly_name: "Example temperature helper", unit_of_measurement: "K" }),
    "sensor.humidity": state("sensor.humidity", "60", { device_class: "humidity", unit_of_measurement: "%" }),
  }, { ...emptyRegistries, entities: [{ id: "stable-weather", entity_id: "weather.example" }, { id: "stable-temperature", entity_id: "sensor.temperature" }] }, "home");
  window.history.replaceState(null, "", "/settings/weather");
  const view = render(<App />); await saved();
  expect(screen.queryByRole("button", { name: /^Weather:/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Weather entity" }));
  expect(screen.queryByRole("button", { name: /sensor.example/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Example forecast · weather.example" }));
  await saved();
  expect(settings.settings.weatherEntity).toBe("home|stable-weather");
  expect(screen.getByRole("checkbox", { name: "Beside the clock on Today" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "In the header" })).not.toBeChecked();
  expect(screen.queryByRole("button", { name: /^Weather:/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "In the header" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Beside the clock on Today" }));
  await saved();
  expect(settings.settings.weatherPlacement).toEqual({ today: false, header: true });
  expect(screen.getByRole("button", { name: /^Weather:/ })).toHaveTextContent("18°C");
  fireEvent.click(screen.getByRole("button", { name: "Temperature entity (optional)" }));
  expect(screen.queryByRole("button", { name: /sensor.example/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /sensor.humidity/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /weather.example/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /input_number.temperature/ })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Example temperature · sensor.temperature" }));
  await saved();
  expect(settings.settings.weatherTemperatureEntity).toBe("home|stable-temperature");
  expect(screen.getByRole("button", { name: /^Weather:/ })).toHaveTextContent("21°F");
  view.unmount();
  render(<App />); await saved();
  expect(screen.getByRole("button", { name: "Weather entity" })).toHaveTextContent("Example forecast");
  expect(screen.getByRole("checkbox", { name: "Beside the clock on Today" })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: "In the header" })).toBeChecked();
  expect(screen.getByRole("button", { name: "Temperature entity (optional)" })).toHaveTextContent("Example temperature");
  expect(screen.getByRole("button", { name: /^Weather:/ })).toHaveTextContent("21°F");
  fireEvent.click(screen.getByRole("button", { name: "Temperature entity (optional)" }));
  fireEvent.click(screen.getByRole("button", { name: "Use weather entity" }));
  await saved();
  expect(settings.settings.weatherTemperatureEntity).toBe("");
  expect(screen.getByRole("button", { name: /^Weather:/ })).toHaveTextContent("18°C");
  fireEvent.click(screen.getByRole("checkbox", { name: "In the header" }));
  await saved();
  expect(screen.getByText("Weather is hidden. Your selected source is kept.")).toBeVisible();
  expect(settings.settings.weatherEntity).toBe("home|stable-weather");
  expect(screen.queryByRole("button", { name: /^Weather:/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Weather entity" }));
  fireEvent.click(screen.getByRole("button", { name: "Hide weather widget" }));
  await saved();
  expect(settings.settings.weatherEntity).toBe("");
  expect(screen.queryByRole("button", { name: /^Weather:/ })).not.toBeInTheDocument();
});

it.each([
  { today: true, header: false }, { today: false, header: true }, { today: true, header: true }, { today: false, header: false },
])("places weather beside the clock and/or in the header: %s", async weatherPlacement => {
  app.currentHome = mapHome({ "weather.example": state("weather.example", "sunny", { temperature: 18, temperature_unit: "°C" }) }, emptyRegistries, "home");
  settings.settings.weatherEntity = "home|weather.example";
  settings.settings.weatherPlacement = weatherPlacement;
  const view = render(<App />); await saved();
  expect(within(view.container.querySelector<HTMLElement>(".app-header")).queryByRole("button", { name: /^Weather:/ }) !== null).toBe(weatherPlacement.header);
  const glance = view.container.querySelector(".ambient-glance");
  expect(glance.querySelector("time")).toHaveClass("ambient-clock");
  expect(within(glance as HTMLElement).queryByRole("button", { name: /^Weather:/ }) !== null).toBe(weatherPlacement.today);
});

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
  await navigate("Calendar");
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

it("assigns and replaces one homework list per person in shared settings", async () => {
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Example person" }),
    "todo.homework": state("todo.homework", "0"),
    "todo.replacement": state("todo.replacement", "0"),
  }, emptyRegistries, "home");
  window.history.replaceState(null, "", "/settings/lists");
  const view = render(<App />); await saved();
  chooseEntity(screen.getByRole("button", { name: "Homework for Example person" }), "todo.homework");
  await saved();
  expect(settings.settings.todoLists).toEqual({ "home|todo.homework": { kind: "homework", member: "home|person.example" } });
  chooseEntity(screen.getByRole("button", { name: "Homework for Example person" }), "todo.replacement");
  fireEvent.click(screen.getByRole("button", { name: "Change list" }));
  await saved();
  expect(settings.settings.todoLists).toEqual({ "home|todo.replacement": { kind: "homework", member: "home|person.example" } });
  view.unmount();
  render(<App />); await saved();
  expect(screen.getByRole("button", { name: "Homework for Example person" })).toHaveTextContent("Replacement");
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

it("configures card order across room filters, size and grouping on Smart home and saves after reload", async () => {
  app.currentHome = mapHome(Object.fromEntries(["alpha", "beta", "gamma"].map(name => [`light.${name}`, state(`light.${name}`, "off", { friendly_name: `Example ${name}` })])), {
    areas: [{ area_id: "room-a", name: "Example room A" }, { area_id: "room-b", name: "Example room B" }], devices: [],
    entities: ["alpha", "beta", "gamma"].map(name => ({ id: name, entity_id: `light.${name}`, area_id: name === "beta" ? "room-b" : "room-a" })),
  }, "home");
  settings.settings.smartHome.layout = ["alpha", "beta", "gamma"].map(name => configuredCard(`home|${name}`, "light", { group: "Comfort" }));
  window.history.replaceState(null, "", "/home");
  const view = render(<App />); await saved();
  expect(screen.queryByRole("button", { name: "Configure" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Smart home settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Configure" }));
  expect(screen.queryByRole("dialog", { name: "Smart home settings" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Example room A" }));
  fireEvent.click(screen.getByRole("button", { name: "Move Example gamma earlier" })); await saved();
  expect(settings.settings.smartHome.layout.map(card => card.id)).toEqual(["home|gamma", "home|alpha", "home|beta"]);
  fireEvent.change(screen.getByRole("combobox", { name: "Card size for Example gamma" }), { target: { value: "original" } });
  expect(document.querySelector<HTMLElement>('[data-smart-card="home|gamma"] .smart-card-preview').inert).toBe(true);
  expect(document.querySelector('[data-smart-card="home|gamma"] .dg-card')).toHaveAttribute("data-variant", "Original");
  fireEvent.change(screen.getByRole("textbox", { name: "New group name" }), { target: { value: "Reading" } });
  fireEvent.click(screen.getByRole("button", { name: "Add group" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Card group for Example gamma" }), { target: { value: "Reading" } }); await saved();
  expect(settings.settings.smartHome.layout.find(card => card.id === "home|gamma").group).toBe("Reading");
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("combobox", { name: "Card size for Example gamma" })).not.toBeInTheDocument();
  view.unmount(); render(<App />); await saved();
  expect(within(screen.getByRole("region", { name: "Reading" })).getByRole("article", { name: "Example gamma" })).toHaveAttribute("data-variant", "Original");
  expect(within(screen.getByRole("region", { name: "Comfort" })).getAllByRole("article").map(card => card.getAttribute("aria-label"))).toEqual(["Example alpha", "Example beta"]);
});

it("keeps layout edits visible on a save conflict and blocks further moves", async () => {
  app.currentHome = mapHome({ "light.example": state("light.example", "off", { friendly_name: "Example lamp" }) }, emptyRegistries, "home");
  settings.settings.smartHome.layout = [configuredCard("home|light.example")];
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
  expect(within(dialog).getByRole("switch", { name: "Waste collection" })).not.toBeChecked();
  const toggles = within(dialog).getAllByRole("switch").filter(toggle => !["Show tomorrow’s plans", "Waste collection"].includes(toggle.getAttribute("aria-label")));
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
  expect(Object.entries(settings.settings.dashboard).filter(([key]) => !["showTomorrow", "nextPlanDays"].includes(key)).every(([, value]) => !value)).toBe(true);
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
  expect(settings.settings.dashboard).toEqual({ morningSummary: false, wasteCollection: false, nextPlan: false, nextPlanDays: "auto", day: false, showTomorrow: true, week: false, daily: false, shopping: true, school: false, home: false });
});

it("saves a custom next-plan window, fetches the full range and returns to Auto", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00Z"));
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example person" }), "calendar.example": state("calendar.example", "off") }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example" };
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([]));
  const first = render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Look ahead" }), { target: { value: "custom" } });
  const days = screen.getByRole("spinbutton", { name: "Days ahead" });
  fireEvent.change(days, { target: { value: "14" } }); fireEvent.blur(days);
  await waitFor(() => expect(settings.settings.dashboard.nextPlanDays).toBe(14));
  expect(app.watchCalendarEvents).toHaveBeenCalledWith("calendar.example", expect.any(String), "2026-11-11T23:00:00.000Z", expect.any(AbortSignal), expect.any(Function));
  fireEvent.change(days, { target: { value: "91" } }); fireEvent.blur(days);
  expect(settings.settings.dashboard.nextPlanDays).toBe(14);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(await within(screen.getByRole("region", { name: "Next family plan" })).findByText("No plans in the next 14 days.")).toBeVisible();
  first.unmount(); render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  expect(screen.getByRole("spinbutton", { name: "Days ahead" })).toHaveValue(14);
  fireEvent.change(screen.getByRole("combobox", { name: "Look ahead" }), { target: { value: "auto" } });
  fireEvent.click(screen.getByRole("switch", { name: "Show tomorrow’s plans" }));
  await waitFor(() => expect(settings.settings.dashboard.nextPlanDays).toBe("auto"));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(await within(screen.getByRole("region", { name: "Next family plan" })).findByText("No plans today or tomorrow.")).toBeVisible();
});

it("saves list display choices, keeps them on reassignment and restores Add list when unlinked", async () => {
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example person" }), "person.other": state("person.other", "home", { friendly_name: "Other example" }), "todo.example": state("todo.example", "0", { friendly_name: "Example list" }) }, emptyRegistries, "home");
  settings.settings.todoLists = { "home|todo.example": { kind: "tasks", member: "home|person.example" } };
  window.history.replaceState(null, "", "/settings/lists");
  const first = render(<App />); await saved();
  const disclosure = screen.getByLabelText("Display settings for Tasks for Example person");
  fireEvent.click(disclosure);
  const options = within(disclosure.parentElement);
  expect(options.getByRole("combobox", { name: "Completed items" })).toHaveValue("collapsed");
  expect(options.getByRole("combobox", { name: "Sort order" })).toHaveValue("home-assistant");
  fireEvent.change(options.getByRole("combobox", { name: "Sort order" }), { target: { value: "due-date" } });
  expect(options.getByRole("option", { name: "Hide finished underneath" })).toHaveValue("collapsed");
  fireEvent.change(options.getByRole("combobox", { name: "Completed items" }), { target: { value: "collapsed" } });
  for (const name of ["Show details", "Show due date", "Celebrate completion"]) fireEvent.click(options.getByRole("switch", { name }));
  await saved();
  const display = { completed: "collapsed", sort: "due-date", showDetails: false, showDueDate: false, celebrate: true };
  expect(settings.settings.todoLists["home|todo.example"].display).toEqual(display);
  chooseEntity("Tasks for Other example", "todo.example");
  fireEvent.click(screen.getByRole("button", { name: "Change list" }));
  await saved();
  expect(settings.settings.todoLists["home|todo.example"]).toMatchObject({ member: "home|person.other", display });
  expect(screen.getByRole("button", { name: "Tasks for Example person" })).toHaveTextContent("Add list");
  first.unmount(); render(<App />); await saved();
  fireEvent.click(screen.getByLabelText("Display settings for Tasks for Other example"));
  expect(screen.getByRole("combobox", { name: "Completed items" })).toHaveValue("collapsed");
  expect(screen.getByRole("combobox", { name: "Sort order" })).toHaveValue("due-date");
  expect(screen.getByRole("switch", { name: "Celebrate completion" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Tasks for Other example" }));
  fireEvent.click(screen.getByRole("button", { name: "No list selected" }));
  fireEvent.click(screen.getByRole("button", { name: "Unlink list" }));
  await saved();
  expect(screen.getByRole("button", { name: "Tasks for Other example" })).toHaveTextContent("Add list");
});

it("configures and preserves the waste calendar when its Today section is hidden", async () => {
  app.currentHome = mapHome({ "calendar.example": state("calendar.example", "off", { friendly_name: "Example waste calendar" }) },
    { ...emptyRegistries, entities: [{ id: "stable-waste", entity_id: "calendar.example" }] }, "home");
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([]));
  const first = render(<App />); await saved();
  expect(screen.queryByRole("region", { name: "Waste collection" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.click(screen.getByRole("switch", { name: "Waste collection" }));
  const daysInput = screen.getByRole("spinbutton", { name: "Show up to (days ahead)" });
  expect(daysInput).toHaveValue(7);
  fireEvent.change(daysInput, { target: { value: "3" } });
  fireEvent.blur(daysInput);
  chooseEntity("Waste collection calendar", "calendar.example");
  await waitFor(() => expect(settings.settings.wasteCalendarEntity).toBe("home|stable-waste"));
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Customize Today" }), { key: "Escape" });
  expect(screen.queryByRole("region", { name: "Waste collection" })).not.toBeInTheDocument();
  expect(settings.settings.wasteCollectionDays).toBe(3);
  const signal = app.watchCalendarEvents.mock.calls[app.watchCalendarEvents.mock.calls.length - 1][3];
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.click(screen.getByRole("switch", { name: "Waste collection" }));
  await waitFor(() => expect(settings.settings.dashboard.wasteCollection).toBe(false));
  expect(settings.settings.wasteCalendarEntity).toBe("home|stable-waste");
  expect(signal.aborted).toBe(true);
  first.unmount();
  render(<App />); await saved();
  expect(screen.queryByRole("region", { name: "Waste collection" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.click(screen.getByRole("switch", { name: "Waste collection" }));
  expect(screen.getByRole("button", { name: "Waste collection calendar" })).toHaveTextContent("Example waste calendar");
  expect(screen.getByRole("spinbutton", { name: "Show up to (days ahead)" })).toHaveValue(3);
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
  settings.settings.dashboard.nextPlan = false;
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
  settings.settings.smartHome.layout = [configuredCard("home|light.lamp")];
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
  await navigate("Calendar");
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
  fireEvent.click(screen.getByRole("button", { name: "Smart home settings" }));
  fireEvent.click(screen.getByRole("link", { name: "Connection & settings" }));
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
  settings.settings.smartHome.layout = [configuredCard("home|missing")];
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
  window.history.replaceState(null, "", "/calendar?view=week&date=2026-10-26");
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
    ["Appearance", "appearance"], ["Language", "language"], ["Notifications", "notifications"], ["Weather", "weather"],
    ["People", "people"], ["Calendars", "calendars"], ["To-do lists", "lists"], ["Timetables", "timetables"],
    ["Smart home", "smart-home"], ["Connection & account", "connection"], ["Storage and backups", "backups"],
  ];
  for (const [title, path] of destinations) {
    const menu = within(screen.getByRole("navigation", { name: "Settings navigation" }));
    expect(menu.getAllByRole("link")).toHaveLength(destinations.length);
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

const cardEditorHome = () => mapHome({
  "light.example": state("light.example", "on", { friendly_name: "Example lamp", supported_color_modes: ["brightness"], brightness: 128 }),
  "sensor.example": state("sensor.example", "74", { friendly_name: "Example battery", unit_of_measurement: "%" }),
  "sensor.new": state("sensor.new", "20", { friendly_name: "New reading" }),
  "scene.example": state("scene.example", "unknown", { friendly_name: "Example scene" }),
}, emptyRegistries, "home");

it("builds a card type first, previews its chosen sources, saves once and keeps later discoveries out", async () => {
  app.currentHome = cardEditorHome();
  window.history.replaceState(null, "", "/settings/smart-home");
  const view = render(<App />); await saved();
  expect(screen.queryByRole("switch", { name: /Show/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add card" }));
  expect(screen.getByRole("heading", { name: "Choose a card type" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Light 1 available" }));
  expect(screen.getByRole("article", { name: "Light" })).toHaveAttribute("data-card-kind", "light");
  expect(screen.getAllByRole("button", { name: "Add card" })[0]).toBeDisabled();
  expect(screen.getByRole("button", { name: "Main entity" })).toBeDisabled();
  fireEvent.change(screen.getByRole("combobox", { name: "Device" }), { target: { value: "none" } });
  chooseEntity("Main entity", "light.example");
  fireEvent.click(screen.getByRole("button", { name: "Supporting entities" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Example battery" }));
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Supporting entities" }), { key: "Escape" });
  expect(screen.getByRole("article")).toHaveTextContent("74 %");
  expect(settings.settings.smartHome.layout).toEqual([]);
  fireEvent.change(screen.getByRole("textbox", { name: "Card name" }), { target: { value: "Reading light" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Card group" }), { target: { value: "Comfort" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Add card" })[0]); await saved();
  expect(settings.settings.smartHome.layout).toHaveLength(1);
  expect(settings.settings.smartHome.layout[0]).toMatchObject({ type: "light", mainEntity: "home|light.example", linkedEntities: ["home|sensor.example"], title: "Reading light", group: "Comfort", density: "supercompact" });
  await navigate("Smart home");
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByRole("article", { name: "Reading light" })).toHaveTextContent("Example battery");
  expect(screen.queryByText("New reading")).not.toBeInTheDocument();
  view.unmount(); render(<App />); await saved();
  expect(screen.getByRole("article", { name: "Reading light" })).toBeInTheDocument();
});

it("preserves missing selections and lets an unavailable card be repaired or removed with confirmation", async () => {
  app.currentHome = cardEditorHome();
  settings.settings.smartHome.layout = [configuredCard("home|missing", "light", { id: "example-card", title: "Missing lamp", linkedEntities: ["home|missing-reading"] })];
  window.history.replaceState(null, "", "/settings/smart-home?card=example-card");
  render(<App />); await saved();
  expect(screen.getByRole("button", { name: "Main entity" })).toHaveTextContent("Entity unavailable");
  expect(screen.getByRole("button", { name: "Entities from other devices" })).toHaveTextContent("missing-reading");
  fireEvent.change(screen.getByRole("combobox", { name: "Device" }), { target: { value: "none" } });
  chooseEntity("Main entity", "light.example");
  fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]); await saved();
  expect(settings.settings.smartHome.layout[0].linkedEntities).toEqual(["home|missing-reading"]);
  fireEvent.click(screen.getByRole("button", { name: /Missing lamp Light/ }));
  fireEvent.click(screen.getByRole("button", { name: "Remove card" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(settings.settings.smartHome.layout).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Remove card" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove card" }));
  await saved();
  expect(settings.settings.smartHome.layout).toEqual([]);
});

it("requires confirmation to clear all Smart home cards and preserves every other setting", async () => {
  app.currentHome = cardEditorHome();
  settings.settings.smartHome.layout = [configuredCard("home|light.example"), configuredCard("home|scene.example", "scene", { group: "Scenes" })];
  settings.settings.homeEntities = ["home|light.example"];
  const before = structuredClone(settings.settings);
  window.history.replaceState(null, "", "/settings/smart-home");
  render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Clear Smart home" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Today’s favourites");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(settings.settings).toEqual(before);
  fireEvent.click(screen.getByRole("button", { name: "Clear Smart home" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Clear Smart home" }));
  await saved();
  expect(settings.settings).toEqual({ ...before, smartHome: { layout: [] } });
  expect(screen.getByRole("button", { name: "Clear Smart home" })).toBeDisabled();
  await navigate("Smart home");
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.getByText("Make room for your home")).toBeVisible();
  expect(screen.getByRole("link", { name: "Add card" })).toHaveAttribute("href", "/settings/smart-home?card=new");
});

it("keeps a failed card save visible and disables reset and further changes", async () => {
  app.currentHome = cardEditorHome();
  settings.settings.smartHome.layout = [configuredCard("home|light.example")];
  window.history.replaceState(null, "", "/settings/smart-home?card=home%7Clight.example");
  render(<App />); await saved();
  fireEvent.change(screen.getByRole("textbox", { name: "Card name" }), { target: { value: "Unsaved lamp" } });
  app.configurationRequest.mockResolvedValue({ ok: false, status: 409 });
  fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Another screen changed the configuration"));
  expect(screen.getByRole("button", { name: /Unsaved lamp Light/ })).toBeVisible();
  expect(screen.getByRole("button", { name: "Clear Smart home" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /Unsaved lamp Light/ }));
  expect(screen.getByRole("textbox", { name: "Card name" })).toHaveValue("Unsaved lamp");
  expect(screen.getByRole("button", { name: "Main entity" })).toBeDisabled();
  expect(settings.settings.smartHome.layout[0].title).toBe("");
});

it("does not save abandoned drafts and keeps saved cards while changing type", async () => {
  app.currentHome = cardEditorHome();
  settings.settings.smartHome.layout = [configuredCard("home|light.example")];
  window.history.replaceState(null, "", "/settings/smart-home?card=home%7Clight.example");
  render(<App />); await saved();
  fireEvent.change(screen.getByRole("combobox", { name: "Card type" }), { target: { value: "sensor" } });
  expect(screen.getAllByRole("button", { name: "Save changes" })[0]).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Your cards" }));
  expect(screen.getByRole("alertdialog", { name: "Discard card changes?" })).toBeVisible();
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("combobox", { name: "Card type" })).toHaveValue("sensor");
  fireEvent.click(screen.getByRole("button", { name: "Your cards" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  await pageReady();
  expect(settings.settings.smartHome.layout[0].type).toBe("light");
});

it("scopes card sources to the chosen device and preserves explicit links from other devices across save and device changes", async () => {
  app.currentHome = mapHome({
    "light.desk": state("light.desk", "on", { friendly_name: "Desk light" }),
    "sensor.battery": state("sensor.battery", "74", { friendly_name: "Desk battery" }),
    "light.hall": state("light.hall", "off", { friendly_name: "Hall light" }),
    "sensor.temperature": state("sensor.temperature", "21", { friendly_name: "Hall temperature" }),
    "sensor.helper": state("sensor.helper", "3", { friendly_name: "Standalone reading" }),
  }, {
    areas: [], devices: [{ id: "desk-device", name: "Desk device" }, { id: "hall-device", name: "Hall device" }],
    entities: [
      { id: "desk-light", entity_id: "light.desk", device_id: "desk-device" },
      { id: "desk-battery", entity_id: "sensor.battery", device_id: "desk-device" },
      { id: "hall-light", entity_id: "light.hall", device_id: "hall-device" },
      { id: "hall-temperature", entity_id: "sensor.temperature", device_id: "hall-device" },
    ],
  }, "home");
  window.history.replaceState(null, "", "/settings/smart-home?card=new");
  const view = render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Light 2 available" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Device" }), { target: { value: "desk-device" } });
  fireEvent.click(screen.getByRole("button", { name: "Main entity" }));
  expect(screen.queryByRole("button", { name: /Choose device/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Hall light ·/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Desk light · light.desk" }));
  fireEvent.click(screen.getByRole("button", { name: "Supporting entities" }));
  expect(screen.queryByRole("checkbox", { name: "Hall temperature" })).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: "Standalone reading" })).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: "Desk light" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Desk battery" }));
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Supporting entities" }), { key: "Escape" });
  fireEvent.click(screen.getByText("Add entities from other devices"));
  fireEvent.click(screen.getByRole("button", { name: "Entities from other devices" }));
  fireEvent.click(screen.getByRole("button", { name: /All entities/ }));
  expect(screen.queryByRole("checkbox", { name: "Desk battery" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Hall temperature" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Standalone reading" }));
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Entities from other devices" }), { key: "Escape" });
  fireEvent.click(screen.getAllByRole("button", { name: "Add card" })[0]); await saved();
  expect(settings.settings.smartHome.layout[0]).toMatchObject({ mainEntity: "home|desk-light", linkedEntities: ["home|desk-battery", "home|hall-temperature", "home|sensor.helper"] });
  const id = settings.settings.smartHome.layout[0].id;
  view.unmount();
  window.history.replaceState(null, "", `/settings/smart-home?card=${id}`);
  render(<App />); await saved();
  expect(screen.getByRole("combobox", { name: "Device" })).toHaveValue("desk-device");
  expect(screen.getByRole("button", { name: "Supporting entities" })).toHaveTextContent("Desk battery");
  expect(screen.getByRole("button", { name: "Entities from other devices" })).toHaveTextContent("Hall temperature, Standalone reading");
  fireEvent.change(screen.getByRole("combobox", { name: "Device" }), { target: { value: "hall-device" } });
  expect(screen.getAllByRole("button", { name: "Save changes" })[0]).toBeDisabled();
  expect(screen.getByRole("button", { name: "Supporting entities" })).toHaveTextContent("Hall temperature");
  expect(screen.getByRole("button", { name: "Entities from other devices" })).toHaveTextContent("Desk battery, Standalone reading");
  chooseEntity("Main entity", "light.hall");
  fireEvent.click(screen.getByRole("button", { name: "Supporting entities" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Hall temperature" }));
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Supporting entities" }), { key: "Escape" });
  fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]); await saved();
  expect(settings.settings.smartHome.layout[0]).toMatchObject({ mainEntity: "home|hall-light", linkedEntities: ["home|desk-battery", "home|sensor.helper"] });
});

it("offers opt-in source recommendations and renders a clean production card preview for new and saved cards", async () => {
  app.currentHome = mapHome({
    "light.example": state("light.example", "on", { friendly_name: "Example lamp" }),
    "sensor.battery": state("sensor.battery", "82", { friendly_name: "Example battery", device_class: "battery", unit_of_measurement: "%" }),
    "sensor.temperature": state("sensor.temperature", "20", { friendly_name: "Unrelated reading", device_class: "temperature" }),
  }, { areas: [], devices: [{ id: "example-device", name: "Example device" }], entities: [
    { id: "lamp", entity_id: "light.example", device_id: "example-device" },
    { id: "battery", entity_id: "sensor.battery", device_id: "example-device", entity_category: "diagnostic" },
    { id: "temperature", entity_id: "sensor.temperature", device_id: "example-device" },
  ] }, "home");
  window.history.replaceState(null, "", "/settings/smart-home?card=new");
  render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Light 1 available" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Device" }), { target: { value: "example-device" } });
  expect(screen.getAllByRole("button", { name: "Add card" })[0]).toBeDisabled();
  const preview = within(screen.getByRole("complementary", { name: "Card preview" }));
  expect(preview.queryByRole("combobox", { name: "Device" })).not.toBeInTheDocument();
  expect(preview.queryByRole("button", { name: "Main entity" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Use Example lamp" }));
  expect(screen.getByRole("button", { name: "Main entity" })).toHaveFocus();
  expect(preview.getByRole("article", { name: "Example lamp" })).toHaveAttribute("data-card-kind", "light");
  expect(preview.queryByText("Example battery")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add Unrelated reading" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add Example battery" }));
  expect(screen.getByRole("button", { name: "Supporting entities" })).toHaveFocus();
  expect(preview.getByText("82 %")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Add Example battery" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Card name" }), { target: { value: "Preview lamp" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Card size" }), { target: { value: "original" } });
  expect(preview.getByRole("article", { name: "Preview lamp" })).toHaveAttribute("data-variant", "Original");
  expect(settings.settings.smartHome.layout).toEqual([]);
  fireEvent.click(screen.getAllByRole("button", { name: "Add card" })[0]); await saved();
  expect(settings.settings.smartHome.layout[0]).toMatchObject({ mainEntity: "home|lamp", linkedEntities: ["home|battery"], title: "Preview lamp", density: "original" });
  fireEvent.click(screen.getByRole("button", { name: /Preview lamp Light/ }));
  expect(within(screen.getByRole("complementary", { name: "Card preview" })).getByRole("article", { name: "Preview lamp" })).toHaveAttribute("data-variant", "Original");
});
