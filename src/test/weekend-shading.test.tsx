import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FamilyWeekGrid } from "@/components/FamilyCalendar";
import { CalendarMonth } from "@/components/CalendarViews";
import { calendarRange } from "@/lib/family-calendar";
import { createI18n } from "@/lib/i18n";
import { addDays, isWeekend, type FamilyMember } from "@/contexts/FamilyContext";

const members: FamilyMember[] = [{ id: "alex", name: "Alex Example", initials: "AE", color: "#3366cc" }];
const mocks = vi.hoisted(() => ({ today: "2026-10-21" }));
vi.mock("@/hooks/use-i18n", () => ({ useI18n: () => createI18n("en") }));
vi.mock("@/contexts/FamilyContext", async original => ({ ...await original<typeof import("@/contexts/FamilyContext")>(), useFamily: () => ({
  today: mocks.today, time: "08:00", members, allMembers: members, calendar: { view: "week", startDay: "monday" }, setCalendarSettings: () => {},
  memberName: () => "Alex Example", memberColor: () => "#3366cc",
}) }));

beforeEach(() => { mocks.today = "2026-10-21"; });
afterEach(cleanup);

const weekendColumns = (start: string) => {
  render(<FamilyWeekGrid start={start} events={[]} members={members} onEdit={() => {}} onAdd={() => {}} />);
  const table = within(screen.getByRole("region", { name: "Family weekly calendar" })).getByRole("table");
  const headers = [...table.querySelectorAll("thead th[scope=col]")].slice(1);
  const cols = [...table.querySelectorAll("col")].slice(1);
  const dates = headers.map(header => header.querySelector("time")!.getAttribute("datetime"));
  // Header cells and their columns agree, so the shade follows the date rather than a column position.
  expect(cols.map(col => col.hasAttribute("data-weekend"))).toEqual(headers.map(header => header.hasAttribute("data-weekend")));
  return dates.filter((_, index) => headers[index].hasAttribute("data-weekend"));
};

it("treats Saturday and Sunday as the weekend across both daylight-saving changes", () => {
  // Europe moves its clocks on Sunday 29 March and Sunday 25 October 2026.
  expect(["2026-03-27", "2026-03-28", "2026-03-29", "2026-03-30"].map(isWeekend)).toEqual([false, true, true, false]);
  expect(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"].map(isWeekend)).toEqual([false, true, true, false]);
  expect(Array.from({ length: 14 }, (_, i) => addDays("2026-10-19", i)).filter(isWeekend)).toEqual(["2026-10-24", "2026-10-25", "2026-10-31", "2026-11-01"]);
});

it("marks the weekend columns by date whichever day the week grid starts on", () => {
  // Week starting Monday, including the October daylight-saving change.
  expect(weekendColumns(calendarRange("2026-10-21", "week", "monday").start)).toEqual(["2026-10-24", "2026-10-25"]);
  cleanup();
  // Seven days from today (a Wednesday): the weekend falls mid-grid.
  expect(weekendColumns(calendarRange("2026-10-21", "week", "today").start)).toEqual(["2026-10-24", "2026-10-25"]);
  cleanup();
  // Seven days from a Sunday (the March change): the weekend sits at both ends.
  mocks.today = "2026-03-29";
  expect(weekendColumns(calendarRange("2026-03-29", "week", "today").start)).toEqual(["2026-03-29", "2026-04-04"]);
});

it("keeps today's column marker on a weekend day so its tint replaces the weekend shade", () => {
  mocks.today = "2026-10-24";
  render(<FamilyWeekGrid start="2026-10-19" events={[]} members={members} onEdit={() => {}} onAdd={() => {}} />);
  const table = screen.getByRole("table");
  const saturday = table.querySelectorAll("col")[6];
  expect(saturday).toHaveClass("week-today");
  expect(saturday).toHaveAttribute("data-weekend");
  expect(table.querySelector('th.week-today time[aria-current="date"]')).toHaveTextContent("Today");
});

it("shades the weekend days and weekday headings in the month view", () => {
  const { start, end } = calendarRange("2026-10-01", "month", "monday");
  render(<CalendarMonth date="2026-10-01" start={start} end={end} events={[]} onDay={() => {}} onEdit={() => {}} />);
  const month = screen.getByRole("region", { name: "Month view" });
  const headings = [...month.querySelectorAll(".calendar-month-weekdays > span")];
  expect(headings.filter(heading => heading.hasAttribute("data-weekend")).map(heading => heading.textContent)).toEqual(["Sat", "Sun"]);
  const weekend = [...month.querySelectorAll(".calendar-month-day[data-weekend] time")].map(time => time.getAttribute("datetime"));
  expect(weekend).toHaveLength(10);
  expect(weekend.every(date => isWeekend(date!))).toBe(true);
  expect(weekend).toContain("2026-10-25");
  // The outside-month Sunday that ends the grid keeps both its outside and weekend cues.
  expect(month.querySelector('.calendar-month-day.is-outside[data-weekend] time[datetime="2026-11-01"]')).not.toBeNull();
});
