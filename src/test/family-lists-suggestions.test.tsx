import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ListPanel } from "@/components/FamilyLists";
import type { ListItem } from "@/contexts/FamilyContext";
import type { Entity } from "@/types/api";
import { state } from "./ha-fixtures";

const app = vi.hoisted(() => ({ haUrl: "http://ha.local:8123", homeOnline: true, currentHome: { entities: [] as Entity[] }, commands: {} as Record<string, { pending: boolean }>, services: { todo: { add_item: { fields: {} }, update_item: { fields: {} } } }, todoItems: vi.fn(), command: vi.fn() }));
const family = vi.hoisted(() => ({ connectedPlanner: true, todoLists: {} as Record<string, { kind: "shopping"; member: string }>, items: [] as ListItem[], today: "2026-01-01", compareMembers: () => 0, isMemberVisible: () => true, memberName: () => "Everyone", memberColor: () => "#c4d5a3", members: [], allMembers: [], addItem: vi.fn(), toggleItem: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/FamilyContext")>(), useFamily: () => family }));

beforeEach(() => {
  vi.resetAllMocks();
  app.commands = {};
  family.todoLists = { "home|todo.shopping": { kind: "shopping", member: "everyone" } };
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

it("keeps the quick-add draft, suggestions and item UID with their selected shopping list", async () => {
  const weekend = "home|todo.weekend";
  family.todoLists[weekend] = { kind: "shopping", member: "everyone" };
  family.connectedPlanner = true;
  app.currentHome.entities.push({ ...app.currentHome.entities[0], entityId: "todo.weekend", preferenceId: weekend, name: "Weekend shop" });
  app.todoItems.mockImplementation(async id => [{ uid: "shared-uid", summary: id === "todo.weekend" ? "Weekend milk" : "Oat milk", status: "completed" }]);
  app.command.mockResolvedValue(undefined);
  render(<MemoryRouter initialEntries={[{ pathname: "/lists", search: "?tab=shopping&list=home%7Ctodo.weekend", state: { addToList: weekend } }]}><ListPanel kind="shopping" /></MemoryRouter>);
  const input = await screen.findByRole("textbox", { name: "New item in Weekend shop" });
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: "milk" } });
  const picker = within(screen.getByRole("group", { name: "Shopping lists" }));
  expect(picker.getByRole("button", { name: "Weekend shop" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(picker.getByRole("button", { name: "Shopping" }));
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
  const other = screen.getByRole("textbox", { name: "New item in Shopping" });
  expect(other).toHaveValue("");
  fireEvent.change(other, { target: { value: "milk" } });
  expect(within(screen.getByRole("group", { name: "Existing items" })).getByRole("button", { name: "Oat milk" })).toBeEnabled();
  fireEvent.click(picker.getByRole("button", { name: "Weekend shop" }));
  expect(input).toHaveValue("milk");
  const suggestions = within(screen.getByRole("group", { name: "Existing items" }));
  expect(suggestions.queryByText("Oat milk")).toBeNull();
  await act(async () => fireEvent.click(suggestions.getByRole("button", { name: "Weekend milk" })));
  expect(app.command).toHaveBeenCalledExactlyOnceWith("todo.weekend", "update_item", { item: "shared-uid", status: "needs_action" });
});

it("requires a new destination when opening a link to a removed shopping list", async () => {
  family.connectedPlanner = true;
  render(<MemoryRouter initialEntries={["/lists?tab=shopping&list=removed"]}><ListPanel kind="shopping" /></MemoryRouter>);
  expect(screen.getByText(/This list is no longer linked/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Add item" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Shopping" }));
  expect(await screen.findByRole("checkbox", { name: "Milk" })).toBeVisible();
});

async function openSuggestions() {
  const view = render(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
  await screen.findByRole("checkbox", { name: "Milk" });
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
  const input = screen.getByRole("textbox", { name: /New / });
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
    expect(screen.getByRole("textbox", { name: /New / })).toHaveValue("");
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

it("shows pending feedback on the selected suggestion and permits retry after failure", async () => {
  family.connectedPlanner = true;
  let reject: (reason: Error) => void;
  app.command.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
  const { input } = await openSuggestions();
  const suggestion = screen.getByRole("button", { name: "Oat milk" });
  fireEvent.click(suggestion);
  expect(suggestion).toHaveAttribute("aria-busy", "true");
  expect(suggestion).toBeDisabled();
  fireEvent.click(suggestion);
  expect(app.command).toHaveBeenCalledTimes(1);
  expect(input).toHaveValue(" MIL ");
  await act(async () => reject(new Error("Could not update item")));
  expect(suggestion).toHaveAttribute("aria-busy", "false");
  expect(suggestion).toBeEnabled();
  expect(input).toHaveValue(" MIL ");
});
