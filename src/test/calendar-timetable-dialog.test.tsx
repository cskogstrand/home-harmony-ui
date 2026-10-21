import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CalendarTimetable } from "@/components/CalendarTimetable";
import { useTimetableCalendars } from "@/hooks/use-timetable-calendars";
import type { CalendarEvent, Entity } from "@/types/api";
import type { TimetableSettings } from "../../shared/configuration";

const app = vi.hoisted(() => ({ homeOnline: true, haUrl: "https://ha.example", currentHome: { timeZone: "UTC", entities: [] as Entity[] }, watchCalendarEvents: vi.fn() }));
const clock = vi.hoisted(() => ({ today: "2026-10-19", now: new Date("2026-10-19T09:30:00Z"), time: "09:30" }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/FamilyContext")>(), useFamily: () => ({ ...clock, memberName: () => "Example person" }) }));

// Synthetic calendars, activities and dates only.
const settings: TimetableSettings = { type: "calendar", education: "school", calendars: { "home|calendar.activities": ["events", "popupActivities"], "home|calendar.meetings": ["events", "popupMeetings"] } };
const activities: CalendarEvent[] = [
  { summary: "Example activity", start: "2026-10-19T09:00:00Z", end: "2026-10-19T10:00:00Z", location: "Example room", description: "Bring example materials.\nSecond paragraph." },
  { summary: "Next day activity", start: "2026-10-20", end: "2026-10-21" },
];
const receive = new Map<string, (events: CalendarEvent[] | null) => void>();

beforeEach(() => {
  vi.clearAllMocks();
  receive.clear();
  clock.today = "2026-10-19";
  clock.now = new Date("2026-10-19T09:30:00Z");
  clock.time = "09:30";
  app.homeOnline = true;
  app.currentHome.entities = ["activities", "meetings", "unselected"].map(name => ({ entityId: `calendar.${name}`, preferenceId: `home|calendar.${name}`, name: `Example ${name}`, domain: "calendar", state: "off", attributes: {}, areaId: "unassigned" }));
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, callback) => {
    receive.set(id, callback);
    callback(id === "calendar.activities" ? activities : [{ summary: "Example meeting", start: "2026-10-19T11:00:00Z", end: "2026-10-19T12:00:00Z" }]);
  });
});
afterEach(cleanup);

it("shows only today's grouped agenda and keeps other days available through their popup", () => {
  render(<CalendarTimetable child="example" settings={settings} todayOnly />);
  const today = screen.getByRole("region", { name: "Today's activities" });
  expect(within(today).getByText("Example activity")).toBeVisible();
  expect(within(today).getByText("Example meeting")).toBeVisible();
  expect(within(today).getByText("Bring example materials. Second paragraph.")).toBeVisible();
  expect(screen.queryByText("Next day activity")).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Mon 19 Oct" })).queryByText("Example activity")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View activities for Tuesday, 20 October 2026" }));
  expect(within(screen.getByRole("dialog")).getByText("Next day activity")).toBeVisible();
  expect(within(screen.getByRole("dialog")).queryByText("Example activity")).not.toBeInTheDocument();
});

it("updates the inline agenda when the home's date changes", () => {
  const view = render(<CalendarTimetable child="example" settings={settings} todayOnly />);
  clock.today = "2026-10-20";
  clock.now = new Date("2026-10-20T09:30:00Z");
  view.rerender(<CalendarTimetable child="example" settings={settings} todayOnly />);
  const today = within(screen.getByRole("region", { name: "Today's activities" }));
  expect(today.getByText("Next day activity")).toBeVisible();
  expect(today.queryByText("Example activity")).not.toBeInTheDocument();
});

it("loads the actual weekend day while the compact weekday strip advances to next week", () => {
  clock.today = "2026-10-24";
  clock.now = new Date("2026-10-24T09:30:00Z");
  app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, callback) => callback([
    { summary: "Weekend workshop", start: "2026-10-24T09:00:00Z", end: "2026-10-24T10:00:00Z" },
    { summary: "Next week workshop", start: "2026-10-26T09:00:00Z", end: "2026-10-26T10:00:00Z" },
  ]));
  render(<CalendarTimetable child="example" settings={{ ...settings, calendars: { "home|calendar.activities": ["popupActivities"] } }} todayOnly />);
  const today = within(screen.getByRole("region", { name: "Today's activities" }));
  expect(today.getByText("Weekend workshop")).toBeVisible();
  expect(today.getByText("Happening now")).toBeVisible();
  expect(screen.queryByText("Next week workshop")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "View activities for Monday, 26 October 2026" })).toBeVisible();
  expect(app.watchCalendarEvents.mock.calls[0].slice(0, 3)).toEqual(["calendar.activities", "2026-10-24T00:00:00.000Z", "2026-10-31T00:00:00.000Z"]);
});

it("shows the home clock and updates the current activity while today's popup stays open", () => {
  const view = render(<CalendarTimetable child="example" settings={settings} />);
  const day = screen.getByRole("region", { name: "Mon 19 Oct" });
  expect(screen.getByText("09:30")).toBeVisible();
  expect(day.querySelector('[aria-current="time"]')).toHaveTextContent("Example activity");
  expect(within(day).getByText("Bring example materials. Second paragraph.")).not.toBeVisible();
  fireEvent.click(within(day).getByText("Example activity"));
  expect(within(day).getByText("Bring example materials. Second paragraph.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "View activities for Monday, 19 October 2026" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("09:30")).toBeVisible();
  expect(dialog.querySelector('[aria-current="time"]')).toHaveTextContent("Example activity");
  expect(within(dialog).getByText("Happening now")).toBeVisible();
  clock.now = new Date("2026-10-19T10:00:00Z");
  clock.time = "10:00";
  view.rerender(<CalendarTimetable child="example" settings={settings} />);
  expect(within(dialog).getByText("10:00")).toBeVisible();
  expect(dialog.querySelector('[aria-current="time"]')).toBeNull();
  expect(day.querySelector('[aria-current="time"]')).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "View activities for Tuesday, 20 October 2026" }));
  expect(within(screen.getByRole("dialog")).queryByText("Now")).not.toBeInTheDocument();
});

it("opens only the chosen day's selected-calendar activities with full details and restores focus", async () => {
  render(<CalendarTimetable child="example" settings={settings} />);
  const trigger = screen.getByRole("button", { name: "View activities for Monday, 19 October 2026" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Monday, 19 October 2026" });
  expect(dialog).toHaveAccessibleDescription("Activities for Example person");
  expect(within(within(dialog).getByRole("region", { name: "Activities" })).getByText("Example activity")).toBeVisible();
  expect(within(within(dialog).getByRole("region", { name: "Meetings" })).getByText("Example meeting")).toBeVisible();
  for (const text of ["Example activity", "09:00 – 10:00", "Example room", "Bring example materials. Second paragraph.", "Example meeting"]) {
    expect(within(dialog).getByText(text)).toBeVisible();
  }
  expect(within(dialog).queryByText(/^Calendar:/)).not.toBeInTheDocument();
  expect(within(dialog).queryByText("Next day activity")).not.toBeInTheDocument();
  expect(app.watchCalendarEvents.mock.calls.map(([id]) => id)).toEqual(["calendar.activities", "calendar.meetings"]);
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View activities for Tuesday, 20 October 2026" }));
  expect(within(screen.getByRole("dialog")).getByText("All day")).toBeVisible();
  expect(within(screen.getByRole("dialog")).queryByText("Example activity")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("keeps an open day current when events arrive, reports failures and offers retry", () => {
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, callback) => receive.set(id, callback));
  render(<CalendarTimetable child="example" settings={settings} />);
  fireEvent.click(screen.getByRole("button", { name: "View activities for Monday, 19 October 2026" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("Loading timetable…")).toBeVisible();
  act(() => { receive.get("calendar.activities")!(activities); receive.get("calendar.meetings")!(null); });
  expect(dialog.getByText("Example activity")).toBeVisible();
  expect(dialog.getByRole("status")).toHaveTextContent("Some calendars could not be read: Example meetings.");
  expect(dialog.queryByText("No events")).not.toBeInTheDocument();
  fireEvent.click(dialog.getByRole("button", { name: "Retry" }));
  expect(app.watchCalendarEvents).toHaveBeenCalledTimes(4);
  act(() => { receive.get("calendar.activities")!([]); receive.get("calendar.meetings")!([]); });
  expect(dialog.getAllByText("No events")).toHaveLength(2);
  expect(dialog.queryByText("Example activity")).not.toBeInTheDocument();
});

it("does not offer day dialogs without a connection or configured sources", () => {
  app.homeOnline = false;
  const view = render(<CalendarTimetable child="example" settings={settings} />);
  expect(screen.getByRole("status")).toHaveTextContent("Connect to Home Assistant");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  app.homeOnline = true;
  view.rerender(<CalendarTimetable child="example" settings={{ ...settings, calendars: {} }} />);
  expect(screen.getByText("Choose calendars for this person in Settings → Timetables.")).toBeVisible();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("shows only popup selections and explains how to configure an empty selection", () => {
  const configured: TimetableSettings = { ...settings, calendars: { "home|calendar.activities": ["events"], "home|calendar.meetings": ["popupMeetings"] } };
  const view = render(<CalendarTimetable child="example" settings={configured} />);
  expect(screen.getByText("Example activity")).toBeVisible();
  expect(screen.queryByText("Example meeting")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View activities for Monday, 19 October 2026" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("Example meeting")).toBeVisible();
  expect(dialog.queryByText("Example activity")).not.toBeInTheDocument();
  view.rerender(<CalendarTimetable child="example" settings={{ ...settings, calendars: { "home|calendar.activities": ["events"] } }} />);
  expect(dialog.getByText("Choose calendars for Day popup in Settings → Timetables.")).toBeVisible();
  expect(dialog.queryByText("Example activity")).not.toBeInTheDocument();
});

it.each([
  ["2026-10-21", "2026-10-19", "2026-10-19", "2027-10-22"],
  ["2026-10-24", "2026-10-26", "2026-10-24", "2027-10-25"],
])("subscribes once to a message and popup calendar, covering both ranges on %s", (today, start, from, to) => {
  renderHook(() => useTimetableCalendars({ ...settings, calendars: { "home|calendar.activities": ["message", "popupMessages"] } }, start, today));
  expect(app.watchCalendarEvents).toHaveBeenCalledOnce();
  expect(app.watchCalendarEvents.mock.calls[0].slice(0, 3)).toEqual(["calendar.activities", `${from}T00:00:00.000Z`, `${to}T00:00:00.000Z`]);
});

it("keeps messages from a shared calendar when opening hours must be hidden", () => {
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, callback) => callback(id === "calendar.meetings" ? null : activities));
  render(<CalendarTimetable child="example" settings={{ ...settings, calendars: { "home|calendar.activities": ["hours", "message", "popupHours", "popupMessages"], "home|calendar.meetings": ["closures", "popupClosures"] } }} />);
  expect(screen.getByRole("heading", { name: "Example activity" })).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Mon 19 Oct" })).queryByText("Example activity")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View activities for Monday, 19 October 2026" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(within(dialog.getByRole("region", { name: "Opening hours / Closed" })).queryByText("Example activity")).not.toBeInTheDocument();
  expect(within(dialog.getByRole("region", { name: "Messages (Pedagogy)" })).getByText("Example activity")).toBeVisible();
});

it("puts opening hours and closure status in the header, retaining notes behind Details", () => {
  const hours = { summary: "Example opening schedule", start: "2026-10-19T07:00:00Z", end: "2026-10-19T17:00:00Z", description: "Example arrival instructions." };
  const closed = { summary: "Example closure", start: "2026-10-19", end: "2026-10-20" };
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, callback) => {
    receive.set(id, callback);
    callback(id === "calendar.activities" ? [hours] : []);
  });
  render(<CalendarTimetable child="example" settings={{ ...settings, calendars: { "home|calendar.activities": ["hours", "popupHours"], "home|calendar.meetings": ["closures", "popupClosures"] } }} />);
  const day = screen.getByRole("region", { name: "Mon 19 Oct" });
  expect(within(day).getAllByText("Opening hours")).toHaveLength(1);
  expect(within(day).queryByText(hours.summary)).not.toBeInTheDocument();
  expect(day.querySelector('[aria-current="time"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View activities for Monday, 19 October 2026" }));
  const dialog = within(screen.getByRole("dialog"));
  const header = dialog.getByRole("heading", { level: 2 }).parentElement!;
  const status = within(header).getByRole("region", { name: "Opening hours / Closed" });
  expect(within(status).getByText("07:00 – 17:00")).toBeVisible();
  expect(within(status).getAllByText("Opening hours")).toHaveLength(1);
  expect(within(status).queryByText(hours.summary)).not.toBeInTheDocument();
  expect(within(status).getByText(hours.description)).not.toBeVisible();
  fireEvent.click(within(status).getByText("Details"));
  expect(within(status).getByText(hours.description)).toBeVisible();
  expect(dialog.queryByText("Choose calendars for Day popup in Settings → Timetables.")).not.toBeInTheDocument();
  act(() => receive.get("calendar.meetings")!([closed]));
  expect(within(status).getByText("Closed for the day")).toBeVisible();
  expect(within(status).getByText(closed.summary)).toBeVisible();
  expect(within(day).getByText(closed.summary)).toBeInTheDocument();
  expect(dialog.queryByText(hours.summary)).not.toBeInTheDocument();
  expect(dialog.queryByText(/^Calendar:/)).not.toBeInTheDocument();
});
