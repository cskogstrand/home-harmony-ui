import { configuredCard } from "./device-card-fixtures";
import { chooseEntity } from "./entity-picker-helpers";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { Map as LeafletMap, Marker } from "leaflet";
import App from "@/App";
import { dashboardSections, emptyConfiguration, parseConfiguration } from "../../shared/configuration";
import { notificationRuleSchema } from "../../shared/notifications";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { configurationSnapshot } from "./configuration-snapshot.mjs";
import { addDays, homeDate, weekStart, isPlannerDate } from "@/contexts/FamilyContext";

const app = vi.hoisted(() => ({ currentHome: null, haUrl: "http://ha.local:8123", homeOnline: true, connectionStatus: "connected", entityRegistryAvailable: true, metadataWarnings: [], services: {}, commands: {}, command: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), configurationRequest: vi.fn(), storageRequest: vi.fn(), watchCalendarEvents: vi.fn(), todoItems: vi.fn() }));
vi.mock("@/contexts/AppContext", async importOriginal => {
  const { AppContext } = await importOriginal<typeof import("@/contexts/AppContext")>();
  const { useContext } = await import("react");
  return { AppContext, useApp: (select = value => value) => select(useContext(AppContext) ?? app) };
});
vi.mock("../../config.yaml?raw", () => ({ default: 'name: Home Harmony UI\nversion: "9.8.7"\n' }));
vi.mock("@/contexts/AppProvider", () => ({ AppProvider: ({ children }) => children }));
let settings = emptyConfiguration();
beforeEach(() => {
  settings = emptyConfiguration();
  app.services = {};
  app.watchCalendarEvents.mockReset();
  app.todoItems.mockReset().mockResolvedValue([]);
  app.entityRegistryAvailable = true;
  app.homeOnline = true;
  app.connectionStatus = "connected";
  app.haUrl = "http://ha.local:8123";
  app.currentHome = mapHome({ "person.emma": state("person.emma", "home", { friendly_name: "Emma" }), "person.leo": state("person.leo", "home", { friendly_name: "Leo" }) }, emptyRegistries, "home");
  app.configurationRequest.mockImplementation(async (method, body) => {
    if (method === "PUT") settings = parseConfiguration(body);
    return { ok: true, json: async () => configurationSnapshot(settings) };
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

it("loads the saved day scene on the card itself with the wall artwork off", async () => {
  settings.settings.appearance.plannerArtwork = { day: true };
  const { container } = render(<App />);
  const day = await screen.findByRole("region", { name: "Everyone’s day" });
  await waitFor(() => expect(container.querySelector("#artwork-fjord")).toBeInTheDocument());
  expect(day.querySelector(":scope > .card-backdrop use")).toHaveAttribute("href", "#artwork-fjord");
  expect(screen.getByRole("region", { name: "Everyone’s week" }).querySelector(".card-backdrop")).toBeNull();
  expect(container.querySelector(".artwork-background")).toBeNull();
});

it("assigns waste collections to an active person and shows the same single collection date in Calendar and Everyone’s day", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T07:00:00Z"));
  settings.settings.language = "nb";
  settings.settings.wasteCalendarEntity = "home|calendar.example_waste";
  settings.settings.dashboard.showTomorrow = true;
  settings.settings.hiddenMembers = ["home|person.hidden"];
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Eksempelperson" }),
    "person.other": state("person.other", "home", { friendly_name: "Annen eksempelperson" }),
    "person.hidden": state("person.hidden", "home", { friendly_name: "Skjult eksempelperson" }),
    "calendar.example_waste": state("calendar.example_waste", "off", { friendly_name: "Eksempel på tømmekalender", supported_features: 7 }),
  }, emptyRegistries, "home");
  app.currentHome.timeZone = "Europe/Oslo";
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([
    { uid: "example-pickup", summary: "Mat- og Restavfall", start: "2026-10-23T22:30:00Z", end: "2026-10-27T12:00:00Z", description: "Fiktiv tømmeoppføring" },
  ]));
  window.history.replaceState(null, "", "/settings/calendars");
  render(<App />);
  fireEvent.click(await screen.findByRole("link", { name: "Tømmevarsler" }));
  const selector = await screen.findByRole("combobox", { name: "Vis tømmevarsler for" });
  await waitFor(() => expect(selector).toBeEnabled());
  expect(within(selector).queryByRole("option", { name: "Skjult eksempelperson" })).not.toBeInTheDocument();
  fireEvent.change(selector, { target: { value: "home|person.example" } });
  await waitFor(() => expect(settings.settings.calendarMembers["home|calendar.example_waste"]).toBe("home|person.example"));
  fireEvent.click(screen.getByRole("link", { name: "I dag" }));
  const day = await screen.findByRole("region", { name: "Dagen vår" });
  const dayCollection = await within(day).findByRole("button", { name: /Mat- og Restavfall.*Tømt i dag/ });
  expect(dayCollection.querySelectorAll(".waste-collection-icons svg")).toHaveLength(2);
  expect(dayCollection.querySelector(".lucide-apple")).toBeInTheDocument();
  expect(dayCollection.querySelector(".lucide-trash2")).toBeInTheDocument();
  expect(within(day).getAllByRole("button", { name: /Mat- og Restavfall/ })).toHaveLength(1);
  expect(within(day).getByRole("region", { name: "I morgen" })).not.toHaveTextContent("Mat- og Restavfall");
  expect(within(day).queryByRole("group", { name: "Annen eksempelperson" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Kalender" }));
  const collection = await screen.findByRole("button", { name: /Mat- og Restavfall.*Tømt i dag/ });
  expect(collection.querySelectorAll(".waste-collection-icons svg")).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: /Mat- og Restavfall/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Måned" }));
  const monthCollection = screen.getByRole("button", { name: /Mat- og Restavfall.*Tømt i dag/ });
  expect(monthCollection.querySelectorAll(".waste-collection-icons svg")).toHaveLength(2);
  fireEvent.click(monthCollection);
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent("Tømmevarsler bruker bare tømmedatoen");
  expect(dialog).toHaveTextContent("Tømt i dag");
  expect(dialog.querySelectorAll(".waste-collection-icons svg")).toHaveLength(2);
  expect(dialog).not.toHaveTextContent("00:30");
  expect(within(dialog).queryByRole("button", { name: "Lagre plan" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Slett" })).not.toBeInTheDocument();
});

it.each(["unconfigured", "missing", "offline"])("disables the waste person selector when its source is %s", async condition => {
  if (condition !== "unconfigured") settings.settings.wasteCalendarEntity = "home|calendar.missing";
  if (condition === "offline") app.homeOnline = false;
  window.history.replaceState(null, "", "/settings/calendars");
  render(<App />);
  await saved();
  fireEvent.click(screen.getByRole("link", { name: "Waste collection" }));
  expect(screen.getByRole("combobox", { name: "Show waste collections for" })).toBeDisabled();
  expect(screen.getByText(condition === "unconfigured" ? "Choose a waste collection calendar in Customize Today." : "Waste collection calendar unavailable. Check the calendar or choose another in Customize Today.")).toBeInTheDocument();
});

it.each([
  ["en", "2026-10-28", "auto", false, "In 6 h"],
  ["en", "2026-10-29", "auto", true, "Tomorrow"],
  ["en", "2026-10-29", "auto", false, "Tomorrow"],
  ["en", "2026-10-30", "auto", true, "In 2 days"],
  ["nb", "2026-10-31", "auto", true, "Om 3 dager"],
  ["nb", "2026-10-28", "auto", true, "Om 6 t"],
  ["nb", "2026-10-29", "auto", true, "I morgen"],
  ["nb", "2026-10-29", "auto", false, "I morgen"],
  ["en", "2026-10-30", 3, false, "In 2 days"],
  ["en", "2026-11-01", 3, false, "In 4 days"],
] as const)("explains the next family plan in %s on %s (%s, tomorrow %s)", async (language, date, days, showTomorrow, countdown) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00Z"));
  settings.settings.language = language;
  settings.settings.dashboard.nextPlanDays = days;
  settings.settings.dashboard.showTomorrow = showTomorrow;
  settings.settings.memberColors = { "home|person.example": "#a5c9bd" };
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example person" }), "calendar.example": state("calendar.example", "off") }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example" };
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([
    { summary: "Example activity", start: `${date}T16:00:00Z`, end: `${date}T17:00:00Z`, location: "Example location", description: "Example reminder" },
  ]));
  render(<App />); await pageReady();
  const next = screen.getByRole("region", { name: language === "nb" ? "Neste familieplan" : "Next family plan" });
  expect(within(next).getByRole("heading", { level: 2, name: language === "nb" ? "Neste familieplan" : "Next family plan" })).toBeVisible();
  expect(await within(next).findByRole("heading", { level: 3, name: "Example activity" })).toBeVisible();
  expect(within(next).queryByText(/^(No (more )?plans|Ingen (flere )?planer)/)).not.toBeInTheDocument();
  expect(next.querySelector(".next-plan-countdown")?.textContent ?? null).toBe(countdown);
  expect(within(next).getByRole("link", { name: language === "nb" ? "Åpne kalender" : "Open calendar" })).toHaveAttribute("href", `/calendar?date=${date}&view=day`);
  expect(within(next).getAllByRole("button")).toHaveLength(2);
  const plan = within(next).getByRole("button", { name: /Example activity/ });
  expect(plan.style.getPropertyValue("--member")).toBe("#a5c9bd");
  expect(within(plan).getByText(countdown, { selector: ".next-plan-countdown" })).toBeVisible();
  expect(within(plan).getByText("Example person · Example location")).toBeVisible();
  expect(within(next).getByText("Example reminder")).toBeVisible();
  fireEvent.click(within(plan).getByText("17:00 – 18:00"));
  expect(screen.getByRole("dialog", { name: "Example activity" })).toBeVisible();
});

it("formats Home Assistant descriptions in the next plan and calendar dialog with separate links", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00Z"));
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example person" }), "calendar.example": state("calendar.example", "off") }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example" };
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([
    { summary: "Example reservation", start: "2026-10-28T16:00:00Z", end: "2026-10-28T17:00:00Z", description: '<p>Example details<br><strong>Bring supplies</strong></p><p><a href="https://example.com/booking">Booking details</a></p><script>alert(1)</script>' },
  ]));
  render(<App />); await pageReady();
  const next = screen.getByRole("region", { name: "Next family plan" });
  const link = await within(next).findByRole("link", { name: "Booking details" });
  expect(link.closest("button")).toBeNull();
  fireEvent.click(link);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(next.querySelector("strong")).toHaveTextContent("Bring supplies");
  fireEvent.click(within(next).getByRole("button", { name: /Example reservation/ }));
  const dialog = screen.getByRole("dialog", { name: "Example reservation" });
  expect(within(dialog).getByRole("link", { name: "Booking details" })).toHaveAttribute("href", "https://example.com/booking");
  expect(dialog.querySelector("strong")).toHaveTextContent("Bring supplies");
  expect(dialog.querySelector("script")).toBeNull();
  expect(dialog).not.toHaveTextContent("<p>");
});

it.each(["en", "nb"] as const)("toggles next-plan descriptions locally and applies the shared default in %s", async language => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00Z"));
  settings.settings.language = language;
  settings.settings.dashboard.hideNextPlanDescription = true;
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example person" }), "calendar.example": state("calendar.example", "off") }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example" };
  let event = { uid: "example", summary: "Example reservation", start: "2026-10-28T16:00:00Z", end: "2026-10-28T17:00:00Z", description: '<p><a href="https://example.com/booking">Booking details</a></p>' };
  const receivers = new Set<(events: typeof event[]) => void>();
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => { receivers.add(receive); receive([event]); });
  const update = (changes: Partial<typeof event>) => act(() => { event = { ...event, ...changes }; receivers.forEach(receive => receive([event])); });
  render(<App />); await pageReady();
  const next = () => screen.getByRole("region", { name: language === "nb" ? "Neste familieplan" : "Next family plan" });
  const toggle = () => within(next()).getByRole("button", { name: language === "nb" ? "Vis eller skjul beskrivelsen" : "Show or hide description" });
  await within(next()).findByRole("button", { name: /Example reservation/ });
  expect(toggle()).toHaveAttribute("aria-expanded", "false");
  expect(document.getElementById(toggle().getAttribute("aria-controls")!)).not.toBeVisible();
  expect(within(next()).queryByRole("link", { name: "Booking details" })).not.toBeInTheDocument();
  const writes = () => app.configurationRequest.mock.calls.filter(([method]) => method === "PUT").length;
  const before = writes();
  fireEvent.click(toggle());
  expect(toggle()).toHaveAttribute("aria-expanded", "true");
  expect(within(next()).getByRole("link", { name: "Booking details" })).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(writes()).toBe(before);
  update({ summary: "Updated reservation" });
  expect(toggle()).toHaveAttribute("aria-expanded", "true");
  update({ uid: "next-example", summary: "Next reservation" });
  expect(toggle()).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(screen.getByRole("button", { name: language === "nb" ? "Tilpass I dag" : "Customize Today" }));
  const defaultToggle = screen.getByRole("switch", { name: language === "nb" ? "Skjul beskrivelsen som standard" : "Hide description by default" });
  expect(defaultToggle).toBeChecked();
  fireEvent.click(defaultToggle);
  await waitFor(() => expect(settings.settings.dashboard.hideNextPlanDescription).toBe(false));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(toggle()).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(toggle());
  expect(toggle()).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(within(next()).getByRole("button", { name: /Next reservation/ }));
  expect(within(screen.getByRole("dialog", { name: "Next reservation" })).getByRole("link", { name: "Booking details" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  update({ uid: "no-description", description: "" });
  expect(within(next()).getAllByRole("button")).toHaveLength(1);
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
  expect(within(next).queryByText(/^No (more )?plans/)).not.toBeInTheDocument();
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
  expect(await next.findByText("No more timed plans today.")).toBeVisible();
  expect(next.queryByText("Example all-day plan")).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Everyone’s day" })).getByText("Example all-day plan")).toBeVisible();
});

it("keeps the next-plan countdown when changing the look-ahead window while ignoring all-day events", async () => {
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
  expect(next.querySelector(".next-plan-countdown")).toHaveTextContent("In 2 days");
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Look ahead" }), { target: { value: "custom" } });
  const days = screen.getByRole("spinbutton", { name: "Days ahead" });
  fireEvent.change(days, { target: { value: "2" } });
  await waitFor(() => expect(settings.settings.dashboard.nextPlanDays).toBe(2));
  expect(next.querySelector(".next-plan-countdown")).toHaveTextContent("In 2 days");
  fireEvent.change(days, { target: { value: "0" } });
  await waitFor(() => expect(settings.settings.dashboard.nextPlanDays).toBe(0));
  expect(next.querySelector(".next-plan-countdown")).toHaveTextContent("In 2 days");
  expect(within(next).queryByText(/^No (more )?plans/)).not.toBeInTheDocument();
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
  expect(await next.findByText("In 2 days")).toBeVisible();
  expect(next.queryByText("No more timed plans today.")).not.toBeInTheDocument();
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
  const month = within(screen.getByRole("region", { name: "Month view" }));
  const tripCards = month.getAllByRole("button", { name: /^Example trip.*All day.*Example person/ });
  expect(tripCards).toHaveLength(3);
  expect(within(tripCards[0]).getByText("Example person")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Example person" }));
  expect(month.queryByRole("button", { name: /^Other plan/ })).not.toBeInTheDocument();
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
  const todayAction = screen.getByRole("button", { name: "Today" });
  // Today is an action beside the view segments, never styled or exposed as a selected state.
  expect(todayAction).not.toHaveAttribute("aria-pressed");
  expect(todayAction).not.toHaveClass("border");
  expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(todayAction);
  expect(screen.getByRole("heading", { name: "October 2026" })).toBeVisible();
  expect(settings.settings.calendar).toEqual({ view: "week", startDay: "today" });
  fireEvent.click(screen.getByRole("button", { name: "Week" }));
  fireEvent.click(screen.getByRole("button", { name: "Monday, 26 October 2026" }));
  expect(screen.getByRole("region", { name: "Day view" })).toHaveTextContent("No calendars or to-do lists selected");
  expect(screen.queryByText("No plans for this day.")).not.toBeInTheDocument();
});

it("opens old date links as a day agenda and distinguishes failed data from an empty day", async () => {
  app.currentHome = mapHome({ "person.example": state("person.example", "home"), "calendar.example": state("calendar.example", "off") }, emptyRegistries, "home");
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example" };
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive(null));
  window.history.replaceState(null, "", "/calendar?date=2026-10-26");
  render(<App />); await saved();
  expect(screen.getByRole("button", { name: "Day", pressed: true })).toBeVisible();
  expect(screen.getByRole("region", { name: "Day view" })).toHaveTextContent("Some calendars or to-do lists could not be loaded.");
  expect(screen.queryByText("No plans for this day.")).not.toBeInTheDocument();
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([]));
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("No plans for this day.")).toBeVisible();
  expect(screen.queryByRole("button", { name: /Refresh|Retry/ })).not.toBeInTheDocument();
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
  expect(screen.queryByRole("navigation", { name: "Settings sections" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Settings section" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Weather source" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Show weather" })).toBeVisible();
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
  expect(screen.getByRole("button", { name: /^Weather:/ })).toHaveTextContent("18 °C");
  fireEvent.click(screen.getByRole("button", { name: "Temperature entity (optional)" }));
  expect(screen.queryByRole("button", { name: /sensor.example/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /sensor.humidity/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /weather.example/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /input_number.temperature/ })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Example temperature · sensor.temperature" }));
  await saved();
  expect(settings.settings.weatherTemperatureEntity).toBe("home|stable-temperature");
  expect(screen.getByRole("button", { name: /^Weather:/ })).toHaveTextContent("21 °F");
  view.unmount();
  render(<App />); await saved();
  expect(screen.getByRole("button", { name: "Weather entity" })).toHaveTextContent("Example forecast");
  expect(screen.getByRole("checkbox", { name: "Beside the clock on Today" })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: "In the header" })).toBeChecked();
  expect(screen.getByRole("button", { name: "Temperature entity (optional)" })).toHaveTextContent("Example temperature");
  expect(screen.getByRole("button", { name: /^Weather:/ })).toHaveTextContent("21 °F");
  fireEvent.click(screen.getByRole("button", { name: "Temperature entity (optional)" }));
  fireEvent.click(screen.getByRole("button", { name: "Use weather entity" }));
  await saved();
  expect(settings.settings.weatherTemperatureEntity).toBe("");
  expect(screen.getByRole("button", { name: /^Weather:/ })).toHaveTextContent("18 °C");
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
  expect(screen.getByRole("button", { name: "Shopping" })).toHaveTextContent("Shopping");
  await navigate("Calendar");
  expect(screen.getAllByRole("rowheader")).toHaveLength(1);
  expect(screen.getByRole("rowheader", { name: "Example person" })).toBeInTheDocument();
  expect(app.watchCalendarEvents).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Add a plan" }));
  expect(screen.getByLabelText("Who’s going?")).toHaveValue("home|person.example");
  expect(screen.queryByRole("option", { name: "Everyone" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("link", { name: "Open app settings" }));
  await pageReady();
  fireEvent.click(screen.getByRole("button", { name: /^Household/ }));
  fireEvent.click(screen.getByRole("link", { name: "Calendars" }));
  await pageReady();
  chooseEntity(screen.getByRole("button", { name: "Add calendar for Example person" }), "calendar.shared");
  fireEvent.click(screen.getByRole("button", { name: "Move calendar" }));
  await saved();
  fireEvent.click(screen.getByRole("link", { name: "All settings" }));
  fireEvent.click(within(await screen.findByRole("navigation", { name: "Settings navigation" })).getByRole("link", { name: "To-do lists" }));
  await pageReady();
  fireEvent.click(screen.getByRole("link", { name: "Example person" }));
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
  fireEvent.click(screen.getByRole("link", { name: "Example person" }));
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
  expect(screen.queryByRole("button", { name: "Arrange cards" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Smart home settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Arrange cards" }));
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
  expect(screen.queryByRole("button", { name: "Arrange cards" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Smart home settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Arrange cards" }));
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
  const headings = ["Morning summary", "Everyone’s day", "Everyone’s week", "Daily rhythm", "Shopping", "School", "Favorites"];
  for (const name of headings) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Next family plan" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  const dialog = screen.getByRole("dialog", { name: "Customize Today" });
  expect(within(dialog).getByRole("switch", { name: "Waste collection" })).not.toBeChecked();
  const toggles = ["Morning summary", "Next family plan", "Everyone’s day", "Everyone’s week", "Daily rhythm", "Shopping", "School", "Home favorites"]
    .map(name => within(dialog).getByRole("switch", { name }));
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
  expect(dashboardSections.every(key => !settings.settings.dashboard[key])).toBe(true);
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
  expect(settings.settings.dashboard).toEqual({ ...emptyConfiguration().settings.dashboard, morningSummary: false, nextPlan: false, day: false, showTomorrow: true, week: false, daily: false, shopping: true, school: false, home: false });
});

it("saves homework filters and opens the full homework list in Lists or School without a timetable", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Example student" }),
    "todo.example": state("todo.example", "3", { supported_features: 127 }),
  }, emptyRegistries, "home");
  app.currentHome.timeZone = "Europe/Oslo";
  settings.settings.todoLists = { "home|todo.example": { kind: "homework", member: "home|person.example" } };
  app.todoItems.mockResolvedValue([
    { uid: "overdue", summary: "Finish a sketch", status: "needs_action", due: "2026-10-20" },
    { uid: "today", summary: "Read a chapter", status: "needs_action", due: "2026-10-28" },
    { uid: "tomorrow", summary: "Practise fractions", status: "needs_action", due: "2026-10-28T23:30:00Z" },
    { uid: "done", summary: "Draw a map", status: "completed", due: "2026-10-29" },
    { uid: "later", summary: "Plan a project", status: "needs_action", due: "2026-10-29T23:00:00Z" },
    { uid: "undated", summary: "Read a poem", status: "needs_action" },
  ]);
  const first = render(<App />); await saved();
  const customize = () => {
    fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
    return within(screen.getByRole("dialog"));
  };
  const closeSettings = () => fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  fireEvent.click(customize().getByRole("switch", { name: "Homework" }));
  closeSettings();
  const panel = () => within(document.querySelector<HTMLElement>(".portrait-board .list-homework")!);
  expect(await panel().findByRole("checkbox", { name: "Read a chapter" })).toBeVisible();
  expect(panel().getByRole("checkbox", { name: "Finish a sketch" })).toBeVisible();
  expect(panel().getByRole("checkbox", { name: "Read a poem" })).toBeVisible();
  expect(panel().getByText("No due date")).toBeVisible();
  expect(panel().getAllByRole("checkbox")).toHaveLength(3);
  let dialog = customize();
  fireEvent.click(dialog.getByRole("switch", { name: "Include homework without a due date" }));
  fireEvent.change(dialog.getByLabelText("Due date"), { target: { value: "today" } });
  closeSettings();
  expect(panel().getByRole("checkbox", { name: "Read a chapter" })).toBeVisible();
  expect(panel().getAllByRole("checkbox")).toHaveLength(1);
  dialog = customize();
  fireEvent.change(dialog.getByLabelText("Due date"), { target: { value: "tomorrow" } });
  closeSettings();
  expect(panel().getByRole("checkbox", { name: "Practise fractions" })).toBeVisible();
  expect(panel().getAllByRole("checkbox")).toHaveLength(1);
  dialog = customize();
  fireEvent.change(dialog.getByLabelText("Due date"), { target: { value: "through-tomorrow" } });
  fireEvent.click(dialog.getByRole("switch", { name: "Show completed homework" }));
  fireEvent.change(dialog.getByLabelText("Homework action"), { target: { value: "school" } });
  closeSettings(); await saved();
  first.unmount();
  render(<App />); await saved();
  expect(await panel().findByText("Practise fractions")).toBeVisible();
  expect(panel().getByText("Draw a map")).toBeVisible();
  expect(panel().queryByText("Read a poem")).toBeNull();
  expect(panel().getByText("Read a chapter")).toBeVisible();
  expect(panel().getByText("Finish a sketch")).toBeVisible();
  expect(panel().queryByText("Plan a project")).toBeNull();
  expect(panel().queryByRole("checkbox")).toBeNull();
  fireEvent.click(panel().getByRole("link", { name: "Open in School" }));
  expect(await screen.findByRole("heading", { level: 1, name: "School" })).toBeVisible();
  expect(await screen.findByRole("checkbox", { name: "Read a poem" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Timetables" })).toHaveAttribute("href", "/school");
  await navigate("Today");
  dialog = customize();
  fireEvent.change(dialog.getByLabelText("Due date"), { target: { value: "all" } });
  fireEvent.click(dialog.getByRole("switch", { name: "Include homework without a due date" }));
  fireEvent.click(dialog.getByRole("switch", { name: "Show completed homework" }));
  fireEvent.change(dialog.getByLabelText("Homework action"), { target: { value: "lists" } });
  closeSettings();
  expect(panel().getByText("Read a poem")).toBeVisible();
  expect(panel().queryByRole("checkbox")).toBeNull();
  await waitFor(() => expect(panel().queryByText("Draw a map")).toBeNull());
  fireEvent.click(panel().getByRole("link", { name: "Open in Lists" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Lists" })).toBeVisible();
  expect(screen.getByRole("button", { name: /Homework/, pressed: true })).toBeVisible();
  expect(await screen.findByRole("checkbox", { name: "Read a poem" })).toBeVisible();
});

it("persists summary display choices and keeps playback configuration accessible with the summary panel hidden", async () => {
  const today = homeDate(new Date(), "UTC");
  app.currentHome = mapHome({
    "sensor.afterglow_morning_summary": state("sensor.afterglow_morning_summary", today, {
      message: "Example legacy summary.", messages: [{ key: "example", name: "Example group", emoji: "☀️", text: "Example group summary." }],
    }),
    "script.morning_summary_voice": state("script.morning_summary_voice", "off"),
  }, emptyRegistries, "home");
  app.currentHome.timeZone = "UTC";
  const first = render(<App />); await saved();
  expect(screen.getByText("Example group summary.")).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Everyone’s day" })).queryByRole("button", { name: "Show morning summary" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.click(screen.getByRole("switch", { name: "Hide morning summary content" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show summary button in Everyone’s day" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await saved();
  const summary = screen.getByRole("region", { name: "Morning summary" });
  expect(within(summary).getByRole("heading", { name: "Morning summary" })).toBeVisible();
  expect(within(summary).getByRole("button", { name: "Play summary" })).toBeVisible();
  expect(within(summary).queryByRole("list")).not.toBeInTheDocument();
  expect(screen.queryByText("Example group summary.")).not.toBeInTheDocument();
  expect(screen.queryByText("Example legacy summary.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.click(screen.getByRole("switch", { name: "Morning summary" }));
  expect(screen.getByRole("button", { name: "Morning summary sensor" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Playback script" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Playback switch (input_boolean)" })).toBeEnabled();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await saved();
  first.unmount();
  render(<App />); await saved();
  expect(screen.queryByRole("region", { name: "Morning summary" })).not.toBeInTheDocument();
  const show = within(screen.getByRole("region", { name: "Everyone’s day" })).getByRole("button", { name: "Show morning summary" });
  fireEvent.click(show);
  const modal = screen.getByRole("dialog", { name: "Morning summary" });
  expect(within(modal).getByText("Example group summary.")).toBeVisible();
  expect(within(modal).queryByText("Example legacy summary.")).not.toBeInTheDocument();
  expect(within(modal).getByRole("button", { name: "Play summary" })).toBeDisabled();
  fireEvent.keyDown(modal, { key: "Escape" });
  await waitFor(() => expect(show).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  expect(screen.getByRole("switch", { name: "Hide morning summary content" })).toBeChecked();
  expect(screen.getByRole("switch", { name: "Show summary button in Everyone’s day" })).toBeChecked();
});

it("reorders Today sections, preserves hidden positions across reload and resets only the order", async () => {
  const first = render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  const dialog = screen.getByRole("dialog", { name: "Customize Today" });
  const rows = () => within(dialog).getByRole("list", { name: "Section order" });
  for (const row of within(rows()).getAllByRole("listitem")) {
    const heading = within(row).getByRole("heading", { level: 3 });
    expect(heading.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(within(row).getByRole("switch", { name: heading.textContent })).toHaveAttribute("aria-labelledby", heading.id);
  }
  expect(within(dialog).getByRole("button", { name: "Move Morning summary earlier" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Move Home status later" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Reset section order" })).toBeDisabled();
  for (let i = 0; i < 6; i++) fireEvent.click(within(dialog).getByRole("button", { name: "Move Shopping earlier" }));
  expect(within(dialog).getByRole("button", { name: "Move Shopping earlier" })).toBeDisabled();
  await waitFor(() => expect(within(dialog).getByRole("switch", { name: "Shopping" })).toHaveFocus());
  expect(rows().firstElementChild).toHaveAttribute("data-section", "shopping");
  expect(within(dialog).getByText(`Moved Shopping to position 1 of ${dashboardSections.length}.`)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Move Shopping later" }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Move Shopping later" })).toHaveFocus());
  fireEvent.click(within(dialog).getByRole("switch", { name: "Shopping" }));
  await waitFor(() => expect(settings.settings.dashboard.order[1]).toBe("shopping"));
  await waitFor(() => expect(settings.settings.dashboard.shopping).toBe(false));
  first.unmount();
  render(<App />); await saved();
  expect(screen.queryByRole("heading", { name: "Shopping" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  const restored = screen.getByRole("dialog", { name: "Customize Today" });
  expect(within(restored).getByRole("list", { name: "Section order" }).children[1]).toHaveAttribute("data-section", "shopping");
  fireEvent.click(within(restored).getByRole("switch", { name: "Shopping" }));
  fireEvent.keyDown(restored, { key: "Escape" });
  await saved();
  expect(screen.getAllByRole("heading", { level: 2 })[0].textContent).toBe("Shopping");
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.click(screen.getByRole("switch", { name: "Everyone’s week" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset section order" }));
  await waitFor(() => expect(settings.settings.dashboard.order).toEqual(dashboardSections));
  expect(settings.settings.dashboard.week).toBe(false);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.getAllByRole("heading", { level: 2 })[0].textContent).toBe("Next family plan");
});

it("disables reordering when shared configuration fails to load", async () => {
  app.configurationRequest.mockRejectedValue(new Error("Example storage failure"));
  render(<App />); await pageReady();
  fireEvent.click(await screen.findByRole("button", { name: "Customize Today" }));
  const dialog = screen.getByRole("dialog", { name: "Customize Today" });
  expect(within(dialog).getByRole("button", { name: "Move Shopping earlier" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Move Shopping later" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Reset section order" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Playback script" })).toBeDisabled();
});

it("selects, persists and clears the morning summary sensor in Today settings", async () => {
  const today = homeDate(new Date(), "UTC");
  app.currentHome = mapHome({
    "sensor.afterglow_morning_summary": state("sensor.afterglow_morning_summary", today, { friendly_name: "Default summary", message: "Default block." }),
    "sensor.example_summary": state("sensor.example_summary", today, { friendly_name: "Example summary", message: "Selected block." }),
  }, { ...emptyRegistries, entities: [{ entity_id: "sensor.example_summary", id: "stable-summary" }] }, "home");
  app.currentHome.timeZone = "UTC";
  const first = render(<App />); await saved();
  expect(screen.getByText("Default block.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  expect(screen.getByRole("button", { name: "Morning summary sensor" })).toHaveTextContent("Default summary");
  chooseEntity("Morning summary sensor", "sensor.example_summary");
  await waitFor(() => expect(settings.settings.morningSummaryEntity).toBe("home|stable-summary"));
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Customize Today" }), { key: "Escape" });
  expect(screen.getByText("Selected block.")).toBeVisible();
  expect(screen.queryByText("Default block.")).not.toBeInTheDocument();
  first.unmount(); render(<App />); await saved();
  expect(screen.getByText("Selected block.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.click(screen.getByRole("button", { name: "Morning summary sensor" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Morning summary sensor" })).getByRole("button", { name: "Clear selection" }));
  await waitFor(() => expect(settings.settings.morningSummaryEntity).toBe(""));
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Customize Today" }), { key: "Escape" });
  expect(screen.queryByRole("region", { name: "Morning summary" })).not.toBeInTheDocument();
});

it.each([
  ["en", "Customize Today", "Playback script", "Play summary", "Clear selection", "The script that runs when you press Play. Choose the speaker and voice in Home Assistant."],
  ["nb", "Tilpass I dag", "Avspillingsskript", "Spill av oppsummering", "Fjern valg", "Skriptet som kjøres når du trykker Spill av. Høyttaler og stemme velges i Home Assistant."],
] as const)("selects, persists and clears the playback script in %s Today settings", async (language, customize, label, play, clear, help) => {
  settings.settings.language = language;
  app.currentHome = mapHome({
    "sensor.afterglow_morning_summary": state("sensor.afterglow_morning_summary", homeDate(new Date(), "UTC"), { message: "Example summary." }),
    "script.morning_summary_voice": state("script.morning_summary_voice", "off", { friendly_name: "Default voice" }),
    "script.example_voice": state("script.example_voice", "off", { friendly_name: "Example voice" }),
  }, { ...emptyRegistries, entities: [{ entity_id: "script.example_voice", id: "stable-voice" }] }, "home");
  app.currentHome.timeZone = "UTC";
  const first = render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: customize }));
  const picker = screen.getByRole("button", { name: label });
  await waitFor(() => expect(picker).toBeEnabled());
  expect(picker).toHaveTextContent("Default voice");
  expect(picker).toHaveAccessibleDescription(expect.stringContaining(help));
  fireEvent.click(picker);
  expect(within(screen.getByRole("dialog", { name: label })).queryByRole("button", { name: /sensor\.afterglow_morning_summary/ })).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("dialog", { name: label })).getByRole("button", { name: "Example voice · script.example_voice" }));
  await waitFor(() => expect(settings.settings.morningSummaryScript).toBe("home|stable-voice"));
  first.unmount(); render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: customize }));
  await waitFor(() => expect(screen.getByRole("button", { name: label })).toHaveTextContent("Example voice"));
  fireEvent.click(screen.getByRole("button", { name: label }));
  fireEvent.click(within(screen.getByRole("dialog", { name: label })).getByRole("button", { name: clear }));
  await waitFor(() => expect(settings.settings.morningSummaryScript).toBe(""));
  fireEvent.keyDown(screen.getByRole("dialog", { name: customize }), { key: "Escape" });
  expect(screen.getByText("Example summary.")).toBeVisible();
  expect(screen.queryByRole("button", { name: play })).not.toBeInTheDocument();
});

it.each([
  ["en", "Customize Today", "Playback switch (input_boolean)", "Clear selection", "Play is available only when this helper is on. Without a selection, playback is disabled."],
  ["nb", "Tilpass I dag", "Avspillingsbryter (input_boolean)", "Fjern valg", "Spill av er bare tilgjengelig når denne hjelperen er på. Uten et valg er avspilling deaktivert."],
] as const)("selects, persists and clears only an input_boolean for summary playback in %s", async (language, customize, label, clear, help) => {
  settings.settings.language = language;
  app.currentHome = mapHome({
    "input_boolean.example_playback": state("input_boolean.example_playback", "on", { friendly_name: "Example playback" }),
    "switch.example_playback": state("switch.example_playback", "on"),
    "sensor.example": state("sensor.example", "on"),
  }, { ...emptyRegistries, entities: [{ entity_id: "input_boolean.example_playback", id: "stable-playback" }] }, "home");
  const first = render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: customize }));
  const picker = screen.getByRole("button", { name: label });
  await waitFor(() => expect(picker).toBeEnabled());
  expect(picker).toHaveAccessibleDescription(expect.stringContaining(help));
  fireEvent.click(picker);
  const options = within(screen.getByRole("dialog", { name: label }));
  expect(options.queryByRole("button", { name: /switch\.example_playback/ })).not.toBeInTheDocument();
  expect(options.queryByRole("button", { name: /sensor\.example/ })).not.toBeInTheDocument();
  fireEvent.click(options.getByRole("button", { name: "Example playback · input_boolean.example_playback" }));
  await waitFor(() => expect(settings.settings.morningSummaryPlaybackEntity).toBe("home|stable-playback"));
  first.unmount(); render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: customize }));
  await waitFor(() => expect(screen.getByRole("button", { name: label })).toHaveTextContent("Example playback"));
  fireEvent.click(screen.getByRole("button", { name: label }));
  fireEvent.click(within(screen.getByRole("dialog", { name: label })).getByRole("button", { name: clear }));
  await waitFor(() => expect(settings.settings.morningSummaryPlaybackEntity).toBe(""));
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
  expect(await within(screen.getByRole("region", { name: "Next family plan" })).findByText("No more timed plans today or in the next 14 days.")).toBeVisible();
  first.unmount(); render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  expect(screen.getByRole("spinbutton", { name: "Days ahead" })).toHaveValue(14);
  fireEvent.change(screen.getByRole("combobox", { name: "Look ahead" }), { target: { value: "auto" } });
  fireEvent.click(screen.getByRole("switch", { name: "Show tomorrow’s plans" }));
  await waitFor(() => expect(settings.settings.dashboard.nextPlanDays).toBe("auto"));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(await within(screen.getByRole("region", { name: "Next family plan" })).findByText("No more timed plans today or tomorrow.")).toBeVisible();
});

it("saves list display choices, keeps them on reassignment and restores Add list when unlinked", async () => {
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example person" }), "person.other": state("person.other", "home", { friendly_name: "Other example" }), "todo.example": state("todo.example", "0", { friendly_name: "Example list" }) }, emptyRegistries, "home");
  settings.settings.todoLists = { "home|todo.example": { kind: "tasks", member: "home|person.example" } };
  window.history.replaceState(null, "", "/settings/lists");
  const first = render(<App />); await saved();
  fireEvent.click(screen.getByRole("link", { name: "Example person" }));
  const disclosure = screen.getByLabelText("Display settings for Tasks for Example person");
  fireEvent.click(disclosure);
  const options = within(disclosure.parentElement);
  expect(options.getByRole("combobox", { name: "Completed items" })).toHaveValue("collapsed");
  expect(options.getByRole("combobox", { name: "Sort order" })).toHaveValue("home-assistant");
  fireEvent.change(options.getByRole("combobox", { name: "Sort order" }), { target: { value: "due-date" } });
  expect(options.getByRole("option", { name: "Hide finished underneath" })).toHaveValue("collapsed");
  fireEvent.change(options.getByRole("combobox", { name: "Completed items" }), { target: { value: "collapsed" } });
  expect(options.getByRole("switch", { name: "Celebrate finishing the list" })).not.toBeChecked();
  for (const name of ["Show details", "Show due date", "Celebrate completion", "Celebrate finishing the list"]) fireEvent.click(options.getByRole("switch", { name }));
  await saved();
  const display = { completed: "collapsed", sort: "due-date", showDetails: false, showDueDate: false, celebrate: true, celebrateFinal: true };
  expect(settings.settings.todoLists["home|todo.example"].display).toEqual(display);
  fireEvent.click(screen.getByRole("link", { name: "Other example" }));
  chooseEntity("Tasks for Other example", "todo.example");
  fireEvent.click(screen.getByRole("button", { name: "Change list" }));
  await saved();
  expect(settings.settings.todoLists["home|todo.example"]).toMatchObject({ member: "home|person.other", display });
  fireEvent.click(screen.getByRole("link", { name: "Example person" }));
  expect(screen.getByRole("button", { name: "Tasks for Example person" })).toHaveTextContent("Add list");
  first.unmount(); render(<App />); await saved();
  fireEvent.click(screen.getByRole("link", { name: "Other example" }));
  fireEvent.click(screen.getByLabelText("Display settings for Tasks for Other example"));
  expect(screen.getByRole("combobox", { name: "Completed items" })).toHaveValue("collapsed");
  expect(screen.getByRole("combobox", { name: "Sort order" })).toHaveValue("due-date");
  expect(screen.getByRole("switch", { name: "Celebrate completion" })).toBeChecked();
  expect(screen.getByRole("switch", { name: "Celebrate finishing the list" })).toBeChecked();
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
  expect(day.getAllByRole("group").map(group => group.getAttribute("aria-label"))).toEqual(["Everyone", "Example B", "Example A"]);
  const person = within(day.getByRole("group", { name: "Example A" }));
  expect(person.getAllByRole("button").map(button => button.querySelector("strong")?.textContent)).toEqual(["Overnight example", "Early example", "Later example"]);
  expect(person.getByRole("button", { name: /Early example/ })).toHaveTextContent("00:15 – 00:25");
  expect(person.getByRole("button", { name: /Overnight example/ })).toHaveTextContent("Continues – 07:00");
  expect(person.getByRole("button", { name: /Later example/ })).toHaveTextContent("Example hall");
  for (const card of person.getAllByRole("button")) expect(card).not.toHaveTextContent("Example A");
  expect(day.queryByText("Previous day example")).not.toBeInTheDocument();
  expect(day.queryByText("Next day example")).not.toBeInTheDocument();
  expect(within(day.getByRole("group", { name: "Everyone" })).getByRole("button", { name: /Shared example/ })).toHaveTextContent("All day");
  expect(day.getAllByText("Shared example")).toHaveLength(1);
  const emptyToday = day.getByRole("group", { name: "Example B" });
  expect(within(emptyToday).getByRole("img", { name: "No plans today." })).toBeInTheDocument();
  expect(within(emptyToday).queryByRole("button")).not.toBeInTheDocument();
  expect(day.queryByRole("group", { name: "Example C" })).not.toBeInTheDocument();
  expect(app.watchCalendarEvents.mock.calls.map(([id]) => id).sort()).toEqual(["calendar.a", "calendar.b", "calendar.extra", "calendar.shared"]);
  expect(day.queryByRole("button", { name: /Refresh|Retry/ })).not.toBeInTheDocument();
  expect(day.queryByRole("link", { name: "Open calendar" })).not.toBeInTheDocument();
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
  expect(within(emptyTomorrow).queryByRole("button")).not.toBeInTheDocument();
  expect(within(day.getByRole("region", { name: "Tomorrow" })).queryByRole("group", { name: "Example C" })).not.toBeInTheDocument();
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
  expect(day.getAllByRole("heading", { name: "Example person" })).toHaveLength(1);
  expect(day.getAllByRole("heading", { name: "Everyone" })).toHaveLength(1);
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
  if (condition === "offline") {
    expect(day.getByText("Plans unavailable.")).toBeVisible();
    expect(day.queryByText("Free")).not.toBeInTheDocument();
    return;
  }
  for (const label of ["Today", "Tomorrow"]) {
    const person = within(day.getByRole("region", { name: label })).getByRole("group", { name: "Example person" });
    expect(person).toHaveTextContent(condition === "loading" ? "Loading plans…" : "Some calendars or to-do lists could not be loaded.");
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
  for (const [category, names] of [["School day view · Activities", ["Activities", "Invitations"]], ["School day view · Meetings", ["Invitations"]], ["School day view · Messages", ["Pedagogy"]], ["School day view · Closure days", ["Closures"]], ["School day view · Opening hours", ["Hours"]]] as const) {
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
  expect(within(within(preview).getByRole("region", { name: "Messages" })).getByText("Shared focus")).toBeVisible();
  expect(app.watchCalendarEvents.mock.calls.every(([id, , to]) => homeDate(new Date(to), app.currentHome.timeZone) === "2026-10-31"
    || id === "calendar.pedagogy" && homeDate(new Date(to), app.currentHome.timeZone) === "2027-10-25")).toBe(true);
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
  expect(within(within(selectedDay).getByRole("region", { name: "Messages" })).getByText("Shared focus")).toBeVisible();
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
  fireEvent.click(screen.getByRole("button", { name: "School day view · Messages calendars for Emma" }));
  const picker = screen.getByRole("dialog", { name: "School day view · Messages calendars for Emma" });
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
    expect(screen.getByRole("heading", { name: "Meldinger" })).toBeInTheDocument();
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
  expect(screen.getByRole("button", { name: "Kalendere i Dagsvisning på Skole · Meldinger for Example child" })).toHaveTextContent("Example nursery Example child Pedagogikk");
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

it("returns from an unknown address to Today through the app", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  window.history.replaceState(null, "", "/missing-page");
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
  expect(screen.queryByRole("navigation", { name: "Smart home navigation" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Smart home" })).not.toHaveAttribute("aria-current");
  fireEvent.click(screen.getByRole("link", { name: "Go to Today" }));
  expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
});

it.each(["/settings/activity", "/settings/integrations"])("offers connection settings when %s has no Home Assistant URL", async path => {
  app.haUrl = "";
  app.homeOnline = false;
  window.history.replaceState(null, "", path);
  render(<App />);
  expect(await screen.findByRole("link", { name: "Open connection settings" })).toHaveAttribute("href", "/settings/connection");
});

it("lists automations under Settings → System with the Home Assistant editor beside them", async () => {
  app.currentHome = mapHome({ "automation.example": state("automation.example", "on", { friendly_name: "Example automation" }) }, emptyRegistries, "home");
  window.history.replaceState(null, "", "/settings/automations");
  render(<App />); await saved();
  expect(await screen.findByRole("heading", { level: 1, name: "Automations" })).toBeInTheDocument();
  expect(screen.getByRole("article", { name: "Example automation" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Edit automations in Home Assistant/ })).toHaveAttribute("href", "http://ha.local:8123/config/automation/dashboard");
  expect(screen.getByRole("link", { name: "All settings" })).toHaveAttribute("href", "/settings?group=system");
  expect(screen.queryByRole("navigation", { name: "Smart home navigation" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Smart home" })).not.toHaveAttribute("aria-current");
});

it("offers one setup entry on Today and keeps guidance off the everyday boards", async () => {
  app.currentHome = mapHome({
    "person.example": state("person.example", "home"), "calendar.example": state("calendar.example", "off"),
    "todo.example": state("todo.example", "0"),
  }, emptyRegistries, "home");
  render(<App />); await saved();
  expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/onboarding");
  expect(screen.queryByText(/Set up calendars in this app/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Set up people and calendars" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Set up to-do lists" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Set up school timetables/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Get started" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Connect Home Assistant" })).toHaveFocus();
  expect(screen.getByText("Step 1 of 4")).toBeVisible();
  expect(screen.queryByRole("navigation", { name: "Smart home navigation" })).not.toBeInTheDocument();
  for (const [index, label] of ["Choose people", "Choose calendars", "Choose lists"].entries()) {
    fireEvent.click(within(screen.getByRole("navigation", { name: "Household setup" })).getByRole("link", { name: label }));
    expect(await screen.findByRole("heading", { level: 1, name: label })).toHaveFocus();
    expect(screen.getByText(`Step ${index + 2} of 4`)).toBeVisible();
    expect(window.location.pathname).toBe("/onboarding");
  }
  const shopping = within(screen.getByRole("region", { name: "Shopping lists" }));
  chooseEntity(shopping.getByRole("button", { name: "Add shopping list" }), "todo.example");
  await saved();
  expect(settings.settings.todoLists["home|todo.example"]).toMatchObject({ kind: "shopping", member: "everyone" });
  expect(window.location.search).toBe("?step=lists");
  fireEvent.click(screen.getByRole("link", { name: "Back" }));
  expect(screen.getByRole("heading", { level: 1, name: "Choose calendars" })).toHaveFocus();
  fireEvent.click(screen.getByRole("link", { name: "Choose lists" }));
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
])("keeps guided setup reachable from settings for configured households: %j", async configuration => {
  Object.assign(settings.settings, configuration);
  render(<App />); await saved();
  expect(screen.queryByRole("link", { name: "Get started" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Open app settings" }));
  fireEvent.click(await screen.findByRole("link", { name: /^(Continue setup|Guided setup)/ }));
  expect(window.location.pathname).toBe("/onboarding");
  expect(screen.getByRole("navigation", { name: "Household setup" })).toBeVisible();
});

it("guides setup from the gear and clears its badge when the basics are ready", async () => {
  app.currentHome = mapHome({
    "person.example": state("person.example", "home"), "calendar.example": state("calendar.example", "off"),
    "todo.example": state("todo.example", "0"),
  }, emptyRegistries, "home");
  settings.settings.todoLists = { "home|todo.example": { kind: "shopping", member: "everyone" } };
  render(<App />); await saved();
  const gear = screen.getByRole("link", { name: "Open app settings" });
  expect(gear).toHaveAccessibleDescription("One setup step remaining");
  fireEvent.click(gear);
  const resume = await screen.findByRole("link", { name: /Continue setup/ });
  expect(resume).toHaveAttribute("href", "/onboarding?step=calendars");
  fireEvent.click(resume);
  expect(await screen.findByRole("heading", { level: 1, name: "Choose calendars" })).toHaveFocus();
  const picker = within(screen.getByRole("group", { name: "Example" })).getByRole("button", { name: /Add calendar/ });
  chooseEntity(picker, "calendar.example");
  await waitFor(() => expect(gear.querySelector(".header-badge")).toBeNull());
});

it("withholds calendar and list setup prompts while their registry IDs are unavailable", async () => {
  app.entityRegistryAvailable = false;
  render(<App />); await saved();
  const gear = screen.getByRole("link", { name: "Open app settings" });
  expect(gear.querySelector(".header-badge")).toBeNull();
});

it.each(["reconnecting", "auth-error"])("only points to connection setup when actionable during %s", async status => {
  app.homeOnline = false;
  app.connectionStatus = status;
  render(<App />); await saved();
  const gear = screen.getByRole("link", { name: "Open app settings" });
  expect(!!gear.querySelector(".header-badge")).toBe(status === "auth-error");
  fireEvent.click(gear);
  await pageReady();
  expect(!!screen.queryByRole("link", { name: /Continue setup/ })).toBe(status === "auth-error");
});

it("keeps onboarding available without a Home Assistant connection", async () => {
  app.haUrl = "";
  app.homeOnline = false;
  window.history.replaceState(null, "", "/onboarding");
  render(<App />); await saved();
  expect(screen.getByRole("button", { name: "Reconnect" })).toBeVisible();
  expect(screen.getByText(/Set your Home Assistant address and token/)).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Your instance" })).toBeNull();
  expect(screen.getByRole("link", { name: "All settings" })).toHaveAttribute("href", "/settings");
});

it.each([
  { kind: "tasks" as const, member: "home|person.hidden", complete: false },
  { kind: "tasks" as const, member: "home|person.visible", complete: true },
  { kind: "shopping" as const, member: "everyone", complete: true },
])("counts only visible lists toward setup: $kind / $member", async ({ kind, member, complete }) => {
  settings.settings.hiddenMembers = ["home|person.hidden"];
  settings.settings.todoLists = { "home|todo.example": { kind, member } };
  app.currentHome = mapHome({
    "person.visible": state("person.visible", "home", { friendly_name: "Example person" }),
    "person.hidden": state("person.hidden", "home", { friendly_name: "Hidden example person" }),
    "todo.example": state("todo.example", "0", { friendly_name: "Example list" }),
  }, emptyRegistries, "home");
  window.history.replaceState(null, "", "/settings");
  render(<App />); await saved();
  const gear = screen.getByRole("link", { name: "Open app settings" });
  expect(gear).toHaveAccessibleDescription(complete ? "One setup step remaining" : "2 setup steps remaining");
});

it("navigates with empty HA data and shows the server-managed connection", async () => {
  app.currentHome = mapHome({}, emptyRegistries, "home");
  render(<App />); await saved();
  expect(screen.getByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
  expect(screen.getByRole("contentinfo")).toHaveTextContent("Version 9.8.7");
  await navigate("Smart home");
  fireEvent.click(screen.getByRole("button", { name: "Smart home settings" }));
  fireEvent.click(screen.getByRole("link", { name: "Connection & settings" }));
  expect(await screen.findByRole("button", { name: "Reconnect" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Home Assistant URL")).not.toBeInTheDocument();
  await navigate("Smart home");
  for (const [link, heading] of [["Devices", "Devices"], ["Cameras", "Cameras"], ["Areas", "Areas"], ["Zones", "Zones"], ["Security", "Alarm"], ["Scenes", "Scenes"]]) {
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

it("keeps Home Assistant admin pages out of Smart home navigation and keeps Add card visible", async () => {
  app.currentHome = cardEditorHome();
  settings.settings.smartHome.layout = [configuredCard("home|light.example")];
  window.history.replaceState(null, "", "/home");
  render(<App />); await saved();
  expect(screen.getByRole("link", { name: "Add card" })).toHaveAttribute("href", "/settings/smart-home?card=new");
  const nav = within(screen.getByRole("navigation", { name: "Smart home navigation" }));
  fireEvent.keyDown(nav.getByRole("button", { name: "More controls" }), { key: "Enter" });
  const menu = within(await screen.findByRole("menu"));
  expect(menu.getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Car & energy", "Zones", "Alerts", "Home settings"]);
  for (const name of [/Automations/, /Activity/, /Integrations/]) {
    expect(menu.queryByRole("menuitem", { name })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name })).not.toBeInTheDocument();
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
  const opener = within(carousel).getByRole("button", { name: "Enlarge Emma’s timetable, page 2 of 2" });
  act(() => opener.focus());
  fireEvent.click(opener);
  const dialog = within(screen.getByRole("dialog", { name: "Emma’s school week" }));
  expect(dialog.getByRole("img", { name: "Emma’s school timetable, page 2 of 2" })).toHaveAttribute("src", "/second.svg");
  fireEvent.click(dialog.getByRole("button", { name: "Previous timetable page" }));
  expect(dialog.getByRole("img", { name: "Emma’s school timetable, page 1 of 2" })).toHaveAttribute("src", "/first.svg");
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(opener).toHaveFocus());
});

it("retains each person's timetable draft while navigating between settings panels", async () => {
  settings.settings.timetableEnabled = { "home|person.emma": true, "home|person.leo": true };
  window.history.replaceState(null, "", "/settings/timetables?from=setup&panel=missing#school");
  render(<App />); await saved();
  const menu = within(screen.getByRole("navigation", { name: "Settings sections" }));
  expect(menu.getByRole("link", { name: "Emma" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("button", { name: "Add timetable images" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Emma timetable image URLs" }), { target: { value: "https://school.example/draft.png" } });
  fireEvent.click(menu.getByRole("link", { name: "Leo" }));
  expect(screen.queryByRole("textbox", { name: "Emma timetable image URLs" })).toBeNull();
  expect(new URLSearchParams(window.location.search).get("panel")).toBe("home|person.leo");
  expect(new URLSearchParams(window.location.search).get("from")).toBe("setup");
  expect(window.location.hash).toBe("#school");
  fireEvent.click(menu.getByRole("link", { name: "Emma" }));
  expect(screen.getByRole("textbox", { name: "Emma timetable image URLs" })).toHaveValue("https://school.example/draft.png");
  expect(settings.settings.timetables["home|person.emma"]).toBeUndefined();
});

it("offers the signed iOS shortcut and copies each person's upload destination", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", Object.create(navigator, { clipboard: { value: { writeText } } }));
  const success = vi.spyOn(toast, "success").mockImplementation(() => "copied");
  settings.settings.timetableEnabled = { "home|person.emma": true, "home|person.leo": true };
  window.history.replaceState(null, "", "/settings/timetables");
  render(<App />); await saved();
  for (const name of ["Emma", "Leo"]) {
    fireEvent.click(screen.getByRole("link", { name }));
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
  fireEvent.click(screen.getByRole("link", { name: "Advanced appearance" }));
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
  fireEvent.click(screen.getByRole("link", { name: "Advanced appearance" }));
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
  fireEvent.click(screen.getByRole("link", { name: "All settings" }));
  fireEvent.click(within(await screen.findByRole("navigation", { name: "Settings navigation" })).getByRole("link", { name: "People" }));
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
  expect(screen.getByRole("link", { name: "Alle innstillinger" })).toHaveAttribute("href", "/settings?group=screen");
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
  expect(screen.getByRole("heading", { name: "Home Assistant-tilkobling" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Din installasjon" })).toBeVisible();
  expect(screen.queryByRole("navigation", { name: "Innstillingsgrupper" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Innstillingsgruppe" })).toBeNull();
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

it("opens categorized home status and counts both a room alert and a missing reading", async () => {
  settings.settings.dashboard.statusSources = ["home|binary_sensor.example_smoke", "home|sensor.removed"];
  app.currentHome = mapHome({
    "binary_sensor.example_smoke": state("binary_sensor.example_smoke", "on", { friendly_name: "Example detector", device_class: "smoke" }),
    "binary_sensor.example_leak": state("binary_sensor.example_leak", "off", { friendly_name: "Example leak sensor", device_class: "moisture" }),
    "climate.example_car": state("climate.example_car", "heat", { friendly_name: "Example car", current_temperature: 30 }),
  }, { ...emptyRegistries, areas: [{ area_id: "entry", name: "Example entry" }], entities: [{ id: "binary_sensor.example_smoke", entity_id: "binary_sensor.example_smoke", area_id: "entry" }] }, "home");
  render(<App />); await saved();
  const trigger = screen.getByRole("button", { name: "Home status · 2 issues" });
  expect(trigger.querySelector(":scope > .lucide-house")).toBeInTheDocument();
  expect(trigger.querySelector(".header-badge .lucide-triangle-alert")).toBeInTheDocument();
  expect(trigger.querySelector(".header-badge")).toHaveTextContent("2");
  expect(screen.queryByRole("button", { name: /Example detector/ })).toBeNull();
  fireEvent.click(trigger);
  const modal = screen.getByRole("dialog", { name: "Home status" });
  const status = within(modal);
  expect(status.getByRole("link", { name: /Example detector.*Example entry.*Smoke detected/ })).toBeVisible();
  expect(status.getByText("No reading")).toBeVisible();
  expect(status.queryByText(/Example car/)).toBeNull();
  expect(status.queryByRole("button", { name: /Water and leaks/ })).toBeNull();
  fireEvent.click(status.getByRole("button", { name: "View readings" }));
  expect(status.getByRole("heading", { name: "Readings" })).toHaveFocus();
  expect(status.getByRole("heading", { name: "Fire and gas" })).toBeVisible();
  fireEvent.click(status.getByRole("button", { name: "Back" }));
  expect(status.getByRole("button", { name: "View readings" })).toHaveFocus();
  fireEvent.click(status.getByRole("button", { name: "Manage sources" }));
  const water = status.getByRole("button", { name: /Water and leaks/ });
  fireEvent.click(water);
  expect(status.getByRole("heading", { name: "Water and leaks" })).toHaveFocus();
  fireEvent.click(status.getByRole("button", { name: "Choose sources for Water and leaks" }));
  const picker = screen.getByRole("dialog", { name: "Choose sources for Water and leaks" });
  fireEvent.click(within(picker).getByRole("checkbox", { name: "Example leak sensor" }));
  fireEvent.click(within(picker).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(settings.settings.dashboard.statusSources).toEqual(["home|binary_sensor.example_smoke", "home|sensor.removed", "home|binary_sensor.example_leak"]));
  fireEvent.click(status.getByRole("button", { name: "Back" }));
  expect(status.getByRole("button", { name: /Water and leaks/ })).toHaveFocus();
  fireEvent.keyDown(modal, { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "Customize Today" }));
  fireEvent.click(screen.getByRole("switch", { name: "Home status" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await saved();
  const card = screen.getByRole("button", { name: /Home status · 2 issues.*Example detector/ });
  fireEvent.click(card);
  expect(screen.getByRole("dialog", { name: "Home status" })).toBeVisible();
});

it("puts an active smoke alarm ahead of maintenance issues in the short overview", async () => {
  const batteries = Array.from({ length: 3 }, (_, i) => "binary_sensor.test_battery_" + i);
  const smoke = "binary_sensor.test_smoke";
  settings.settings.dashboard.statusSources = [...batteries, smoke].map(id => "home|" + id);
  app.currentHome = mapHome(Object.fromEntries([...batteries, smoke].map(id => [id, state(id, "on", {
    device_class: id === smoke ? "smoke" : "battery", friendly_name: id === smoke ? "Test smoke alarm" : "Test battery",
  })])), emptyRegistries, "home");
  render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Home status · 4 issues" }));
  const modal = within(screen.getByRole("dialog"));
  expect(modal.getAllByRole("listitem")[0]).toHaveTextContent("Test smoke alarm");
  expect(modal.getByText("More issues (1)")).toBeVisible();
});

it("updates the home illustration as readings and connectivity change in an open dialog", async () => {
  const id = "binary_sensor.example_water";
  settings.settings.dashboard.statusSources = ["home|" + id];
  const report = (value: string, deviceClass = "moisture") => {
    app.currentHome = mapHome({ [id]: state(id, value, { device_class: deviceClass }) }, emptyRegistries, "home");
  };
  report("off");
  const view = render(<App />); await saved();
  const healthy = screen.getByRole("button", { name: "Home status · No issues reported" });
  expect(healthy.querySelector(".header-badge")).toBeNull();
  fireEvent.click(healthy);
  const scene = screen.getByRole("dialog").querySelector(".housing-scene");
  const expectScene = (name: string) => expect(scene.querySelector("use").getAttribute("href")).toMatch(new RegExp("#" + name + "$"));
  expect(scene).toHaveAttribute("aria-hidden", "true");
  expectScene("healthy");
  report("on"); view.rerender(<App />); expectScene("leak");
  report("on", "smoke"); view.rerender(<App />); expectScene("alarm");
  report("on", "battery"); view.rerender(<App />); expectScene("battery");
  report("on", "problem"); view.rerender(<App />); expectScene("attention");
  report("unavailable"); view.rerender(<App />); expectScene("missing");
  app.homeOnline = false;
  app.connectionStatus = "syncing"; view.rerender(<App />); expectScene("loading");
  app.connectionStatus = "disconnected"; view.rerender(<App />); expectScene("offline");
});

it("distinguishes offline plans and security from successful empty reads", async () => {
  settings.settings.smartHome.layout = [configuredCard("home|missing")];
  app.homeOnline = false;
  app.connectionStatus = "disconnected";
  const view = render(<App />); await saved();
  const header = within(screen.getByRole("link", { name: "Afterglow home" }).closest("header")!);
  expect(header.queryByText("HA offline")).toBeNull();
  const warning = screen.getByText(/Readings are stale; controls are paused/);
  expect(within(warning).getByRole("link", { name: "Connection settings" })).toHaveAttribute("href", "/settings/connection");
  expect(screen.getByRole("region", { name: "Next family plan" })).toHaveTextContent("Plans unavailable.");
  expect(screen.queryByRole("button", { name: "Add a family plan" })).not.toBeInTheDocument();
  await navigate("Smart home");
  expect(screen.queryByText("No visible alarm")).not.toBeInTheDocument();
  expect(header.getByRole("button", { name: "Home status · Home status unavailable" })).toBeVisible();
  app.homeOnline = true;
  app.connectionStatus = "connected";
  view.rerender(<App />);
  expect(screen.queryByText(/Readings are stale/)).toBeNull();
  expect(header.queryByText("Home Assistant")).toBeNull();
});


it.each([
  ["/devices", "Device settings", "Manage devices in Home Assistant", "/config/devices/dashboard"],
  ["/areas", "Area settings", "Manage areas in Home Assistant", "/config/areas/dashboard"],
  ["/zones", "Zone settings", "Manage zones in Home Assistant", "/config/zone"],
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

it.each([true, false])("previews every saved rule only on Today with notifications enabled=%s", async enabled => {
  app.currentHome = mapHome({ "sensor.example": state("sensor.example", "running") }, emptyRegistries, "home");
  settings.settings.notifications.enabled = enabled;
  settings.settings.notifications.rules = Array.from({ length: 5 }, (_, i) => notificationRuleSchema.parse({
    id: `rule-${i}`, title: `Example alert ${i}`, kind: "current", enabled: i !== 4,
    trigger: i === 4 ? { type: "calendar", entity: "home|calendar.example", leadMinutes: 30 }
      : { type: "state", entity: "home|sensor.example", operator: "eq", value: i === 0 ? "running" : "idle" },
  }));
  window.history.replaceState(null, "", "/settings/debug");
  render(<App />);
  await saved();
  const toggle = () => screen.getByRole("switch", { name: "Show all notifications" });
  expect(toggle()).not.toBeChecked();
  app.configurationRequest.mockClear();
  fireEvent.click(toggle());
  fireEvent.click(screen.getByRole("link", { name: "Go to Today" }));
  const preview = within(await screen.findByRole("region", { name: "Notification preview" }));
  expect(preview.getAllByRole("listitem")).toHaveLength(5);
  fireEvent.click(preview.getByRole("button", { name: "Show details for Example alert 4" }));
  const dialog = screen.getByRole("dialog", { name: "Example alert 4" });
  expect(within(dialog).getByText(/Starts at/)).toBeVisible();
  expect(within(dialog).getByRole("button", { name: "Dismiss notification" })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.getByRole("link", { name: enabled ? "Notifications: 1 active" : "Notifications" })).toBeVisible();

  await navigate("Calendar");
  expect(screen.queryByRole("region", { name: "Notification preview" })).toBeNull();
  expect(screen.queryByText("Example alert 4")).toBeNull();
  await navigate("Today");
  fireEvent.click(screen.getByRole("link", { name: "Previewing all notifications" }));
  expect(toggle()).toBeChecked();
  fireEvent.click(toggle());
  await navigate("Today");
  expect(screen.queryByRole("region", { name: "Notification preview" })).toBeNull();
  expect(screen.queryAllByRole("button", { name: /Show details for Example alert/ })).toHaveLength(enabled ? 1 : 0);
  expect(app.configurationRequest.mock.calls.some(([method]) => method === "PUT")).toBe(false);
});

it("groups all settings, opens each focused subpage, and returns to the hub", async () => {
  window.history.replaceState(null, "", "/settings");
  render(<App />); await saved();
  const categories = [
    ["Household", [["People", "people"], ["Calendars", "calendars"], ["To-do lists", "lists"], ["Timetables", "timetables"]]],
    ["Screen and alerts", [["Appearance", "appearance"], ["Language", "language"], ["Weather", "weather"], ["Notifications", "notifications"]]],
    ["Devices", [["Smart home", "smart-home"], ["Electric vehicles", "vehicles"], ["Cameras", "cameras"], ["Camera connections", "camera-connections"]]],
    ["System", [["Connection & account", "connection"], ["Automations", "automations"], ["Integrations", "integrations"], ["Activity", "activity"], ["Storage and backups", "backups"], ["Debug", "debug"], ["Danger zone", "danger-zone"]]],
  ] as const;
  const menu = () => within(screen.getByRole("navigation", { name: "Settings navigation" }));
  expect(menu().getAllByRole("button")).toHaveLength(4);
  expect(menu().queryAllByRole("link")).toHaveLength(0);
  for (const [category, destinations] of categories) {
    fireEvent.click(menu().getByRole("button", { name: new RegExp(`^${category}`) }));
    for (const [title, path] of destinations) {
      expect(menu().getAllByRole("link")).toHaveLength(destinations.length);
      fireEvent.click(menu().getByRole("link", { name: title }));
      expect(await screen.findByRole("heading", { name: title, level: 1 })).toHaveFocus();
      expect(window.location.pathname).toBe(`/settings/${path}`);
      expect(screen.queryByRole("navigation", { name: "Settings navigation" })).toBeNull();
      if (path === "appearance") {
        for (const name of ["Color palette", "Artwork"]) {
          const link = screen.getByRole("link", { name });
          expect(screen.queryByRole("radiogroup", { name })).toBeNull();
          fireEvent.click(link);
          expect(link).toHaveAttribute("aria-current", "page");
          expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
          expect(within(screen.getByRole("radiogroup", { name })).getAllByRole("radio")).toHaveLength(12);
        }
      }
      if (path === "backups") expect(screen.getByRole("button", { name: "Import configuration" })).toBeEnabled();
      fireEvent.click(screen.getByRole("link", { name: "All settings" }));
      expect(await screen.findByRole("heading", { name: "Settings", level: 1 })).toHaveFocus();
      expect(menu().getByRole("button", { name: new RegExp(`^${category}`) })).toHaveAttribute("aria-expanded", "true");
    }
  }
});

it.each([
  ["/user-settings", "appearance", "Appearance"],
  ["/settings#connection", "connection", "Connection & account"],
  ["/settings#notifications", "notifications", "Notifications"],
  ["/settings#smart-home-visibility", "smart-home", "Smart home"],
  ["/settings/smart-home?panel=reset", "danger-zone", "Danger zone"],
  ["/settings#people-order", "people", "People"],
  ["/settings#family-calendar", "calendars", "Calendars"],
  ["/settings#family-lists", "lists", "To-do lists"],
  ["/settings#timetables", "timetables", "Timetables"],
  ["/automations", "automations", "Automations"],
  ["/automation", "automations", "Automations"],
  ["/integrations", "integrations", "Integrations"],
  ["/services", "integrations", "Integrations"],
  ["/history", "activity", "Activity"],
])("preserves the old settings bookmark %s", async (legacy, path, title) => {
  window.history.replaceState(null, "", legacy);
  const replace = vi.spyOn(window.history, "replaceState");
  render(<App />); await saved();
  expect(await screen.findByRole("heading", { name: title, level: 1 })).toBeInTheDocument();
  expect(window.location.pathname).toBe(`/settings/${path}`);
  expect(window.location.hash).toBe("");
  // One redirect straight to the final section, without passing through another old route.
  expect(replace.mock.calls.filter(call => call[2] !== undefined).map(call => new URL(String(call[2]), window.location.origin).pathname)).toEqual([`/settings/${path}`]);
  expect(screen.queryByRole("navigation", { name: "Smart home navigation" })).not.toBeInTheDocument();
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
  expect(screen.queryByRole("navigation", { name: "Settings sections" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Clear Smart home" })).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "All settings" }));
  fireEvent.click(screen.getByRole("button", { name: /^System/ }));
  fireEvent.click(screen.getByRole("link", { name: "Danger zone" }));
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
  expect(screen.queryByRole("navigation", { name: "Settings sections" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Clear Smart home" })).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "All settings" }));
  fireEvent.click(screen.getByRole("button", { name: /^System/ }));
  fireEvent.click(screen.getByRole("link", { name: "Danger zone" }));
  expect(screen.getByRole("button", { name: "Clear Smart home" })).toBeDisabled();
  fireEvent.click(screen.getByRole("link", { name: "All settings" }));
  const menu = within(screen.getByRole("navigation", { name: "Settings navigation" }));
  fireEvent.click(menu.getByRole("button", { name: /^Devices/ }));
  fireEvent.click(menu.getByRole("link", { name: "Smart home" }));
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

it.each(["month", "week", "day"])("includes assigned dated tasks in the %s calendar and opens their list details", async mode => {
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Example person" }),
    "person.other": state("person.other", "home", { friendly_name: "Other person" }),
    "todo.example": state("todo.example", "2"),
    "todo.other": state("todo.other", "1"),
  }, emptyRegistries, "home");
  settings.settings.todoLists = {
    "home|todo.example": { kind: "tasks", member: "home|person.example" },
    "home|todo.other": { kind: "homework", member: "home|person.other" },
  };
  app.todoItems.mockImplementation(async id => id === "todo.example" ? [
    { uid: "date", summary: "Example deadline", status: "needs_action", due: "2026-10-29", description: "Example task details" },
    { uid: "timed", summary: "Timed deadline", status: "needs_action", due: "2026-10-29T12:00:00Z" },
    { uid: "done", summary: "Finished task", status: "completed", due: "2026-10-29" },
    { uid: "undated", summary: "Undated task", status: "needs_action" },
  ] : [{ uid: "other", summary: "Other homework", status: "needs_action", due: "2026-10-29" }]);
  window.history.replaceState(null, "", `/calendar?view=${mode}&date=2026-10-29`);
  render(<App />);
  const task = await screen.findByRole("button", { name: /Example deadline/ });
  expect(task).toHaveAccessibleName(/Task/);
  if (mode !== "month") expect(within(task).getByRole("img", { name: "Task" })).toBeVisible();
  expect(screen.getByRole("button", { name: /Timed deadline/ })).toHaveTextContent("13:00");
  expect(screen.queryByText("No calendars or to-do lists selected")).not.toBeInTheDocument();
  expect(screen.queryByText("Finished task")).not.toBeInTheDocument();
  expect(screen.queryByText("Undated task")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Other homework/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Example person" }));
  expect(screen.queryByRole("button", { name: /Other homework/ })).not.toBeInTheDocument();
  if (mode === "week") {
    fireEvent.click(screen.getByRole("button", { name: "Calendar settings" }));
    fireEvent.click(screen.getByRole("button", { name: "By person" }));
    expect(screen.getByRole("button", { name: /Example deadline/ })).toBeVisible();
  }
  fireEvent.click(screen.getByRole("button", { name: /Example deadline/ }));
  const details = within(screen.getByRole("dialog", { name: "Example deadline" }));
  expect(details.getByText("Example task details")).toBeVisible();
  expect(details.getByRole("link", { name: "Open to-do list" })).toHaveAttribute("href", "/lists?tab=tasks&list=home%7Ctodo.example");
  expect(details.queryByRole("button", { name: /Save|Delete/ })).not.toBeInTheDocument();
  expect(settings.settings).not.toHaveProperty("events");
});

it("marks tasks in Today's person columns without repeating their owner's name", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T10:00:00Z"));
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Example person" }),
    "todo.example": state("todo.example", "1"),
    "calendar.example": state("calendar.example", "off"),
  }, emptyRegistries, "home");
  settings.settings.todoLists = { "home|todo.example": { kind: "tasks", member: "home|person.example" } };
  settings.settings.calendarMembers = { "home|calendar.example": "home|person.example" };
  app.todoItems.mockResolvedValue([{ uid: "task", summary: "Example deadline", status: "needs_action", due: "2026-10-29" }]);
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([
    { summary: "Example appointment", start: "2026-10-29T14:00:00Z", end: "2026-10-29T15:00:00Z", location: "Example hall" },
  ]));
  render(<App />);
  const day = within(await screen.findByRole("region", { name: "Everyone’s day" }));
  const person = within(day.getByRole("group", { name: "Example person" }));
  expect(day.getByRole("heading", { name: "Example person" })).toBeInTheDocument();
  const task = await person.findByRole("button", { name: /Example deadline/ });
  expect(within(task).getByRole("img", { name: "Task" })).toBeVisible();
  const appointment = person.getByRole("button", { name: /Example appointment/ });
  expect(within(appointment).queryByRole("img", { name: "Task" })).not.toBeInTheDocument();
  expect(appointment).toHaveTextContent("Example hall");
  for (const card of person.getAllByRole("button")) expect(card).not.toHaveTextContent("Example person");
});

it("uses TeslaMate readings and sends commands only to the explicitly paired Tesla vehicle", async () => {
  app.command.mockReset().mockResolvedValue(undefined);
  app.services = { climate: { set_hvac_mode: { fields: {} }, set_temperature: { fields: {} } } };
  const device = { id: "example-car", name: "Example car", model: "Model 3" };
  const commands = { id: "command-car", name: "Example command vehicle", model: "Model 3" };
  const readings = [
    ["sensor.example_level", "battery_level", "64", { device_class: "battery", unit_of_measurement: "%" }],
    ["sensor.renamed_range", "rated_battery_range", "283", { unit_of_measurement: "km" }],
    ["binary_sensor.example_plug", "plugged_in", "on", { device_class: "plug" }],
    ["binary_sensor.example_brake", "park_brake", "on", {}],
    ["sensor.example_state", "state", "online", {}],
    ["binary_sensor.example_fan", "is_climate_on", "on", { device_class: "running" }],
    ["sensor.example_temp", "inside_temp", "18", { unit_of_measurement: "°C" }],
    ["binary_sensor.example_lock", "locked", "off", { device_class: "lock" }],
  ] as const;
  const states = readings.map(([id, , value, attrs]) => state(id, value, attrs));
  const entries = readings.map(([id, metric]) => ({
    id, entity_id: id, unique_id: `teslamate_demo_2_1_${metric}`, device_id: device.id, platform: "mqtt",
  }));
  app.currentHome = mapHome({
    ...Object.fromEntries(states.map(s => [s.entity_id, s])),
    "climate.example_hvac": state("climate.example_hvac", "off", { hvac_modes: ["off", "heat_cool"] }),
    "climate.example_target": state("climate.example_target", "off", { hvac_modes: ["off", "heat_cool"], supported_features: 1, current_temperature: 30, temperature: 20, min_temp: 15, max_temp: 28 }),
  }, { ...emptyRegistries, devices: [device, commands], entities: [
    ...entries, { id: "native", entity_id: "climate.example_hvac", device_id: device.id, platform: "tesla_fleet" },
    { id: "paired", entity_id: "climate.example_target", device_id: commands.id, platform: "tesla_fleet" },
  ] }, "home");
  settings.settings.vehicles = [{ id: device.id, name: device.name }];
  window.history.replaceState(null, "", "/settings/vehicles");
  const view = render(<App />);
  const native = await screen.findByRole("article", { name: "Example car" });
  expect(native).toHaveTextContent("Tesla Fleet");
  fireEvent.click(screen.getByRole("button", { name: "Add electric vehicle" }));
  const sources = within(screen.getByRole("dialog", { name: "Add electric vehicle" }));
  expect(sources.queryByRole("button", { name: /Example car/ })).toBeNull();
  expect(sources.getByRole("button", { name: /Example command vehicle/ })).toBeEnabled();
  fireEvent.click(sources.getByRole("button", { name: "Close" }));
  fireEvent.click(within(native).getByRole("button", { name: "Edit Example car" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove vehicle" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove vehicle" }));
  fireEvent.click(screen.getByRole("button", { name: "Add electric vehicle" }));
  fireEvent.click(screen.getByRole("button", { name: /Example car.*TeslaMate/ }));
  await waitFor(() => expect(settings.settings.vehicles.map(car => car.id)).toEqual(["teslamate:example-car"]));
  const widget = screen.getByRole("button", { name: /Example car.*64%.*283 km.*Plugged in.*Parked.*Climate on/ });
  fireEvent.click(widget);
  const dialog = screen.getByRole("dialog", { name: "Example car" });
  const scene = within(dialog.querySelector<HTMLElement>(".vehicle-scene"));
  const vehicleState = app.currentHome.entities.find(e => e.entityId === "sensor.example_state");
  expect(scene.getByText("Parked")).toBeVisible();
  for (const [state, label] of [["driving", "Driving"], ["asleep", "Asleep"], ["offline", "Offline"], ["online", "Parked"]]) {
    vehicleState.state = state;
    view.rerender(<App />);
    expect(widget).toHaveAccessibleName(expect.stringContaining(label));
    expect(scene.getByText(label)).toBeVisible();
    if (state === "asleep" || state === "offline") {
      expect(widget.querySelector(".vehicle-glance-climate")).toBeNull();
      expect(widget.querySelector(".vehicle-charge-symbol")).toBeNull();
      expect(widget).toHaveTextContent("64%");
    }
  }
  expect(widget.querySelector(".vehicle-glance-climate")).toBeInTheDocument();
  expect(app.command).not.toHaveBeenCalled();
  expect(within(dialog).getByText("Climate on · 18 °C")).toBeVisible();
  expect(within(dialog).getByText("Locked")).toBeVisible();
  expect(within(dialog).queryByRole("switch", { name: "Cabin climate" })).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit Example car" }));
  const picker = screen.getByRole("combobox", { name: "Send commands for Example car through" });
  expect(picker).toHaveValue("");
  fireEvent.change(picker, { target: { value: commands.id } });
  await waitFor(() => expect(settings.settings.vehicles[0].commandVehicleId).toBe(commands.id));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Edit Example car" })).getByRole("button", { name: "Close" }));
  expect(screen.getAllByRole("button", { name: /^Open status for/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: /Example car.*64%.*Climate on/ }));
  const paired = screen.getByRole("dialog", { name: "Example car" });
  expect(within(paired).getByText("Climate on · 18 °C")).toBeVisible();
  const toggle = within(paired).getByRole("switch", { name: "Cabin climate" });
  expect(toggle).toBeChecked();
  fireEvent.click(toggle);
  const confirm = await screen.findByRole("alertdialog");
  expect(app.command).not.toHaveBeenCalled();
  fireEvent.click(within(confirm).getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(confirm).not.toBeInTheDocument());
  expect(app.command).toHaveBeenCalledWith("climate.example_target", "hvac_mode", "off", undefined, expect.any(Function));
  expect(toggle).toBeChecked();
  fireEvent.keyDown(within(paired).getByRole("slider"), { key: "ArrowRight" });
  expect(app.command).toHaveBeenCalledWith("climate.example_target", "temperature", 20.5, undefined, expect.any(Function));

  const home = app.currentHome;
  app.currentHome = { ...home, entities: home.entities.filter(e => e.integration !== "mqtt") };
  view.rerender(<App />);
  expect(within(paired).getByText("TeslaMate readings unavailable")).toBeVisible();
  expect(within(paired).getByRole("slider")).toBeEnabled();
  expect(within(paired).getByRole("combobox")).toHaveValue("");

  app.currentHome = { ...home, entities: home.entities.filter(e => e.device.id !== commands.id) };
  view.rerender(<App />);
  expect(within(paired).getByText("Climate on · 18 °C")).toBeVisible();
  expect(within(paired).getByText("Climate control unavailable")).toBeVisible();
  expect(within(paired).queryByRole("switch", { name: "Cabin climate" })).toBeNull();
  fireEvent.click(within(paired).getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit Example car" }));
  const savedPicker = screen.getByRole("combobox", { name: "Send commands for Example car through" });
  expect(savedPicker).toHaveValue(commands.id);
  fireEvent.change(savedPicker, { target: { value: "" } });
  await waitFor(() => expect(settings.settings.vehicles[0].commandVehicleId).toBeUndefined());
});

it("saves Tesla vehicles by device, opens their separate live status and hides stale telemetry offline", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-04-09T07:00:00Z"));
  app.command.mockReset().mockResolvedValue(undefined);
  app.services = { climate: { set_hvac_mode: { fields: {} }, set_temperature: { fields: {} } } };
  const devices = [
    { id: "demo-a", name: "Example One", model: "Model 3" },
    { id: "demo-b", name: "Example Two", model: "Model Y" },
    { id: "demo-site", name: "Example storage", model: "Powerwall" },
  ];
  const entries = [
    { entity_id: "sensor.example_front", device_id: "demo-a", original_name: "Tpms front left" },
    { entity_id: "sensor.example_gear", device_id: "demo-a", original_name: "Shift state" },
    { entity_id: "sensor.example_speed", device_id: "demo-a", translation_key: "drive_state_speed" },
    { entity_id: "climate.example_cabin", device_id: "demo-a", original_name: "Hvac (climate) system" },
    { entity_id: "lock.example_doors", device_id: "demo-a", original_name: "Doors" },
    { entity_id: "device_tracker.example_destination", device_id: "demo-a", original_name: "Destination location tracker" },
    { entity_id: "device_tracker.example_location", device_id: "demo-a", original_name: "Location tracker" },
    { entity_id: "sensor.example_arrival", device_id: "demo-a", original_name: "Arrival time" },
    { entity_id: "sensor.demo_a_cell", device_id: "demo-a", translation_key: "charge_state_battery_level" },
    { entity_id: "sensor.renamed_distance", device_id: "demo-a", translation_key: "charge_state_battery_range" },
    { entity_id: "number.demo_a_target", device_id: "demo-a", original_name: "Charge limit" },
    { entity_id: "sensor.demo_a_finish", device_id: "demo-a", original_name: "Time charge complete" },
    { entity_id: "sensor.demo_a_power", device_id: "demo-a", original_name: "Charger power" },
    { entity_id: "sensor.demo_a_odometer", device_id: "demo-a", translation_key: "vehicle_state_odometer" },
    { entity_id: "sensor.demo_a_charging", device_id: "demo-a", translation_key: "charge_state_charging_state" },
    { entity_id: "binary_sensor.demo_a_door", device_id: "demo-a", translation_key: "vehicle_state_driver_door" },
    { entity_id: "sensor.demo_b_cell", device_id: "demo-b", original_name: "Battery" },
    { entity_id: "binary_sensor.demo_b_plug", device_id: "demo-b", original_name: "Charger" },
    { entity_id: "sensor.demo_site_cell", device_id: "demo-site" },
  ].map(e => ({ ...e, id: e.entity_id, platform: e.device_id === "demo-b" ? "tesla_custom" : "tesla_fleet" }));
  const battery = { unit_of_measurement: "%", device_class: "battery" };
  const distance = { unit_of_measurement: "mi", device_class: "distance" };
  app.currentHome = mapHome({
    "sensor.demo_a_cell": state("sensor.demo_a_cell", "0", battery),
    "sensor.renamed_distance": state("sensor.renamed_distance", "102.4", distance),
    "number.demo_a_target": state("number.demo_a_target", "85", { unit_of_measurement: "%" }),
    "sensor.demo_a_finish": state("sensor.demo_a_finish", "2030-04-09T10:34:00Z", { device_class: "timestamp" }),
    "sensor.demo_a_power": state("sensor.demo_a_power", "3.5", { unit_of_measurement: "kW" }),
    "sensor.example_front": state("sensor.example_front", "42", { unit_of_measurement: "psi", device_class: "pressure" }),
    "sensor.example_gear": state("sensor.example_gear", "P"),
    "sensor.example_speed": state("sensor.example_speed", "0", { unit_of_measurement: "km/h" }),
    "sensor.example_address": state("sensor.example_address", "Example Street 42"),
    "zone.example_park": state("zone.example_park", "0", { friendly_name: "Example Park" }),
    "climate.example_cabin": state("climate.example_cabin", "off", { hvac_modes: ["off", "heat_cool"], supported_features: 1, current_temperature: 15, temperature: 19, min_temp: 15, max_temp: 28, temperature_unit: "°C" }),
    "lock.example_doors": state("lock.example_doors", "unlocked"),
    "device_tracker.example_destination": state("device_tracker.example_destination", "not_home"),
    "device_tracker.example_location": state("device_tracker.example_location", "home", { latitude: 12, longitude: 34 }),
    "sensor.example_arrival": state("sensor.example_arrival", "2030-04-09T08:10:00Z", { device_class: "timestamp", Destination: "Example station" }),
    "image.demo_car": state("image.demo_car", "2030-04-09T05:00:00Z", { friendly_name: "Example car photo" }),
    "sensor.demo_a_odometer": state("sensor.demo_a_odometer", "12345", distance),
    "sensor.demo_a_charging": state("sensor.demo_a_charging", "charging"),
    "binary_sensor.demo_a_door": state("binary_sensor.demo_a_door", "on", { friendly_name: "Example One Door", device_class: "door", door_position: "ajar" }),
    "sensor.demo_b_cell": state("sensor.demo_b_cell", "88", battery),
    "binary_sensor.demo_b_plug": state("binary_sensor.demo_b_plug", "on", { device_class: "plug", charging_state: "Complete" }),
    "sensor.demo_site_cell": state("sensor.demo_site_cell", "61", battery),
  }, { ...emptyRegistries, devices, entities: entries }, "home");
  window.history.replaceState(null, "", "/settings/vehicles");
  const view = render(<App />);
  const add = await screen.findByRole("button", { name: "Add electric vehicle" });
  await waitFor(() => expect(add).toBeEnabled());
  expect(screen.getByText("No electric vehicles added")).toBeVisible();
  expect(screen.queryByRole("button", { name: /^Open status for/ })).toBeNull();
  fireEvent.click(add);
  expect(screen.queryByRole("button", { name: /Example storage/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Example One.*Tesla Fleet/ }));
  fireEvent.click(add);
  const choices = within(screen.getByRole("dialog", { name: "Add electric vehicle" }));
  expect(choices.queryByRole("button", { name: /Example One/ })).toBeNull();
  fireEvent.click(choices.getByRole("button", { name: /Example Two/ }));
  await waitFor(() => expect(settings.settings.vehicles.map(car => car.id)).toEqual(["demo-a", "demo-b"]));
  const card = screen.getByRole("article", { name: "Example One" });
  fireEvent.click(within(card).getByRole("button", { name: "Edit Example One" }));
  fireEvent.click(screen.getByRole("button", { name: "Photo for Example One" }));
  fireEvent.click(screen.getByRole("button", { name: /Example car photo · image.demo_car/ }));
  await waitFor(() => expect(settings.settings.vehicles[0].imageEntity).toBe("home|image.demo_car"));
  chooseEntity("Address sensor for Example One", "sensor.example_address");
  await waitFor(() => expect(settings.settings.vehicles[0].addressEntity).toBe("home|sensor.example_address"));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Edit Example One" })).getByRole("button", { name: "Close" }));
  expect(card.querySelector("img")).toHaveAttribute("src", expect.stringContaining("/api/image_proxy/image.demo_car"));
  expect(screen.getByRole("button", { name: /Example Two.*88%.*Complete/ })).toBeVisible();
  const widget = screen.getByRole("button", { name: /Example One.*0%.*102 mi.*Charging.*Parked.*Climate off/ });
  expect(widget).not.toHaveTextContent(/Example One|Charging|Off/);
  expect(widget.querySelector("img")).toHaveAttribute("src", expect.stringContaining("/api/image_proxy/image.demo_car"));
  fireEvent.click(widget);
  const dialog = screen.getByRole("dialog", { name: "Example One" });
  expect(within(dialog).getByText("12:34")).toBeVisible();
  expect(within(dialog).getByText("85%")).toBeVisible();
  expect(within(dialog).getByText("3.5 kW")).toBeVisible();
  const photo = within(dialog).getByRole("img", { name: "Photo of Example One" });
  expect(photo.getAttribute("src")).toMatch(/^\/api\/image_proxy\/image.demo_car/);
  fireEvent.error(photo);
  expect(within(dialog).getByRole("img", { name: "Model illustration of Model 3" })).toHaveAttribute("src", "/vehicles/model-3.webp");
  expect(within(dialog).getByText("Unlocked")).toBeVisible();
  expect(within(dialog).getByText("Example station")).toBeVisible();
  expect(within(dialog).getByText("10:10")).toBeVisible();
  const mapName = "Vehicle position on OpenStreetMap";
  const map = await within(dialog).findByRole("region", { name: mapName });
  const pan = vi.spyOn(LeafletMap.prototype, "panTo");
  const movePin = vi.spyOn(Marker.prototype, "setLatLng");
  const gps = app.currentHome.entities.find(e => e.entityId === "device_tracker.example_location");
  const readings = within(map).getByRole("group", { name: "Driving information" });
  expect(readings).toHaveTextContent("Speed 0 km/h");
  expect(readings).toHaveTextContent("Gear P");
  expect(within(dialog).queryByTitle("Example Street 42")).toBeNull();
  gps.state = "not_home";
  gps.attributes.heading = 90;
  gps.attributes.latitude = 12.001;
  app.currentHome.entities.find(e => e.entityId === "sensor.example_speed").state = "55";
  view.rerender(<App />);
  expect(within(dialog).getByTitle("Example Street 42")).toBeVisible();
  expect(readings).toHaveTextContent("Speed 55 km/h");
  expect(readings).toHaveTextContent("Heading 90°");
  expect(pan).toHaveBeenCalledWith([12.001, 34], expect.anything());
  expect(movePin).toHaveBeenCalledWith([12.001, 34]);
  const mapView = pan.mock.results[0].value;
  mapView.setZoom(16);
  const expand = within(dialog).getByRole("button", { name: "Show map fullscreen" });
  fireEvent.click(expand);
  const fullscreen = await screen.findByRole("dialog", { name: mapName });
  expect(within(fullscreen).getByRole("region", { name: mapName })).toBe(map);
  expect(within(fullscreen).getByRole("group", { name: "Driving information" })).toBe(readings);
  gps.attributes.longitude = 34.002;
  gps.attributes.in_zones = ["zone.example_park"];
  view.rerender(<App />);
  expect(pan).toHaveLastReturnedWith(mapView);
  expect(movePin).toHaveBeenLastCalledWith([12.001, 34.002]);
  expect(mapView.getZoom()).toBe(16);
  fireEvent.keyDown(fullscreen, { key: "Escape" });
  await waitFor(() => expect(expand).toHaveFocus());
  expect(within(dialog).getByRole("region", { name: mapName })).toBe(map);
  expect(within(dialog).getByTitle("Example Park")).toBeVisible();
  fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Trip" }), { button: 0 });
  expect(within(dialog).getAllByRole("region", { name: mapName })).toHaveLength(1);
  expect(within(dialog).getByRole("button", { name: "Show map fullscreen" })).toBeVisible();
  expect(within(dialog).getByRole("group", { name: "Driving information" })).toHaveTextContent("Speed 55 km/h");
  fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Overview" }), { button: 0 });
  const climateSwitch = within(dialog).getByRole("switch", { name: "Cabin climate" });
  expect(climateSwitch).not.toBeChecked();
  fireEvent.click(climateSwitch);
  expect(app.command).toHaveBeenCalledWith("climate.example_cabin", "hvac_mode", "heat_cool", undefined, expect.any(Function));
  expect(climateSwitch).not.toBeChecked();
  app.currentHome.entities.find(e => e.entityId === "climate.example_cabin").state = "heat_cool";
  view.rerender(<App />);
  expect(climateSwitch).toBeChecked();
  fireEvent.keyDown(within(dialog).getByRole("slider"), { key: "ArrowRight" });
  expect(app.command).toHaveBeenCalledWith("climate.example_cabin", "temperature", 19.5, undefined, expect.any(Function));
  fireEvent.click(climateSwitch);
  const confirm = await screen.findByRole("alertdialog");
  fireEvent.click(within(confirm).getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(app.command).toHaveBeenCalledWith("climate.example_cabin", "hvac_mode", "off", undefined, expect.any(Function)));
  await waitFor(() => expect(confirm).not.toBeInTheDocument());
  fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Access" }), { button: 0 });
  const search = within(dialog).getByRole("searchbox", { name: "Search this car" });
  fireEvent.change(search, { target: { value: "door" } });
  expect(within(dialog).queryByRole("heading", { name: "Battery & charging" })).toBeNull();
  fireEvent.click(within(dialog).getByText("Door", { selector: "summary span" }));
  expect(within(dialog).getByText("ajar")).toBeVisible();
  expect(within(dialog).queryByText("88%")).toBeNull();
  fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Tyres" }), { button: 0 });
  expect(within(dialog).getByRole("img", { name: "Model 3 viewed from above" })).toHaveAttribute("src", "/vehicles/model-3-top.webp");
  expect(within(dialog).getByText("2.9 bar")).toBeVisible();
  fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Overview" }), { button: 0 });
  app.currentHome.entities.find(e => e.entityId === "sensor.demo_a_cell").state = "24";
  view.rerender(<App />);
  expect(within(dialog).getByText("24%")).toBeVisible();
  app.homeOnline = false;
  view.rerender(<App />);
  expect(within(dialog).getByRole("status")).toHaveTextContent("reconnects");
  expect(within(dialog).queryByText("24%")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  app.currentHome = mapHome({}, emptyRegistries, "home");
  view.rerender(<App />);
  expect(screen.getByRole("button", { name: /Example Two.*HA offline/ })).toBeVisible();
  const offlineCard = screen.getByRole("article", { name: "Example Two" });
  expect(offlineCard).toHaveTextContent("Offline");
  fireEvent.click(within(offlineCard).getByRole("button", { name: "Edit Example Two" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove vehicle" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove vehicle" }));
  await waitFor(() => expect(settings.settings.vehicles.map(car => car.id)).toEqual(["demo-a"]));
});
