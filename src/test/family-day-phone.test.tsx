import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "@/App";
import { emptyConfiguration, parseConfiguration } from "../../shared/configuration";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import { config, state } from "./ha-fixtures";
import { configurationSnapshot } from "./configuration-snapshot.mjs";
import { restoreRealTimers } from "./timers";

const app = vi.hoisted(() => ({ currentHome: null, haUrl: "http://ha.local:8123", homeOnline: true, connectionStatus: "connected", connectionStarting: false, awaitingFirstConnection: false, entityRegistryAvailable: true, metadataWarnings: [], services: {}, commands: {}, command: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), configurationRequest: vi.fn(), storageRequest: vi.fn(), watchCalendarEvents: vi.fn(), subscribeLogbook: vi.fn(() => () => {}), todoItems: vi.fn(), assistAgents: vi.fn(async () => []) }));
vi.mock("@/contexts/AppContext", async importOriginal => {
  const { AppContext } = await importOriginal<typeof import("@/contexts/AppContext")>();
  const { useContext } = await import("react");
  return { AppContext, useApp: (select = value => value) => select(useContext(AppContext) ?? app) };
});
vi.mock("../../config.yaml?raw", () => ({ default: 'name: Home Harmony UI\nversion: "9.8.7"\n' }));
vi.mock("@/contexts/AppProvider", () => ({ AppProvider: ({ children }) => children }));

// Fictional household: one person busy both days, one free both days, one busy only tomorrow.
const plans: Record<string, { summary: string; start: string; end: string }[]> = {
  "calendar.example_ada": [
    { summary: "Example swim practice", start: "2026-10-28T15:00:00Z", end: "2026-10-28T16:00:00Z" },
    { summary: "Example dentist", start: "2026-10-29T08:00:00Z", end: "2026-10-29T09:00:00Z" },
  ],
  "calendar.example_bo": [],
  "calendar.example_cy": [{ summary: "Example football match", start: "2026-10-29T16:00:00Z", end: "2026-10-29T17:30:00Z" }],
};
const home = (timeZone?: string) => mapHome({
  "person.ada": state("person.ada", "home", { friendly_name: "Example Ada" }),
  "person.bo": state("person.bo", "home", { friendly_name: "Example Bo" }),
  "person.cy": state("person.cy", "home", { friendly_name: "Example Cy" }),
  "calendar.example_ada": state("calendar.example_ada", "off"),
  "calendar.example_bo": state("calendar.example_bo", "off"),
  "calendar.example_cy": state("calendar.example_cy", "off"),
}, emptyRegistries, "home", timeZone ? { ...config, time_zone: timeZone } : undefined);
let settings = emptyConfiguration();
let phone = true;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T07:00:00Z"));
  phone = true;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && query === "(max-width: 699px)", media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }));
  settings = emptyConfiguration();
  settings.settings.dashboard.showTomorrow = true;
  settings.settings.calendarMembers = { "home|calendar.example_ada": "home|person.ada", "home|calendar.example_bo": "home|person.bo", "home|calendar.example_cy": "home|person.cy" };
  app.homeOnline = true;
  app.currentHome = home();
  app.todoItems.mockReset().mockResolvedValue([]);
  app.watchCalendarEvents.mockReset().mockImplementation((id: string, _from, _to, _signal, receive) => receive(plans[id.split("|").pop() ?? id] ?? []));
  app.configurationRequest.mockImplementation(async (method, body) => {
    if (method === "PUT") settings = parseConfiguration(body);
    return { ok: true, json: async () => configurationSnapshot(settings) };
  });
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); restoreRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const everyonesDay = async () => {
  const day = await screen.findByRole("region", { name: "Everyone’s day" });
  await within(day).findByRole("button", { name: /Example swim practice/ });
  return day;
};

it("lists only people with plans on phones and gathers everyone free today on one line", async () => {
  render(<App />);
  const day = await everyonesDay();
  const todayPlans = within(day).getByRole("region", { name: "Today" });
  expect(within(todayPlans).getByRole("heading", { level: 3, name: /Today/ })).toBeVisible();
  expect(within(todayPlans).getByRole("group", { name: "Example Ada" })).toHaveTextContent("Example swim practice");
  expect(within(todayPlans).queryByRole("group", { name: "Example Bo" })).not.toBeInTheDocument();
  const free = within(todayPlans).getByRole("list", { name: "Free today" });
  const items = within(free).getAllByRole("listitem");
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent("Example Bo");
  expect(items[1]).toHaveTextContent("Example Cy");
  // Each person's name appears once per day instead of a repeated lane heading.
  expect(within(todayPlans).getAllByText("Example Ada")).toHaveLength(1);
  expect(day.querySelector(".family-day-board")).toBeNull();
});

it("folds tomorrow behind a disclosure that names the day and its plan count", async () => {
  render(<App />);
  const day = await everyonesDay();
  const summary = day.querySelector("details > summary") as HTMLElement;
  expect(summary).toHaveTextContent(/Tomorrow.*2 plans/);
  const details = summary.parentElement as HTMLDetailsElement;
  expect(details.open).toBe(false);
  const match = within(details).getByRole("button", { name: /Example football match/ });
  expect(match).not.toBeVisible();
  fireEvent.click(summary);
  await waitFor(() => expect(details.open).toBe(true));
  expect(match).toBeVisible();
  const tomorrow = within(day).getByRole("region", { name: "Tomorrow" });
  expect(within(tomorrow).getByRole("group", { name: "Example Ada" })).toHaveTextContent("Example dentist");
  expect(within(tomorrow).getByRole("group", { name: "Example Cy" })).toHaveTextContent("Example football match");
  expect(within(within(tomorrow).getByRole("list", { name: "Free tomorrow" })).getByRole("listitem")).toHaveTextContent("Example Bo");
});

it("keeps the person lanes above the phone breakpoint", async () => {
  phone = false;
  render(<App />);
  const day = await everyonesDay();
  expect(day.querySelector(".family-day-agenda")).toBeNull();
  expect(day.querySelector(".family-day-board")).not.toBeNull();
  expect(within(day).getAllByRole("group", { name: "Example Bo" })).toHaveLength(2);
  expect(within(day).queryByRole("list", { name: "Free today" })).not.toBeInTheDocument();
  expect(day.querySelector("details")).toBeNull();
});

it("shades the weekend in Everyone's day by the home's date and names each weekday, on phones and wider screens", async () => {
  // Friday 23 October 2026, 12:00 UTC: still Friday in Europe/Oslo, already Saturday in Pacific/Auckland. Sunday the 25th is Europe's daylight-saving change.
  vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
  const days = async () => {
    const day = await screen.findByRole("region", { name: "Everyone’s day" });
    await waitFor(() => expect(day.querySelectorAll(":is(.family-day-date, .family-day-agenda-day) time")).toHaveLength(2));
    return [...day.querySelectorAll(":is(.family-day-date, .family-day-agenda-day)")].map(element => {
      const time = element.querySelector("time")!;
      return [time.getAttribute("datetime"), time.textContent, element.hasAttribute("data-weekend")];
    });
  };
  for (const isPhone of [true, false]) {
    phone = isPhone;
    app.currentHome = home("Europe/Oslo");
    render(<App />);
    expect(await days()).toEqual([["2026-10-23", "Fri 23 Oct", false], ["2026-10-24", "Sat 24 Oct", true]]);
    cleanup();
    app.currentHome = home("Pacific/Auckland");
    render(<App />);
    expect(await days()).toEqual([["2026-10-24", "Sat 24 Oct", true], ["2026-10-25", "Sun 25 Oct", true]]);
    cleanup();
  }
});
