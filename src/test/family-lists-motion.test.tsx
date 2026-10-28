import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ListPanel } from "@/components/FamilyLists";
import type { Entity } from "@/types/api";
import { state } from "./ha-fixtures";

const app = vi.hoisted(() => ({ haUrl: "http://ha.local:8123", homeOnline: true, currentHome: { entities: [] as Entity[] }, commands: {}, services: { todo: { update_item: { fields: {} } } }, todoItems: vi.fn(), command: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ connectedPlanner: true, todoLists: { "home|todo.daily": { kind: "daily", member: "everyone" } }, compareMembers: () => 0, isMemberVisible: () => true, memberName: () => "Everyone", memberColor: () => "#c4d5a3", members: [], allMembers: [] }) }));
beforeEach(() => {
  vi.resetAllMocks();
  app.currentHome.entities = [{ ...state("todo.daily", "1", { supported_features: 4 }), entityId: "todo.daily", preferenceId: "home|todo.daily", domain: "todo", name: "Daily", areaId: "unassigned" }];
});
afterEach(() => { cleanup(); delete document.documentElement.dataset.motionInput; vi.useRealTimers(); vi.restoreAllMocks(); });
it.each(["pointer", "keyboard"])("completes HA list items without the animation delay when reduced motion is enabled (%s)", async input => {
  document.documentElement.dataset.motionInput = input;
  const matchMedia = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({ ...matchMedia(query), matches: query.includes("prefers-reduced-motion") }));
  let completed = false;
  app.todoItems.mockImplementation(async () => [{ uid: "one", summary: "Set the table", status: completed ? "completed" : "needs_action" }]);
  app.command.mockImplementation(async () => { completed = true; });
  render(<MemoryRouter><ListPanel kind="daily" /></MemoryRouter>);
  const checkbox = await screen.findByRole("checkbox", { name: "Set the table" });
  await act(async () => fireEvent.click(checkbox));
  expect(screen.getByText("Completed (1)")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Set the table" })).toBeChecked();
});

it.each([false, true])("keeps only the clicked checkbox busy through command and refresh (initially completed: %s)", async completed => {
  const items = [{ uid: "one", summary: "Set the table", status: completed ? "completed" : "needs_action" }, { uid: "two", summary: "Water plants", status: "needs_action" }];
  app.todoItems.mockResolvedValue(items);
  let finishCommand: () => void;
  app.command.mockImplementation(() => new Promise<void>(resolve => { finishCommand = resolve; }));
  const view = render(<MemoryRouter><ListPanel kind="daily" /></MemoryRouter>);
  await screen.findByRole("checkbox", { name: "Water plants" });
  const checkbox = screen.getByRole("checkbox", { name: "Set the table" });
  fireEvent.click(checkbox);
  expect(checkbox).toHaveAttribute("aria-busy", "true");
  expect(checkbox).toBeDisabled();
  expect(checkbox).toHaveProperty("checked", completed);
  expect(screen.getByRole("checkbox", { name: "Water plants" })).toHaveAttribute("aria-busy", "false");
  expect(view.container.querySelectorAll(".lucide-loader-circle")).toHaveLength(1);

  // An entity update can refresh the list before the command has returned.
  app.currentHome.entities[0].lastUpdated = "next";
  await act(async () => view.rerender(<MemoryRouter><ListPanel kind="daily" /></MemoryRouter>));
  expect(app.todoItems).toHaveBeenCalledTimes(2);
  expect(checkbox).toHaveAttribute("aria-busy", "true");

  let finishRefresh: (value: typeof items) => void;
  app.todoItems.mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  await act(async () => finishCommand());
  expect(checkbox).toHaveAttribute("aria-busy", "true");
  expect(checkbox).toHaveProperty("checked", completed);
  await act(async () => finishRefresh(items.map(item => item.uid === "one" ? { ...item, status: completed ? "needs_action" : "completed" } : item)));
  expect(checkbox).toHaveAttribute("aria-busy", "false");
  expect(view.container.querySelector(".lucide-loader-circle")).not.toBeInTheDocument();
  expect(app.command).toHaveBeenCalledExactlyOnceWith("todo.daily", "update_item", { item: "one", status: completed ? "needs_action" : "completed" });
});

it("clears pending feedback after a failed refresh so the list can recover", async () => {
  const items = [{ uid: "one", summary: "Set the table", status: "needs_action" }];
  app.todoItems.mockResolvedValue(items);
  app.command.mockResolvedValue(undefined);
  const view = render(<MemoryRouter><ListPanel kind="daily" /></MemoryRouter>);
  const checkbox = await screen.findByRole("checkbox", { name: "Set the table" });
  app.todoItems.mockRejectedValueOnce(new Error("Could not refresh items"));
  fireEvent.click(checkbox);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not refresh items");
  expect(view.container.querySelector(".lucide-loader-circle")).not.toBeInTheDocument();
  const refresh = screen.getByRole("button", { name: "Refresh list" });
  await waitFor(() => expect(refresh).toBeEnabled());
  fireEvent.click(refresh);
  expect(await screen.findByRole("checkbox", { name: "Set the table" })).toBeEnabled();
});
