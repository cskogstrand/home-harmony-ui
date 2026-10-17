import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";

const shared = vi.hoisted(() => ({ enabled: true, online: true, state: { loaded: true, dirty: false, saving: false, error: "" } }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => ({ homeOnline: true, currentHome: { name: "Home" }, metadataWarnings: [] }) }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ saved: shared.state.loaded && !shared.state.dirty }) }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => shared }));

beforeEach(() => {
  shared.enabled = true;
  shared.online = true;
  shared.state = { loaded: true, dirty: false, saving: false, error: "" };
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const layout = () => <MemoryRouter><AppLayout /></MemoryRouter>;

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
  [{}, false, "Connect to Home Assistant to load and save shared settings."],
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

it("omits the shared storage indicator in browser-only mode", () => {
  shared.enabled = false;
  render(layout());
  expect(screen.queryByRole("status", { name: "Settings storage" })).not.toBeInTheDocument();
});
