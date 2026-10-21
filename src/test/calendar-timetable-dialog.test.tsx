import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CalendarTimetable } from "@/components/CalendarTimetable";
import type { CalendarEvent, Entity } from "@/types/api";
import type { TimetableSettings } from "../../shared/configuration";

const app = vi.hoisted(() => ({ homeOnline: true, haUrl: "https://ha.example", currentHome: { timeZone: "UTC", entities: [] as Entity[] }, watchCalendarEvents: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/FamilyContext")>(), useFamily: () => ({ today: "2026-10-19", memberName: () => "Example person" }) }));

// Synthetic calendars, activities and dates only.
const settings: TimetableSettings = { type: "calendar", education: "school", calendars: { "home|calendar.activities": "events", "home|calendar.meetings": "events" } };
const activities: CalendarEvent[] = [
  { summary: "Example activity", start: "2026-10-19T09:00:00Z", end: "2026-10-19T10:00:00Z", location: "Example room", description: "Bring example materials.\nSecond paragraph." },
  { summary: "Next day activity", start: "2026-10-20", end: "2026-10-21" },
];
const receive = new Map<string, (events: CalendarEvent[] | null) => void>();

beforeEach(() => {
  vi.clearAllMocks();
  receive.clear();
  app.homeOnline = true;
  app.currentHome.entities = ["activities", "meetings", "unselected"].map(name => ({ entityId: `calendar.${name}`, preferenceId: `home|calendar.${name}`, name: `Example ${name}`, domain: "calendar", state: "off", attributes: {}, areaId: "unassigned" }));
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, callback) => {
    receive.set(id, callback);
    callback(id === "calendar.activities" ? activities : [{ summary: "Example meeting", start: "2026-10-19T11:00:00Z", end: "2026-10-19T12:00:00Z" }]);
  });
});
afterEach(cleanup);

it("opens only the chosen day's selected-calendar activities with full details and restores focus", async () => {
  render(<CalendarTimetable child="example" settings={settings} />);
  const trigger = screen.getByRole("button", { name: "View activities for Monday, 19 October 2026" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Monday, 19 October 2026" });
  expect(dialog).toHaveAccessibleDescription("Activities for Example person");
  for (const text of ["Example activity", "09:00 – 10:00", "Example room", "Calendar: Example activities", "Bring example materials. Second paragraph.", "Example meeting", "Calendar: Example meetings"]) {
    expect(within(dialog).getByText(text)).toBeVisible();
  }
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
  expect(dialog.getByText("No events")).toBeVisible();
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
