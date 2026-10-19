import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ListPanel } from "@/components/FamilyLists";
import type { ListItem } from "@/contexts/FamilyContext";
import type { Entity } from "@/types/api";
import { state } from "./ha-fixtures";

const app = vi.hoisted(() => ({ haUrl: "http://ha.local:8123", homeOnline: true, currentHome: { entities: [] as Entity[] }, commands: {} as Record<string, { pending: boolean }>, services: { todo: { add_item: { fields: {} }, update_item: { fields: {} } } }, todoItems: vi.fn(), command: vi.fn() }));
const family = vi.hoisted(() => ({ connectedPlanner: true, todoLists: { "home|todo.shopping": { kind: "shopping", member: "everyone" } }, items: [] as ListItem[], today: "2026-01-01", compareMembers: () => 0, isMemberVisible: () => true, memberName: () => "Everyone", members: [], allMembers: [], addItem: vi.fn(), toggleItem: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/FamilyContext")>(), useFamily: () => family }));

beforeEach(() => {
  vi.resetAllMocks();
  app.commands = {};
  app.currentHome.entities = [{ ...state("todo.shopping", "1", { supported_features: 5 }), entityId: "todo.shopping", preferenceId: "home|todo.shopping", domain: "todo", name: "Shopping", areaId: "unassigned" }];
  family.items = [
    { id: "active", text: "Milk", kind: "shopping", member: "everyone", done: false },
    { id: "duplicate", text: " milk ", kind: "shopping", member: "everyone", done: true },
    { id: "completed", text: "Oat milk", kind: "shopping", member: "everyone", done: true },
  ];
  app.todoItems.mockImplementation(async () => family.items.map(item => ({ uid: item.id, summary: item.text, status: item.done ? "completed" : "needs_action" })));
  app.command.mockImplementation(async (_entity, _action, value) => { family.items.find(item => item.id === value.item)!.done = false; });
  family.addItem.mockReturnValue(true);
  family.toggleItem.mockReturnValue(true);
});
afterEach(cleanup);

async function openSuggestions() {
  const view = render(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
  await screen.findByRole("checkbox", { name: "Milk" });
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: " MIL " } });
  return { ...view, input };
}

describe.each([true, false])("shopping suggestions (Home Assistant: %s)", connected => {
  beforeEach(() => { family.connectedPlanner = connected; });

  it("disables active items, including completed duplicates with different casing or spaces", async () => {
    await openSuggestions();
    for (const name of ["Milk", "milk"]) {
      const suggestion = screen.getByRole("button", { name });
      expect(suggestion).toBeDisabled();
      fireEvent.click(suggestion);
    }
    expect(screen.getByRole("button", { name: "Oat milk" })).toBeEnabled();
    expect(app.command).not.toHaveBeenCalled();
    expect(family.toggleItem).not.toHaveBeenCalled();
    expect(family.addItem).not.toHaveBeenCalled();
  });

  it("immediately reopens the selected item instead of adding the partial search text", async () => {
    await openSuggestions();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Oat milk" })));
    if (connected) {
      expect(app.command).toHaveBeenCalledExactlyOnceWith("todo.shopping", "update_item", { item: "completed", status: "needs_action" });
      expect(screen.getByRole("checkbox", { name: "Oat milk" })).not.toBeChecked();
    } else expect(family.toggleItem).toHaveBeenCalledExactlyOnceWith("completed");
    expect(family.addItem).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("keeps the draft and composer when reopening fails", async () => {
    app.command.mockRejectedValue(new Error("Could not update item"));
    family.toggleItem.mockReturnValue(false);
    const { input } = await openSuggestions();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Oat milk" })));
    expect(input).toHaveValue(" MIL ");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

it.each(["pending", "unsupported"])("disables Home Assistant suggestions when an update is %s", async reason => {
  family.connectedPlanner = true;
  const { rerender } = await openSuggestions();
  if (reason === "pending") app.commands = { "todo.shopping": { pending: true } };
  else app.currentHome.entities[0].attributes.supported_features = 1;
  rerender(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
  const suggestion = screen.getByRole("button", { name: "Oat milk" });
  expect(suggestion).toBeDisabled();
  fireEvent.click(suggestion);
  expect(app.command).not.toHaveBeenCalled();
});
