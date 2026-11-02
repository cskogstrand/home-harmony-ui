import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCalendarPlans } from "@/hooks/use-calendar-plans";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { createI18n } from "@/lib/i18n";
import type { CalendarEvent } from "@/types/api";

const mocks = vi.hoisted(() => ({ app: { currentHome: null, homeOnline: true, haUrl: "http://ha.example", watchCalendarEvents: vi.fn() }, family: {
  members: [{ id: "example" }], calendarMembers: { "home|calendar.example": "example", "home|calendar.other": "example" }, events: [],
  compareMembers: () => 0, isMemberVisible: () => true,
} }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("@/contexts/FamilyContext", async original => ({ ...await original<typeof import("@/contexts/FamilyContext")>(), useFamily: () => mocks.family }));
vi.mock("@/hooks/use-i18n", () => ({ useI18n: () => createI18n("en") }));
vi.mock("@/hooks/use-calendar-todos", () => ({ useCalendarTodos: () => ({ events: [], errors: [], loading: false }) }));
const event = (summary: string): CalendarEvent => ({ summary, start: { date: "2026-10-29" }, end: { date: "2026-10-30" } });
const receive = (call: number, events: CalendarEvent[] | null) => act(() => mocks.app.watchCalendarEvents.mock.calls[call][4](events));
beforeEach(() => {
  mocks.app.homeOnline = true; mocks.app.haUrl = "http://ha.example";
  mocks.app.watchCalendarEvents.mockReset();
  mocks.app.currentHome = mapHome(Object.fromEntries(["example", "other"].map(id => [`calendar.${id}`, state(`calendar.${id}`, "off")])), emptyRegistries, "home");
});
afterEach(cleanup);

it("keeps all calendars visible through partial refreshes and transient errors, then accepts deletions", () => {
  const { result } = renderHook(() => useCalendarPlans("2026-10-29", "2026-10-30"));
  expect(result.current.loading).toBe(true);
  receive(0, [event("First plan")]); receive(1, [event("Second plan")]);
  const titles = () => result.current.events.map(item => item.title).sort();
  expect(titles()).toEqual(["First plan", "Second plan"]);
  act(() => result.current.refresh());
  expect(mocks.app.watchCalendarEvents.mock.calls[0][3].aborted).toBe(true);
  expect(titles()).toEqual(["First plan", "Second plan"]);
  expect(result.current.loading).toBe(false);
  receive(2, [event("Updated plan")]);
  expect(titles()).toEqual(["Second plan", "Updated plan"]);
  receive(3, null);
  expect(titles()).toEqual(["Second plan", "Updated plan"]);
  expect(result.current.errors).toHaveLength(1);
  receive(3, []);
  expect(titles()).toEqual(["Updated plan"]);
  expect(result.current.errors).toEqual([]);
});

it("keeps last known plans during reconnect but never carries them into another range or home", () => {
  const { result, rerender } = renderHook(({ start, end }) => useCalendarPlans(start, end), { initialProps: { start: "2026-10-29", end: "2026-10-30" } });
  receive(0, [event("Example plan")]); receive(1, []);
  mocks.app.homeOnline = false; rerender({ start: "2026-10-29", end: "2026-10-30" });
  expect(result.current.events).toHaveLength(1);
  mocks.app.homeOnline = true; rerender({ start: "2026-10-29", end: "2026-10-30" });
  expect(result.current.events).toHaveLength(1);
  expect(result.current.loading).toBe(false);
  rerender({ start: "2026-10-30", end: "2026-10-31" });
  receive(2, [event("Late response")]);
  expect(result.current.events).toEqual([]);
  expect(result.current.loading).toBe(true);
  receive(4, [{ ...event("Next day"), start: { date: "2026-10-30" }, end: { date: "2026-10-31" } }]); receive(5, []);
  expect(result.current.events).toHaveLength(1);
  mocks.app.haUrl = "http://other.example"; rerender({ start: "2026-10-30", end: "2026-10-31" });
  expect(result.current.events).toEqual([]);
});
