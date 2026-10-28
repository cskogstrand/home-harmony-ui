import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomeworkList } from "@/components/HomeworkList";
import { ListPanel } from "@/components/FamilyLists";
import School from "@/pages/School";
import { createI18n } from "@/lib/i18n";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import type { TodoItem } from "@/types/api";
import type { TodoListKind } from "@/contexts/FamilyContext";
import { defaultTodoDisplay, type TodoDisplay } from "../../shared/configuration";
import { state } from "./ha-fixtures";

const mocks = vi.hoisted(() => ({ language: "en" as "en" | "nb", app: { haUrl: "http://ha.local:8123", homeOnline: true, currentHome: null, commands: {}, services: { todo: { add_item: { fields: {} }, update_item: { fields: {} }, remove_item: { fields: {} } } }, todoItems: vi.fn(), command: vi.fn() }, family: { today: "2026-10-28", todoLists: {} as Record<string, { kind: TodoListKind; member: string; display?: TodoDisplay }>, connectedPlanner: true, compareMembers: () => 0, isMemberVisible: () => true, memberName: () => "Alex", memberColor: () => "#c4d5a3", members: [{ id: "home|person.example", name: "Alex" }], allMembers: [], hasTimetable: () => true, timetableSettings: {} } }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => mocks.family }));
vi.mock("@/hooks/use-i18n", () => ({ useI18n: () => createI18n(mocks.language) }));
vi.mock("@/components/FamilyPlanner", () => ({ MemberAvatar: () => null, MemberOptions: () => null, PanelHeading: ({ title }) => <h2>{title}</h2>, PageHeading: ({ title }) => <h1>{title}</h1>, SchoolPreview: () => <div>Example timetable</div> }));
const member = "home|person.example";
const item = (uid: string, due?: string | null, status: TodoItem["status"] = "needs_action"): TodoItem => ({ uid, summary: uid, due, status });
const show = () => render(<MemoryRouter><HomeworkList member={member} /></MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.language = "en";
  mocks.app.homeOnline = true;
  mocks.app.currentHome = mapHome({ "todo.homework": state("todo.homework", "1", { friendly_name: "Example list", supported_features: 127 }) }, emptyRegistries, "home");
  mocks.family.todoLists = { "home|todo.homework": { kind: "homework", member } };
  mocks.app.todoItems.mockResolvedValue([]);
  mocks.app.command.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it.each(["en", "nb"] as const)("sorts homework and labels due dates in %s, using the home time zone", async language => {
  mocks.language = language;
  mocks.family.todoLists["home|todo.homework"].display = { ...defaultTodoDisplay, sort: "due-date" };
  mocks.app.todoItems.mockResolvedValue([item("Undated Z"), item("Later", "2026-11-12"), item("Weekday", "2026-10-30"), item("Tomorrow task", "2026-10-28T23:30:00Z"), item("Today task", "2026-10-28"), item("Overdue task", "2026-10-27"), item("Undated A", null)]);
  const view = show();
  await screen.findByRole("checkbox", { name: "Today task" });
  expect(screen.getAllByRole("checkbox").map(row => row.getAttribute("aria-label"))).toEqual(["Overdue task", "Today task", "Tomorrow task", "Weekday", "Later", "Undated A", "Undated Z"]);
  expect(screen.getByText(language === "nb" ? "I dag" : "Today")).toHaveAttribute("data-state", "today");
  expect(screen.getByText(language === "nb" ? "I morgen" : "Tomorrow")).toHaveAttribute("data-state", "tomorrow");
  expect(screen.getByText(language === "nb" ? "fredag" : "Friday")).toBeVisible();
  expect(view.container.querySelector('[data-state="overdue"]')).toHaveAttribute("dateTime", "2026-10-27");
  expect(view.container.querySelector('[data-state="overdue"]')).toHaveAttribute("aria-label", expect.stringContaining(language === "nb" ? "Forfalt" : "Overdue"));
});

it.each(["school", "lists"])("keeps generated homework completion-only in %s, with pending feedback", async surface => {
  let completed = false;
  mocks.app.todoItems.mockImplementation(async () => [{ ...item("Read a chapter", "2026-10-29", completed ? "completed" : "needs_action"), description: "Example reading notes" }]);
  let finish: () => void;
  mocks.app.command.mockImplementation(() => new Promise<void>(resolve => { finish = () => { completed = true; resolve(); }; }));
  const view = surface === "school" ? show() : render(<MemoryRouter><ListPanel kind="homework" /></MemoryRouter>);
  const checkbox = await screen.findByRole("checkbox", { name: "Read a chapter" });
  expect(checkbox).toHaveAccessibleDescription("Example reading notes");
  expect(screen.getByText("Example reading notes")).toBeVisible();
  expect(screen.getByText("Example reading notes")).not.toHaveClass("sr-only");
  expect(screen.queryByRole("button", { name: /Edit|Add|Remove/ })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/open items/)).not.toBeInTheDocument();
  fireEvent.click(checkbox);
  expect(checkbox).toHaveAttribute("aria-busy", "true");
  expect(mocks.app.command).toHaveBeenCalledExactlyOnceWith("todo.homework", "update_item", { item: "Read a chapter", status: "completed" });
  await act(async () => finish());
  const completedGroup = screen.getByText("Completed (1)").closest("details");
  expect(completedGroup).not.toHaveAttribute("open");
  expect(completedGroup.querySelector(".check-row")).toHaveClass("complete");
  fireEvent.click(screen.getByText("Completed (1)"));
  const reopened = within(completedGroup).getByRole("checkbox", { name: "Read a chapter" });
  fireEvent.click(reopened);
  expect(mocks.app.command).toHaveBeenLastCalledWith("todo.homework", "update_item", { item: "Read a chapter", status: "needs_action" });
  expect(view.container.querySelector(".todo-description-field")).not.toBeInTheDocument();
});

it.each(["school", "lists", "shopping"])("refreshes %s automatically while retaining rows and announcing status without layout space", async surface => {
  vi.useFakeTimers();
  if (surface === "shopping") mocks.family.todoLists["home|todo.homework"].kind = "shopping";
  mocks.app.todoItems.mockResolvedValue([item("Example task")]);
  const view = surface === "school" ? show() : render(<MemoryRouter><ListPanel kind={surface === "shopping" ? "shopping" : "homework"} /></MemoryRouter>);
  await act(async () => {});
  const checkbox = screen.getByRole("checkbox", { name: "Example task" });
  expect(screen.queryByRole("button", { name: /Refresh|Retry/ })).not.toBeInTheDocument();
  let finish: (items: TodoItem[]) => void;
  mocks.app.todoItems.mockImplementationOnce(() => new Promise<TodoItem[]>(resolve => { finish = resolve; }));
  await act(async () => vi.advanceTimersByTimeAsync(60000));
  expect(mocks.app.todoItems).toHaveBeenCalledTimes(2);
  expect(checkbox.closest('[role="group"]')).toHaveAttribute("aria-busy", "true");
  expect(checkbox).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("sr-only");
  expect(screen.getByRole("status")).toHaveTextContent("Refreshing list…");
  expect(screen.queryByText("Loading to-do items…")).not.toBeInTheDocument();
  await act(async () => vi.advanceTimersByTimeAsync(60000));
  expect(mocks.app.todoItems).toHaveBeenCalledTimes(2);
  await act(async () => finish([item("Example task"), item("Added elsewhere")]));
  expect(screen.getByRole("checkbox", { name: "Added elsewhere" })).toBeInTheDocument();
  expect(checkbox.closest('[role="group"]')).toHaveAttribute("aria-busy", "false");
  view.unmount();
  await act(async () => vi.advanceTimersByTimeAsync(60000));
  expect(mocks.app.todoItems).toHaveBeenCalledTimes(2);
});

it("pauses background list reads while a write is pending or Home Assistant is offline", async () => {
  vi.useFakeTimers();
  mocks.app.todoItems.mockResolvedValue([item("Example task")]);
  let finish: () => void;
  mocks.app.command.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const view = show();
  await act(async () => {});
  fireEvent.click(screen.getByRole("checkbox", { name: "Example task" }));
  await act(async () => vi.advanceTimersByTimeAsync(120000));
  expect(mocks.app.todoItems).toHaveBeenCalledOnce();
  expect(mocks.app.command).toHaveBeenCalledOnce();
  await act(async () => finish());
  expect(mocks.app.todoItems).toHaveBeenCalledTimes(2);
  mocks.app.homeOnline = false;
  view.rerender(<MemoryRouter><HomeworkList member={member} /></MemoryRouter>);
  await act(async () => vi.advanceTimersByTimeAsync(120000));
  expect(mocks.app.todoItems).toHaveBeenCalledTimes(2);
  mocks.app.homeOnline = true;
  view.rerender(<MemoryRouter><HomeworkList member={member} /></MemoryRouter>);
  await act(async () => {});
  expect(mocks.app.todoItems).toHaveBeenCalledTimes(3);
  await act(async () => vi.advanceTimersByTimeAsync(60000));
  expect(mocks.app.todoItems).toHaveBeenCalledTimes(4);
});

it("orders repeated-hour deadlines by their instant, after date-only items and before undated ones", async () => {
  mocks.family.todoLists["home|todo.homework"].display = { ...defaultTodoDisplay, sort: "due-date" };
  mocks.app.todoItems.mockResolvedValue([item("Undated"), item("Later instant", "2026-10-25T02:15:00+01:00"), item("Earlier instant", "2026-10-25T02:30:00+02:00"), item("Date only", "2026-10-25")]);
  show();
  await screen.findByRole("checkbox", { name: "Undated" });
  expect(screen.getAllByRole("checkbox").map(row => row.getAttribute("aria-label"))).toEqual(["Date only", "Earlier instant", "Later instant", "Undated"]);
});

it("keeps Home Assistant order for homework unless sorting is selected", async () => {
  mocks.app.todoItems.mockResolvedValue([item("Z task"), item("A task", "2026-10-25")]);
  show();
  await screen.findByRole("checkbox", { name: "Z task" });
  expect(screen.getAllByRole("checkbox").map(row => row.getAttribute("aria-label"))).toEqual(["Z task", "A task"]);
});

it("shows the empty state, read-only rows, unavailable state and recoverable errors", async () => {
  const view = show();
  expect(await screen.findByText("No homework.")).toBeVisible();
  view.unmount();
  mocks.app.currentHome.entities[0].attributes.supported_features = 0;
  mocks.app.todoItems.mockResolvedValue([item("Read only")]);
  const readonly = show();
  expect(await screen.findByRole("checkbox", { name: "Read only" })).toBeDisabled();
  readonly.unmount();
  mocks.app.todoItems.mockRejectedValueOnce(new Error("Could not read list"));
  const failed = show();
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not read list");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("checkbox", { name: "Read only" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  failed.unmount();
  mocks.app.homeOnline = false;
  show();
  expect(screen.getByText(/unavailable while offline/)).toBeVisible();
  expect(screen.queryByText("No homework.")).not.toBeInTheDocument();
});

it("only adds homework to a School card when configured and excludes it from other list panels", async () => {
  mocks.family.todoLists = {};
  const view = render(<MemoryRouter><School /></MemoryRouter>);
  expect(screen.queryByRole("heading", { name: "Homework" })).not.toBeInTheDocument();
  mocks.family.todoLists = { "home|todo.homework": { kind: "homework", member } };
  view.rerender(<MemoryRouter><School /></MemoryRouter>);
  expect(await screen.findByText("No homework.")).toBeVisible();
  expect(screen.getByText("Example timetable").nextElementSibling).toHaveClass("homework-list");
  view.unmount();
  mocks.app.todoItems.mockClear();
  render(<MemoryRouter>{(["daily", "tasks", "shopping"] as const).map(kind => <ListPanel key={kind} kind={kind} />)}</MemoryRouter>);
  expect(mocks.app.todoItems).not.toHaveBeenCalled();
});

it.each(["daily", "tasks", "shopping"] as const)("adds and edits due dates and descriptions on %s lists", async kind => {
  mocks.family.todoLists["home|todo.homework"].kind = kind;
  mocks.app.todoItems.mockResolvedValue([{ ...item("Example task", "2026-10-29"), description: "Original notes" }]);
  render(<MemoryRouter><ListPanel kind={kind} /></MemoryRouter>);
  const editButton = await screen.findByRole("button", { name: "Edit Example task" });
  expect(within(editButton).getByText("Original notes")).toBeVisible();
  expect(within(editButton).getByText("Original notes")).not.toHaveClass("sr-only");
  expect(editButton).toHaveAccessibleDescription("Original notes");
  fireEvent.click(editButton);
  const editor = within(screen.getByRole("dialog"));
  expect(editor.getByLabelText("Due date")).toHaveValue("2026-10-29");
  expect(editor.getByLabelText("Description")).toHaveValue("Original notes");
  fireEvent.change(editor.getByLabelText("Due date"), { target: { value: "2026-10-30" } });
  fireEvent.change(editor.getByLabelText("Description"), { target: { value: "Revised notes" } });
  fireEvent.click(editor.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(mocks.app.command).toHaveBeenLastCalledWith("todo.homework", "update_item", { item: "Example task", rename: "Example task", due_date: "2026-10-30", description: "Revised notes" });
  fireEvent.click(screen.getByRole("button", { name: kind === "shopping" ? "Add item" : "Add task" }));
  fireEvent.change(screen.getByRole("textbox", { name: "New item in Example list" }), { target: { value: "New task" } });
  fireEvent.click(screen.getByText("Due date and description"));
  fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-10-31" } });
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "New notes" } });
  fireEvent.click(screen.getByRole("button", { name: "Save item to Example list" }));
  await waitFor(() => expect(mocks.app.command).toHaveBeenLastCalledWith("todo.homework", "add_item", { item: "New task", due_date: "2026-10-31", description: "New notes" }));
});

it("preserves timed deadlines on rename, clears details explicitly and retains failed drafts", async () => {
  mocks.family.todoLists["home|todo.homework"].kind = "tasks";
  mocks.app.todoItems.mockResolvedValue([{ ...item("Example task", "2026-10-28T23:30:00+00:00"), description: "Original notes" }]);
  render(<MemoryRouter><ListPanel kind="tasks" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Edit Example task" }));
  let editor = within(screen.getByRole("dialog"));
  expect(editor.getByLabelText("Due date")).toHaveValue("2026-10-29");
  expect(editor.getByLabelText("Time (optional)")).toHaveValue("00:30:00");
  fireEvent.change(editor.getByLabelText("Task"), { target: { value: "Renamed task" } });
  fireEvent.click(editor.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(mocks.app.command).toHaveBeenLastCalledWith("todo.homework", "update_item", { item: "Example task", rename: "Renamed task" });
  fireEvent.click(screen.getByRole("button", { name: "Edit Example task" }));
  editor = within(screen.getByRole("dialog"));
  fireEvent.change(editor.getByLabelText("Due date"), { target: { value: "" } });
  fireEvent.change(editor.getByLabelText("Description"), { target: { value: "" } });
  mocks.app.command.mockRejectedValueOnce(new Error("Permission denied"));
  fireEvent.click(editor.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(editor.getByRole("button", { name: "Save changes" })).toBeEnabled());
  expect(mocks.app.command).toHaveBeenLastCalledWith("todo.homework", "update_item", { item: "Example task", rename: "Example task", due_datetime: null, description: "" });
  expect(editor.getByLabelText("Due date")).toHaveValue("");
  expect(editor.getByLabelText("Description")).toHaveValue("");
});

it("disables unsupported details without breaking ordinary rename", async () => {
  mocks.family.todoLists["home|todo.homework"].kind = "tasks";
  mocks.app.currentHome.entities[0].attributes.supported_features = 7;
  mocks.app.todoItems.mockResolvedValue([item("Example task")]);
  render(<MemoryRouter><ListPanel kind="tasks" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Edit Example task" }));
  const editor = within(screen.getByRole("dialog"));
  expect(editor.getByLabelText(/Due date/)).toBeDisabled();
  expect(editor.getByLabelText(/Description/)).toBeDisabled();
  fireEvent.change(editor.getByLabelText("Task"), { target: { value: "Renamed task" } });
  fireEvent.click(editor.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(mocks.app.command).toHaveBeenLastCalledWith("todo.homework", "update_item", { item: "Example task", rename: "Renamed task" });
});
