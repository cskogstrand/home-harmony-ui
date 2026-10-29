import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ListPanel, HomeAssistantList } from "@/components/FamilyLists";
import { TodoCelebration } from "@/components/TodoCelebration";
import { defaultTodoDisplay, type TodoDisplay } from "../../shared/configuration";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import { state } from "./ha-fixtures";

const app = vi.hoisted(() => ({ haUrl: "http://ha.local:8123", homeOnline: true, currentHome: null, commands: {}, services: { todo: { add_item: { fields: {} }, update_item: { fields: {} }, remove_item: { fields: {} } } }, todoItems: vi.fn(), command: vi.fn() }));
const family = vi.hoisted(() => ({ connectedPlanner: true, todoLists: { "home|todo.example": { kind: "shopping", member: "everyone", display: undefined as TodoDisplay | undefined } }, today: "2026-10-28", allMembers: [], memberColor: () => "#aabbcc", compareMembers: () => 0, isMemberVisible: () => true, memberName: () => "Example person" }));
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("@/contexts/FamilyContext", async original => ({ ...await original<typeof import("@/contexts/FamilyContext")>(), useFamily: () => family }));
vi.mock("framer-motion", async original => ({ ...await original<typeof import("framer-motion")>(), useReducedMotion: () => motion.reduced }));
beforeEach(() => {
  vi.resetAllMocks();
  motion.reduced = false;
  app.commands = {};
  app.homeOnline = true;
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay };
  app.currentHome = mapHome({ "todo.example": state("todo.example", "1", { supported_features: 84 }) }, emptyRegistries, "home");
  document.documentElement.dataset.motionInput = "pointer";
});
afterEach(() => { cleanup(); delete document.documentElement.dataset.motionInput; });
const renderList = () => render(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
const pendingItem = { uid: "one", summary: "Example task", status: "needs_action", description: "Example details", due: "2026-10-29" };

it.each(["inline", "under", "collapsed", "hide"] as const)("renders completed items %s while keeping open items editable", async completed => {
  family.todoLists["home|todo.example"].display.completed = completed;
  app.todoItems.mockResolvedValue([{ uid: "done", summary: "Finished example", status: "completed" }, pendingItem]);
  const view = renderList();
  expect(await screen.findByRole("checkbox", { name: "Example task" })).not.toBeChecked();
  expect(screen.getByText("Example details")).toBeVisible();
  expect(view.container.querySelector(".todo-due")).toBeVisible();
  if (completed === "under") expect(screen.getByText("Completed (1)").closest("details")).toHaveAttribute("open");
  else if (completed === "collapsed") {
    expect(screen.getByText("Completed (1)").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("checkbox", { name: "Finished example", hidden: true })).not.toBeVisible();
    fireEvent.click(screen.getByText("Completed (1)"));
    expect(screen.getByRole("checkbox", { name: "Finished example" })).toBeVisible();
  }
  else expect(screen.queryByText("Completed (1)")).not.toBeInTheDocument();
  if (completed === "hide") expect(screen.queryByRole("checkbox", { name: "Finished example" })).not.toBeInTheDocument();
  else expect(screen.getByRole("checkbox", { name: "Finished example" })).toBeChecked();
  if (completed === "inline") expect(screen.getAllByRole("checkbox").map(input => input.getAttribute("aria-label"))).toEqual(["Finished example", "Example task"]);
});

it.each(["shopping", "homework", "school"] as const)("hides details and due dates without removing source data (%s)", async surface => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, showDetails: false, showDueDate: false };
  app.todoItems.mockResolvedValue([pendingItem]);
  const view = render(<MemoryRouter><HomeAssistantList preferenceId="home|todo.example" member="everyone" kind={surface === "shopping" ? "shopping" : "homework"} school={surface === "school"} /></MemoryRouter>);
  await screen.findByRole("checkbox", { name: "Example task" });
  expect(screen.queryByText("Example details")).not.toBeInTheDocument();
  expect(view.container.querySelector(".todo-due")).not.toBeInTheDocument();
  if (surface === "shopping") {
    fireEvent.click(screen.getByRole("button", { name: "Edit Example task" }));
    expect(screen.getByLabelText("Description")).toHaveValue("Example details");
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-10-29");
  }
  expect(pendingItem.description).toBe("Example details");
  expect(pendingItem.due).toBe("2026-10-29");
});

it.each(["inline", "under", "collapsed", "hide"] as const)("sorts open and completed items without changing Home Assistant data (%s)", async completed => {
  family.todoLists["home|todo.example"].display.completed = completed;
  const items = [
    { uid: "z", summary: "Z task", status: "needs_action", due: "2026-10-28" },
    { uid: "b", summary: "B task", status: "needs_action", due: "2026-10-30" },
    { uid: "a", summary: "A task", status: "needs_action" },
    { uid: "d", summary: "D finished", status: "completed", due: "2026-10-29" },
    { uid: "c", summary: "C finished", status: "completed", due: "2026-10-31" },
  ];
  app.todoItems.mockResolvedValue(items);
  const view = renderList();
  await screen.findByRole("checkbox", { name: "Z task" });
  if (completed === "collapsed") fireEvent.click(screen.getByText("Completed (2)"));
  const order = () => screen.getAllByRole("checkbox").map(input => input.getAttribute("aria-label"));
  expect(order()).toEqual(completed === "hide" ? ["Z task", "B task", "A task"] : items.map(item => item.summary));
  family.todoLists["home|todo.example"].display.sort = "alphabetical";
  view.rerender(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
  expect(order()).toEqual(completed === "hide" ? ["A task", "B task", "Z task"] : completed === "inline" ? ["A task", "B task", "C finished", "D finished", "Z task"] : ["A task", "B task", "Z task", "C finished", "D finished"]);
  family.todoLists["home|todo.example"].display.sort = "due-date";
  view.rerender(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
  expect(order()).toEqual(completed === "hide" ? ["Z task", "B task", "A task"] : completed === "inline" ? ["Z task", "D finished", "B task", "C finished", "A task"] : ["Z task", "B task", "A task", "D finished", "C finished"]);
  expect(items.map(item => item.uid)).toEqual(["z", "b", "a", "d", "c"]);
  expect(app.command).not.toHaveBeenCalled();
});

it.each(["inline", "under", "collapsed", "hide"] as const)("celebrates only after the clicked item is confirmed complete (%s)", async completed => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, completed, celebrate: true };
  const otherItem = { ...pendingItem, uid: "two", summary: "Another task" };
  app.todoItems.mockResolvedValue([otherItem, pendingItem]);
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
  // A source reorder must not move the clicked row during its celebration.
  await act(async () => finishRefresh([{ ...pendingItem, status: "completed" }, otherItem]));
  expect(document.querySelectorAll(".todo-celebration i")).toHaveLength(32);
  expect(checkbox).toBeChecked();
  expect(checkbox.closest(".check-row-shell")).not.toHaveAttribute("aria-hidden");
  expect(screen.getAllByRole("checkbox").map(input => input.getAttribute("aria-label"))).toEqual(["Another task", "Example task"]);
  expect(screen.queryByText("Completed (1)")).not.toBeInTheDocument();
  await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 1200)); });
  expect(document.querySelector(".todo-celebration")).not.toBeNull();
  expect(checkbox.closest(".check-row-shell")).not.toHaveAttribute("aria-hidden");
  await waitFor(() => expect(document.querySelector(".todo-celebration")).toBeNull());
  if (completed === "inline") expect(checkbox.closest(".check-row-shell")).not.toHaveAttribute("aria-hidden");
  else expect(checkbox.closest(".check-row-shell")).toHaveAttribute("aria-hidden", "true");
  if (completed === "under") expect(screen.getByText("Completed (1)")).toBeInTheDocument();
  if (completed === "collapsed") expect(screen.getByText("Completed (1)").closest("details")).not.toHaveAttribute("open");
  expect(screen.getByRole("checkbox", { name: "Another task" })).toBeEnabled();
});

it.each(["disabled", "keyboard", "failed command", "failed refresh", "unconfirmed"])("does not celebrate %s", async mode => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, celebrate: mode !== "disabled", celebrateFinal: mode !== "disabled" };
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
  if (mode === "failed command" || mode === "unconfirmed") expect(screen.getByRole("checkbox", { name: "Example task" })).toBeEnabled();
  if (mode === "failed refresh") {
    app.todoItems.mockResolvedValue([pendingItem]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("checkbox", { name: "Example task" })).toBeEnabled();
  }
});

it("holds the row when a live update confirms completion before the command returns", async () => {
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
  await waitFor(() => expect(checkbox).toBeChecked());
  expect(checkbox.closest(".check-row-shell")).not.toHaveAttribute("aria-hidden");
  expect(document.querySelector(".todo-celebration")).toBeNull();
  await act(async () => finishCommand());
  expect(document.querySelectorAll(".todo-celebration-reduced i")).toHaveLength(1);
  await waitFor(() => expect(checkbox).not.toBeInTheDocument());
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

it.each([false, true])("waits for every browser animation to finish and cancels on unmount (whole list: %s)", async wholeList => {
  const animate = Element.prototype.animate;
  const finishes: (() => void)[] = [];
  const cancel = vi.fn();
  Element.prototype.animate = vi.fn(() => ({ finished: new Promise<void>(resolve => finishes.push(resolve)), cancel })) as unknown as typeof animate;
  try {
    const onComplete = vi.fn();
    const view = render(<TodoCelebration origin={{ x: 100, y: 100 }} wholeList={wholeList} onComplete={onComplete} />);
    await act(async () => finishes.slice(1).forEach(finish => finish()));
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => finishes[0]());
    expect(onComplete).toHaveBeenCalledOnce();
    view.unmount();
    expect(cancel).toHaveBeenCalledTimes(finishes.length);
  } finally { Element.prototype.animate = animate; }
});

const deferred = <T,>() => {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve: resolve!, reject: reject! };
};

it.each(["inline", "under", "collapsed", "hide"] as const)("celebrates the whole list only after the final item is confirmed (%s)", async completed => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, completed, celebrateFinal: true };
  app.currentHome = mapHome({ "todo.example": state("todo.example", "1", { supported_features: 85 }) }, emptyRegistries, "home");
  const write = deferred<void>(), read = deferred<typeof pendingItem[]>();
  app.todoItems.mockResolvedValue([pendingItem]);
  app.command.mockReturnValue(write.promise);
  const view = renderList();
  const checkbox = await screen.findByRole("checkbox", { name: "Example task" });
  fireEvent.click(checkbox);
  expect(document.querySelector(".todo-celebration")).toBeNull();
  app.todoItems.mockReturnValueOnce(read.promise);
  await act(async () => write.resolve());
  expect(document.querySelector(".todo-celebration")).toBeNull();
  await act(async () => read.resolve([{ ...pendingItem, status: "completed" }]));
  const finale = view.container.querySelector(".todo-celebration-list");
  expect(finale).toHaveTextContent("All done!");
  expect(finale.querySelectorAll("i")).toHaveLength(96);
  expect(finale.closest(".household-list")).toContainElement(checkbox);
  expect(screen.getByRole("button", { name: "Add item" })).toBeEnabled();
  await waitFor(() => expect(document.querySelector(".todo-celebration")).toBeNull(), { timeout: 3000 });
});

it("does not mistake a dashboard limit, initial load or remote completion for the final checkmark", async () => {
  motion.reduced = true;
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, celebrateFinal: true };
  const other = { ...pendingItem, uid: "two", summary: "Another task" };
  const done = { ...pendingItem, status: "completed" };
  app.todoItems.mockResolvedValue([pendingItem, other]);
  app.command.mockResolvedValue(undefined);
  const view = render(<MemoryRouter><ListPanel kind="shopping" limit={1} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("checkbox", { name: "Example task" }));
  app.todoItems.mockResolvedValue([done, other]);
  await act(async () => {});
  expect(document.querySelector(".todo-celebration")).toBeNull();
  app.todoItems.mockResolvedValue([done, { ...other, status: "completed" }]);
  app.currentHome.entities[0].lastUpdated = "remote-completion";
  view.rerender(<MemoryRouter><ListPanel kind="shopping" limit={1} /></MemoryRouter>);
  await act(async () => {});
  expect(document.querySelector(".todo-celebration")).toBeNull();
  view.unmount();
  renderList();
  await screen.findByText("All done.");
  expect(document.querySelector(".todo-celebration")).toBeNull();
});

it("waits for concurrent writes, celebrates once and cancels when an unfinished item arrives", async () => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, completed: "inline", celebrateFinal: true };
  const other = { ...pendingItem, uid: "two", summary: "Another task" };
  const first = deferred<void>(), second = deferred<void>();
  app.todoItems.mockResolvedValue([pendingItem, other]);
  app.command.mockImplementation((_entity, _action, value) => value.item === "one" ? first.promise : second.promise);
  const view = renderList();
  fireEvent.click(await screen.findByRole("checkbox", { name: "Example task" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Another task" }));
  const done = [pendingItem, other].map(item => ({ ...item, status: "completed" }));
  app.todoItems.mockResolvedValue(done);
  await act(async () => first.resolve());
  expect(document.querySelector(".todo-celebration")).toBeNull();
  await act(async () => second.resolve());
  const finale = document.querySelector(".todo-celebration-list");
  expect(document.querySelectorAll(".todo-celebration-list")).toHaveLength(1);
  app.currentHome.entities[0].lastUpdated = "same-completion";
  view.rerender(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
  await act(async () => {});
  expect(document.querySelector(".todo-celebration-list")).toBe(finale);
  app.todoItems.mockResolvedValue([pendingItem, done[1]]);
  app.currentHome.entities[0].lastUpdated = "new-work";
  view.rerender(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
  await act(async () => {});
  expect(document.querySelector(".todo-celebration")).toBeNull();
  app.command.mockResolvedValue(undefined);
  app.todoItems.mockResolvedValue(done);
  fireEvent.click(screen.getByRole("checkbox", { name: "Example task" }));
  await act(async () => {});
  expect(document.querySelectorAll(".todo-celebration-list")).toHaveLength(1);
});

it("replaces the finale particles and scaling with a readable stationary fade for reduced motion", async () => {
  motion.reduced = true;
  const animate = Element.prototype.animate;
  Element.prototype.animate = vi.fn(() => ({ finished: new Promise(() => {}), cancel: vi.fn() })) as unknown as typeof animate;
  try {
    const view = render(<TodoCelebration origin={{ x: 0, y: 0 }} wholeList onComplete={vi.fn()} />);
    expect(view.container.querySelectorAll("i")).toHaveLength(0);
    expect(view.container).toHaveTextContent("All done!");
    expect(Element.prototype.animate).toHaveBeenCalledOnce();
    const [frames, options] = vi.mocked(Element.prototype.animate).mock.calls[0];
    expect(frames).toEqual(expect.arrayContaining([expect.objectContaining({ opacity: 1 })]));
    expect((frames as Keyframe[]).every(frame => !("transform" in frame))).toBe(true);
    expect(options).toMatchObject({ duration: 1600 });
    view.unmount();
  } finally { Element.prototype.animate = animate; }
});

it("stops an active finale when its setting is disabled", async () => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, celebrateFinal: true };
  app.todoItems.mockResolvedValueOnce([pendingItem]).mockResolvedValue([{ ...pendingItem, status: "completed" }]);
  app.command.mockResolvedValue(undefined);
  const view = renderList();
  fireEvent.click(await screen.findByRole("checkbox", { name: "Example task" }));
  await act(async () => {});
  expect(document.querySelector(".todo-celebration-list")).not.toBeNull();
  family.todoLists["home|todo.example"].display.celebrateFinal = false;
  view.rerender(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
  await act(async () => {});
  expect(document.querySelector(".todo-celebration")).toBeNull();
});

it.each(["shopping", "tasks", "daily", "homework", "school"] as const)("updates separate items in parallel and ignores older refreshes (%s)", async surface => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, completed: "inline", celebrate: false };
  app.currentHome.entities[0].attributes.supported_features = 7;
  const items = [pendingItem, { ...pendingItem, uid: "two", summary: "Second task" }, { ...pendingItem, uid: "three", summary: "Third task" }];
  const first = deferred<void>(), second = deferred<void>(), staleRead = deferred<typeof items>();
  app.todoItems.mockResolvedValue(items);
  app.command.mockImplementation((_entity, _action, value) => {
    app.commands = { "todo.example": { pending: true, items: { [value.item]: { pending: true } } } };
    return value.item === "one" ? first.promise : second.promise;
  });
  const view = render(<MemoryRouter><HomeAssistantList preferenceId="home|todo.example" member="everyone" kind={surface === "school" ? "homework" : surface} school={surface === "school"} /></MemoryRouter>);
  const one = await screen.findByRole("checkbox", { name: "Example task" });
  const two = screen.getByRole("checkbox", { name: "Second task" });
  const three = screen.getByRole("checkbox", { name: "Third task" });
  fireEvent.click(one);
  expect(two).toBeEnabled();
  if (surface !== "homework" && surface !== "school") {
    expect(screen.getByRole("button", { name: "Edit Example task" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove Example task" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit Second task" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove Second task" })).toBeEnabled();
  }
  fireEvent.click(two);
  fireEvent.click(one);
  expect(app.command).toHaveBeenCalledTimes(2);
  expect(one).toBeDisabled();
  expect(two).toBeDisabled();
  expect(three).toBeEnabled();
  app.todoItems.mockReturnValueOnce(staleRead.promise);
  await act(async () => second.resolve());
  expect(two).toHaveAttribute("aria-busy", "true");
  expect(three).toBeEnabled();
  app.commands = {};
  app.todoItems.mockResolvedValue(items.map(item => item.uid === "three" ? item : { ...item, status: "completed" }));
  await act(async () => first.resolve());
  expect(one).toBeChecked();
  expect(two).toBeChecked();
  expect(one).toBeEnabled();
  expect(two).toBeEnabled();
  await act(async () => staleRead.resolve(items.map(item => item.uid === "two" ? { ...item, status: "completed" } : item)));
  expect(one).toBeChecked();
  expect(two).toBeChecked();
  expect(view.container.querySelector(".lucide-loader-circle")).not.toBeInTheDocument();
});

it("keeps another item pending and usable after one update fails", async () => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, completed: "inline", celebrate: false };
  const items = [pendingItem, { ...pendingItem, uid: "two", summary: "Second task" }];
  const first = deferred<void>(), second = deferred<void>();
  app.todoItems.mockResolvedValue(items);
  app.command.mockImplementation((_entity, _action, value) => value.item === "one" ? first.promise : second.promise);
  renderList();
  const one = await screen.findByRole("checkbox", { name: "Example task" });
  const two = screen.getByRole("checkbox", { name: "Second task" });
  fireEvent.click(one);
  fireEvent.click(two);
  await act(async () => first.reject(new Error("Example failure")));
  expect(one).toBeEnabled();
  expect(one).not.toBeChecked();
  expect(two).toBeDisabled();
  expect(two).toHaveAttribute("aria-busy", "true");
  app.todoItems.mockResolvedValue([pendingItem, { ...items[1], status: "completed" }]);
  await act(async () => second.resolve());
  expect(two).toBeChecked();
  expect(two).toBeEnabled();
});

it("celebrates concurrent completions independently without locking the remaining item", async () => {
  motion.reduced = true;
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, completed: "hide", celebrate: true };
  const items = [pendingItem, { ...pendingItem, uid: "two", summary: "Second task" }, { ...pendingItem, uid: "three", summary: "Third task" }];
  const first = deferred<void>(), second = deferred<void>();
  app.todoItems.mockResolvedValue(items);
  app.command.mockImplementation((_entity, _action, value) => value.item === "one" ? first.promise : second.promise);
  renderList();
  const one = await screen.findByRole("checkbox", { name: "Example task" });
  const two = screen.getByRole("checkbox", { name: "Second task" });
  fireEvent.click(one);
  fireEvent.click(two);
  app.todoItems.mockResolvedValue(items.map(item => item.uid === "three" ? item : { ...item, status: "completed" }));
  await act(async () => { second.resolve(); first.resolve(); });
  expect(document.querySelectorAll(".todo-celebration")).toHaveLength(2);
  expect(one).toBeChecked();
  expect(two).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Third task" })).toBeEnabled();
  await waitFor(() => expect(document.querySelector(".todo-celebration")).toBeNull());
  await waitFor(() => expect(one).not.toBeInTheDocument());
  expect(two).not.toBeInTheDocument();
});

it("invalidates a background read as soon as an item is clicked", async () => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, completed: "inline", celebrate: false };
  const write = deferred<void>(), staleRead = deferred<typeof pendingItem[]>();
  app.todoItems.mockResolvedValue([pendingItem]);
  app.command.mockReturnValue(write.promise);
  const view = renderList();
  const checkbox = await screen.findByRole("checkbox", { name: "Example task" });
  app.todoItems.mockReturnValueOnce(staleRead.promise);
  app.currentHome.entities[0].lastUpdated = "background-update";
  view.rerender(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
  expect(checkbox).toBeEnabled();
  fireEvent.click(checkbox);
  await act(async () => staleRead.reject(new Error("Stale read failure")));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(checkbox).toHaveAttribute("aria-busy", "true");
  app.todoItems.mockResolvedValue([{ ...pendingItem, status: "completed" }]);
  await act(async () => write.resolve());
  expect(checkbox).toBeChecked();
  expect(checkbox).toBeEnabled();
});

it.each([false, true])("ignores an old command after reconnecting (rejected: %s)", async rejected => {
  family.todoLists["home|todo.example"].display = { ...defaultTodoDisplay, completed: "inline", celebrate: true };
  const write = deferred<void>();
  app.todoItems.mockResolvedValue([pendingItem]);
  app.command.mockReturnValue(write.promise);
  const view = renderList();
  fireEvent.click(await screen.findByRole("checkbox", { name: "Example task" }));
  app.homeOnline = false;
  view.rerender(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
  app.homeOnline = true;
  view.rerender(<MemoryRouter><ListPanel kind="shopping" /></MemoryRouter>);
  const checkbox = await screen.findByRole("checkbox", { name: "Example task" });
  expect(checkbox).toBeEnabled();
  const reads = app.todoItems.mock.calls.length;
  await act(async () => { if (rejected) write.reject(new Error("Connection changed")); else write.resolve(); });
  expect(app.todoItems).toHaveBeenCalledTimes(reads);
  expect(checkbox).not.toBeChecked();
  expect(checkbox).toBeEnabled();
  expect(document.querySelector(".todo-celebration")).toBeNull();
});
