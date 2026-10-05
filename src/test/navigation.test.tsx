import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "@/App";
import { addDays, homeDate, weekStart, isPlannerDate, itemIsDone } from "@/contexts/FamilyContext";

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const navigate = (name: string) => fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name }));

it("keeps a device change consistent from Today through detail, devices and rooms", async () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: "Good to be home." })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Toggle Living Room Light" }));
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("link", { name: "Living Room Light" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Living Room Light" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/devices/dev-1");
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("link", { name: "Back to devices" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Devices" })).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).not.toBeChecked();
  fireEvent.click(within(screen.getByRole("navigation", { name: "Smart home navigation" })).getByRole("link", { name: "Rooms" }));
  fireEvent.click(screen.getByRole("link", { name: /Living Room/ }));
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).not.toBeChecked();
});

it("saves shopping items and daily completion across navigation and a reload", () => {
  const view = render(<App />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Set the table" }));
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
  fireEvent.change(screen.getByRole("textbox", { name: "New shopping item" }), { target: { value: "Bread <wholegrain>" } });
  fireEvent.click(screen.getByRole("button", { name: "Save shopping item" }));
  navigate("Lists");
  fireEvent.click(screen.getByRole("button", { name: /Shopping/ }));
  expect(screen.getByRole("checkbox", { name: "Bread <wholegrain>" })).toBeInTheDocument();
  view.unmount();
  render(<App />);
  expect(screen.getByRole("checkbox", { name: "Bread <wholegrain>" })).toBeInTheDocument();
  navigate("Today");
  expect(screen.getByRole("checkbox", { name: "Set the table" })).toBeChecked();
});

it("adds, edits and removes an event from the per-person week", async () => {
  render(<App />);
  navigate("Our week");
  fireEvent.click(screen.getByRole("button", { name: "Add a plan" }));
  fireEvent.change(await screen.findByLabelText("What’s happening?"), { target: { value: "Library afternoon" } });
  fireEvent.change(screen.getByLabelText("Who’s going?"), { target: { value: "emma" } });
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  fireEvent.click(await screen.findByRole("button", { name: /Library afternoon/ }));
  fireEvent.change(screen.getByLabelText("What’s happening?"), { target: { value: "Library morning" } });
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  fireEvent.click(await screen.findByRole("button", { name: /Library morning/ }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove event" }));
  expect(screen.queryByRole("button", { name: /Library morning/ })).not.toBeInTheDocument();
});

it("applies scenes, protects the door with a PIN and pauses controls when the hub is offline", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Movie Night" }));
  navigate("Smart home");
  expect(screen.getByRole("slider", { name: "Living Room Light brightness" })).toHaveValue("20");
  expect(screen.getByText("Offline · reading unavailable")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Unlock Front Door Lock" }));
  const dialog = within(await screen.findByRole("dialog"));
  for (const digit of ["1", "1", "1", "1"]) fireEvent.click(dialog.getByRole("button", { name: digit }));
  fireEvent.click(dialog.getByRole("button", { name: "OK" }));
  expect(dialog.getByRole("alert")).toHaveTextContent("Incorrect PIN");
  for (const digit of ["1", "2", "3", "4"]) fireEvent.click(dialog.getByRole("button", { name: digit }));
  fireEvent.click(dialog.getByRole("button", { name: "OK" }));
  expect(screen.getByRole("button", { name: "Lock Front Door Lock" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Preview hub offline" }));
  expect(screen.getByRole("switch", { name: "Toggle Living Room Light" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Pause charging" })).toBeDisabled();
  navigate("Today");
  expect(screen.getByRole("button", { name: "Lock Front Door Lock" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Set the table" }));
  expect(screen.getByRole("checkbox", { name: "Set the table" })).toBeChecked();
});

it("uses the home timezone and calendar dates across a month boundary", () => {
  expect(homeDate(new Date("2026-10-05T23:30:00Z"), "Europe/Oslo")).toBe("2026-10-06");
  expect(weekStart("2026-11-01")).toBe("2026-10-26");
  expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  expect(isPlannerDate("2026-02-30")).toBe(false);
  expect(itemIsDone({ id: "daily", text: "Table", kind: "daily", member: "leo", done: true, completedOn: "2026-10-05" }, "2026-10-06")).toBe(false);
});

const gridDates = () => Array.from(screen.getByRole("table").querySelectorAll("thead time"), time => time.getAttribute("datetime"));

it("shares and remembers calendar layouts and today/Monday ranges without discarding existing plans", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
  const view = render(<App />);
  // Simulate planner data saved before calendar preferences existed.
  const key = "afterglow-planner-v1:home-1";
  const oldPlanner = JSON.parse(localStorage.getItem(key)!);
  delete oldPlanner.calendar;
  view.unmount();
  localStorage.setItem(key, JSON.stringify(oldPlanner));
  const restored = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Weekly grid" }));
  expect(gridDates()).toEqual(Array.from({ length: 7 }, (_, i) => addDays("2026-10-07", i)));
  expect(screen.getAllByRole("rowheader").map(row => row.textContent)).toEqual(["AAnna", "ErErik", "EmEmma", "LLeo"]);
  fireEvent.click(screen.getByRole("button", { name: "Monday" }));
  expect(gridDates()).toEqual(Array.from({ length: 7 }, (_, i) => addDays("2026-10-05", i)));
  navigate("Our week");
  expect(screen.getByRole("button", { name: "Weekly grid" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /Parents’ meeting/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  fireEvent.click(screen.getByRole("button", { name: "Next week" }));
  expect(gridDates()[0]).toBe("2026-10-14");
  fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
  expect(gridDates()[0]).toBe("2026-10-07");
  fireEvent.click(screen.getByRole("button", { name: "Next week" }));
  fireEvent.click(screen.getByRole("button", { name: "Monday" }));
  expect(gridDates()[0]).toBe("2026-10-05");
  restored.unmount();
  render(<App />);
  expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "true");
  expect(gridDates()[0]).toBe("2026-10-05");
  fireEvent.click(screen.getByRole("button", { name: "By person" }));
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  navigate("Today");
  expect(screen.getByRole("button", { name: "By person" })).toHaveAttribute("aria-pressed", "true");
  expect(JSON.parse(localStorage.getItem(key)!).events).toEqual(oldPlanner.events);
});

it("opens every plan in a dashboard cell and prefills the person and date when adding", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Weekly grid" }));
  fireEvent.click(screen.getByRole("button", { name: "View Emma on Wed 7 Oct: 2 plans" }));
  const day = within(await screen.findByRole("dialog"));
  expect(day.getByRole("button", { name: /Dinner together/ })).toBeInTheDocument();
  fireEvent.click(day.getByRole("button", { name: /Piano lesson/ }));
  expect(await screen.findByLabelText("What’s happening?")).toHaveValue("Piano lesson");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Add a plan for Emma on Tue 13 Oct" }));
  expect(await screen.findByLabelText("Date")).toHaveValue("2026-10-13");
  expect(screen.getByLabelText("Who’s going?")).toHaveValue("emma");
  fireEvent.change(screen.getByLabelText("What’s happening?"), { target: { value: "Library visit" } });
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  expect(await screen.findByRole("button", { name: "View Emma on Tue 13 Oct: 1 plan" })).toHaveTextContent("Library visit");
  navigate("Our week");
  fireEvent.click(screen.getByRole("button", { name: /Library visit/ }));
  expect(await screen.findByLabelText("Date")).toHaveValue("2026-10-13");
});

it("advances an unbrowsed rolling week at midnight in the home timezone across New Year", () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-12-31T22:59:55Z"));
  render(<App />);
  navigate("Our week");
  fireEvent.click(screen.getByRole("button", { name: "Weekly grid" }));
  expect(gridDates()[0]).toBe("2026-12-31");
  expect(gridDates()[6]).toBe("2027-01-06");
  act(() => vi.advanceTimersByTime(15000));
  expect(gridDates()[0]).toBe("2027-01-01");
  expect(gridDates()[6]).toBe("2027-01-07");
  navigate("Today");
  expect(gridDates()[0]).toBe("2027-01-01");
  fireEvent.click(screen.getByRole("button", { name: "Monday" }));
  expect(gridDates()[0]).toBe("2026-12-28");
});
