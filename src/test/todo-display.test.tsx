import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ListPanel, HomeAssistantList } from "@/components/FamilyLists";
import { defaultTodoDisplay, type TodoDisplay } from "../../shared/configuration";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import { state } from "./ha-fixtures";

const app = vi.hoisted(() => ({ haUrl: "http://ha.local:8123", homeOnline: true, currentHome: null, commands: {}, services: { todo: { update_item: { fields: {} } } }, todoItems: vi.fn(), command: vi.fn() }));
const family = vi.hoisted(() => ({ connectedPlanner: true, todoLists: { "home|todo.example": { kind: "shopping", member: "everyone", display: undefined as TodoDisplay | undefined } }, today: "2026-10-28", allMembers: [], memberColor: () => "#aabbcc", compareMembers: () => 0, isMemberVisible: () => true, memberName: () => "Example person" }));
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("@/contexts/FamilyContext", async original => ({ ...await original<typeof import("@/contexts/FamilyContext")>(), useFamily: () => family }));
vi.mock("framer-motion", async original => ({ ...await original<typeof import("framer-motion")>(), useReducedMotion: () => motion.reduced }));
beforeEach(() => {
  vi.resetAllMocks();
  motion.reduced = false;
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay };
  app.currentHome = mapHome({ "todo.example": state("todo.example", "1", { supported_features: 84 }) }, emptyRegistries, "home");
  document.documentElement.dataset.motionInput = "pointer";
});
afterEach(() => { cleanup(); delete document.documentElement.dataset.motionInput; });
const renderList = () => render(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
const pendingItem = { uid: "one", summary: "Example task", status: "needs_action", description: "Example details", due: "2026-10-29" };

it.each(["inline", "under", "hide"] as const)("renders completed items %s while keeping open items editable", async completed => {
  family.todoLists["home|todo.example"].display.completed = completed;
  app.todoItems.mockResolvedValue([{ uid: "done", summary: "Finished example", status: "completed" }, pendingItem]);
  const view = renderList();
  expect(await screen.findByRole("checkbox", { name: "Example task" })).not.toBeChecked();
  expect(screen.getByText("Example details")).toBeVisible();
  expect(view.container.querySelector(".todo-due")).toBeVisible();
  if (completed === "under") { expect(screen.getByText("Completed (1)")).toBeVisible(); fireEvent.click(screen.getByText("Completed (1)")); }
  else expect(screen.queryByText("Completed (1)")).not.toBeInTheDocument();
  if (completed === "hide") expect(screen.queryByRole("checkbox", { name: "Finished example" })).not.toBeInTheDocument();
  else expect(screen.getByRole("checkbox", { name: "Finished example" })).toBeChecked();
  if (completed === "inline") expect(screen.getAllByRole("checkbox").map(input => input.getAttribute("aria-label"))).toEqual(["Finished example", "Example task"]);
});

it.each([false, true])("hides details and due dates without removing source data (School: %s)", async school => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, showDetails: false, showDueDate: false };
  app.todoItems.mockResolvedValue([pendingItem]);
  const view = render(<MemoryRouter><HomeAssistantList preferenceId="home|todo.example" member="everyone" kind="homework" school={school} /></MemoryRouter>);
  await screen.findByRole("checkbox", { name: "Example task" });
  expect(screen.queryByText("Example details")).not.toBeInTheDocument();
  expect(view.container.querySelector(".todo-due")).not.toBeInTheDocument();
  if (!school) {
    fireEvent.click(screen.getByRole("button", { name: "Edit Example task" }));
    expect(screen.getByLabelText("Description")).toHaveValue("Example details");
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-10-29");
  }
});

it.each(["inline", "under", "hide"] as const)("celebrates only after the clicked item is confirmed complete (%s)", async completed => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, completed, celebrate: true };
  app.todoItems.mockResolvedValue([pendingItem]);
  let finishCommand: () => void;
  app.command.mockImplementation(() => new Promise<void>(resolve => { finishCommand = resolve; }));
  renderList();
  const checkbox = await screen.findByRole("checkbox", { name: "Example task" });
  fireEvent.click(checkbox);
  expect(document.querySelector(".todo-celebration")).toBeNull();
  let finishRefresh: (items: typeof pendingItem[]) => void;
  app.todoItems.mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  await act(async () => finishCommand());
  expect(document.querySelector(".todo-celebration")).toBeNull();
  await act(async () => finishRefresh([{ ...pendingItem, status: "completed" }]));
  expect(document.querySelectorAll(".todo-celebration i")).toHaveLength(12);
  await waitFor(() => expect(document.querySelector(".todo-celebration")).toBeNull());
});

it.each(["disabled", "keyboard", "failed command", "failed refresh", "unconfirmed"])("does not celebrate %s", async mode => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, celebrate: mode !== "disabled" };
  if (mode === "keyboard") document.documentElement.dataset.motionInput = "keyboard";
  app.todoItems.mockResolvedValueOnce([pendingItem]);
  if (mode === "failed refresh") app.todoItems.mockRejectedValue(new Error("Example refresh failure"));
  else app.todoItems.mockResolvedValue([{ ...pendingItem, status: mode === "unconfirmed" ? "needs_action" : "completed" }]);
  if (mode === "failed command") app.command.mockRejectedValue(new Error("Example command failure"));
  else app.command.mockResolvedValue(undefined);
  renderList();
  fireEvent.click(await screen.findByRole("checkbox", { name: "Example task" }));
  await act(async () => {});
  expect(document.querySelector(".todo-celebration")).toBeNull();
});

it("keeps the completion origin when a live update removes the row before the command returns", async () => {
  motion.reduced = true;
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, completed: "hide", celebrate: true };
  app.todoItems.mockResolvedValue([pendingItem]);
  let finishCommand: () => void;
  app.command.mockImplementation(() => new Promise<void>(resolve => { finishCommand = resolve; }));
  const view = renderList();
  const checkbox = await screen.findByRole("checkbox", { name: "Example task" });
  fireEvent.click(checkbox);
  app.todoItems.mockResolvedValue([{ ...pendingItem, status: "completed" }]);
  app.currentHome.entities[0].lastUpdated = "confirmed-update";
  view.rerender(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
  await waitFor(() => expect(checkbox).not.toBeInTheDocument());
  expect(document.querySelector(".todo-celebration")).toBeNull();
  await act(async () => finishCommand());
  expect(document.querySelectorAll(".todo-celebration-reduced i")).toHaveLength(1);
});

it("uses a stationary fade with reduced motion and does not replay it when reopening", async () => {
  motion.reduced = true;
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, completed: "inline", celebrate: true };
  app.todoItems.mockResolvedValueOnce([pendingItem]).mockResolvedValue([{ ...pendingItem, status: "completed" }]);
  app.command.mockResolvedValue(undefined);
  const view = renderList();
  fireEvent.click(await screen.findByRole("checkbox", { name: "Example task" }));
  await act(async () => {});
  expect(document.querySelectorAll(".todo-celebration-reduced i")).toHaveLength(1);
  await waitFor(() => expect(document.querySelector(".todo-celebration")).toBeNull());
  app.todoItems.mockResolvedValue([pendingItem]);
  fireEvent.click(screen.getByRole("checkbox", { name: "Example task" }));
  await act(async () => {});
  expect(document.querySelector(".todo-celebration")).toBeNull();
  view.unmount();
  expect(document.querySelector(".todo-celebration")).toBeNull();
});
