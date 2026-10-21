import { expect, it } from "vitest";
import { timetableDays, timetableEventIsCurrent, timetableMessages, timetableWeek, type TimetableSource } from "@/lib/calendar-timetable";
import type { CalendarEvent } from "@/types/api";

// Synthetic calendars and dates; never household data.
const source = (id: string, roles: TimetableSource["roles"] | TimetableSource["roles"][number], events: CalendarEvent[]): TimetableSource => ({ id, name: id, roles: Array.isArray(roles) ? roles : [roles], events });
const allDay = (summary: string, start = "2026-10-19", end = "2026-10-20", description = ""): CalendarEvent => ({ summary, start, end, description });

it("highlights timed events from inclusive start to exclusive end using instants across DST", () => {
  const [day] = timetableDays([source("example", "popupActivities", [
    { summary: "Example session", start: "2026-10-25T02:30:00+02:00", end: "2026-10-25T02:30:00+01:00" },
    allDay("Example notice", "2026-10-25", "2026-10-26"),
  ])], "2026-10-25", "Europe/Oslo", "example");
  const event = day.popup.activities.find(event => !event.allDay)!;
  for (const [instant, current] of [["00:29:59", false], ["00:30:00", true], ["01:00:00", true], ["01:30:00", false]] as const) {
    expect(timetableEventIsCurrent(event, new Date(`2026-10-25T${instant}Z`), day.date)).toBe(current);
  }
  expect(timetableEventIsCurrent(event, new Date("2026-10-25T01:00:00Z"), "2026-10-26")).toBe(false);
  expect(timetableEventIsCurrent(day.popup.activities.find(event => event.allDay)!, new Date("2026-10-25T01:00:00Z"), day.date)).toBe(false);
});

it("highlights only today's segment of an overnight event", () => {
  const days = timetableDays([source("example", "popupMeetings", [{ summary: "Example overnight event", start: "2026-10-19T23:00:00Z", end: "2026-10-20T01:00:00Z" }])], "2026-10-19", "UTC", "example");
  const now = new Date("2026-10-20T00:30:00Z");
  expect(timetableEventIsCurrent(days[0].popup.meetings[0], now, "2026-10-20")).toBe(false);
  expect(timetableEventIsCurrent(days[1].popup.meetings[0], now, "2026-10-20")).toBe(true);
});

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

it("selects popup calendars independently, including message calendars, without duplicating multi-category events", () => {
  const [day] = timetableDays([
    source("week", "events", [allDay("Week only")]),
    source("shared", ["events", "message", "popupActivities"], [allDay("Shared activity")]),
    source("popup", "popupActivities", [allDay("Popup only")]),
    source("message", ["message", "popupMessages"], [allDay("Daily message")]),
    source("notice", "message", [allDay("Notice only")]),
  ], "2026-10-19", "UTC", "example");
  expect(day.events.map(event => event.title)).toEqual(["Week only", "Shared activity"]);
  expect(day.popup.activities.map(event => event.title)).toEqual(["Shared activity", "Popup only"]);
  expect(day.popup.messages.map(event => event.title)).toEqual(["Daily message"]);
});

it("uses popup closures independently of the week and hides only popup hours", () => {
  const days = timetableDays([
    source("closed", "popupClosures", [allDay("Planning day")]),
    source("hours", ["hours", "popupHours"], [allDay("Opening hours", "2026-10-19", "2026-10-22")]),
  ], "2026-10-19", "UTC", "example");
  expect(days[0].popup.hours).toMatchObject([{ title: "Planning day", role: "closures" }]);
  expect(days[0].events).toMatchObject([{ title: "Opening hours", role: "hours" }]);
  expect(days[1].popup.hours).toMatchObject([{ title: "Opening hours", role: "hours" }]);
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

it("groups and deduplicates popup events within each section using the selected day's messages", () => {
  const meeting = allDay("Example meeting");
  const [day, nextDay] = timetableDays([
    source("activities", "popupActivities", [allDay("Example activity")]),
    source("meetings", "popupMeetings", [meeting]),
    source("invitations", "popupMeetings", [{ ...meeting, description: "Meeting notes" }]),
    source("messages", "popupMessages", [allDay("Daily focus"), allDay("Next focus", "2026-10-20", "2026-10-21")]),
    source("shared", ["hours", "popupMessages"], [allDay("Shared notice")]),
  ], "2026-10-19", "UTC", "example");
  expect(day.popup.activities.map(event => event.title)).toEqual(["Example activity"]);
  expect(day.popup.meetings).toMatchObject([{ title: "Example meeting", note: "Meeting notes" }]);
  expect(day.popup.messages.map(event => event.title)).toEqual(["Daily focus", "Shared notice"]);
  expect(day.popup.messages.every(event => event.role === "events")).toBe(true);
  expect(nextDay.popup.messages.map(event => event.title)).toEqual(["Next focus"]);
});
