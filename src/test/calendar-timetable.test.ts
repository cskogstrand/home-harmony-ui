import { expect, it } from "vitest";
import { timetableDays, timetableMessages, timetableWeek, type TimetableSource } from "@/lib/calendar-timetable";
import type { CalendarEvent } from "@/types/api";

// Synthetic calendars and dates; never household data.
const source = (id: string, role: TimetableSource["role"], events: CalendarEvent[]): TimetableSource => ({ id, name: id, role, events });
const allDay = (summary: string, start = "2026-10-19", end = "2026-10-20", description = ""): CalendarEvent => ({ summary, start, end, description });

it("shows five weekdays and advances to the coming week on weekends, including year boundaries", () => {
  expect(timetableWeek("2026-10-23")).toBe("2026-10-19");
  expect(timetableWeek("2026-10-24")).toBe("2026-10-26");
  expect(timetableWeek("2027-01-03")).toBe("2027-01-04");
  expect(timetableDays([], "2026-10-19", "UTC", "example").map(day => day.date)).toEqual([
    "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23",
  ]);
});

it("combines cross-calendar invitations, preserves richer descriptions and distinct events", () => {
  const event = { summary: "Example activity", start: "2026-10-19T09:00:00Z", end: "2026-10-19T10:00:00Z" };
  const days = timetableDays([
    source("activities", "events", [{ ...event, uid: "activity" }, { ...event, uid: "different", location: "Example room" }]),
    source("invitations", "events", [{ ...event, uid: "invitation", description: "Bring drawing materials." }]),
    source("messages", "message", [allDay("Educational focus")]),
  ], "2026-10-19", "Europe/Oslo", "example");
  expect(days[0].events).toHaveLength(2);
  expect(days[0].events[0]).toMatchObject({ time: "11:00", note: "Bring drawing materials." });
  expect(days[0].events[1].location).toBe("Example room");
});

it("does not combine distinct occurrences from the same calendar", () => {
  const days = timetableDays([source("activities", "events", [allDay("Example"), allDay("Example")])], "2026-10-19", "UTC", "example");
  expect(days[0].events).toHaveLength(2);
});

it("hides opening hours on occupied closure dates, preserving other events and the exclusive end", () => {
  const days = timetableDays([
    source("hours", "hours", [allDay("Hours", "2026-10-19", "2026-10-24")]),
    source("closures", "closures", [allDay("Closed for planning", "2026-10-19", "2026-10-21")]),
    source("activities", "events", [allDay("Personal appointment")]),
  ], "2026-10-19", "UTC", "example");
  expect(days[0].events.map(event => event.title)).toEqual(["Closed for planning", "Personal appointment"]);
  expect(days[1].closed).toBe(true);
  expect(days[2]).toMatchObject({ closed: false, events: [{ role: "hours" }] });
});

it("uses today's messages even after their time has passed, and shows repeated long text only once", () => {
  const sources = [source("pedagogy", "message", [
    allDay("Yesterday", "2026-10-18", "2026-10-19"),
    allDay("Focus", "2026-10-19", "2026-10-20", "A long educational description.\nSecond paragraph."),
    allDay("Focus", "2026-10-19", "2026-10-20", "A long educational description.\nSecond paragraph."),
    allDay("Tomorrow", "2026-10-20", "2026-10-21"),
  ])];
  expect(timetableMessages(sources, "2026-10-19", "UTC", "example")[0]).toMatchObject({ date: "2026-10-19", messages: [{ title: "Focus" }] });
  const timed = source("notices", "message", [{ summary: "Morning notice", start: "2026-10-19T07:00:00Z", end: "2026-10-19T08:00:00Z" }]);
  expect(timetableMessages([timed], "2026-10-19", "UTC", "example")[0].messages).toHaveLength(1);
});

it("uses the earliest future day on an empty weekend, including gaps and multiple messages", () => {
  const sources = [source("pedagogy", "message", [
    allDay("Later", "2026-11-04", "2026-11-05"),
    allDay("Next focus", "2026-11-02", "2026-11-03"),
    allDay("Next notice", "2026-11-02", "2026-11-03"),
    allDay("Expired", "2026-10-23", "2026-10-24"),
  ])];
  const [message] = timetableMessages(sources, "2026-10-24", "UTC", "example");
  expect(message.date).toBe("2026-11-02");
  expect(message.messages.map(event => event.title)).toEqual(["Next focus", "Next notice"]);
});

it("selects messages in the home's timezone across DST and respects exclusive ends", () => {
  const [message] = timetableMessages([source("notices", "message", [
    { summary: "Expired at midnight", start: "2026-10-24T20:00:00Z", end: "2026-10-24T22:00:00Z" },
    { summary: "Today at midnight", start: "2026-10-24T22:00:00Z", end: "2026-10-25T01:00:00Z" },
    allDay("Continues", "2026-10-23", "2026-10-26"),
  ])], "2026-10-25", "Europe/Oslo", "example");
  expect(message.date).toBe("2026-10-25");
  expect(message.messages.map(event => event.title)).toEqual(["Continues", "Today at midnight"]);
});

it("returns an empty message state for an empty or expired source", () => {
  expect(timetableMessages([source("notices", "message", [allDay("Expired")])], "2026-10-24", "UTC", "example")[0]).toMatchObject({ date: "", messages: [] });
});
