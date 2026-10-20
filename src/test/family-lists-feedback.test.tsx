import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ListPanel } from "@/components/FamilyLists";
import type { ListItem } from "@/contexts/FamilyContext";
import type { Entity } from "@/types/api";
import { state } from "./ha-fixtures";

const app = vi.hoisted(() => ({ haUrl: "http://ha.local:8123", homeOnline: true, currentHome: { entities: [] as Entity[] }, commands: {}, services: { todo: { update_item: { fields: {} } } }, todoItems: vi.fn(), command: vi.fn() }));
const family = vi.hoisted(() => ({ connectedPlanner: true, todoLists: { "home|todo.shopping": { kind: "shopping", member: "everyone" } }, items: [] as ListItem[], today: "2026-01-01", compareMembers: () => 0, isMemberVisible: () => true, memberName: () => "Everyone", memberColor: () => "#c4d5a3", members: [], allMembers: [] }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/FamilyContext")>(), useFamily: () => family }));

beforeEach(() => {
  vi.resetAllMocks();
  document.documentElement.dataset.motionInput = "pointer";
  app.currentHome.entities = [{ ...state("todo.shopping", "1", { supported_features: 4 }), entityId: "todo.shopping", preferenceId: "home|todo.shopping", domain: "todo", name: "Shopping", areaId: "unassigned" }];
  family.items = [{ id: "bread", text: "Bread", kind: "shopping", member: "everyone", done: false }];
  app.todoItems.mockImplementation(async () => family.items.map(item => ({ uid: item.id, summary: item.text, status: item.done ? "completed" : "needs_action" })));
});
afterEach(() => { cleanup(); delete document.documentElement.dataset.motionInput; });

describe.each([true, false])("list change feedback (Home Assistant: %s)", connected => {
  beforeEach(() => { family.connectedPlanner = connected; });

  async function openList(limit?: number) {
    const view = render(<MemoryRouter><ListPanel kind="shopping" limit={limit} /></MemoryRouter>);
    await screen.findByRole("checkbox", { name: "Bread" });
    let revision = 0;
    const update = () => {
      app.currentHome.entities[0].lastUpdated = String(++revision);
      view.rerender(<MemoryRouter><ListPanel kind="shopping" limit={limit} /></MemoryRouter>);
    };
    return update;
  }

  it.each(["pointer", "keyboard"])("highlights additions and confirmed edits without replaying the initial list (%s)", async input => {
    document.documentElement.dataset.motionInput = input;
    const update = await openList();
    const bread = screen.getByRole("checkbox", { name: "Bread" }).closest(".check-row");
    expect(bread).not.toHaveAttribute("data-feedback");
    family.items = [...family.items, { id: "milk", text: "Milk", kind: "shopping", member: "everyone", done: false }];
    update();
    const milk = (await screen.findByRole("checkbox", { name: "Milk" })).closest(".check-row");
    await waitFor(() => expect(milk).toHaveAttribute("data-feedback", "added"));
    expect(bread).not.toHaveAttribute("data-feedback");
    await waitFor(() => expect(milk).not.toHaveAttribute("data-feedback"));
    family.items = family.items.map(item => item.id === "milk" ? { ...item, text: "Oat milk" } : item);
    update();
    await screen.findByRole("checkbox", { name: "Oat milk" });
    await waitFor(() => expect(milk).toHaveAttribute("data-feedback", "edited"));
    expect(app.command).not.toHaveBeenCalled();
  });

  it("does not highlight an existing item newly revealed by the dashboard limit", async () => {
    family.items.push({ id: "milk", text: "Milk", kind: "shopping", member: "everyone", done: false });
    const update = await openList(1);
    family.items = family.items.filter(item => item.id !== "bread");
    update();
    const milk = await screen.findByRole("checkbox", { name: "Milk" });
    expect(milk.closest(".check-row")).not.toHaveAttribute("data-feedback");
  });

});
