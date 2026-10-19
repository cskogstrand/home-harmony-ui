import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ListPanel } from "@/components/FamilyLists";
import { state } from "./ha-fixtures";

const app = vi.hoisted(() => ({ haUrl: "http://ha.local:8123", homeOnline: true, currentHome: { entities: [] }, commands: {}, services: { todo: { update_item: { fields: {} } } }, todoItems: vi.fn(), command: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ connectedPlanner: true, todoLists: { "home|todo.daily": { kind: "daily", member: "everyone" } }, compareMembers: () => 0, isMemberVisible: () => true, memberName: () => "Everyone", members: [], allMembers: [] }) }));
afterEach(() => { cleanup(); delete document.documentElement.dataset.motionInput; vi.useRealTimers(); vi.restoreAllMocks(); });
it("completes HA list items without the animation delay when reduced motion is enabled", async () => {
  document.documentElement.dataset.motionInput = "pointer";
  const matchMedia = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({ ...matchMedia(query), matches: query.includes("prefers-reduced-motion") }));
  app.currentHome.entities = [{ ...state("todo.daily", "1", { supported_features: 4 }), entityId: "todo.daily", preferenceId: "home|todo.daily", domain: "todo", name: "Daily" }];
  let completed = false;
  app.todoItems.mockImplementation(async () => [{ uid: "one", summary: "Set the table", status: completed ? "completed" : "needs_action" }]);
  app.command.mockImplementation(async () => { completed = true; });
  render(<MemoryRouter><ListPanel kind="daily" /></MemoryRouter>);
  const checkbox = await screen.findByRole("checkbox", { name: "Set the table" });
  await act(async () => fireEvent.click(checkbox));
  expect(screen.getByText("Completed (1)")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Completed (1)"));
  expect(screen.getByRole("checkbox", { name: "Set the table" })).toBeChecked();
});
