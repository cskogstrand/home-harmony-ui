import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FamilyWeekGrid } from "@/components/FamilyCalendar";
import { createI18n, type Language } from "@/lib/i18n";
import type { FamilyEvent, FamilyMember } from "@/contexts/FamilyContext";

const members: FamilyMember[] = [
  { id: "alex", name: "Alex Example", initials: "AE", color: "#3366cc" },
  { id: "sam", name: "Sam Sample", initials: "SS", color: "#cc6633" },
];
const mocks = vi.hoisted(() => ({ language: "en" as Language, today: "2026-10-28", time: "08:00" }));
vi.mock("@/hooks/use-i18n", () => ({ useI18n: () => createI18n(mocks.language) }));
vi.mock("@/contexts/FamilyContext", async original => ({ ...await original<typeof import("@/contexts/FamilyContext")>(), useFamily: () => ({
  today: mocks.today, time: mocks.time, members, allMembers: members,
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

beforeEach(() => { mocks.language = "en"; mocks.today = "2026-10-28"; });
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

it("names each person row while their avatar stands in for the visible name on wide screens", () => {
  const { grid } = renderGrid([]);
  for (const member of members) {
    const header = grid.getByRole("rowheader", { name: member.name });
    expect(header.querySelector(".week-person")).toHaveAttribute("title", member.name);
  }
});
