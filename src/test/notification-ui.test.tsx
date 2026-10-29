import { chooseEntity } from "./entity-picker-helpers";
import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { NotificationRow } from "@/components/NotificationCenter";
import { NotificationPreview } from "@/components/NotificationPreview";
import { NotificationSettings } from "@/components/NotificationSettings";
import { NotificationBell, NotificationCamera, NotificationList } from "@/components/NotificationCenter";
import { NotificationContext } from "@/contexts/NotificationContext";
import { NotificationProvider } from "@/contexts/NotificationProvider";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { emptyPlanner } from "../../shared/configuration";
import { notificationRuleSchema } from "../../shared/notifications";
import { state } from "./ha-fixtures";

const mocks = vi.hoisted(() => ({ app: {} as Record<string, unknown>, family: {} as Record<string, unknown>, shared: { state: { loaded: true, error: "" } } }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<object>(), useFamily: () => mocks.family }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => mocks.shared }));

const setNotifications = vi.fn((_settings: Partial<ReturnType<typeof emptyPlanner>["notifications"]>) => true);
const openEditorSection = async (name: string) => {
  const trigger = screen.getByRole("button", { name });
  if (trigger.getAttribute("aria-expanded") === "false") fireEvent.click(trigger);
  await waitFor(() => expect(screen.getByRole("region", { name }).querySelector("fieldset")).toBeVisible());
};
const watchEvents = vi.fn();
const watchCameraStream = vi.fn();
const home = (value = "off") => mapHome({ "binary_sensor.example": state("binary_sensor.example", value, { friendly_name: "Example detector" }), "camera.example": state("camera.example", "idle", { friendly_name: "Example camera" }) }, emptyRegistries, "home");
const cameraRule = () => notificationRuleSchema.parse({ id: "example-camera", title: "Example doorbell", kind: "camera", cameraEntity: "home|camera.example", trigger: { type: "state", entity: "home|binary_sensor.example", operator: "eq", value: "on" }, durationSeconds: 10 });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  mocks.app = { currentHome: home(), homeOnline: true, watchEvents, watchCameraStream, watchCalendarEvents: vi.fn() };
  mocks.family = { ...emptyPlanner(), today: "2026-10-24", setNotifications };
  mocks.shared.state = { loaded: true, error: "" };
  setNotifications.mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each(["Ongoing tasks", "Current alerts", "Camera popup"])("opens only content and focuses the title for a new %s", async kind => {
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: `Add ${kind}` }));
  const dialog = within(screen.getByRole("dialog", { name: "Add notification" }));
  await waitFor(() => expect(dialog.getByLabelText("Title")).toHaveFocus());
  expect(dialog.getAllByRole("button", { expanded: true })).toEqual([dialog.getByRole("button", { name: "Notification content" })]);
  expect(dialog.getByRole("button", { name: "When to show it" })).toHaveAttribute("aria-expanded", "false");
  fireEvent.change(dialog.getByLabelText("Title"), { target: { value: "Example task" } });
  expect(dialog.getByLabelText("Title")).toHaveFocus();
  expect(dialog.getByRole("button", { name: "Notification content" })).toHaveAttribute("aria-expanded", "true");
});

it("treats a whitespace-only title as unset when opening an existing draft", async () => {
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [{ ...cameraRule(), title: "   " }] };
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /^Edit\s*$/ }));
  await waitFor(() => expect(screen.getByLabelText("Title")).toHaveFocus());
  expect(within(screen.getByRole("dialog")).getAllByRole("button", { expanded: true })).toEqual([screen.getByRole("button", { name: "Notification content" })]);
});

it("announces incoming titles and same-count replacements without repeating sensor readings", () => {
  const notification = { id: "example", rule: { ...cameraRule(), kind: "current" as const }, startedAt: 0, popup: false };
  const value = { notifications: [notification], errors: [], dismiss: vi.fn(), camera: vi.fn(), retry: vi.fn() };
  const content = () => <MemoryRouter><NotificationContext.Provider value={value}><NotificationBell /></NotificationContext.Provider></MemoryRouter>;
  const view = render(content());
  expect(screen.getByRole("status")).toHaveTextContent("Active notifications: Example doorbell");
  value.notifications = [{ ...notification, rule: { ...notification.rule, title: "Example window" } }];
  view.rerender(content());
  expect(screen.getByRole("status")).toHaveTextContent("Active notifications: Example window");
  value.notifications = [];
  view.rerender(content());
  expect(screen.getByRole("status")).toHaveTextContent("No active notifications");
  const cameraValue = { ...value, notifications: [{ ...notification, rule: cameraRule(), popup: true }] };
  view.rerender(<MemoryRouter><NotificationContext.Provider value={cameraValue}><NotificationBell /></NotificationContext.Provider></MemoryRouter>);
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("configures ongoing tasks with a stable entity reference", async () => {
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Add Ongoing tasks" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Example wash" } });
  await openEditorSection("When to show it");
  chooseEntity("Source entity", "binary_sensor.example");
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications).toHaveBeenCalledWith({ rules: [expect.objectContaining({ title: "Example wash", kind: "ongoing", trigger: expect.objectContaining({ entity: "home|binary_sensor.example", value: "on" }) })] });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("restricts the camera picker to cameras and allows clearing the optional reading", async () => {
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Add Camera popup" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Example camera alert" } });
  await openEditorSection("When to show it");
  chooseEntity("Source entity", "binary_sensor.example");
  await openEditorSection("Entities and readings");
  fireEvent.click(screen.getByRole("button", { name: "Camera" }));
  const picker = within(screen.getByRole("dialog", { name: "Camera" }));
  expect(picker.queryByRole("button", { name: /Example detector/ })).not.toBeInTheDocument();
  fireEvent.click(picker.getByRole("button", { name: "Example camera · camera.example" }));
  chooseEntity("Add entity", "binary_sensor.example");
  fireEvent.click(screen.getByRole("button", { name: "Remove additional reading Example detector" }));
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications).toHaveBeenCalledWith({ rules: [expect.objectContaining({ kind: "camera", cameraEntity: "home|camera.example", detailEntities: [] })] });
});

it("adds multiple readings, reopens their selections and removes one without losing the others", async () => {
  mocks.app.currentHome = mapHome({
    "sensor.remaining": state("sensor.remaining", "15", { friendly_name: "Example remaining" }),
    "sensor.progress": state("sensor.progress", "40", { friendly_name: "Example progress" }),
    "input_text.private": state("input_text.private", "fictional", { friendly_name: "Example password", mode: "password" }),
  }, emptyRegistries, "home");
  const rule = cameraRule();
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [rule] };
  const view = render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Entities and readings");
  fireEvent.click(screen.getByRole("button", { name: "Add entity" }));
  expect(screen.queryByRole("button", { name: "Example password · input_text.private" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Example remaining · sensor.remaining" }));
  chooseEntity("Add entity", "sensor.progress");
  fireEvent.click(screen.getByRole("button", { name: "Add entity" }));
  expect(screen.getByRole("button", { name: "Example remaining · sensor.remaining" })).toBeDisabled();
  fireEvent.click(within(screen.getByRole("dialog", { name: "Add entity" })).getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications).toHaveBeenLastCalledWith({ rules: [{ ...rule, detailEntities: ["home|sensor.remaining", "home|sensor.progress"] }] });
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [{ ...rule, detailEntities: ["home|sensor.remaining", "home|sensor.progress"] }] };
  view.rerender(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Entities and readings");
  await waitFor(() => expect(screen.getByLabelText("Example remaining: display name")).toBeVisible());
  expect(screen.getByLabelText("Example progress: display name")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Remove additional reading Example remaining" }));
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications).toHaveBeenLastCalledWith({ rules: [{ ...rule, detailEntities: ["home|sensor.progress"] }] });
});

it.each([false, true])("renders and refreshes all readings, retaining available ones when another is missing (banner: %s)", compact => {
  const readingHome = (progress: string) => mapHome({
    "sensor.remaining": state("sensor.remaining", "15", { friendly_name: "Example remaining", unit_of_measurement: "min" }),
    "sensor.progress": state("sensor.progress", progress, { friendly_name: "Example progress", unit_of_measurement: "%" }),
  }, emptyRegistries, "home");
  mocks.app.currentHome = readingHome("40");
  const rule = { ...cameraRule(), detailEntities: ["home|sensor.remaining", "home|sensor.progress", "home|sensor.missing"] };
  const value = { notifications: [{ id: "example", rule, startedAt: 0, popup: false }], errors: [], dismiss: vi.fn(), camera: vi.fn(), retry: vi.fn() };
  const content = () => <MemoryRouter><NotificationContext.Provider value={value}><NotificationList compact={compact} presentation="banner" /></NotificationContext.Provider></MemoryRouter>;
  const view = render(content());
  expect(screen.getByText("Example remaining · 15 min")).toBeVisible();
  expect(screen.getByText("Example progress · 40 %")).toBeVisible();
  expect(screen.getByText("Some additional readings are unavailable")).toBeVisible();
  mocks.app.currentHome = readingHome("50");
  view.rerender(content());
  expect(screen.getByText("Example progress · 50 %")).toBeVisible();
  expect(screen.queryByText("Example progress · 40 %")).not.toBeInTheDocument();
});

it("saves page choices per rule and disables editing when storage is unavailable", async () => {
  const other = { ...cameraRule(), id: "other", title: "Example second alert", pages: "main" as const };
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [cameraRule(), other] };
  const content = () => <MemoryRouter><NotificationSettings /></MemoryRouter>;
  const view = render(content());
  expect(screen.queryByLabelText("Show on")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Notification content");
  expect(screen.getByLabelText("Show on")).toHaveValue("main");
  fireEvent.change(screen.getByLabelText("Show on"), { target: { value: "today" } });
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  const rules = [{ ...cameraRule(), pages: "today" }, other];
  expect(setNotifications).toHaveBeenLastCalledWith({ rules });
  mocks.family.notifications = { ...emptyPlanner().notifications, rules };
  view.rerender(content());
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Notification content");
  expect(screen.getByLabelText("Show on")).toHaveValue("today");
  mocks.shared.state.error = "Storage unavailable";
  view.rerender(content());
  expect(screen.getByLabelText("Show on")).toBeDisabled();
});

it("inherits the saved global page choice for existing and new rules", async () => {
  mocks.family.notifications = { ...emptyPlanner().notifications, pages: "today", rules: [cameraRule()] };
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Notification content");
  expect(screen.getByLabelText("Show on")).toHaveValue("today");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Add Ongoing tasks" }));
  expect(screen.getByLabelText("Show on")).toHaveValue("today");
});

it.each(["banner", "section", "activity"] as const)("filters %s by each rule's page choice while retaining the full notification list", presentation => {
  mocks.family.notifications = { ...emptyPlanner().notifications, pages: "today" };
  const rules = [cameraRule(), { ...cameraRule(), id: "today", title: "Example today", pages: "today" as const }, { ...cameraRule(), id: "main", title: "Example everywhere", pages: "main" as const }];
  const value = { notifications: rules.map(rule => ({ id: rule.id, rule, startedAt: 0, popup: false })), errors: [], dismiss: vi.fn(), camera: vi.fn(), retry: vi.fn() };
  const content = (path: string, compact = true) => <MemoryRouter key={path} initialEntries={[path]}><NotificationContext.Provider value={value}><NotificationList compact={compact} presentation={presentation} /></NotificationContext.Provider></MemoryRouter>;
  const view = render(content("/calendar"));
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByText("Example everywhere")).toBeVisible();
  expect(screen.getByRole("link", { name: "View all (3)" })).toBeVisible();
  view.rerender(content("/"));
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  view.rerender(content("/notifications", false));
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  value.notifications = value.notifications.filter(item => item.id !== "main");
  view.rerender(content("/calendar"));
  expect(screen.queryByRole("region", { name: "Active notifications" })).not.toBeInTheDocument();
});

it("shows every activity card on main pages instead of limiting each group to three", () => {
  const notifications = Array.from({ length: 5 }, (_, index) => ({ id: `example-${index}`, rule: { ...cameraRule(), id: `example-${index}`, kind: "ongoing" as const, title: `Example task ${index}` }, startedAt: 0, popup: false }));
  render(<MemoryRouter><NotificationContext.Provider value={{ notifications, errors: [], dismiss: vi.fn(), camera: vi.fn(), retry: vi.fn() }}><NotificationList compact presentation="activity" /></NotificationContext.Provider></MemoryRouter>);
  expect(screen.getAllByRole("listitem")).toHaveLength(5);
});

it("previews and saves compact activity cards per rule without changing other cards", async () => {
  const other = { ...cameraRule(), id: "other", title: "Example second alert" };
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation: "activity", rules: [cameraRule(), other] };
  const content = () => <MemoryRouter><NotificationSettings /></MemoryRouter>;
  const view = render(content());
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  const preview = within(screen.getByRole("region", { name: "Notification preview" }));
  expect(preview.getByRole("listitem")).not.toHaveClass("notification-activity-compact");
  await openEditorSection("Display as");
  fireEvent.click(screen.getByRole("button", { name: "Compact activity card" }));
  expect(preview.getByRole("listitem")).toHaveClass("notification-activity-compact");
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  const rules = [{ ...cameraRule(), presentation: "activity-compact" }, other];
  expect(setNotifications).toHaveBeenLastCalledWith({ rules });
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation: "activity", rules };
  view.rerender(content());
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Display as");
  expect(screen.getByRole("button", { name: "Compact activity card" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Activity cards" }));
  expect(within(screen.getByRole("region", { name: "Notification preview" })).getByRole("listitem")).not.toHaveClass("notification-activity-compact");
});

it.each(["banner", "section", "activity", "activity-compact"] as const)("keeps readings and actions in each rule's chosen style (%s)", presentation => {
  const rule = { ...cameraRule(), presentation, message: "Example message", detailEntities: ["home|binary_sensor.example"] };
  const camera = vi.fn(), dismiss = vi.fn();
  render(<MemoryRouter><NotificationContext.Provider value={{ notifications: [{ id: rule.id, rule, popup: false, startedAt: 0 }], errors: [], camera, dismiss, retry: vi.fn() }}><NotificationList compact /></NotificationContext.Provider></MemoryRouter>);
  expect(screen.getByRole("listitem").classList.contains("notification-activity-compact")).toBe(presentation === "activity-compact");
  expect(screen.getByRole("listitem")).toHaveTextContent("Off");
  if (presentation !== "banner") expect(screen.getByText("Example message")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Show camera" }));
  expect(camera).toHaveBeenCalledWith(rule.id, true);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss Example doorbell" }));
  expect(dismiss).toHaveBeenCalledWith(rule.id);
});

it("mixes per-rule styles in the same notification group and shares a grid between normal and compact cards", () => {
  const notifications = (["banner", "section", "activity", "activity-compact"] as const).map(presentation => ({ id: presentation, rule: { ...cameraRule(), id: presentation, title: `Example ${presentation}`, kind: "ongoing" as const, presentation, message: "Example details" }, popup: false, startedAt: 0 }));
  const content = (compact: boolean) => <MemoryRouter><NotificationContext.Provider value={{ notifications, errors: [], camera: vi.fn(), dismiss: vi.fn(), retry: vi.fn() }}><NotificationList compact={compact} presentation="section" /></NotificationContext.Provider></MemoryRouter>;
  const view = render(content(true));
  const item = (style: string) => screen.getByText(`Example ${style}`).closest("li");
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(item("banner").parentElement).toHaveClass("notification-banner-list");
  expect(item("section").parentElement).toHaveClass("notification-section-list");
  expect(item("activity").parentElement).toHaveClass("notification-activity-grid");
  expect(item("activity-compact").parentElement).toBe(item("activity").parentElement);
  expect(item("activity-compact")).toHaveClass("notification-activity-compact");
  expect(within(item("banner")).queryByText("Example details")).not.toBeInTheDocument();
  view.rerender(content(false));
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(within(item("banner")).getByText("Example details")).toBeVisible();
});

it("summarizes banners while keeping camera, dismiss, retry and the full list available", () => {
  const rule = { ...cameraRule(), message: "Example message" };
  const value = { notifications: Array.from({ length: 4 }, (_, i) => ({ id: `example-${i}`, rule: { ...rule, title: `Example alert ${i}` }, startedAt: 0, popup: false })), errors: [], dismiss: vi.fn(), camera: vi.fn(), retry: vi.fn() };
  const content = (compact = true) => <MemoryRouter><NotificationContext.Provider value={value}><NotificationList compact={compact} presentation="banner" /></NotificationContext.Provider></MemoryRouter>;
  const view = render(content());
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(screen.queryByText("Example message")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View all (4)" })).toHaveAttribute("href", "/notifications");
  fireEvent.click(screen.getAllByRole("button", { name: "Show camera" })[0]);
  expect(value.camera).toHaveBeenCalledWith("example-0", true);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss Example alert 0" }));
  expect(value.dismiss).toHaveBeenCalledWith("example-0");
  view.rerender(content(false));
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(screen.getAllByText("Example message")).toHaveLength(4);
  value.notifications = [];
  view.rerender(content());
  expect(screen.queryByRole("region", { name: "Active notifications" })).not.toBeInTheDocument();
  value.errors = ["Example source unavailable"];
  view.rerender(content());
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(value.retry).toHaveBeenCalledOnce();
});

it("preserves drafts on invalid filters or failed saves and blocks settings edits before storage loads", async () => {
  const view = render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Add Current alerts" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Example event" } });
  await openEditorSection("When to show it");
  fireEvent.change(screen.getByLabelText("Trigger"), { target: { value: "ha-event" } });
  fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "example_event" } });
  fireEvent.change(screen.getByLabelText("Event data filters (JSON)", { exact: false }), { target: { value: "[1]" } });
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(screen.getByRole("alert")).toBeVisible();
  expect(setNotifications).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Event data filters (JSON)", { exact: false }), { target: { value: "{}" } });
  setNotifications.mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(screen.getByLabelText("Title")).toHaveValue("Example event");
  expect(screen.getByRole("alert")).toHaveTextContent("draft is still here");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  mocks.shared.state.loaded = false;
  view.rerender(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Add Current alerts" })).toBeDisabled();
});

it("opens one camera on a fresh trigger, stops its stream on close, and expires the alert", () => {
  vi.useFakeTimers();
  mocks.family.notifications = { enabled: true, rules: [cameraRule()] };
  const content = () => <MemoryRouter><NotificationProvider><main id="main-content" tabIndex={-1}><input aria-label="Interrupted field" /></main><NotificationList /><NotificationCamera /></NotificationProvider></MemoryRouter>;
  const view = render(content());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  screen.getByLabelText("Interrupted field").focus();
  mocks.app.currentHome = home("on");
  view.rerender(content());
  expect(screen.getByRole("dialog")).toHaveTextContent("Example doorbell");
  expect(watchCameraStream).toHaveBeenCalledOnce();
  const signal = watchCameraStream.mock.calls[0][2] as AbortSignal;
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close camera" }));
  expect(signal.aborted).toBe(true);
  act(() => { vi.advanceTimersByTime(0); });
  expect(screen.getByLabelText("Interrupted field")).toHaveFocus();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show camera" }));
  expect(screen.getByRole("dialog")).toBeVisible();
  act(() => { vi.advanceTimersByTime(11000); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("Example doorbell")).not.toBeInTheDocument();
});

it("cleans up event subscriptions and alerts when notifications are switched off", () => {
  const rule = notificationRuleSchema.parse({ ...cameraRule(), trigger: { type: "ha-event", eventType: "example_event", filters: { action: "pressed" } } });
  mocks.family.notifications = { enabled: true, rules: [rule] };
  const content = () => <MemoryRouter><NotificationProvider><NotificationList /></NotificationProvider></MemoryRouter>;
  const view = render(content());
  const [type, signal, receive] = watchEvents.mock.calls[0];
  expect(type).toBe("example_event");
  act(() => receive({ event_type: type, data: { action: "pressed" } }));
  expect(screen.getByText("Example doorbell")).toBeVisible();
  mocks.family.notifications = { enabled: false, rules: [rule] };
  view.rerender(content());
  expect(signal.aborted).toBe(true);
  act(() => receive({ event_type: type, data: { action: "pressed" } }));
  expect(screen.queryByText("Example doorbell")).not.toBeInTheDocument();
});

it("shows the active-state message in the camera header, then counts down to the original expiry", () => {
  vi.useFakeTimers();
  Object.assign(mocks.shared.state, { config: { settings: { language: "nb" } } });
  mocks.family.notifications = { enabled: true, rules: [cameraRule()] };
  const content = () => <NotificationProvider><NotificationCamera /></NotificationProvider>;
  const view = render(content());
  mocks.app.currentHome = home("on");
  view.rerender(content());
  const heading = screen.getByRole("heading", { name: "Example doorbell" });
  expect(heading.parentElement).toHaveTextContent("Lukkes automatisk når varselet utløper.");
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(3000); });
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  mocks.app.currentHome = home("off");
  view.rerender(content());
  expect(within(heading.parentElement).getByRole("timer")).toHaveTextContent("Lukkes om 0:07");
  act(() => { vi.advanceTimersByTime(2000); });
  expect(screen.getByRole("timer")).toHaveTextContent("Lukkes om 0:05");
  mocks.app.currentHome = home("on");
  view.rerender(content());
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  expect(heading.parentElement).toHaveTextContent("Lukkes automatisk når varselet utløper.");
  expect(watchCameraStream).toHaveBeenCalledOnce();
  const signal = watchCameraStream.mock.calls[0][2] as AbortSignal;
  act(() => { vi.advanceTimersByTime(5000); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(signal.aborted).toBe(true);
});

it("counts down event camera alerts every second and keeps the original deadline after reopening", () => {
  vi.useFakeTimers();
  const rule = notificationRuleSchema.parse({ ...cameraRule(), durationSeconds: 65, trigger: { type: "ha-event", eventType: "example_event", filters: {} } });
  mocks.family.notifications = { enabled: true, rules: [rule] };
  render(<MemoryRouter><NotificationProvider><NotificationList /><NotificationCamera /></NotificationProvider></MemoryRouter>);
  const [type, , receive] = watchEvents.mock.calls[0];
  act(() => receive({ event_type: type, data: {} }));
  expect(screen.getByRole("timer")).toHaveTextContent("Closes in 1:05");
  expect(screen.getByRole("timer")).toHaveAttribute("aria-live", "off");
  act(() => { vi.advanceTimersByTime(6000); });
  expect(screen.getByRole("timer")).toHaveTextContent("Closes in 0:59");
  expect(watchCameraStream).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Close camera" }));
  act(() => { vi.advanceTimersByTime(3000); });
  fireEvent.click(screen.getByRole("button", { name: "Show camera" }));
  expect(screen.getByRole("timer")).toHaveTextContent("Closes in 0:56");
  act(() => { vi.advanceTimersByTime(56000); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("configures progress from a numeric reading, a total entity and a chosen activity icon", async () => {
  mocks.app.currentHome = mapHome({
    "binary_sensor.example": state("binary_sensor.example", "on"),
    "sensor.remaining": state("sensor.remaining", "30"),
    "sensor.total": state("sensor.total", "90"),
  }, emptyRegistries, "home");
  const rule = notificationRuleSchema.parse({ ...cameraRule(), kind: "ongoing", detailEntities: ["home|sensor.remaining"] });
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation: "activity", rules: [rule] };
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Progress");
  fireEvent.click(screen.getByRole("switch", { name: "Show progress bar" }));
  expect(screen.getByRole("button", { name: "Current value: entity" })).toHaveTextContent("Remaining");
  fireEvent.change(screen.getByLabelText("End / total value"), { target: { value: "0" } });
  fireEvent.change(screen.getByLabelText("Start value: value source"), { target: { value: "entity" } });
  chooseEntity("Start value: entity", "sensor.total");
  await openEditorSection("Icon and animation");
  fireEvent.click(screen.getByRole("button", { name: "Laundry" }));
  fireEvent.click(screen.getByRole("switch", { name: "Animate activity icon" }));
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  const saved = setNotifications.mock.lastCall[0].rules[0];
  expect(saved).toMatchObject({ icon: "washing", animateIcon: false, progress: {
    current: { type: "entity", entity: "home|sensor.remaining", attribute: "" },
    start: { type: "entity", entity: "home|sensor.total", attribute: "" }, end: { type: "value", value: 0 },
  } });
});

it("suggests the numeric trigger and threshold, rejects an empty range, and lets progress be removed", async () => {
  mocks.app.currentHome = mapHome({ "sensor.example": state("sensor.example", "30") }, emptyRegistries, "home");
  const rule = notificationRuleSchema.parse({ ...cameraRule(), kind: "ongoing", trigger: { type: "state", entity: "home|sensor.example", operator: "lt", value: "80" } });
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [rule] };
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Progress");
  fireEvent.click(screen.getByRole("switch", { name: "Show progress bar" }));
  expect(screen.getByLabelText("End / total value")).toHaveValue(80);
  fireEvent.change(screen.getByLabelText("Start value"), { target: { value: "80" } });
  fireEvent.click(screen.getByRole("button", { name: "Progress" }));
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Check progress");
  expect(screen.getByRole("button", { name: "Progress" })).toHaveAttribute("aria-expanded", "true");
  expect(setNotifications).not.toHaveBeenCalled();
  await openEditorSection("Progress");
  fireEvent.click(screen.getByRole("switch", { name: "Show progress bar" }));
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications.mock.lastCall[0].rules[0].progress).toBeUndefined();
});

it.each(["section", "banner", "activity"] as const)("updates accessible progress from live readings in %s", presentation => {
  const rule = notificationRuleSchema.parse({ ...cameraRule(), kind: "ongoing", progress: { current: { type: "entity", entity: "home|sensor.example" }, start: { type: "value", value: 0 }, end: { type: "value", value: 100 } } });
  const value = { notifications: [{ id: "example", rule, startedAt: 0, popup: false }], errors: [], dismiss: vi.fn(), camera: vi.fn(), retry: vi.fn() };
  const content = () => <MemoryRouter><NotificationContext.Provider value={value}><NotificationList compact presentation={presentation} /></NotificationContext.Provider></MemoryRouter>;
  mocks.app.currentHome = mapHome({ "sensor.example": state("sensor.example", "40") }, emptyRegistries, "home");
  const view = render(content());
  expect(screen.getByRole("progressbar", { name: "Progress for Example doorbell" })).toHaveAttribute("aria-valuenow", "40");
  expect(view.container.querySelector(".notification-progress")).toHaveTextContent(/^40%$/);
  mocks.app.currentHome = mapHome({ "sensor.example": state("sensor.example", "75") }, emptyRegistries, "home");
  view.rerender(content());
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
  value.notifications[0].rule.progress.text = "none";
  view.rerender(content());
  expect(view.container.querySelector(".notification-progress")).toHaveTextContent(/^$/);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "75% complete, current value 75");
  mocks.app.currentHome = mapHome({ "sensor.example": state("sensor.example", "unavailable") }, emptyRegistries, "home");
  view.rerender(content());
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.getByText("Progress unavailable. Check the numeric readings and range.")).toBeVisible();
});

it("previews and saves progress without text, preserving the choice when sources change and the editor reopens", async () => {
  const rule = notificationRuleSchema.parse({ ...cameraRule(), kind: "ongoing", progress: { current: { type: "entity", entity: "home|sensor.example" }, start: { type: "value", value: 100 }, end: { type: "value", value: 0 } } });
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation: "activity", rules: [rule] };
  const view = render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Progress");
  expect(screen.getByLabelText("Progress text")).toHaveValue("percentage");
  fireEvent.change(screen.getByLabelText("Progress text"), { target: { value: "none" } });
  fireEvent.change(screen.getByLabelText("Start value"), { target: { value: "120" } });
  expect(screen.getByRole("progressbar").parentElement).toHaveTextContent(/^$/);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  const saved = setNotifications.mock.lastCall[0].rules[0];
  expect(saved.progress).toMatchObject({ text: "none", start: { type: "value", value: 120 } });
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation: "activity", rules: [saved] };
  view.rerender(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Progress");
  expect(screen.getByLabelText("Progress text")).toHaveValue("none");
  fireEvent.change(screen.getByLabelText("Progress text"), { target: { value: "percentage" } });
  expect(screen.getByRole("progressbar").parentElement).toHaveTextContent(/^40%$/);
});

it("previews simulated progress without saving settings or mutating Home Assistant readings", () => {
  vi.useFakeTimers();
  const currentHome = home();
  const original = JSON.stringify(currentHome);
  mocks.app.currentHome = currentHome;
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  expect(screen.queryByRole("region", { name: "Notification preview" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Preview notification" }));
  const preview = within(screen.getByRole("dialog", { name: "Preview notification" }));
  expect(preview.getByText("Sample data only. Nothing is sent to Home Assistant.")).toBeVisible();
  fireEvent.change(preview.getByRole("slider", { name: "Demo progress" }), { target: { value: "70" } });
  expect(preview.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
  fireEvent.click(preview.getByRole("button", { name: "Play demo" }));
  act(() => vi.advanceTimersByTime(1000));
  expect(preview.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
  fireEvent.click(preview.getByRole("button", { name: "Pause demo" }));
  expect(JSON.stringify(currentHome)).toBe(original);
  expect(setNotifications).not.toHaveBeenCalled();
  fireEvent.click(preview.getByRole("button", { name: "Close" }));
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("button", { name: "Preview notification" })).toHaveFocus();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Notification preview" })).not.toBeInTheDocument();
});

it("previews every saved rule and saves display choices independently without resetting demo progress", async () => {
  const progress = { current: { type: "entity" as const, entity: "home|sensor.remaining" }, start: { type: "value" as const, value: 100 }, end: { type: "value" as const, value: 0 } };
  const rules = [
    cameraRule(),
    { ...cameraRule(), id: "current", kind: "current" as const, title: "Example current", enabled: false },
    ...["first", "second"].map(id => notificationRuleSchema.parse({ ...cameraRule(), id, title: `Example ${id}`, kind: "ongoing", progress })),
  ];
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation: "activity", rules };
  const content = () => <MemoryRouter><NotificationSettings /></MemoryRouter>;
  const view = render(content());
  fireEvent.click(screen.getByRole("button", { name: "Preview notification" }));
  const dialog = within(screen.getByRole("dialog", { name: "Preview notification" }));
  expect(dialog.queryByRole("combobox")).not.toBeInTheDocument();
  expect(dialog.getAllByRole("heading", { name: /^(Ongoing tasks|Current alerts|Camera popup)$/ }).map(heading => heading.textContent)).toEqual(["Ongoing tasks", "Current alerts", "Camera popup"]);
  for (const rule of rules) expect(dialog.getByRole("region", { name: `Preview ${rule.title}` })).toBeVisible();
  const first = within(dialog.getByRole("region", { name: "Preview Example first" }));
  const second = within(dialog.getByRole("region", { name: "Preview Example second" }));
  fireEvent.change(first.getByRole("slider"), { target: { value: "70" } });
  expect(second.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  fireEvent.click(first.getByRole("button", { name: "Display as" }));
  await waitFor(() => expect(first.getByRole("button", { name: "Compact activity card" })).toBeVisible());
  fireEvent.click(first.getByRole("button", { name: "Compact activity card" }));
  const updated = rules.map(rule => rule.id === "first" ? { ...rule, presentation: "activity-compact" } : rule);
  expect(setNotifications).toHaveBeenLastCalledWith({ rules: updated });
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation: "activity", rules: updated };
  view.rerender(content());
  expect(first.getByRole("button", { name: "Compact activity card" })).toHaveAttribute("aria-pressed", "true");
  expect(first.getByRole("listitem")).toHaveClass("notification-activity-compact");
  expect(first.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
  expect(second.getByRole("listitem")).not.toHaveClass("notification-activity-compact");
  fireEvent.click(second.getByRole("button", { name: "Display as" }));
  await waitFor(() => expect(second.getByRole("button", { name: "Banner" })).toBeVisible());
  fireEvent.click(second.getByRole("button", { name: "Banner" }));
  expect(setNotifications).toHaveBeenLastCalledWith({ rules: updated.map(rule => rule.id === "second" ? { ...rule, presentation: "banner" } : rule) });
  expect(dialog.getByRole("button", { name: "Show camera" })).toBeDisabled();
  expect(dialog.getByRole("button", { name: "Dismiss Example current" })).toBeDisabled();
});

it("keeps the saved preview style on failure and disables style changes when storage is unavailable", async () => {
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [cameraRule()] };
  const content = () => <MemoryRouter><NotificationSettings /></MemoryRouter>;
  const view = render(content());
  fireEvent.click(screen.getByRole("button", { name: "Preview notification" }));
  fireEvent.click(screen.getByRole("button", { name: "Display as" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Activity cards" })).toBeVisible());
  setNotifications.mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: "Activity cards" }));
  expect(screen.getByRole("alert")).toHaveTextContent("The display choice could not be saved.");
  expect(screen.getByRole("button", { name: "Section" })).toHaveAttribute("aria-pressed", "true");
  setNotifications.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Activity cards" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  mocks.shared.state.error = "Storage unavailable";
  view.rerender(content());
  for (const button of within(screen.getByRole("group", { name: "Display as" })).getAllByRole("button")) expect(button).toBeDisabled();
});

it.each(["section", "activity"] as const)("groups ongoing, current and camera notifications separately in %s and settings", presentation => {
  const rules = [cameraRule(), { ...cameraRule(), id: "current", kind: "current" as const, title: "Example current" }, { ...cameraRule(), id: "ongoing", kind: "ongoing" as const, title: "Example ongoing" }];
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation, rules };
  const value = { notifications: rules.map(rule => ({ id: rule.id, rule, startedAt: 0, popup: false })), errors: [], dismiss: vi.fn(), camera: vi.fn(), retry: vi.fn() };
  const view = render(<MemoryRouter><NotificationContext.Provider value={value}><NotificationList presentation={presentation} /></NotificationContext.Provider></MemoryRouter>);
  expect(within(screen.getByRole("region", { name: "Current alerts" })).queryByText("Example doorbell")).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Camera popup" })).getByText("Example doorbell")).toBeVisible();
  expect(screen.getAllByRole("heading").map(heading => heading.textContent)).toEqual(["Ongoing tasks", "Current alerts", "Camera popup"]);
  view.unmount();
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  expect(within(screen.getByRole("region", { name: "Camera popup" })).getByRole("button", { name: "Edit Example doorbell" })).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Current alerts" })).getByRole("button", { name: "Edit Example current" })).toBeVisible();
});

it("simulates an attribute and a total state on the same entity without corrupting either source", () => {
  mocks.app.currentHome = mapHome({ "sensor.example": state("sensor.example", "90", { remaining: 30 }) }, emptyRegistries, "home");
  const rule = notificationRuleSchema.parse({ ...cameraRule(), kind: "ongoing", progress: {
    current: { type: "entity", entity: "home|sensor.example", attribute: "remaining" },
    start: { type: "entity", entity: "home|sensor.example" }, end: { type: "value", value: 0 },
  } });
  render(<MemoryRouter><NotificationPreview rule={rule} presentation="activity" /></MemoryRouter>);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  fireEvent.click(screen.getByRole("switch", { name: "Use sample data" }));
  expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeCloseTo(66.67, 2);
});


it("adds a notification from each empty group and offers four style examples inside each editor", async () => {
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  expect(screen.queryByRole("group", { name: "Display as" })).not.toBeInTheDocument();
  for (const kind of ["Ongoing tasks", "Current alerts", "Camera popup"]) {
    const group = within(screen.getByRole("region", { name: kind }));
    expect(group.getByText("No notifications in this group yet.")).toBeVisible();
    fireEvent.click(group.getByRole("button", { name: `Add ${kind}` }));
    expect(screen.getByRole("dialog", { name: "Add notification" })).toHaveAccessibleDescription(kind);
    expect(screen.getByRole("region", { name: "Notification preview" })).toBeVisible();
    await openEditorSection("Display as");
    const styles = within(screen.getByRole("group", { name: "Display as" }));
    expect(styles.getAllByRole("button")).toHaveLength(4);
    expect(styles.getByRole("button", { name: "Section" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(styles.getByRole("button", { name: "Activity cards" }));
    expect(styles.getByRole("button", { name: "Activity cards" })).toHaveAttribute("aria-pressed", "true");
    expect(setNotifications).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  }
});

it("saves and reopens names and placement for sources, readings and progress attributes", async () => {
  mocks.app.currentHome = mapHome({
    "sensor.example": state("sensor.example", "90", { friendly_name: "Example cycle", remaining: 30 }),
    "sensor.power": state("sensor.power", "500", { friendly_name: "Example power", unit_of_measurement: "W" }),
  }, emptyRegistries, "home");
  const rule = notificationRuleSchema.parse({ ...cameraRule(), kind: "ongoing",
    trigger: { type: "state", entity: "home|sensor.example", operator: "gt", value: "0" },
    detailEntities: ["home|sensor.power"],
    progress: { current: { type: "entity", entity: "home|sensor.example", attribute: "remaining" }, start: { type: "entity", entity: "home|sensor.example" }, end: { type: "value", value: 0 } },
    entityDisplay: [{ entity: "home|sensor.old", name: "Old selection" }],
  });
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation: "activity", rules: [rule] };
  const view = render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Entities and readings");
  const entries = [
    ["Example cycle", "Total duration", "footer"],
    ["Example power", "Power now", "right"],
    ["Example cycle · remaining", "Time left", "left"],
  ];
  for (const [name, alias, placement] of entries) {
    fireEvent.change(screen.getByLabelText(`${name}: display name`), { target: { value: alias } });
    fireEvent.change(screen.getByLabelText(`${name}: placement`), { target: { value: placement } });
  }
  const preview = within(screen.getByRole("region", { name: "Notification preview" }));
  expect(preview.getByText("Time left").closest("[data-placement]")).toHaveAttribute("data-placement", "left");
  expect(preview.getByText("Power now").closest("[data-placement]")).toHaveAttribute("data-placement", "right");
  expect(preview.getByText(/Total duration ·/).closest("[data-placement]")).toHaveAttribute("data-placement", "footer");
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  const saved = setNotifications.mock.lastCall[0].rules[0];
  expect(saved.entityDisplay).toHaveLength(3);
  expect(saved.trigger).toEqual(rule.trigger);
  expect(saved.progress).toEqual(rule.progress);
  mocks.family.notifications = { ...mocks.family.notifications as object, rules: [saved] };
  view.rerender(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Entities and readings");
  for (const [name, alias, placement] of entries) {
    expect(screen.getByLabelText(`${name}: display name`)).toHaveValue(alias);
    expect(screen.getByLabelText(`${name}: placement`)).toHaveValue(placement);
  }
});

it("lets camera and event entities have local names and placements", async () => {
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [cameraRule()] };
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Entities and readings");
  fireEvent.change(screen.getByLabelText("Example detector: display name"), { target: { value: "Detection" } });
  fireEvent.change(screen.getByLabelText("Example camera: display name"), { target: { value: "Camera status" } });
  fireEvent.change(screen.getByLabelText("Example camera: placement"), { target: { value: "footer" } });
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications.mock.lastCall[0].rules[0].entityDisplay).toEqual([
    { entity: "home|binary_sensor.example", attribute: "", name: "Detection", placement: "auto" },
    { entity: "home|camera.example", attribute: "", name: "Camera status", placement: "footer" },
  ]);
});

it.each(["banner", "section", "activity"] as const)("respects names and placements while hidden readings still drive progress in %s", presentation => {
  const entities = mapHome({ "sensor.example": state("sensor.example", "40", { remaining: 60, friendly_name: "Original name" }) }, emptyRegistries, "home").entities;
  const rule = notificationRuleSchema.parse({ ...cameraRule(), kind: "ongoing", trigger: { type: "state", entity: "home|sensor.example", operator: "gt", value: "0" },
    progress: { current: { type: "entity", entity: "home|sensor.example", attribute: "remaining" }, start: { type: "value", value: 0 }, end: { type: "value", value: 100 } },
    entityDisplay: [{ entity: "home|sensor.example", name: "Secret label", placement: "hidden" }, { entity: "home|sensor.example", attribute: "remaining", name: "Remaining", placement: "right" }],
  });
  render(<MemoryRouter><NotificationRow item={{ id: rule.id, rule, popup: false, startedAt: 0 }} entities={entities} activity={presentation === "activity"} condensed={presentation === "banner"} /></MemoryRouter>);
  expect(screen.queryByText(/Secret label|Original name/)).not.toBeInTheDocument();
  expect(screen.getByText(presentation === "activity" ? "Remaining" : "Remaining · 60").closest("[data-placement]")).toHaveAttribute("data-placement", "right");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
});


it("collapses editor sections independently, keeps draft values and reveals invalid hidden fields", async () => {
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [cameraRule()] };
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  const content = screen.getByRole("button", { name: "Notification content" });
  const trigger = screen.getByRole("button", { name: "When to show it" });
  const readings = screen.getByRole("button", { name: "Entities and readings" });
  expect(within(screen.getByRole("dialog")).queryAllByRole("button", { expanded: true })).toHaveLength(0);
  expect(content).toHaveFocus();
  expect(content).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(readings).toHaveAttribute("aria-expanded", "false");
  await openEditorSection("Notification content");
  await openEditorSection("When to show it");
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Draft title" } });
  fireEvent.click(content);
  await waitFor(() => expect(screen.getByLabelText("Title")).not.toBeVisible());
  expect(screen.getByLabelText("Title")).toBeDisabled();
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("region", { name: "Notification preview" })).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Notification preview" })).getByText("Draft title")).toBeVisible();
  content.focus();
  fireEvent.keyDown(content, { key: "ArrowDown" });
  expect(screen.getByRole("button", { name: "Display as" })).toHaveFocus();
  fireEvent.click(content);
  expect(screen.getByLabelText("Title")).toHaveValue("Draft title");
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "" } });
  fireEvent.click(content);
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications).not.toHaveBeenCalled();
  expect(content).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByLabelText("Title")).toHaveValue("");
  expect(screen.getByRole("alert")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  expect(within(screen.getByRole("dialog")).queryAllByRole("button", { expanded: true })).toHaveLength(0);
  expect(screen.getByLabelText("Title")).not.toHaveFocus();
});


it("adds, names and positions a reading in one section, and keeps its draft through collapse", async () => {
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation: "activity", rules: [cameraRule()] };
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Entities and readings");
  expect(screen.queryByRole("button", { name: "Entity names and placement" })).not.toBeInTheDocument();
  chooseEntity("Add entity", "binary_sensor.example");
  fireEvent.change(screen.getByLabelText("Example detector: display name"), { target: { value: "Status" } });
  fireEvent.change(screen.getByLabelText("Example detector: placement"), { target: { value: "right" } });
  fireEvent.click(screen.getByRole("button", { name: "Entities and readings" }));
  expect(screen.getByLabelText("Example detector: display name")).toBeDisabled();
  expect(within(screen.getByRole("region", { name: "Notification preview" })).getByText("Status").closest("[data-placement]")).toHaveAttribute("data-placement", "right");
  await openEditorSection("Entities and readings");
  await waitFor(() => expect(screen.getByLabelText("Example detector: display name")).toBeVisible());
  expect(screen.getByLabelText("Example detector: display name")).toHaveValue("Status");
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications.mock.lastCall[0].rules[0]).toMatchObject({ detailEntities: ["home|binary_sensor.example"], entityDisplay: [{ entity: "home|binary_sensor.example", attribute: "", name: "Status", placement: "right" }] });
});

it("explains required entities and opens their assignment, while removing only the extra reading", async () => {
  const configured = notificationRuleSchema.parse({ ...cameraRule(), kind: "ongoing", detailEntities: ["home|binary_sensor.example"], progress: {
    current: { type: "entity", entity: "home|binary_sensor.example" }, start: { type: "entity", entity: "home|sensor.total" }, end: { type: "value", value: 0 },
  } });
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [configured] };
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Entities and readings");
  const total = within(screen.getByRole("group", { name: "sensor.total" }));
  expect(total.getByText("In use")).toBeVisible();
  expect(total.getByText("Start value")).toBeVisible();
  expect(total.getByText("Change its assignment before removing this entity.")).toBeVisible();
  expect(total.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  const source = within(screen.getByRole("group", { name: "Example detector" }));
  expect(source.getByText("Removing the extra reading keeps its other uses.")).toBeVisible();
  fireEvent.click(source.getByRole("button", { name: "Remove additional reading Example detector" }));
  expect(source.getByText("In use")).toBeVisible();
  expect(source.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  fireEvent.click(source.getByRole("button", { name: "Edit trigger" }));
  expect(screen.getByRole("button", { name: "When to show it" })).toHaveFocus();
  fireEvent.click(total.getByRole("button", { name: "Edit progress" }));
  expect(screen.getByRole("button", { name: "Progress" })).toHaveFocus();
  await openEditorSection("Progress");
  fireEvent.change(screen.getByLabelText("Start value: value source"), { target: { value: "value" } });
  fireEvent.change(screen.getByLabelText("Start value"), { target: { value: "100" } });
  expect(screen.queryByRole("group", { name: "sensor.total" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications.mock.lastCall[0].rules[0]).toMatchObject({ detailEntities: [], progress: { current: configured.progress.current, start: { type: "value" } } });
});

it("persists the activity name toggle through other entity edits and updates the preview", async () => {
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation: "activity", rules: [cameraRule()] };
  const view = render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Entities and readings");
  fireEvent.click(screen.getByRole("switch", { name: "Example detector: show name in activity card" }));
  fireEvent.change(screen.getByLabelText("Example detector: display name"), { target: { value: "Detection" } });
  fireEvent.change(screen.getByLabelText("Example detector: placement"), { target: { value: "left" } });
  expect(within(screen.getByRole("region", { name: "Notification preview" })).getByText("Detection")).toHaveClass("sr-only");
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  const saved = setNotifications.mock.lastCall[0].rules[0];
  expect(saved.entityDisplay[0]).toMatchObject({ name: "Detection", placement: "left", hideName: true });
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation: "activity", rules: [saved] };
  view.rerender(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  await openEditorSection("Entities and readings");
  const toggle = screen.getByRole("switch", { name: "Example detector: show name in activity card" });
  expect(toggle).toHaveAttribute("aria-checked", "false");
  fireEvent.click(toggle);
  expect(within(screen.getByRole("region", { name: "Notification preview" })).getByText("Detection")).not.toHaveClass("sr-only");
});

it.each(["subtitle", "left", "right", "footer"] as const)("hides only the activity label at %s, preserving the value and other styles", placement => {
  const rule = notificationRuleSchema.parse({ ...cameraRule(), entityDisplay: [{ entity: "home|binary_sensor.example", name: "Detection", placement, hideName: true }] });
  const item = { id: rule.id, rule, popup: false, startedAt: 0 };
  const view = render(<MemoryRouter><NotificationRow item={item} activity /></MemoryRouter>);
  const reading = view.container.querySelector(`[data-placement="${placement}"]`);
  expect(reading).toHaveTextContent("Off");
  expect(within(reading as HTMLElement).getByText(/Detection/)).toHaveClass("sr-only");
  for (const condensed of [true, false]) {
    view.rerender(<MemoryRouter><NotificationRow item={item} condensed={condensed} /></MemoryRouter>);
    expect(screen.getByText("Detection · Off")).not.toHaveClass("sr-only");
  }
});
