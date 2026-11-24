import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CalendarViewControls, FamilyWeekGrid } from "@/components/FamilyCalendar";
import { createI18n, type Language } from "@/lib/i18n";
import type { FamilyEvent, FamilyMember } from "@/contexts/FamilyContext";

const members: FamilyMember[] = [
  { id: "alex", name: "Alex Example", initials: "AE", color: "#3366cc" },
  { id: "sam", name: "Sam Sample", initials: "SS", color: "#cc6633" },
];
const mocks = vi.hoisted(() => ({ language: "en" as Language, today: "2026-10-28", time: "08:00" }));
vi.mock("@/hooks/use-i18n", () => ({ useI18n: () => createI18n(mocks.language) }));
vi.mock("@/contexts/FamilyContext", async original => ({ ...await original<typeof import("@/contexts/FamilyContext")>(), useFamily: () => ({
  today: mocks.today, time: mocks.time, members, allMembers: members, calendar: { view: "week", startDay: "monday" }, setCalendarSettings: () => {},
  memberName: (id: string) => members.find(member => member.id === id)?.name ?? id,
  memberColor: (id: string) => members.find(member => member.id === id)?.color ?? "#888888",
}) }));

const start = "2026-10-26";
const plan = (values: Partial<FamilyEvent>): FamilyEvent => ({ id: values.title ?? "plan", title: "Plan", date: start, time: "09:00", member: "alex", location: "", note: "", ...values });
const renderGrid = (events: FamilyEvent[], props: Partial<Parameters<typeof FamilyWeekGrid>[0]> = {}) => {
  const onEdit = vi.fn(), onAdd = vi.fn(), onDay = vi.fn();
  render(<FamilyWeekGrid start={start} events={events} members={members} onEdit={onEdit} onAdd={onAdd} onDay={onDay} {...props} />);
  return { grid: within(screen.getByRole("region", { name: /weekly calendar|ukekalender/ })), onEdit, onAdd, onDay };
};

beforeEach(() => { mocks.language = "en"; mocks.today = "2026-10-28"; mocks.time = "08:00"; });
afterEach(cleanup);

it("keeps the full title as the event's accessible name and marks the grid with the active language for hyphenation", () => {
  const title = "Extraordinarily long autumn holiday rehearsal at the community centre";
  const { grid } = renderGrid([plan({ title })]);
  expect(grid.getByRole("button", { name: new RegExp(`^${title}`) })).toBeInTheDocument();
  expect(grid.getByRole("table")).toHaveAttribute("lang", "en");
  cleanup();
  mocks.language = "nb";
  expect(renderGrid([plan({ title })]).grid.getByRole("table")).toHaveAttribute("lang", "nb");
});

it("shows a day's waste pickups as one chip that opens the combined read-only entry", () => {
  const pickup = (title: string, note = "") => plan({ id: `waste-${title}`, title, note, date: "2026-10-27", allDay: true, time: "00:00", wasteCollection: true, calendarId: "calendar.waste" });
  const { grid, onEdit } = renderGrid([pickup("Paper", "Example notes"), pickup("Plastic"), plan({ id: "glass", title: "Glass", date: "2026-10-29", allDay: true, wasteCollection: true, calendarId: "calendar.waste" }), plan({ title: "Example plan", date: "2026-10-27" })]);
  const chip = grid.getByRole("button", { name: "2 pickups: Paper · Plastic, Waste collection" });
  expect(chip).toHaveClass("week-waste-chip");
  expect(chip).toHaveAttribute("title", "Paper · Plastic");
  expect(chip.querySelectorAll(".waste-collection-icons svg")).toHaveLength(2);
  expect(grid.getByRole("button", { name: "Glass, Waste collection" })).toHaveClass("week-waste-chip");
  expect(grid.getAllByRole("button", { name: /Paper|Plastic/ })).toEqual([chip]);
  expect(grid.getByRole("button", { name: /^Example plan/ })).toHaveClass("event-button");
  chip.click();
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ title: "Paper · Plastic", note: "Example notes", wasteCollection: true }));
});

it("marks a chip picked up from 09:00 on its day", () => {
  mocks.today = "2026-10-27"; mocks.time = "09:00";
  const { grid } = renderGrid([plan({ title: "Paper", date: "2026-10-27", allDay: true, wasteCollection: true, calendarId: "calendar.waste" })]);
  expect(grid.getByRole("button", { name: "Paper, Picked up today" })).toHaveAttribute("data-state", "collected");
});

it("offers one add control per person row that opens the editor for that person, starting today when it is in view", () => {
  const { grid, onAdd, onDay } = renderGrid([plan({ title: "Example plan" }), plan({ title: "Overlap", time: "09:30" })]);
  const adds = grid.getAllByRole("button", { name: /^Add a plan/ });
  expect(adds.map(button => button.getAttribute("aria-label"))).toEqual(["Add a plan for Alex Example", "Add a plan for Sam Sample"]);
  for (const button of adds) expect(button.closest("th")).toHaveAttribute("scope", "rowgroup");
  adds[1].click();
  expect(onAdd).toHaveBeenCalledExactlyOnceWith("2026-10-28", "sam");
  grid.getByRole("button", { name: "Thursday, 29 October 2026" }).click();
  expect(onDay).toHaveBeenCalledExactlyOnceWith("2026-10-29");
  cleanup();
  mocks.today = "2026-11-10";
  const later = renderGrid([]);
  later.grid.getByRole("button", { name: "Add a plan for Alex Example" }).click();
  expect(later.onAdd).toHaveBeenCalledExactlyOnceWith(start, "alex");
  cleanup();
  expect(renderGrid([], { compact: true }).grid.queryAllByRole("button", { name: /^Add a plan/ })).toEqual([]);
});

it("explains local filters inside the calendar settings popover instead of beneath the toolbar", async () => {
  render(<CalendarViewControls note="View and person filters apply to this screen only." />);
  expect(screen.queryByText("View and person filters apply to this screen only.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Calendar settings" }));
  expect(await screen.findByText("View and person filters apply to this screen only.")).toBeInTheDocument();
  cleanup();
  render(<CalendarViewControls />);
  fireEvent.click(screen.getByRole("button", { name: "Calendar settings" }));
  expect(await screen.findByRole("button", { name: /Weekly grid/ })).toBeInTheDocument();
  expect(screen.queryByText(/apply to this screen only/)).not.toBeInTheDocument();
});

it("names each person row while their avatar stands in for the visible name on wide screens", () => {
  const { grid } = renderGrid([]);
  for (const member of members) {
    const header = grid.getByRole("rowheader", { name: member.name });
    expect(header.querySelector(".week-person")).toHaveAttribute("title", member.name);
  }
});
