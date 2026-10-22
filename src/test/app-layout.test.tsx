import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { lazy } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { SmartHomeNav } from "@/components/layout/Navigation";

const shared = vi.hoisted(() => ({ enabled: true, online: true, availableVersion: undefined as string | undefined, state: { loaded: true, dirty: false, saving: false, error: "", timetableError: null as { id: string; member: string; message: string } | null } }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => ({ homeOnline: true, currentHome: { name: "Home" }, metadataWarnings: [] }) }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ saved: shared.state.loaded && !shared.state.dirty, memberName: () => "Emma", appearance: { compactMode: false } }) }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => shared }));
vi.mock("@/hooks/use-app-update", () => ({ appVersion: "0.0.0", useAppUpdate: () => shared.availableVersion }));

beforeEach(() => {
  shared.enabled = true;
  shared.online = true;
  shared.availableVersion = undefined;
  shared.state = { loaded: true, dirty: false, saving: false, error: "", timetableError: null };
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const layout = () => <MemoryRouter><AppLayout /></MemoryRouter>;

it("keeps navigation visible during page loading and scrolls to the anchor after it loads", async () => {
  const scrollIntoView = vi.fn();
  const Page = () => <section id="example" ref={element => { if (element) element.scrollIntoView = scrollIntoView; }}>Page content</section>;
  let resolvePage: (module: { default: typeof Page }) => void;
  const LazyPage = lazy(() => new Promise<{ default: typeof Page }>(resolve => { resolvePage = resolve; }));
  render(<MemoryRouter initialEntries={["/example#example"]}><Routes>
    <Route element={<AppLayout />}><Route path="/example" element={<LazyPage />} /></Route>
  </Routes></MemoryRouter>);

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
  render(<MemoryRouter initialEntries={["/school"]}><Routes>
    <Route element={<AppLayout />}>
      <Route path="/school" element={<LazyPage />} />
      <Route path="/lists" element={<p>Working page</p>} />
    </Route>
  </Routes></MemoryRouter>);

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

it.each(["/devices/sample", "/entities/light.sample"])("marks the parent device section on %s", path => {
  render(<MemoryRouter initialEntries={[path]}><SmartHomeNav /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Devices" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("link", { name: "Overview" }));
  expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
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
  expect(screen.getByRole("link", { name: "Timetable settings" })).toHaveAttribute("href", "/settings#timetables");
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
  expect(status).toHaveClass("absolute");
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
  const settings = screen.getByRole("button", { name: "Open app settings" });
  expect(settings).toHaveAttribute("title", message);
  fireEvent.keyDown(settings, { key: "Enter" });
  expect(screen.getByRole("menuitem", { name: "Storage and backups" })).toHaveAttribute("href", "/user-settings");
});
