import { expect, it } from "vitest";
import { calendarPlans, calendarRange, moveCalendarDate, todoPlans, uniqueCalendarPlans, weekEventRows } from "@/lib/family-calendar";
import { addDays, eventTimeLabel, weekNumber } from "@/contexts/FamilyContext";
import type { CalendarEvent, TodoItem } from "@/types/api";

it("places only unfinished dated to-dos within the visible range, in the home time zone", () => {
  const items: TodoItem[] = [
    { uid: "date", summary: "Example task", status: "needs_action", due: "2026-10-25", description: "Example notes" },
    { uid: "timed", summary: "Timed task", status: "needs_action", due: "2026-10-25T23:30:00Z" },
    { uid: "done", summary: "Completed", status: "completed", due: "2026-10-25" },
    ...[undefined, null, "invalid", "2026-02-30", "2026-10-24", "2026-10-27"].map((due, index) => ({ uid: `skip-${index}`, summary: "Excluded", status: "needs_action" as const, due })),
  ];
  const plans = todoPlans(items, "home|todo.example", "tasks", "home|person.example", "2026-10-25", "2026-10-27", "Europe/Oslo");
  expect(plans).toHaveLength(2);
  expect(plans[0]).toMatchObject({ date: "2026-10-25", time: "00:00", allDay: true, note: "Example notes", member: "home|person.example", todo: { list: "home|todo.example", kind: "tasks" } });
  expect(plans[1]).toMatchObject({ date: "2026-10-26", time: "00:30", allDay: false });
  expect(todoPlans(items, "home|todo.other", "tasks", "home|person.example", "2026-10-25", "2026-10-27", "Europe/Oslo")[0].id).not.toBe(plans[0].id);
  expect(todoPlans(items, "home|todo.example", "tasks", "home|person.example", "2026-10-26", "2026-10-27", "Europe/Oslo")[0].id).toBe(plans[1].id);
});

it("covers complete Monday-first month grids, including leap days and year boundaries", () => {
  expect(calendarRange("2026-10-31", "month", "today")).toEqual({ start: "2026-09-28", end: "2026-11-02" });
  expect(calendarRange("2024-02-29", "month", "monday")).toEqual({ start: "2024-01-29", end: "2024-03-04" });
  expect(calendarRange("2027-01-01", "month", "monday")).toEqual({ start: "2026-12-28", end: "2027-02-01" });
  expect(calendarRange("2026-10-31", "week", "monday")).toEqual({ start: "2026-10-26", end: "2026-11-02" });
  expect(calendarRange("2026-10-31", "week", "today")).toEqual({ start: "2026-10-31", end: "2026-11-07" });
  expect(calendarRange("2026-10-25", "day", "monday")).toEqual({ start: "2026-10-25", end: "2026-10-26" });
});

it("moves the chosen period without overflowing short months or DST days", () => {
  expect(moveCalendarDate("2024-01-31", "month", 1)).toBe("2024-02-29");
  expect(moveCalendarDate("2026-03-31", "month", -1)).toBe("2026-02-28");
  expect(moveCalendarDate("2026-12-31", "month", 1)).toBe("2027-01-31");
  expect(moveCalendarDate("2026-10-25", "day", 1)).toBe("2026-10-26");
  expect(moveCalendarDate("2026-03-29", "week", -1)).toBe("2026-03-22");
});

it.each([
  ["2026-10-18", 42], ["2026-10-19", 43],
  ["2024-12-30", 1], ["2026-12-28", 53],
  ["2027-01-01", 53], ["2027-01-03", 53], ["2027-01-04", 1],
])("uses ISO week numbers for %s", (date, expected) => {
  expect(weekNumber(date)).toBe(expected);
});

it("places HA events on home-timezone days with exclusive ends and clips multi-day events to the visible range", () => {
  const plans = (start: CalendarEvent["start"], end: CalendarEvent["end"]) => calendarPlans({ summary: "Trip", start, end }, "calendar.family", "everyone", "2026-10-24", "2026-10-27", "Europe/Oslo", 0);
  expect(plans({ date: "2026-10-23" }, { date: "2026-10-26" }).map(e => [e.date, e.allDay])).toEqual([["2026-10-24", true], ["2026-10-25", true]]);
  expect(plans("2026-10-24T21:30:00Z", "2026-10-25T23:00:00Z").map(e => [e.date, e.time, e.continues])).toEqual([["2026-10-24", "23:30", false], ["2026-10-25", "00:00", true]]);
  expect(plans({ dateTime: "2026-10-25T23:30:00Z" }, { dateTime: "2026-10-26T01:00:00Z" }).map(e => [e.date, e.time])).toEqual([["2026-10-26", "00:30"]]);
  expect(plans("2026-10-23", "2026-10-24")).toEqual([]);
});

it("retains original dates and recurrence identity on every displayed day", () => {
  const event = { uid: "trip", recurrence_id: "20261023", rrule: "FREQ=WEEKLY", summary: "Trip", start: { date: "2026-10-23" }, end: { date: "2026-10-27" } };
  const plans = calendarPlans(event, "calendar.family", "everyone", "2026-10-24", "2026-10-26", "Europe/Oslo", 0);
  expect(plans).toHaveLength(2);
  for (const plan of plans) expect(plan.calendarEvent).toBe(event);
});

it.each([
  ["2026-10-24T13:00:00Z", "2026-10-24T14:30:00Z", "2026-10-24", "15:00 – 16:30"],
  ["2026-10-24T21:30:00Z", "2026-10-25T02:00:00Z", "2026-10-24", "23:30 – Sun 25 Oct, 03:00"],
  ["2026-10-24T21:30:00Z", "2026-10-25T02:00:00Z", "2026-10-25", "Continues – 03:00"],
  ["2026-10-24T21:30:00Z", "2026-10-24T22:00:00Z", "2026-10-24", "23:30 – Sun 25 Oct, 00:00"],
  ["2026-10-24", "2026-10-26", "2026-10-24", "All day"],
])("shows HA end times in the home timezone: %s to %s, viewed on %s", (start, end, day, expected) => {
  const [plan] = calendarPlans({ summary: "Trip", start, end }, "calendar.family", "everyone", day, addDays(day, 1), "Europe/Oslo", 0);
  expect(eventTimeLabel(plan)).toBe(expected);
});

it("packs overlapping spans into separate rows and clips both ends of the week", () => {
  const start = "2026-10-24", end = "2026-10-31";
  const trip = { uid: "trip", summary: "Trip", start: "2026-10-23", end: "2026-10-27" };
  const appointment = { summary: "Appointment", start: "2026-10-25T09:00:00Z", end: "2026-10-25T10:00:00Z" };
  const next = { ...trip, start: "2026-10-27", end: "2026-10-28" };
  const tail = { summary: "Away", start: "2026-10-29", end: "2026-11-03" };
  const plans = [trip, appointment, next, tail].flatMap((event, index) => calendarPlans(event, "calendar.family", "everyone", start, end, "Europe/Oslo", index));
  const local = { id: "local", title: "Local plan", date: "2026-10-26", time: "12:00", member: "everyone", location: "", note: "" };
  const rows = weekEventRows([...plans, local, { ...local, id: "outside", date: end }].reverse(), start);
  expect(rows.map(row => row.map(({ event, start, end }) => [event.title, start, end]))).toEqual([
    [["Trip", 0, 3], ["Trip", 3, 4], ["Away", 5, 7]],
    [["Appointment", 1, 2], ["Local plan", 2, 3]],
  ]);
  expect(rows[0][0].event.calendarEvent).toBe(trip);
  expect(rows[0][0].event.calendarSpan).toMatchObject({ firstDay: "2026-10-23", lastDay: "2026-10-26" });
  expect(rows[0][2].event.calendarSpan).toMatchObject({ firstDay: "2026-10-29", lastDay: "2026-11-02" });
  expect(weekEventRows([], start)).toEqual([[]]);
});

it("groups only the same calendar occurrence, including events without a UID", () => {
  const event = { uid: "series", recurrence_id: "first", summary: "Trip", start: "2026-10-24", end: "2026-10-27" };
  const expand = (event: CalendarEvent, calendar = "calendar.family", index = 0) => calendarPlans(event, calendar, "everyone", "2026-10-24", "2026-10-31", "Europe/Oslo", index);
  const plans = [
    ...expand(event), ...expand({ ...event, recurrence_id: "second" }), ...expand(event, "calendar.work"),
    ...expand({ ...event, uid: undefined }, "calendar.family", 3), ...expand({ ...event, uid: undefined }, "calendar.family", 4),
  ];
  expect(uniqueCalendarPlans(plans)).toHaveLength(5);
  expect(new Set(plans.map(plan => plan.id)).size).toBe(plans.length);
  expect(uniqueCalendarPlans(plans.filter(plan => plan.date === "2026-10-25"))).toHaveLength(5);
});

it.each([
  ["2026-03-28T21:00:00Z", "2026-03-29T06:00:00Z", "2026-03-28", "2026-03-29", 2],
  ["2026-10-24T20:00:00Z", "2026-10-25T07:00:00Z", "2026-10-24", "2026-10-25", 2],
  ["2026-10-24T20:00:00Z", "2026-10-24T22:00:00Z", "2026-10-24", "2026-10-24", 1],
  ["2026-10-24", "2026-10-26", "2026-10-24", "2026-10-25", 2],
])("spans the occupied home-timezone days from %s to %s", (from, to, firstDay, lastDay, width) => {
  const plans = calendarPlans({ summary: "Trip", start: from, end: to }, "calendar.family", "everyone", firstDay, addDays(firstDay, 7), "Europe/Oslo", 0);
  const rows = weekEventRows(plans, firstDay);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toHaveLength(1);
  expect(rows[0][0].end - rows[0][0].start).toBe(width);
  expect(rows[0][0].event.calendarSpan).toMatchObject({ firstDay, lastDay });
});
