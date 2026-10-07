import { expect, it } from "vitest";
import { calendarPlans } from "@/components/FamilyCalendar";
import type { CalendarEvent } from "@/types/api";

it("places HA events on home-timezone days with exclusive ends and clips multi-day events to the visible range", () => {
  const plans = (start: CalendarEvent["start"], end: CalendarEvent["end"]) => calendarPlans({ summary: "Trip", start, end }, "calendar.family", "everyone", "2026-10-24", "2026-10-27", "Europe/Oslo", 0);
  expect(plans({ date: "2026-10-23" }, { date: "2026-10-26" }).map(e => [e.date, e.allDay])).toEqual([["2026-10-24", true], ["2026-10-25", true]]);
  expect(plans("2026-10-24T21:30:00Z", "2026-10-25T23:00:00Z").map(e => [e.date, e.time, e.continues])).toEqual([["2026-10-24", "23:30", false], ["2026-10-25", "00:00", true]]);
  expect(plans({ dateTime: "2026-10-25T23:30:00Z" }, { dateTime: "2026-10-26T01:00:00Z" }).map(e => [e.date, e.time])).toEqual([["2026-10-26", "00:30"]]);
  expect(plans("2026-10-23", "2026-10-24")).toEqual([]);
});
