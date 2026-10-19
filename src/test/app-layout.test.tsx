import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { SmartHomeNav } from "@/components/layout/Navigation";

const shared = vi.hoisted(() => ({ enabled: true, online: true, state: { loaded: true, dirty: false, saving: false, error: "", timetableError: null as { id: string; member: string; message: string } | null } }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => ({ homeOnline: true, currentHome: { name: "Home" }, metadataWarnings: [] }) }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ saved: shared.state.loaded && !shared.state.dirty, memberName: () => "Emma" }) }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => shared }));

beforeEach(() => {
  shared.enabled = true;
  shared.online = true;
  shared.state = { loaded: true, dirty: false, saving: false, error: "", timetableError: null };
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const layout = () => <MemoryRouter><AppLayout /></MemoryRouter>;

it.each(["/settings", "/devices/sample", "/entities/light.sample"])("reveals the active smart home tab on %s and after navigation", path => {
  const scroll = vi.fn();
  const original = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scroll });
  try {
    render(<MemoryRouter initialEntries={[path]}><SmartHomeNav /></MemoryRouter>);
    const active = screen.getByRole("link", { name: path === "/settings" ? "Home settings" : "Devices" });
    expect(scroll.mock.contexts[scroll.mock.contexts.length - 1]).toBe(active);
    expect(scroll).toHaveBeenLastCalledWith({ block: "nearest", inline: "nearest", behavior: "instant" });
    const overview = screen.getByRole("link", { name: "Overview" });
    fireEvent.click(overview);
    expect(overview).toHaveAttribute("aria-current", "page");
    expect(scroll.mock.contexts[scroll.mock.contexts.length - 1]).toBe(overview);
  } finally {
    if (original) Object.defineProperty(Element.prototype, "scrollIntoView", original);
    else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  }
});

it("shows upload errors above the page and allows dismissing each new failure", () => {
  const view = render(layout());
  shared.state.timetableError = { id: "first", member: "home|person.emma", message: "Choose a PDF without password protection." };
  view.rerender(layout());
  const alert = screen.getByRole("alert");
  expect(screen.getByRole("banner").nextElementSibling).toBe(alert);
  expect(alert).toHaveTextContent("Emma’s timetable upload failed.");
  expect(alert).toHaveTextContent(shared.state.timetableError.message);
  expect(screen.getByRole("link", { name: "Open School" })).toHaveAttribute("href", "/school");
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
