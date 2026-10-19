import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import App from "@/App";
import { emptyConfiguration, parseConfiguration } from "../../shared/configuration";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { addDays, homeDate, weekStart, isPlannerDate } from "@/contexts/FamilyContext";

const app = vi.hoisted(() => ({ currentHome: null, haUrl: "http://ha.local:8123", homeOnline: true, connectionStatus: "connected", metadataWarnings: [], services: {}, commands: {}, connect: vi.fn(), disconnect: vi.fn(), configurationRequest: vi.fn(), storageRequest: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app, AppProvider: ({ children }) => children }));
vi.mock("../../config.yaml?raw", () => ({ default: 'name: Home Harmony UI\nversion: "9.8.7"\n' }));
let settings = emptyConfiguration();
beforeEach(() => {
  settings = emptyConfiguration();
  app.homeOnline = true;
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
const navigate = (name: string) => fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name }));
const saved = () => waitFor(() => expect(screen.getByRole("status", { name: "Settings storage" })).toHaveTextContent("Shared settings saved."));

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
  expect(screen.getByRole("heading", { level: 1, name: "Get started" })).toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Household setup" }).children).toHaveLength(5);
  expect(screen.queryByRole("navigation", { name: "Smart home navigation" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Smart home" })).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("link", { name: "Add people in Home Assistant" })).toHaveAttribute("href", "http://ha.local:8123/config/person");
  expect(screen.getByText(/Daily lists need a Home Assistant automation/)).toBeInTheDocument();
  for (const [label, anchor] of [["Connection settings", "connection"], ["Choose people", "people-order"], ["Choose calendars", "family-calendar"], ["Choose lists", "family-lists"], ["Enable timetables", "people-order"]]) {
    fireEvent.click(screen.getByRole("link", { name: label }));
    expect(window.location.pathname).toBe("/settings");
    expect(window.location.hash).toBe(`#${anchor}`);
    expect(document.getElementById(anchor)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Get started" }));
  }
  fireEvent.click(screen.getByRole("link", { name: "Go to Today" }));
  expect(window.location.pathname).toBe("/");
  navigate("Our week");
  expect(screen.queryByText(/Set up calendars in this app/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Set up people and calendars" })).not.toBeInTheDocument();
  navigate("Lists");
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
  expect(screen.getByRole("heading", { name: "Get started" })).toBeInTheDocument();
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
  navigate("Smart home");
  fireEvent.click(screen.getByRole("link", { name: /Configure Home Assistant/ }));
  expect(await screen.findByRole("button", { name: "Reconnect" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Home Assistant URL")).not.toBeInTheDocument();
  for (const [link, heading] of [["Devices", "Devices"], ["Areas", "Areas"], ["Zones", "Zones"], ["Security", "Alarm"], ["Automations", "Automations"], ["Scenes", "Scenes"], ["Activity", "History"], ["Integrations", "Integrations"]]) {
    fireEvent.click(within(screen.getByRole("navigation", { name: "Smart home navigation" })).getByRole("link", { name: link }));
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
  window.history.replaceState(null, "", "/school");
  render(<App />); await saved();
  for (const name of ["Emma", "Leo"]) {
    const card = within(screen.getByRole("heading", { name: `${name}’s school week` }).closest("article")!);
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
  window.history.replaceState(null, "", "/school");
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
  window.history.replaceState(null, "", "/school");
  render(<App />); await saved();
  fireEvent.click(screen.getByRole("button", { name: "Change timetable images" }));
  fireEvent.change(screen.getByLabelText("Emma timetable image URLs"), { target: { value: "https://school.example/replacement.png" } });
  fireEvent.click(screen.getByRole("button", { name: "Save image URLs" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(settings.settings.timetables["home|person.emma"]).toEqual(["/first.svg"]);
  fireEvent.click(screen.getByRole("link", { name: "Manage people" }));
  fireEvent.click(screen.getByRole("switch", { name: "Timetable for Emma" }));
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
