import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import App from "@/App";
import { emptyConfiguration, parseConfiguration } from "../../shared/configuration";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { addDays, homeDate, weekStart, isPlannerDate } from "@/contexts/FamilyContext";

const app = vi.hoisted(() => ({ currentHome: null, haUrl: "http://ha.local:8123", homeOnline: true, connectionStatus: "connected", metadataWarnings: [], services: {}, commands: {}, connect: vi.fn(), disconnect: vi.fn(), configurationRequest: vi.fn(), storageRequest: vi.fn(), watchCalendarEvents: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("../../config.yaml?raw", () => ({ default: 'name: Home Harmony UI\nversion: "9.8.7"\n' }));
vi.mock("@/contexts/AppProvider", () => ({ AppProvider: ({ children }) => children }));
let settings = emptyConfiguration();
beforeEach(() => {
  settings = emptyConfiguration();
  app.watchCalendarEvents.mockReset();
  app.homeOnline = true;
  app.connectionStatus = "connected";
  app.haUrl = "http://ha.local:8123";
  app.currentHome = mapHome({ "person.emma": state("person.emma", "home", { friendly_name: "Emma" }), "person.leo": state("person.leo", "home", { friendly_name: "Leo" }) }, emptyRegistries, "home");
  app.configurationRequest.mockImplementation(async (method, body) => {
    if (method === "PUT") settings = parseConfiguration(body);
    return { ok: true, json: async () => ({ revision: "a".repeat(64), config: structuredClone(settings) }) };
  });
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Reflect.deleteProperty(document, "execCommand"); });
const pageReady = () => waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
const navigate = async (name: string) => {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name }));
  await screen.findByRole("heading", { level: 1, name: name === "Our week" ? "Our week." : name });
};
const saved = async () => {
  await waitFor(() => expect(screen.getByRole("status", { name: "Settings storage" })).toHaveTextContent("Shared settings saved."));
  await pageReady();
};

it("configures calendars in settings, shows today's agenda on School and keeps the full week accessible", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Example child" }),
    ...Object.fromEntries(["Activities", "Invitations", "Pedagogy", "Closures", "Hours"].map(name => [`calendar.${name.toLowerCase()}`, state(`calendar.${name.toLowerCase()}`, "off", { friendly_name: name })])),
  }, emptyRegistries, "home");
  const child = "home|person.example";
  settings.settings.timetableEnabled = { [child]: true };
  settings.settings.timetables = { [child]: ["/sample.png"] };
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, receive) => {
    const activity = { summary: "Example activity", start: "2026-10-26T09:00:00Z", end: "2026-10-26T10:00:00Z" };
    receive(id === "calendar.activities" || id === "calendar.invitations" ? [activity]
      : [{ summary: id === "calendar.pedagogy" ? "Shared focus" : id === "calendar.closures" ? "Planning day" : "Regular hours", description: id === "calendar.pedagogy" ? "A long educational message.\nA second paragraph." : "", start: "2026-10-26", end: "2026-10-27" }]);
  });
  window.history.replaceState(null, "", "/settings#timetables");
  const view = render(<App />); await saved();
  expect(screen.getByLabelText("School or kindergarten for Example child")).toHaveValue("school");
  fireEvent.change(screen.getByLabelText("School or kindergarten for Example child"), { target: { value: "kindergarten" } });
  fireEvent.change(screen.getByLabelText("Timetable type for Example child"), { target: { value: "calendar" } });
  expect(screen.getAllByRole("button", { name: /^School day view ·/ })).toHaveLength(5);
  expect(within(screen.getByRole("tabpanel")).getAllByText("No calendars selected")).toHaveLength(3);
  expect(app.watchCalendarEvents).not.toHaveBeenCalled();
  expect(screen.queryByText(/popup/i)).not.toBeInTheDocument();
  expect(screen.queryByText("Dashboard week view")).not.toBeInTheDocument();
  for (const [category, names] of [["School day view · Activities", ["Activities", "Invitations"]], ["School day view · Meetings", ["Invitations"]], ["School day view · Messages (Pedagogy)", ["Pedagogy"]], ["School day view · Closure days", ["Closures"]], ["School day view · Opening hours", ["Hours"]]] as const) {
    fireEvent.click(screen.getByRole("button", { name: `${category} calendars for Example child` }));
    const picker = screen.getByRole("dialog", { name: category.split(" · ")[1] });
    for (const name of names) fireEvent.click(within(picker).getByRole("checkbox", { name }));
    fireEvent.keyDown(picker, { key: "Escape" });
  }
  await saved();
  expect(settings.settings.timetableSettings[child].calendars["home|calendar.activities"]).toEqual(["events", "popupActivities"]);
  expect(settings.settings.timetableSettings[child].calendars["home|calendar.pedagogy"]).toEqual(["message", "popupMessages"]);
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Monday/ }), { button: 0, ctrlKey: false });
  const preview = screen.getByRole("tabpanel");
  expect(within(within(preview).getByRole("region", { name: "Activities" })).getByText("Example activity")).toBeVisible();
  expect(within(within(preview).getByRole("region", { name: "Messages (Pedagogy)" })).getByText("Shared focus")).toBeVisible();
  expect(app.watchCalendarEvents.mock.calls.every(([, , to]) => homeDate(new Date(to), app.currentHome.timeZone) === "2026-10-31")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "School day view · Activities calendars for Example child" }));
  const popupPicker = screen.getByRole("dialog", { name: "Activities" });
  fireEvent.click(within(popupPicker).getByRole("checkbox", { name: "Activities" }));
  fireEvent.click(within(popupPicker).getByRole("checkbox", { name: "Invitations" }));
  fireEvent.keyDown(popupPicker, { key: "Escape" });
  await saved();
  expect(settings.settings.timetableSettings[child].calendars).not.toHaveProperty("home|calendar.activities");
  expect(settings.settings.timetableSettings[child].calendars["home|calendar.invitations"]).toEqual(["events", "popupMeetings"]);
  expect(screen.getByRole("tab", { name: /Monday/ })).toHaveAttribute("aria-selected", "true");
  expect(within(within(preview).getByRole("region", { name: "Activities" })).queryByText("Example activity")).not.toBeInTheDocument();
  expect(within(within(preview).getByRole("region", { name: "Activities" })).getByText("No calendars selected")).toBeVisible();
  expect(settings.settings.timetables[child]).toEqual(["/sample.png"]);
  expect(JSON.stringify(settings)).not.toContain("Shared focus");
  await navigate("School");
  const today = await screen.findByRole("tabpanel");
  expect(within(today).queryByText("Shared focus")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Activities for Example child" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Expand timetable" })).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Monday/ }), { button: 0, ctrlKey: false });
  const selectedDay = screen.getByRole("tabpanel");
  expect(within(within(selectedDay).getByRole("region", { name: "Messages (Pedagogy)" })).getByText("Shared focus")).toBeVisible();
  expect(within(within(selectedDay).getByRole("region", { name: "Meetings" })).getByText("Example activity")).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Upload .* timetable PDF/)).not.toBeInTheDocument();
  expect(screen.queryByText("Share from iPhone")).not.toBeInTheDocument();
  const subscriptions = [...app.watchCalendarEvents.mock.calls];
  expect(subscriptions.some(([id, , to]) => id === "calendar.pedagogy" && homeDate(new Date(to), app.currentHome.timeZone) === "2027-10-25")).toBe(true);
  view.unmount();
  expect(subscriptions.every(call => call[3].aborted)).toBe(true);
  window.history.replaceState(null, "", "/");
  render(<App />); await saved();
  expect(await screen.findByText("Shared focus")).toBeInTheDocument();
  expect(screen.getAllByText("Example activity")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Expand timetable" }));
  const dialog = screen.getByRole("dialog", { name: "Example child’s kindergarten week" });
  expect(within(dialog).getAllByText("Example activity")).toHaveLength(1);
  expect(within(dialog).getByText("Planning day")).toBeInTheDocument();
  expect(within(dialog).queryByText("Regular hours")).not.toBeInTheDocument();
  expect(within(dialog).getByText("Next message · Mon 26 Oct")).toBeInTheDocument();

});

it("keeps unavailable source selections editable and suppresses hours when closure data fails", async () => {
  const child = "home|person.emma";
  settings.settings.timetableSettings = { [child]: { type: "calendar", education: "school", calendars: { "home|calendar.hours": ["hours", "popupHours"], "home|calendar.closures": ["closures", "popupClosures"], "home|calendar.removed": ["message", "popupMessages"] } } };
  const start = weekStart(homeDate(new Date(), app.currentHome.timeZone));
  app.currentHome.entities.push(...mapHome({
    "calendar.hours": state("calendar.hours", "off", { friendly_name: "Example hours" }),
    "calendar.closures": state("calendar.closures", "off", { friendly_name: "Example closures" }),
  }, emptyRegistries, "home").entities);
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, receive) => receive(id === "calendar.closures" ? null : [{ summary: "Regular hours", start, end: addDays(start, 14) }]));
  window.history.replaceState(null, "", "/school");
  const view = render(<App />); await saved();
  expect(await screen.findByText(/Some calendars could not be read/)).toHaveTextContent("Example closures");
  expect(screen.queryByText("Regular hours")).not.toBeInTheDocument();
  const calls = app.watchCalendarEvents.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(app.watchCalendarEvents.mock.calls.length).toBeGreaterThan(calls);
  view.unmount();
  app.homeOnline = false;
  window.history.replaceState(null, "", "/settings#timetables");
  render(<App />); await saved();
  expect(screen.getAllByRole("button", { name: /^School day view ·/ })).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "School day view · Messages (Pedagogy) calendars for Emma" }));
  const picker = screen.getByRole("dialog", { name: "Messages (Pedagogy)" });
  fireEvent.click(within(picker).getByRole("checkbox", { name: "Unavailable calendar: home|calendar.removed" }));
  fireEvent.keyDown(picker, { key: "Escape" });
  await saved();
  expect(settings.settings.timetableSettings[child].calendars).not.toHaveProperty("home|calendar.removed");
  await navigate("School");
  expect(screen.getByText("Connect to Home Assistant to see this timetable.")).toBeInTheDocument();
  expect(screen.queryByText("Regular hours")).not.toBeInTheDocument();
});

it("uses kindergarten wording for Norwegian image timetables and enlarged views", async () => {
  app.currentHome = mapHome({ "person.example": state("person.example", "home", { friendly_name: "Example child" }) }, emptyRegistries, "home");
  settings.settings.language = "nb";
  settings.settings.timetables = { "home|person.example": ["/sample.png"] };
  settings.settings.timetableSettings = { "home|person.example": { type: "images", education: "kindergarten", calendars: {} } };
  window.history.replaceState(null, "", "/school");
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Example childs barnehageuke" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Example childs barnehagetimeplan" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Forstørr/ }));
  expect(screen.getByRole("dialog", { name: "Example childs barnehageuke" })).toBeInTheDocument();
});

it.each(["/school", "/"])("translates known timetable labels on %s and in settings while preserving source content", async path => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
  app.currentHome = mapHome({
    "person.example": state("person.example", "home", { friendly_name: "Example child" }),
    "calendar.pedagogy": state("calendar.pedagogy", "off", { friendly_name: "Example nursery Example child Pedagogy" }),
    "calendar.activities": state("calendar.activities", "off", { friendly_name: "Example child Activities" }),
  }, emptyRegistries, "home");
  settings.settings.language = "nb";
  settings.settings.timetableSettings = { "home|person.example": { type: "calendar", education: "kindergarten", calendars: { "home|calendar.pedagogy": ["message", "popupMessages"], "home|calendar.activities": ["events", "popupActivities"] } } };
  const message = { summary: "Daily focus", description: "Daily focus: exploring shapes.", start: "2026-10-20", end: "2026-10-21" };
  app.watchCalendarEvents.mockImplementation((id, _from, _to, _signal, receive) => receive([id === "calendar.pedagogy" ? message : { ...message, summary: "Activities" }]));
  window.history.replaceState(null, "", path);
  const view = render(<App />);
  expect(await screen.findByText("Dagens fokus")).toBeInTheDocument();
  if (path === "/school") {
    expect(screen.getByRole("heading", { name: "Meldinger (pedagogikk)" })).toBeInTheDocument();
    expect(screen.queryByText("Example nursery Example child Pedagogikk")).not.toBeInTheDocument();
  } else expect(screen.getByRole("heading", { name: "Example nursery Example child Pedagogikk" })).toBeInTheDocument();
  expect(screen.getAllByText("Aktiviteter").length).toBeGreaterThan(0);
  expect(screen.getAllByText(message.description).length).toBeGreaterThan(0);
  expect(message.summary).toBe("Daily focus");
  expect(app.currentHome.entities.find(entity => entity.entityId === "calendar.pedagogy").name).toBe("Example nursery Example child Pedagogy");
  view.unmount();
  window.history.replaceState(null, "", "/settings#timetables");
  render(<App />);
  expect(await screen.findByRole("button", { name: "Kalendere i Dagsvisning på Skole · Aktiviteter for Example child" })).toHaveTextContent("Example child Aktiviteter");
  expect(screen.getByRole("button", { name: "Kalendere i Dagsvisning på Skole · Meldinger (pedagogikk) for Example child" })).toHaveTextContent("Example nursery Example child Pedagogikk");
});

it("keeps household records out of the smart-home device overview", async () => {
  app.currentHome = mapHome({
    "light.lamp": state("light.lamp", "off", { friendly_name: "Reading lamp" }),
    "person.example": state("person.example", "home", { friendly_name: "Example person" }),
    "calendar.example": state("calendar.example", "off", { friendly_name: "Example calendar" }),
    "todo.example": state("todo.example", "0", { friendly_name: "Example list" }),
  }, emptyRegistries, "home");
  window.history.replaceState(null, "", "/home");
  render(<App />); await saved();
  expect(screen.getByRole("link", { name: "Reading lamp details" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Example.* details/ })).not.toBeInTheDocument();
});

it.each(["/", "/calendar"])("marks Monday week changes and keeps today's week visible on %s", async path => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-12-31T23:30:00Z"));
  window.history.replaceState(null, "", path);
  render(<App />); await saved();

  expect(screen.getByText("Today · Week 53")).toBeInTheDocument();
  expect(screen.getByText("Week 53").closest("th")).toHaveTextContent("Today1 Jan");
  expect(screen.getByText("Week 1").closest("th")).toHaveTextContent("Mon4 Jan");
  expect(screen.getAllByText(/^Week \d+$/)).toHaveLength(2);

  fireEvent.click(screen.getByRole("button", { name: "By person" }));
  expect(screen.getByText("Week 53").closest("a, button")).toHaveTextContent("Fri01");
  expect(screen.getByText("Week 1").closest("a, button")).toHaveTextContent("Mon04");
  expect(screen.getAllByText(/^Week \d+$/)).toHaveLength(2);
  if (path === "/calendar") {
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByText("Today · Week 53")).toBeInTheDocument();
    expect(screen.getByText("Week 1").closest("button")).toHaveTextContent("Fri08");
    expect(screen.getByText("Week 2").closest("button")).toHaveTextContent("Mon11");
  }

  fireEvent.click(screen.getByRole("button", { name: "Weekly grid" }));
  fireEvent.click(screen.getByRole("button", { name: "Monday" }));
  expect(screen.getAllByText(/^Week \d+$/)).toHaveLength(1);
  expect(screen.getByText("Week 53").closest("th")).toHaveTextContent("Mon28 Dec");
  expect(screen.getByText("Today · Week 53")).toBeInTheDocument();
});

it("offers one setup entry on Today and keeps guidance off the everyday boards", async () => {
  render(<App />); await saved();
  expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/onboarding");
  expect(screen.queryByText(/Set up calendars in this app/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Set up people and calendars" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Set up to-do lists" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Set up school timetables/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Get started" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Get started" })).toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Household setup" }).children).toHaveLength(5);
  expect(screen.queryByRole("navigation", { name: "Smart home navigation" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Smart home" })).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("link", { name: "Add people in Home Assistant" })).toHaveAttribute("href", "http://ha.local:8123/config/person");
  expect(screen.getByText(/Daily lists need a Home Assistant automation/)).toBeInTheDocument();
  for (const [label, anchor] of [["Connection settings", "connection"], ["Choose people", "people-order"], ["Choose calendars", "family-calendar"], ["Choose lists", "family-lists"], ["Configure timetables", "timetables"]]) {
    fireEvent.click(screen.getByRole("link", { name: label }));
    expect(window.location.pathname).toBe("/settings");
    expect(window.location.hash).toBe(`#${anchor}`);
    await screen.findByRole("heading", { level: 1, name: "Home settings" });
    await waitFor(() => expect(document.getElementById(anchor)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("link", { name: "Get started" }));
    await screen.findByRole("heading", { level: 1, name: "Get started" });
  }
  fireEvent.click(screen.getByRole("link", { name: "Go to Today" }));
  expect(window.location.pathname).toBe("/");
  await navigate("Our week");
  expect(screen.queryByText(/Set up calendars in this app/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Set up people and calendars" })).not.toBeInTheDocument();
  await navigate("Lists");
  expect(screen.getByRole("button", { name: /Shopping/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("link", { name: "Set up to-do lists" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Daily tasks use your selected/)).not.toBeInTheDocument();
});

it.each([
  { calendarMembers: { "home|calendar.family": "everyone" } },
  { todoLists: { "home|todo.shopping": { kind: "shopping" as const, member: "everyone" } } },
  { timetableEnabled: { "home|person.emma": true } },
  { timetables: { "home|person.emma": ["/timetable.png"] } },
  { homeEntities: [] },
  { selectedAlarm: "home|alarm_control_panel.home" },
])("keeps the setup entry in the menu for configured households: %j", async configuration => {
  Object.assign(settings.settings, configuration);
  render(<App />); await saved();
  expect(screen.queryByRole("link", { name: "Get started" })).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("button", { name: "Open app settings" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: "Get started" }));
  expect(window.location.pathname).toBe("/onboarding");
  expect(await screen.findByRole("heading", { name: "Get started" })).toBeInTheDocument();
});

it("keeps onboarding available without a Home Assistant connection", async () => {
  app.haUrl = "";
  app.homeOnline = false;
  window.history.replaceState(null, "", "/onboarding");
  render(<App />); await saved();
  expect(screen.getByText("Home Assistant not connected")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Add people in Home Assistant" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Choose calendars" })).toHaveAttribute("href", "/settings#family-calendar");
  expect(screen.getByRole("link", { name: "Go to Today" })).toHaveAttribute("href", "/");
});

it("navigates with empty HA data and shows the server-managed connection", async () => {
  app.currentHome = mapHome({}, emptyRegistries, "home");
  render(<App />); await saved();
  expect(screen.getByRole("heading", { level: 1, name: "Good to be home." })).toBeInTheDocument();
  expect(screen.getByRole("contentinfo")).toHaveTextContent("Version 9.8.7");
  await navigate("Smart home");
  fireEvent.click(screen.getByRole("link", { name: /Configure Home Assistant/ }));
  expect(await screen.findByRole("button", { name: "Reconnect" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Home Assistant URL")).not.toBeInTheDocument();
  for (const [link, heading] of [["Devices", "Devices"], ["Areas", "Areas"], ["Zones", "Zones"], ["Security", "Alarm"], ["Automations", "Automations"], ["Scenes", "Scenes"], ["Activity", "History"], ["Integrations", "Integrations"]]) {
    const nav = within(screen.getByRole("navigation", { name: "Smart home navigation" }));
    const direct = nav.queryByRole("link", { name: link });
    if (direct) fireEvent.click(direct);
    else {
      fireEvent.keyDown(nav.getByRole("button"), { key: "Enter" });
      fireEvent.click(await screen.findByRole("menuitem", { name: link }));
    }
    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  }
});

it("shares people visibility, order and timetable preferences with another screen", async () => {
  window.history.replaceState(null, "", "/settings");
  const phone = render(<App />); await saved();
  fireEvent.click(screen.getByRole("switch", { name: "Show Emma in family planner" })); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Move Leo up" })); await saved();
  fireEvent.click(screen.getByRole("switch", { name: "Timetable for Leo" })); await saved();
  expect(settings.settings.hiddenMembers).toEqual(["home|person.emma"]);
  expect(settings.settings.memberOrder).toEqual(["home|person.leo", "home|person.emma"]);
  phone.unmount();
  window.history.replaceState(null, "", "/school");
  render(<App />); await saved();
  expect(screen.getByRole("heading", { name: "Leo’s school week" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Emma’s school week" })).not.toBeInTheDocument();
});

it("navigates timetable pages with arrows and keyboard and enlarges the selected page", async () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("aria-roledescription") === "slide" ? [...this.parentElement!.children].indexOf(this) * 400 : 0;
  });
  settings.settings.timetables = { "home|person.emma": ["/first.svg", "/second.svg"] };
  settings.settings.timetableEnabled = { "home|person.emma": true };
  window.history.replaceState(null, "", "/school");
  render(<><style>{'[aria-roledescription="slide"] { margin-right: 0px; }'}</style><App /></>); await saved();
  const carousel = screen.getByRole("region", { name: "Emma’s timetable pages" });
  const next = within(carousel).getByRole("button", { name: "Next timetable page" });
  act(() => next.focus()); fireEvent.click(next);
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

it("offers the signed iOS shortcut and copies each person's upload destination", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", Object.create(navigator, { clipboard: { value: { writeText } } }));
  const success = vi.spyOn(toast, "success").mockImplementation(() => "copied");
  settings.settings.timetableEnabled = { "home|person.emma": true, "home|person.leo": true };
  window.history.replaceState(null, "", "/settings");
  render(<App />); await saved();
  for (const name of ["Emma", "Leo"]) {
    const card = within(screen.getByRole("heading", { name: name }).closest("article")!);
    fireEvent.click(card.getByText("Share from iPhone"));
    expect(card.getByRole("link", { name: "Download iOS shortcut" })).toHaveAttribute("href", "/shortcuts/Upload%20timetable.shortcut");
    const destination = new URL((card.getByLabelText(`${name} upload URL`) as HTMLInputElement).value);
    expect(destination.origin).toBe(window.location.origin);
    expect(destination.pathname).toBe("/api/timetables");
    expect(destination.searchParams.get("member")).toBe(`home|person.${name.toLowerCase()}`);
    fireEvent.click(card.getByRole("button", { name: `Copy ${name} upload URL` }));
    await waitFor(() => expect(success).toHaveBeenCalledWith("Upload URL copied"));
    expect(writeText).toHaveBeenLastCalledWith(destination.href);
    success.mockClear();
  }
});

it.each([
  ["unavailable", true], ["denied", true], ["unavailable", false], ["denied", false],
])("falls back to selected-text copying when clipboard access is %s (copy succeeds: %s)", async (access, copied) => {
  const clipboard = access === "denied" ? { writeText: vi.fn().mockRejectedValue(new Error("Access denied")) } : undefined;
  vi.stubGlobal("navigator", Object.create(navigator, { clipboard: { value: clipboard } }));
  const error = vi.spyOn(toast, "error").mockImplementation(() => "copy-failed");
  const success = vi.spyOn(toast, "success").mockImplementation(() => "copied");
  settings.settings.timetableEnabled = { "home|person.emma": true };
  window.history.replaceState(null, "", "/settings");
  render(<App />); await saved();
  fireEvent.click(screen.getByText("Share from iPhone"));
  const input = screen.getByLabelText("Emma upload URL") as HTMLInputElement;
  vi.mocked(document.execCommand).mockImplementation(() => {
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    return Boolean(copied);
  });
  fireEvent.click(screen.getByRole("button", { name: "Copy Emma upload URL" }));
  if (copied) {
    await waitFor(() => expect(success).toHaveBeenCalledWith("Upload URL copied"));
    expect(error).not.toHaveBeenCalled();
  } else {
    await waitFor(() => expect(error).toHaveBeenCalledWith("Could not copy. Select the Upload URL and copy it manually."));
    expect(success).not.toHaveBeenCalled();
  }
  expect(document.execCommand).toHaveBeenCalledWith("copy");
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
});

it.each([".png", "-dark.svg"])("colors the original PNG for saved %s timetables across previews and enlarged views", async extension => {
  const imagePath = "/api/timetables/emma/00000000-0000-4000-8000-000000000000/1.png";
  const darkPath = imagePath.replace(/\.png$/, "-dark.svg");
  settings.settings.appearance.theme = "light";
  settings.settings.timetables = { "home|person.emma": [imagePath.replace(/\.png$/, extension)], "home|person.leo": ["/linked.svg"] };
  settings.settings.timetableEnabled = { "home|person.emma": true, "home|person.leo": true };
  app.storageRequest.mockReset().mockImplementation(async path => new Response("image", { headers: { "Content-Type": path.endsWith(".svg") ? "image/svg+xml" : "image/png" } }));
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: vi.fn((blob: Blob) => `blob:${blob.type}`), revokeObjectURL: vi.fn() }));
  window.history.replaceState(null, "", "/user-settings");
  const preferences = render(<App />); await saved();
  const toggle = screen.getByRole("switch", { name: "Toggle dark timetables" });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle); await saved();
  expect(settings.settings.appearance).toMatchObject({ theme: "light", darkTimetables: true });
  preferences.unmount();

  for (const path of ["/", "/school"]) {
    window.history.replaceState(null, "", path);
    const view = render(<App />); await saved();
    await waitFor(() => expect(screen.getByRole("img", { name: "Emma’s school timetable" })).toHaveAttribute("src", "blob:image/png"));
    expect(screen.getByRole("img", { name: "Emma’s school timetable" })).toHaveClass("timetable-image-dark");
    expect(app.storageRequest).toHaveBeenLastCalledWith(imagePath);
    expect(app.storageRequest).not.toHaveBeenCalledWith(darkPath);
    expect(screen.getByRole("img", { name: "Leo’s school timetable" })).toHaveAttribute("src", "/linked.svg");
    expect(screen.getByRole("img", { name: "Leo’s school timetable" })).not.toHaveClass("timetable-image-dark");
    fireEvent.click(screen.getByRole("button", { name: "Enlarge Emma’s timetable" }));
    const dialog = within(screen.getByRole("dialog", { name: "Emma’s school week" }));
    await waitFor(() => expect(dialog.getByRole("img", { name: "Emma’s school timetable" })).toHaveAttribute("src", "blob:image/png"));
    expect(dialog.getByRole("img", { name: "Emma’s school timetable" })).toHaveClass("timetable-image-dark");
    view.unmount();
  }
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:image/png");

  window.history.replaceState(null, "", "/user-settings");
  const nextPreferences = render(<App />); await saved();
  expect(screen.getByRole("switch", { name: "Toggle dark timetables" })).toBeChecked();
  fireEvent.click(screen.getByRole("switch", { name: "Toggle dark timetables" })); await saved();
  nextPreferences.unmount();
  window.history.replaceState(null, "", "/school");
  render(<App />); await saved();
  await waitFor(() => expect(screen.getByRole("img", { name: "Emma’s school timetable" })).toHaveAttribute("src", "blob:image/png"));
  expect(screen.getByRole("img", { name: "Emma’s school timetable" })).not.toHaveClass("timetable-image-dark");
  expect(app.storageRequest).toHaveBeenLastCalledWith(imagePath);
});

it("keeps timetable pages when replacing or hiding them is cancelled", async () => {
  settings.settings.timetables = { "home|person.emma": ["/first.svg"] };
  settings.settings.timetableEnabled = { "home|person.emma": true };
  window.history.replaceState(null, "", "/settings");
  render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Change timetable images" }));
  fireEvent.change(screen.getByLabelText("Emma timetable image URLs"), { target: { value: "https://school.example/replacement.png" } });
  fireEvent.click(screen.getByRole("button", { name: "Save image URLs" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(settings.settings.timetables["home|person.emma"]).toEqual(["/first.svg"]);
  fireEvent.click(await screen.findByRole("switch", { name: "Timetable for Emma" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(settings.settings.timetableEnabled["home|person.emma"]).toBe(true);
});

it("uses home time and real calendar dates across month and year boundaries", () => {
  expect(homeDate(new Date("2026-12-31T23:30:00Z"), "Europe/Oslo")).toBe("2027-01-01");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(weekStart("2027-01-01")).toBe("2026-12-28");
  expect(isPlannerDate("2026-02-30")).toBe(false);
  expect(isPlannerDate("2028-02-29")).toBe(true);
});

it("saves the server language, updates navigation and labels, and restores it on reload", async () => {
  window.history.replaceState(null, "", "/user-settings");
  const first = render(<App />); await saved();
  fireEvent.change(screen.getByRole("combobox", { name: "Language" }), { target: { value: "nb" } });
  await waitFor(() => expect(settings.settings.language).toBe("nb"));
  expect(screen.getByRole("heading", { level: 1, name: "Innstillinger" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "I dag" })).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Slå mørk modus av eller på" })).toBeInTheDocument();
  expect(document.documentElement.lang).toBe("nb");
  expect(document.title).toBe("Afterglow · Familien hjemme");
  first.unmount();
  render(<App />);
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Språk" })).toHaveValue("nb"));
  fireEvent.change(screen.getByRole("combobox", { name: "Språk" }), { target: { value: "en" } });
  await saved();
  expect(document.documentElement.lang).toBe("en");
  expect(screen.getByRole("link", { name: "Today" })).toBeInTheDocument();
});

it("refreshes language from another screen while a confirmation stays open", async () => {
  settings.settings.language = "nb";
  window.history.replaceState(null, "", "/settings");
  render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Koble fra" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Koble fra" }));
  expect(screen.getByRole("alertdialog", { name: "Koble fra Home Assistant?" })).toBeInTheDocument();
  settings.settings.language = "en";
  await waitFor(() => expect(screen.getByRole("alertdialog", { name: "Disconnect Home Assistant?" })).toBeInTheDocument(), { timeout: 6500 });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(app.disconnect).not.toHaveBeenCalled();
}, 10000);


it("applies shared compact density and restores it on reload", async () => {
  window.history.replaceState(null, "", "/user-settings");
  const view = render(<App />); await saved();
  expect(screen.getByRole("main").closest(".afterglow-app")).not.toHaveClass("compact-mode");
  fireEvent.click(screen.getByRole("switch", { name: "Toggle compact mode" }));
  await saved();
  expect(screen.getByRole("main").closest(".afterglow-app")).toHaveClass("compact-mode");
  view.unmount();
  render(<App />); await saved();
  expect(screen.getByRole("main").closest(".afterglow-app")).toHaveClass("compact-mode");
});

it("distinguishes offline plans and security from successful empty reads", async () => {
  app.homeOnline = false;
  app.connectionStatus = "disconnected";
  const view = render(<App />); await saved();
  expect(screen.getByRole("region", { name: "Next family plan" })).toHaveTextContent("Calendars unavailable while offline.");
  expect(screen.getByRole("button", { name: "Add a family plan" })).toBeDisabled();
  await navigate("Smart home");
  expect(screen.queryByText("No alarm")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Security Offline" })).toBeInTheDocument();
  view.unmount();
  app.connectionStatus = "connected";
});
