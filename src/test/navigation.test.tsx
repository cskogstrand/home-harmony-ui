import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "@/App";
import { addDays, homeDate, weekStart, isPlannerDate, itemIsDone } from "@/contexts/FamilyContext";

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const navigate = (name: string) => fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name }));

it("starts with configuration and honest empty states while preserving navigation", async () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1, name: "Good to be home." })).toBeInTheDocument();
  expect(screen.queryByRole("switch", { name: "Toggle Living Room Light" })).not.toBeInTheDocument();
  navigate("Smart home");
  fireEvent.click(screen.getByRole("link", { name: /Configure Home Assistant/ }));
  expect(await screen.findByLabelText("Home Assistant URL")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
  for (const [link, heading] of [["Devices", "Devices"], ["Areas", "Areas"], ["Zones", "Zones"], ["Security", "Alarm"], ["Automations", "Automations"], ["Scenes", "Scenes"], ["Activity", "History"], ["Integrations", "Integrations"]]) {
    fireEvent.click(within(screen.getByRole("navigation", { name: "Smart home navigation" })).getByRole("link", { name: link }));
    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  }
  expect(screen.queryByText(/Demo|Viking Guard|1234/)).not.toBeInTheDocument();
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
  fireEvent.click(screen.getByText("Completed (1)"));
  expect(screen.getByRole("checkbox", { name: "Set the table" })).toBeChecked();
});

it("adds, edits and removes an event from the per-person week", async () => {
  render(<App />);
  navigate("Our week");
  fireEvent.click(screen.getByRole("button", { name: "By person" }));
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

it("suggests list entries and reopens completed items without creating duplicates", () => {
  render(<App />);
  navigate("Lists");
  fireEvent.click(screen.getByRole("button", { name: /Shopping/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Oat milk" }));
  expect(screen.getByRole("checkbox", { name: "Oat milk" })).not.toBeVisible();
  fireEvent.click(screen.getByText("Completed (1)"));
  expect(screen.getByRole("checkbox", { name: "Oat milk" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
  const input = screen.getByRole("textbox", { name: "New shopping item" });
  fireEvent.change(input, { target: { value: "oa" } });
  const suggestions = within(screen.getByRole("group", { name: "Existing items" }));
  expect(suggestions.queryByRole("button", { name: "Bananas" })).not.toBeInTheDocument();
  fireEvent.click(suggestions.getByRole("button", { name: "Oat milk" }));
  expect(input).toHaveValue("Oat milk");
  fireEvent.change(input, { target: { value: " OAT MILK " } });
  fireEvent.click(screen.getByRole("button", { name: "Save shopping item" }));
  expect(screen.getByRole("checkbox", { name: "Oat milk" })).not.toBeChecked();
  expect(screen.queryByText("Completed (1)")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
  fireEvent.change(screen.getByRole("textbox", { name: "New shopping item" }), { target: { value: "Oat milk" } });
  fireEvent.click(screen.getByRole("button", { name: "Save shopping item" }));
  expect(screen.getAllByRole("checkbox", { name: "Oat milk" })).toHaveLength(1);
  const stored = JSON.parse(localStorage.getItem("afterglow-planner-v1:home-1")!);
  expect(stored.items.filter(item => item.kind === "shopping")).toHaveLength(3);
});

it("keeps the family planner usable with no HA connection", () => {
  render(<App />);
  expect(screen.getByText(/Cached readings are stale/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Set the table" }));
  fireEvent.click(screen.getByText("Completed (1)"));
  expect(screen.getByRole("checkbox", { name: "Set the table" })).toBeChecked();
  navigate("School");
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  navigate("Today");
  fireEvent.click(screen.getByText("Completed (1)"));
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

it("saves one people order for calendars, local lists, school and person selectors", () => {
  window.history.replaceState(null, "", "/settings");
  const view = render(<App />);
  const key = "afterglow-planner-v1:home-1";
  const original = JSON.parse(localStorage.getItem(key)!);
  expect(screen.getByRole("button", { name: "Move Anna up" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Move Leo down" })).toBeDisabled();
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Move Leo up" }));
  fireEvent.click(screen.getByRole("button", { name: "Move Erik down" }));
  expect(screen.getByRole("button", { name: "Move Leo up" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Move Erik down" })).toBeDisabled();
  expect(JSON.parse(localStorage.getItem(key)!).memberOrder).toEqual(["leo", "anna", "emma", "erik"]);
  const dailyOrder = ["Set the table", "Pack tomorrow’s school bags", "Empty the dishwasher"];
  const checkboxNames = () => screen.getAllByRole("checkbox").map(input => input.closest("label")!.textContent);
  navigate("Today");
  expect(screen.getAllByRole("rowheader").map(row => row.textContent)).toEqual(["AllEveryone", "LLeo", "AAnna", "EmEmma", "ErErik"]);
  expect(checkboxNames().slice(0, 3)).toEqual(dailyOrder);
  navigate("Our week");
  expect(screen.getAllByRole("rowheader").map(row => row.textContent)).toEqual(["AllEveryone", "LLeo", "AAnna", "EmEmma", "ErErik"]);
  fireEvent.click(screen.getByRole("button", { name: "By person" }));
  expect(screen.getAllByRole("heading", { level: 2, name: /^(Everyone|Leo|Anna|Emma|Erik)$/ }).map(heading => heading.textContent)).toEqual(["Everyone", "Leo", "Anna", "Emma", "Erik"]);
  navigate("Lists");
  expect(checkboxNames()).toEqual(dailyOrder);
  fireEvent.click(screen.getByRole("button", { name: /Family tasks/ }));
  expect(checkboxNames()).toEqual(["Return library books", "Book winter tyre change"]);
  fireEvent.click(screen.getByRole("button", { name: "Add task" }));
  expect(within(screen.getByRole("combobox", { name: "Assign task" })).getAllByRole("option").map(option => option.textContent)).toEqual(["Everyone", "Leo", "Anna", "Emma", "Erik"]);
  navigate("School");
  expect(screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent)).toEqual(["Leo’s school week", "Emma’s school week"]);
  view.unmount();
  window.history.replaceState(null, "", "/settings");
  render(<App />);
  expect(within(screen.getByRole("list", { name: "People order" })).getAllByRole("button", { name: / up$/ }).map(button => button.getAttribute("aria-label"))).toEqual(["Move Leo up", "Move Anna up", "Move Emma up", "Move Erik up"]);
  const saved = JSON.parse(localStorage.getItem(key)!);
  expect(saved.events).toEqual(original.events);
  expect(saved.items).toEqual(original.items);
  expect(saved.timetables).toEqual(original.timetables);
});

it("lets any local person have a timetable without giving them demo school details", () => {
  window.history.replaceState(null, "", "/settings");
  render(<App />);
  expect(screen.getByRole("switch", { name: "Timetable for Emma" })).toBeChecked();
  expect(screen.getByRole("switch", { name: "Timetable for Leo" })).toBeChecked();
  expect(screen.getByRole("switch", { name: "Timetable for Anna" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("switch", { name: "Timetable for Anna" }));
  fireEvent.click(screen.getByRole("switch", { name: "Timetable for Emma" }));
  fireEvent.click(screen.getByRole("switch", { name: "Timetable for Leo" }));
  navigate("School");
  expect(screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent)).toEqual(["Anna’s school week"]);
  expect(screen.queryByText(/Year 2|Year 5|IN THE SCHOOL BAG/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Set up timetable images" })).toBeInTheDocument();
  navigate("Today");
  expect(screen.getAllByRole("button", { name: /Enlarge .* timetable/ })).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Enlarge Anna’s timetable" })).toBeInTheDocument();
});

it("migrates legacy timetable URLs without losing planner entries or enabling empty timetables", () => {
  window.history.replaceState(null, "", "/settings");
  const key = "afterglow-planner-v1:home-1";
  const items = [{ id: "keep", text: "Keep this task", kind: "tasks", member: "emma", done: false }];
  localStorage.setItem(key, JSON.stringify({ events: [], items, timetables: { emma: "/existing.svg", leo: "", anna: [] }, timetableEnabled: { emma: false } }));
  render(<App />);
  for (const name of ["Emma", "Leo", "Anna"]) expect(screen.getByRole("switch", { name: `Timetable for ${name}` })).not.toBeChecked();
  expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ items, timetables: { emma: ["/existing.svg"], leo: [], anna: [] } });
  expect(localStorage.getItem(`${key}:unreadable-backup`)).toBeNull();
  fireEvent.click(screen.getByRole("switch", { name: "Timetable for Emma" }));
  navigate("School");
  expect(screen.getByRole("img", { name: "Emma’s school timetable" })).toHaveAttribute("src", "/existing.svg");
});

it("saves ordered timetable pages across school, dashboard and reload, rejecting invalid updates", () => {
  window.history.replaceState(null, "", "/school");
  const view = render(<App />);
  const card = within(screen.getByRole("heading", { name: "Emma’s school week" }).closest("article")!);
  fireEvent.click(card.getByRole("button", { name: "Change timetable images" }));
  const input = card.getByRole("textbox", { name: "Emma timetable image URLs" });
  const save = () => fireEvent.click(card.getByRole("button", { name: "Save image URLs" }));
  const pages = ["https://school.example/page-1.png", "/timetables/page-2.svg"];
  fireEvent.change(input, { target: { value: `  ${pages[0]} \r\n\n${pages[1]}  ` } });
  save();
  const key = "afterglow-planner-v1:home-1";
  const storedPages = () => JSON.parse(localStorage.getItem(key)!).timetables.emma;
  expect(storedPages()).toEqual(pages);
  expect(card.getByRole("region", { name: "Emma’s timetable pages" })).toBeInTheDocument();
  expect(card.getAllByRole("img", { hidden: true }).map(image => image.getAttribute("src"))).toEqual(pages);
  expect(card.getByText("Page 1 of 2")).toBeInTheDocument();
  for (const value of [`${pages[0]}\njavascript:alert(1)`, `${pages[0]}\nftp://school.example/page.png`, "   \n  "]) {
    fireEvent.change(input, { target: { value } });
    save();
    expect(storedPages()).toEqual(pages);
  }
  const reversed = [...pages].reverse();
  fireEvent.change(input, { target: { value: reversed.join("\n") } });
  save();
  expect(storedPages()).toEqual(reversed);
  view.unmount();
  render(<App />);
  navigate("Today");
  const preview = within(screen.getByRole("region", { name: "Emma’s timetable pages" }));
  expect(preview.getAllByRole("img", { hidden: true }).map(image => image.getAttribute("src"))).toEqual(reversed);
  fireEvent.error(preview.getByRole("img", { name: "Emma’s school timetable, page 1 of 2" }));
  expect(preview.getByText("The timetable image couldn’t load.")).toBeInTheDocument();
  expect(preview.getAllByRole("img", { hidden: true })).toHaveLength(1);
  navigate("School");
  const restoredCard = within(screen.getByRole("heading", { name: "Emma’s school week" }).closest("article")!);
  fireEvent.click(restoredCard.getByRole("button", { name: "Change timetable images" }));
  const restoredInput = restoredCard.getByRole("textbox", { name: "Emma timetable image URLs" });
  expect(restoredInput).toHaveValue(reversed.join("\n"));
  fireEvent.change(restoredInput, { target: { value: pages[0] } });
  fireEvent.click(restoredCard.getByRole("button", { name: "Save image URLs" }));
  expect(storedPages()).toEqual([pages[0]]);
  expect(restoredCard.queryByRole("region")).not.toBeInTheDocument();
  expect(restoredCard.getByRole("img", { name: "Emma’s school timetable" })).toHaveAttribute("src", pages[0]);
});

it("navigates timetable pages with arrows and keyboard and enlarges the selected page", () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("aria-roledescription") === "slide" ? [...this.parentElement!.children].indexOf(this) * 400 : 0;
  });
  localStorage.setItem("afterglow-planner-v1:home-1", JSON.stringify({ events: [], items: [], timetables: { emma: ["/first.svg", "/second.svg"] } }));
  window.history.replaceState(null, "", "/school");
  render(<><style>{'[aria-roledescription="slide"] { margin-right: 0px; }'}</style><App /></>);
  const carousel = screen.getByRole("region", { name: "Emma’s timetable pages" });
  const next = within(carousel).getByRole("button", { name: "Next timetable page" });
  act(() => next.focus());
  fireEvent.click(next);
  expect(carousel).toHaveFocus();
  expect(within(carousel).getByText("Page 2 of 2")).toBeInTheDocument();
  expect(next).toBeDisabled();
  fireEvent.keyDown(carousel, { key: "ArrowLeft" });
  expect(within(carousel).getByText("Page 1 of 2")).toBeInTheDocument();
  fireEvent.keyDown(carousel, { key: "ArrowRight" });
  fireEvent.click(within(carousel).getByRole("button", { name: "Enlarge Emma’s timetable, page 2 of 2" }));
  const dialog = within(screen.getByRole("dialog", { name: "Emma’s school week" }));
  expect(dialog.getByRole("img", { name: "Emma’s school timetable, page 2 of 2" })).toHaveAttribute("src", "/second.svg");
  fireEvent.click(dialog.getByRole("button", { name: "Previous timetable page" }));
  expect(dialog.getByRole("img", { name: "Emma’s school timetable, page 1 of 2" })).toHaveAttribute("src", "/first.svg");
});

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
  expect(screen.getByRole("button", { name: "Weekly grid" })).toHaveAttribute("aria-pressed", "true");
  expect(gridDates()).toEqual(Array.from({ length: 7 }, (_, i) => addDays("2026-10-07", i)));
  expect(screen.getAllByRole("rowheader").map(row => row.textContent)).toEqual(["AllEveryone", "AAnna", "ErErik", "EmEmma", "LLeo"]);
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
  const reloaded = render(<App />);
  expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "true");
  expect(gridDates()[0]).toBe("2026-10-05");
  fireEvent.click(screen.getByRole("button", { name: "By person" }));
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  navigate("Today");
  expect(screen.getByRole("button", { name: "By person" })).toHaveAttribute("aria-pressed", "true");
  expect(JSON.parse(localStorage.getItem(key)!).events).toEqual(oldPlanner.events);
  reloaded.unmount();
  render(<App />);
  expect(screen.getByRole("button", { name: "By person" })).toHaveAttribute("aria-pressed", "true");
});

it("shows every dashboard plan inline and prefills the person and date when adding", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
  render(<App />);
  expect(screen.getByRole("button", { name: "Weekly grid" })).toHaveAttribute("aria-pressed", "true");
  const emma = within(screen.getByRole("rowheader", { name: "Emma" }).closest("tbody")!);
  expect(emma.getByRole("button", { name: /Piano lesson/ })).toBeVisible();
  expect(emma.queryByRole("button", { name: /Dinner together/ })).not.toBeInTheDocument();
  const leo = within(screen.getByRole("rowheader", { name: "Leo" }).closest("tbody")!);
  expect(leo.getAllByRole("button", { name: /Swimming|Football practice|Dinner together/ })).toHaveLength(2);
  const everyone = within(screen.getByRole("rowheader", { name: "Everyone" }).closest("tbody")!);
  expect(everyone.getByRole("button", { name: /Dinner together/ })).toBeVisible();
  expect(within(screen.getByRole("table")).getAllByRole("button", { name: /Dinner together/ })).toHaveLength(1);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(emma.getByRole("button", { name: /Piano lesson/ }));
  expect(await screen.findByLabelText("What’s happening?")).toHaveValue("Piano lesson");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Add a plan for Emma on Tue 13 Oct" }));
  expect(await screen.findByLabelText("Date")).toHaveValue("2026-10-13");
  expect(screen.getByLabelText("Who’s going?")).toHaveValue("emma");
  fireEvent.change(screen.getByLabelText("What’s happening?"), { target: { value: "Library visit" } });
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  expect(await screen.findByRole("button", { name: /Library visit/ })).toBeVisible();
  navigate("Our week");
  fireEvent.click(screen.getByRole("button", { name: /Library visit/ }));
  expect(await screen.findByLabelText("Date")).toHaveValue("2026-10-13");
});

it("keeps shared plans in Everyone across layouts and prefills new shared plans", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "By person" }));
  expect(screen.getAllByRole("button", { name: /Dinner together/ })).toHaveLength(1);
  navigate("Our week");
  expect(screen.getAllByRole("button", { name: /Dinner together/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Emma" }));
  expect(screen.queryByRole("button", { name: /Dinner together/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Everyone" }));
  expect(screen.getByRole("button", { name: /Dinner together/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Piano lesson/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Weekly grid" }));
  expect(screen.getAllByRole("rowheader")).toHaveLength(1);
  expect(screen.getByRole("rowheader", { name: "Everyone" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add a plan for Everyone on Tue 13 Oct" }));
  expect(await screen.findByLabelText("Who’s going?")).toHaveValue("everyone");
  expect(screen.getByLabelText("Date")).toHaveValue("2026-10-13");
  fireEvent.change(screen.getByLabelText("What’s happening?"), { target: { value: "Family outing" } });
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  expect(await screen.findByRole("button", { name: /Family outing/ })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "All people" }));
  expect(screen.getAllByRole("rowheader")).toHaveLength(5);
  expect(screen.getAllByRole("button", { name: /Family outing/ })).toHaveLength(1);
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
