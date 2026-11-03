import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "@/App";
import { emptyConfiguration } from "../../shared/configuration";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import type { CalendarEvent } from "@/types/api";

const app = vi.hoisted(() => ({ currentHome: null, haUrl: "https://ha.example", homeOnline: true, connectionStatus: "connected", metadataWarnings: [], commands: {}, services: {}, configurationRequest: vi.fn(), storageRequest: vi.fn(), watchCalendarEvents: vi.fn(), todoItems: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("@/contexts/AppProvider", () => ({ AppProvider: ({ children }) => children }));
let config = emptyConfiguration();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
  vi.clearAllMocks();
  config = emptyConfiguration();
  config.settings.dashboard.school = false;
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Example person" }),
    "person.other": state("person.other", "home", { friendly_name: "Other person" }),
    "calendar.example": state("calendar.example", "off"),
    "todo.example": state("todo.example", "1", { friendly_name: "Example list", supported_features: 1 }),
  }, emptyRegistries, "home");
  app.services = { todo: { add_item: { fields: {} } } };
  app.configurationRequest.mockImplementation(async () => ({ ok: true, json: async () => ({ revision: "a".repeat(64), config: structuredClone(config) }) }));
  app.storageRequest.mockResolvedValue({ ok: true, blob: async () => new Blob(["example"], { type: "image/png" }) });
  app.watchCalendarEvents.mockReset().mockImplementation((_id, _from, _to, _signal, receive) => receive([]));
  app.todoItems.mockResolvedValue([{ uid: "example", summary: "Example homework", status: "needs_action" }]);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:example"), revokeObjectURL: vi.fn() }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  window.history.replaceState(null, "", "/home");
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const navigate = async (name: string) => {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name }));
  await screen.findByRole("heading", { level: 1, name: name === "Today" ? "Good to be home." : name });
};

it.each(["/School/", "/school/"])("keeps main routes working at %s", async path => {
  window.history.replaceState(null, "", path);
  render(<App />);
  await screen.findByRole("heading", { level: 1, name: "School" });
  expect(screen.getByRole("link", { name: "School" })).toHaveAttribute("aria-current", "page");
  expect(screen.queryByRole("navigation", { name: "Smart home navigation" })).not.toBeInTheDocument();
  await navigate("Lists");
  await navigate("School");
});

it("preloads school images, calendars and homework while another page is open, then retains live data and cleans up", async () => {
  const image = "/api/timetables/example/00000000-0000-4000-8000-000000000000/1.png";
  config.settings.timetables = { "home|person.other": [image] };
  config.settings.timetableSettings = { "home|person.example": { type: "calendar", education: "school", calendars: { "home|calendar.example": ["events", "popupActivities"] } } };
  config.settings.todoLists = { "home|todo.example": { kind: "homework", member: "home|person.example" } };
  const view = render(<App />);
  await screen.findByRole("heading", { name: "Smart home", level: 1 });
  await waitFor(() => expect(app.storageRequest).toHaveBeenCalledWith(image));
  await waitFor(() => expect(app.watchCalendarEvents).toHaveBeenCalledOnce());
  await waitFor(() => expect(app.todoItems).toHaveBeenCalledTimes(3));
  const [, , , signal, receive] = app.watchCalendarEvents.mock.calls[0];
  const events: CalendarEvent[] = [{ summary: "Example activity", start: "2026-11-03T12:00:00Z", end: "2026-11-03T13:00:00Z" }];
  act(() => receive(events));
  expect(screen.queryByText("Example activity")).not.toBeInTheDocument();
  await navigate("School");
  expect(screen.getByText("Example activity")).toBeVisible();
  expect(screen.getByText("Example homework")).toBeVisible();
  const picture = screen.getByRole("img", { name: "Other person’s school timetable" });
  expect(picture).toHaveAttribute("src", "blob:example");
  const reads = app.todoItems.mock.calls.length;
  await navigate("Smart home");
  act(() => receive([{ ...events[0], summary: "Updated activity" }]));
  expect(signal.aborted).toBe(false);
  await navigate("School");
  expect(screen.getByText("Updated activity")).toBeVisible();
  expect(screen.getByRole("img", { name: "Other person’s school timetable" })).toBe(picture);
  expect(app.watchCalendarEvents).toHaveBeenCalledOnce();
  expect(app.storageRequest).toHaveBeenCalledOnce();
  expect(app.todoItems).toHaveBeenCalledTimes(reads);
  view.unmount();
  expect(signal.aborted).toBe(true);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:example");
});

it("retains every main page across navigation, including visits to settings", async () => {
  render(<App />);
  const headings = new Map<string, HTMLElement>();
  for (const name of ["Today", "Calendar", "Lists", "School", "Smart home"]) {
    await navigate(name);
    headings.set(name, screen.getByRole("heading", { level: 1 }));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  }
  fireEvent.keyDown(screen.getByRole("button", { name: "Open app settings" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: "All settings" }));
  await screen.findByRole("heading", { level: 1, name: "Settings" });
  for (const [name, heading] of headings) {
    await navigate(name);
    expect(screen.getByRole("heading", { level: 1 })).toBe(heading);
  }
});

it("keeps calendar dates, views and person filters and honors an explicit new URL", async () => {
  window.history.replaceState(null, "", "/calendar?view=month&date=2026-11-03");
  render(<App />);
  await screen.findByRole("heading", { level: 1, name: "Calendar" });
  fireEvent.click(screen.getByRole("button", { name: "Example person" }));
  fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  const search = window.location.search;
  await navigate("School");
  await navigate("Calendar");
  expect(window.location.search).toBe(search);
  expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Example person" })).toHaveAttribute("aria-pressed", "true");
  act(() => { window.history.pushState(null, "", "/calendar?view=day&date=2026-11-05"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("heading", { name: "5 November 2026" })).toBeVisible();
});

it("retains the selected list and an unfinished input without putting background controls in the document", async () => {
  config.settings.todoLists = { "home|todo.example": { kind: "tasks", member: "home|person.example" } };
  window.history.replaceState(null, "", "/lists?tab=tasks");
  render(<App />);
  await screen.findByText("Example homework");
  fireEvent.click(screen.getByRole("button", { name: "Add task" }));
  const input = screen.getByRole("textbox", { name: "New item in Example list" });
  fireEvent.change(input, { target: { value: "Unfinished example" } });
  await navigate("School");
  expect(screen.queryByRole("textbox", { name: "New item in Example list" })).not.toBeInTheDocument();
  await navigate("Lists");
  expect(window.location.search).toBe("?tab=tasks");
  expect(screen.getByRole("textbox", { name: "New item in Example list" })).toBe(input);
  expect(input).toHaveValue("Unfinished example");
});

it("hides an open page dialog during navigation and restores its draft when returning", async () => {
  window.history.replaceState(null, "", "/calendar");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Add a plan" }));
  fireEvent.change(screen.getByRole("textbox", { name: "What’s happening?" }), { target: { value: "Example draft" } });
  act(() => { window.history.pushState(null, "", "/school"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await screen.findByRole("heading", { name: "School", level: 1 });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.pointerEvents).not.toBe("none");
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Calendar" }));
  expect(await screen.findByRole("dialog")).toBeVisible();
  expect(screen.getByRole("textbox", { name: "What’s happening?" })).toHaveValue("Example draft");
});
