import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { lazy } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import School from "@/pages/School";
import { AppLayout } from "@/components/layout/AppLayout";
import { SmartHomeNav } from "@/components/layout/Navigation";
import { NotificationContext } from "@/contexts/NotificationContext";
import { notificationRuleSchema } from "../../shared/notifications";

const media = vi.hoisted(() => ({ state: "paused", source: "Radio" }));
const shared = vi.hoisted(() => ({ enabled: true, assist: false, online: true, notifications: { presentation: "section", pages: "main" }, availableVersion: undefined as string | undefined, state: { config: { settings: { cameras: { items: [] } } }, loaded: true, dirty: false, saving: false, error: "", timetableError: null as { id: string; member: string; message: string } | null } }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => ({ homeOnline: shared.online, currentHome: { name: "Home", entities: [{ domain: "media_player", entityId: "media_player.example", integration: "sonos", state: media.state, attributes: { source: media.source } }] }, entityRegistryAvailable: true, metadataWarnings: [] }) }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ saved: shared.state.loaded && !shared.state.dirty, assist: { enabled: shared.assist, agentId: "" }, vehicles: [], members: [], dashboard: {}, selectedAlarm: "", memberName: () => "Emma", smartHome: { layout: [] }, appearance: { compactMode: false, plannerArtwork: {} }, notifications: shared.notifications }) }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => shared }));
vi.mock("@/hooks/use-app-update", () => ({ appVersion: "0.0.0", useAppUpdate: () => shared.availableVersion }));
vi.mock("@/components/layout/MainPages", () => ({ MainPages: () => null }));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  media.state = "paused";
  media.source = "Radio";
  shared.enabled = true;
  shared.assist = false;
  shared.online = true;
  shared.availableVersion = undefined;
  shared.notifications = { presentation: "section", pages: "main" };
  shared.state = { config: { settings: { cameras: { items: [] } } }, loaded: true, dirty: false, saving: false, error: "", timetableError: null };
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const layout = () => <MemoryRouter><AppLayout /></MemoryRouter>;

it.each(["banner", "section", "activity", "activity-compact"])("keeps the bell in the shell and places %s previews under the page heading", presentation => {
  const rule = notificationRuleSchema.parse({ id: "fictional", title: "Example task", kind: "ongoing", trigger: { type: "state", entity: "home|sensor.example", operator: "eq", value: "running" } });
  const value = { notifications: [{ id: rule.id, rule, startedAt: 0, popup: false }], errors: [], dismiss: vi.fn(), camera: vi.fn(), retry: vi.fn() };
  const content = (path: string) => <MemoryRouter key={path} initialEntries={[path]}><NotificationContext.Provider value={value}><AppLayout>
    <Routes><Route path="/school" element={<School />} /><Route path="*" element={null} /></Routes>
  </AppLayout></NotificationContext.Provider></MemoryRouter>;
  const view = render(content("/school"));
  for (const pages of ["main", "today"]) {
    shared.notifications = { presentation, pages };
    for (const path of ["/school", "/settings", "/notifications", "/devices/example", "/user-settings"]) {
      view.rerender(content(path));
      const region = screen.queryByRole("region", { name: "Active notifications" });
      if (path === "/school" && pages === "main") {
        expect(screen.getByRole("heading", { name: "School" }).closest("header").nextElementSibling).toContainElement(region);
      } else expect(region).toBeNull();
      expect(screen.getByRole("link", { name: "Notifications: 1 active" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Home status · No sources selected" })).toBeVisible();
    }
  }
});

it("honors a rule's main-page override even when the legacy global choice is Today only", () => {
  shared.notifications = { presentation: "activity", pages: "today" };
  const rules = ["today", "main"].map(pages => notificationRuleSchema.parse({ id: pages, title: `Example ${pages}`, pages, kind: "ongoing", trigger: { type: "state", entity: "home|sensor.example", operator: "eq", value: "running" } }));
  const value = { notifications: rules.map(rule => ({ id: rule.id, rule, startedAt: 0, popup: false })), errors: [], dismiss: vi.fn(), camera: vi.fn(), retry: vi.fn() };
  render(<MemoryRouter initialEntries={["/school"]}><NotificationContext.Provider value={value}><AppLayout><School /></AppLayout></NotificationContext.Provider></MemoryRouter>);
  expect(screen.getByText("Example main")).toBeVisible();
  expect(screen.queryByText("Example today")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Notifications: 2 active" })).toBeVisible();
});

it("keeps navigation visible during page loading and scrolls to the anchor after it loads", async () => {
  const scrollIntoView = vi.fn();
  const Page = () => <section id="example" ref={element => { if (element) element.scrollIntoView = scrollIntoView; }}>Page content</section>;
  let resolvePage: (module: { default: typeof Page }) => void;
  const LazyPage = lazy(() => new Promise<{ default: typeof Page }>(resolve => { resolvePage = resolve; }));
  render(<MemoryRouter initialEntries={["/example#example"]}><AppLayout><Routes>
    <Route path="/example" element={<LazyPage />} />
  </Routes></AppLayout></MemoryRouter>);

  expect(screen.getByText("Loading…")).toHaveAttribute("role", "status");
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  expect(window.scrollTo).not.toHaveBeenCalled();
  await act(async () => resolvePage({ default: Page }));
  expect(screen.getByText("Page content")).toBeVisible();
  expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  expect(scrollIntoView).toHaveBeenCalledOnce();
});

it("keeps navigation usable when a page download fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const reload = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload });
  let rejectPage: (error: Error) => void;
  const LazyPage = lazy(() => new Promise<{ default: () => JSX.Element }>((_, reject) => { rejectPage = reject; }));
  render(<MemoryRouter initialEntries={["/school"]}><AppLayout><Routes>
      <Route path="/school" element={<LazyPage />} />
      <Route path="/lists" element={<p>Working page</p>} />
  </Routes></AppLayout></MemoryRouter>);

  const error = new TypeError("Failed to fetch dynamically imported module");
  const silenceExpectedError = (event: ErrorEvent) => { if (event.error === error) event.preventDefault(); };
  window.addEventListener("error", silenceExpectedError);
  try { await act(async () => rejectPage(error)); }
  finally { window.removeEventListener("error", silenceExpectedError); }
  expect(screen.getByRole("alert")).toHaveTextContent("This page could not be loaded.");
  expect(screen.getByRole("banner")).toBeVisible();
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(reload).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("link", { name: "Lists" }));
  expect(screen.getByText("Working page")).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("offers an update without reloading until the user chooses to refresh", () => {
  const reload = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload });
  const view = render(layout());
  expect(screen.queryByRole("button", { name: "Refresh app" })).not.toBeInTheDocument();
  shared.availableVersion = "99.0.0";
  view.rerender(layout());
  expect(screen.getByText("Version 99.0.0 is available. Refresh the app to update.").closest("[role='status']")).toBeVisible();
  expect(reload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh app" }));
  expect(reload).toHaveBeenCalledOnce();
});

it("leads the header actions with Ask the house only when it is turned on", () => {
  const view = render(layout());
  expect(screen.queryByRole("button", { name: "Ask the house" })).not.toBeInTheDocument();
  shared.assist = true;
  view.rerender(layout());
  expect(screen.getByRole("button", { name: "Ask the house" }).parentElement).toHaveClass("header-actions");
  expect(screen.getByRole("button", { name: "Ask the house" }).parentElement.firstElementChild).toBe(screen.getByRole("button", { name: "Ask the house" }));
});

it.each(["/devices/sample", "/entities/light.sample"])("marks the parent device section on %s", path => {
  render(<MemoryRouter initialEntries={[path]}><SmartHomeNav /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Devices" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("link", { name: "Overview" }));
  expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
});

it("reveals the selected destination inside its row without scrolling the page", () => {
  render(<MemoryRouter initialEntries={["/home"]}><SmartHomeNav /></MemoryRouter>);
  const nav = screen.getByRole("link", { name: "Cameras" }).parentElement!;
  expect(nav).not.toContainElement(screen.getByRole("button", { name: "More controls" }));
  Object.defineProperties(nav, { clientWidth: { value: 320 }, scrollWidth: { value: 800 } });
  vi.spyOn(nav, "getBoundingClientRect").mockReturnValue(new DOMRect(16, 0, 320, 48));
  const cameras = screen.getByRole("link", { name: "Cameras" });
  vi.spyOn(cameras, "getBoundingClientRect").mockReturnValue(new DOMRect(400, 0, 88, 48));
  fireEvent.click(cameras);
  expect(nav.scrollLeft).toBe(152);
  const overview = screen.getByRole("link", { name: "Overview" });
  vi.spyOn(overview, "getBoundingClientRect").mockReturnValue(new DOMRect(-136, 0, 90, 48));
  fireEvent.click(overview);
  expect(nav.scrollLeft).toBe(0);
  expect(window.scrollTo).not.toHaveBeenCalled();
});

it("keeps the selected destination clear of the row's edge fade", () => {
  render(<MemoryRouter initialEntries={["/home"]}><SmartHomeNav /></MemoryRouter>);
  const nav = screen.getByRole("link", { name: "Cameras" }).parentElement!;
  Object.assign(nav.style, { scrollPaddingLeft: "24px", scrollPaddingRight: "24px" });
  Object.defineProperties(nav, { clientWidth: { value: 320 }, scrollWidth: { value: 800 } });
  vi.spyOn(nav, "getBoundingClientRect").mockReturnValue(new DOMRect(16, 0, 320, 48));
  const cameras = screen.getByRole("link", { name: "Cameras" });
  vi.spyOn(cameras, "getBoundingClientRect").mockReturnValue(new DOMRect(400, 0, 88, 48));
  fireEvent.click(cameras);
  expect(nav.scrollLeft).toBe(176);
});

it("keeps secondary routes discoverable with their current destination visible", () => {
  render(<MemoryRouter initialEntries={["/settings"]}><SmartHomeNav /></MemoryRouter>);
  const trigger = screen.getByRole("button", { name: "Home settings" });
  expect(trigger).toHaveAttribute("data-active", "true");
  fireEvent.keyDown(trigger, { key: "Enter" });
  expect(screen.getByRole("menuitem", { name: "Home settings" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("menuitem", { name: "Car & energy" }));
  expect(screen.getByRole("button", { name: "Car & energy" })).toHaveAttribute("data-active", "true");
});

it("shows upload errors above the page and allows dismissing each new failure", () => {
  const view = render(layout());
  shared.state.timetableError = { id: "first", member: "home|person.emma", message: "Choose a PDF without password protection." };
  view.rerender(layout());
  const alert = screen.getByRole("alert");
  expect(screen.getByRole("banner").nextElementSibling).toBe(alert);
  expect(alert).toHaveTextContent("Emma’s timetable upload failed.");
  expect(alert).toHaveTextContent(shared.state.timetableError.message);
  expect(screen.getByRole("link", { name: "Timetable settings" })).toHaveAttribute("href", "/settings/timetables");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss timetable error" }));
  view.rerender(layout());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  shared.state.timetableError = { ...shared.state.timetableError, id: "second" };
  view.rerender(layout());
  expect(screen.getByRole("alert")).toBeInTheDocument();
  shared.state.timetableError = null;
  view.rerender(layout());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("keeps save feedback in the header without inserting a page row during saves", () => {
  const view = render(layout());
  const pageRows = Array.from(view.container.firstElementChild!.children);
  const status = screen.getByRole("status", { name: "Settings storage" });
  expect(status.closest("header")).toBe(screen.getByRole("banner"));
  expect(status).toHaveClass("sr-only");
  expect(status).toHaveTextContent("Shared settings saved.");

  shared.state.dirty = true;
  shared.state.saving = true;
  view.rerender(layout());
  expect(status).toHaveTextContent("Saving shared settings…");
  expect(Array.from(view.container.firstElementChild!.children)).toEqual(pageRows);

  shared.state.dirty = false;
  shared.state.saving = false;
  view.rerender(layout());
  expect(status).toHaveTextContent("Shared settings saved.");
  expect(Array.from(view.container.firstElementChild!.children)).toEqual(pageRows);
});

it.each([
  [{ loaded: false }, true, "Loading shared settings…"],
  [{ dirty: true }, true, "Shared settings are not saved yet."],
  [{ error: "Another screen changed the configuration." }, true, "Another screen changed the configuration."],
])("keeps storage status and recovery accessible: %s", (state, online, message) => {
  Object.assign(shared.state, state);
  shared.online = online;
  render(layout());
  expect(screen.getByRole("status", { name: "Settings storage" })).toHaveTextContent(message);
  const settings = screen.getByRole("link", { name: "Open app settings" });
  expect(settings).toHaveAttribute("title", message);
  expect(settings).toHaveAccessibleDescription(message);
  expect(settings).toHaveAttribute("href", "/settings");
});

it("shows music playback only while a connected Sonos group plays music", () => {
  const atSonos = () => <MemoryRouter initialEntries={["/sonos"]}><AppLayout /></MemoryRouter>;
  const view = render(atSonos());
  const shortcut = screen.getByRole("banner").querySelector('a[href="/sonos"]');
  for (const [state, source, online, playing] of [
    ["playing", "Radio", true, true], ["paused", "Radio", true, false],
    ["playing", "TV", true, false], ["playing", "Radio", false, false],
  ] as const) {
    Object.assign(media, { state, source });
    shared.online = online;
    view.rerender(atSonos());
    expect(shortcut).toHaveAttribute("href", playing ? "/sonos?player=media_player.example" : "/sonos");
    expect(shortcut).toHaveAccessibleName(playing ? "Sonos · Music playing" : "Sonos");
    expect(!!shortcut!.querySelector(".header-badge")).toBe(playing);
  }
});
