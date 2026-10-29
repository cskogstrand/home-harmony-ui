import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCalendarTodos } from "@/hooks/use-calendar-todos";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { createI18n } from "@/lib/i18n";
import type { TodoListKind } from "@/contexts/FamilyContext";
import type { TodoItem } from "@/types/api";

const mocks = vi.hoisted(() => ({ app: { currentHome: null, homeOnline: true, haUrl: "http://ha.example", todoItems: vi.fn(), commands: {} }, family: { members: [{ id: "home|person.example" }], todoLists: {} as Record<string, { kind: TodoListKind; member: string }> } }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("@/contexts/FamilyContext", async original => ({ ...await original<typeof import("@/contexts/FamilyContext")>(), useFamily: () => mocks.family }));
vi.mock("@/hooks/use-i18n", () => ({ useI18n: () => createI18n("en") }));
const item: TodoItem = { uid: "example", summary: "Example deadline", status: "needs_action", due: "2026-10-29" };
const useTodos = (refresh = 0) => useCalendarTodos("2026-10-29", "2026-10-30", refresh);
beforeEach(() => {
  mocks.app.homeOnline = true;
  mocks.app.commands = {};
  mocks.app.currentHome = mapHome(Object.fromEntries(["example", "other", "shopping"].map(id => [`todo.${id}`, state(`todo.${id}`, "1", { friendly_name: id })])), emptyRegistries, "home");
  mocks.family.members = [{ id: "home|person.example" }];
  mocks.family.todoLists = {
    "home|todo.example": { kind: "tasks", member: "home|person.example" },
    "home|todo.other": { kind: "homework", member: "home|person.hidden" },
    "home|todo.shopping": { kind: "shopping", member: "everyone" },
  };
  mocks.app.todoItems.mockReset().mockResolvedValue([item]);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("reads visible people's lists only and removes completed tasks after an entity update", async () => {
  const { result, rerender } = renderHook(() => useTodos());
  await waitFor(() => expect(result.current.events).toHaveLength(1));
  expect(mocks.app.todoItems).toHaveBeenCalledExactlyOnceWith("todo.example");
  mocks.app.todoItems.mockResolvedValue([{ ...item, status: "completed" }]);
  mocks.app.currentHome.entities.find(entity => entity.entityId === "todo.example").lastUpdated = "2026-10-29T11:00:00Z";
  rerender();
  await waitFor(() => expect(result.current.events).toEqual([]));
});

it("retains healthy lists when another fails and retries without persisting task data", async () => {
  mocks.family.todoLists["home|todo.other"].member = "home|person.example";
  mocks.app.todoItems.mockImplementation(async id => { if (id === "todo.other") throw new Error("Failed"); return [item]; });
  const { result, rerender } = renderHook(({ refresh }) => useTodos(refresh), { initialProps: { refresh: 0 } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.events).toHaveLength(1);
  expect(result.current.errors).toEqual(["Could not read to-do list other. Check it in Home Assistant."]);
  mocks.app.todoItems.mockResolvedValue([item]);
  rerender({ refresh: 1 });
  await waitFor(() => expect(result.current.errors).toEqual([]));
  expect(result.current.events).toHaveLength(2);
});

it("polls idle lists, pauses during writes and clears results offline", async () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(() => useTodos());
  await act(async () => {});
  expect(result.current.events).toHaveLength(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(mocks.app.todoItems).toHaveBeenCalledTimes(2);
  mocks.app.commands = { "todo.example": { pending: true } };
  rerender();
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(mocks.app.todoItems).toHaveBeenCalledTimes(2);
  mocks.app.commands = {};
  mocks.app.todoItems.mockResolvedValue([{ ...item, status: "completed" }]);
  rerender();
  await act(async () => {});
  expect(result.current.events).toEqual([]);
  mocks.app.homeOnline = false;
  rerender();
  expect(result.current).toMatchObject({ events: [], errors: [], loading: false });
});

it("ignores late responses after the assignment is hidden and reports missing lists", async () => {
  let resolve: (items: TodoItem[]) => void;
  mocks.app.todoItems.mockImplementation(() => new Promise<TodoItem[]>(done => { resolve = done; }));
  const { result, rerender } = renderHook(() => useTodos());
  mocks.family.members = [];
  rerender();
  await act(async () => resolve([item]));
  expect(result.current.events).toEqual([]);
  mocks.family.members = [{ id: "home|person.example" }];
  mocks.family.todoLists = { "home|todo.missing": { kind: "tasks", member: "home|person.example" } };
  rerender();
  await waitFor(() => expect(result.current.errors).toHaveLength(1));
  expect(result.current.events).toEqual([]);
});
