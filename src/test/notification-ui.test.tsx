import { chooseEntity } from "./entity-picker-helpers";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

it("configures ongoing tasks with a stable entity reference", () => {
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Add Ongoing tasks" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Example wash" } });
  chooseEntity("Source entity", "binary_sensor.example");
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications).toHaveBeenCalledWith({ rules: [expect.objectContaining({ title: "Example wash", kind: "ongoing", trigger: expect.objectContaining({ entity: "home|binary_sensor.example", value: "on" }) })] });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("restricts the camera picker to cameras and allows clearing the optional reading", () => {
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Add Camera popup" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Example camera alert" } });
  chooseEntity("Source entity", "binary_sensor.example");
  fireEvent.click(screen.getByRole("button", { name: "Camera" }));
  const picker = within(screen.getByRole("dialog", { name: "Camera" }));
  expect(picker.queryByRole("button", { name: /Example detector/ })).not.toBeInTheDocument();
  fireEvent.click(picker.getByRole("button", { name: "Example camera · camera.example" }));
  fireEvent.click(screen.getByRole("button", { name: "Additional readings (optional)" }));
  const reading = screen.getByRole("checkbox", { name: "Example detector" });
  fireEvent.click(reading);
  expect(reading).toBeChecked();
  fireEvent.click(reading);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications).toHaveBeenCalledWith({ rules: [expect.objectContaining({ kind: "camera", cameraEntity: "home|camera.example", detailEntities: [] })] });
});

it("adds multiple readings, reopens their selections and removes one without losing the others", () => {
  mocks.app.currentHome = mapHome({
    "sensor.remaining": state("sensor.remaining", "15", { friendly_name: "Example remaining" }),
    "sensor.progress": state("sensor.progress", "40", { friendly_name: "Example progress" }),
    "input_text.private": state("input_text.private", "fictional", { friendly_name: "Example password", mode: "password" }),
  }, emptyRegistries, "home");
  const rule = cameraRule();
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [rule] };
  const view = render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  fireEvent.click(screen.getByRole("button", { name: "Additional readings (optional)" }));
  expect(screen.queryByRole("checkbox", { name: "Example password" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Example remaining" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Example progress" }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications).toHaveBeenLastCalledWith({ rules: [{ ...rule, detailEntities: ["home|sensor.remaining", "home|sensor.progress"] }] });
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [{ ...rule, detailEntities: ["home|sensor.remaining", "home|sensor.progress"] }] };
  view.rerender(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  fireEvent.click(screen.getByRole("button", { name: "Additional readings (optional)" }));
  expect(screen.getByRole("checkbox", { name: "Example remaining" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Example progress" })).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Example remaining" }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
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

it("saves display and page choices through shared settings and disables them when storage is unavailable", () => {
  const content = () => <MemoryRouter><NotificationSettings /></MemoryRouter>;
  const view = render(content());
  expect(screen.getByRole("button", { name: "Section" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("Show on")).toHaveValue("main");
  fireEvent.click(screen.getByRole("button", { name: "Banner" }));
  expect(setNotifications).toHaveBeenLastCalledWith({ presentation: "banner" });
  fireEvent.change(screen.getByLabelText("Show on"), { target: { value: "today" } });
  expect(setNotifications).toHaveBeenLastCalledWith({ pages: "today" });
  mocks.shared.state.error = "Storage unavailable";
  view.rerender(content());
  expect(screen.getByRole("button", { name: "Banner" })).toBeDisabled();
  expect(screen.getByLabelText("Show on")).toBeDisabled();
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

it("preserves drafts on invalid filters or failed saves and blocks settings edits before storage loads", () => {
  const view = render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Add Current alerts" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Example event" } });
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

it("configures progress from a numeric reading, a total entity and a chosen activity icon", () => {
  mocks.app.currentHome = mapHome({
    "binary_sensor.example": state("binary_sensor.example", "on"),
    "sensor.remaining": state("sensor.remaining", "30"),
    "sensor.total": state("sensor.total", "90"),
  }, emptyRegistries, "home");
  const rule = notificationRuleSchema.parse({ ...cameraRule(), kind: "ongoing", detailEntities: ["home|sensor.remaining"] });
  mocks.family.notifications = { ...emptyPlanner().notifications, presentation: "activity", rules: [rule] };
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show progress bar" }));
  expect(screen.getByRole("button", { name: "Current value: entity" })).toHaveTextContent("Remaining");
  fireEvent.change(screen.getByLabelText("End / total value"), { target: { value: "0" } });
  fireEvent.change(screen.getByLabelText("Start value: value source"), { target: { value: "entity" } });
  chooseEntity("Start value: entity", "sensor.total");
  fireEvent.click(screen.getByRole("button", { name: "Laundry" }));
  fireEvent.click(screen.getByRole("switch", { name: "Animate activity icon" }));
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  const saved = setNotifications.mock.lastCall[0].rules[0];
  expect(saved).toMatchObject({ icon: "washing", animateIcon: false, progress: {
    current: { type: "entity", entity: "home|sensor.remaining", attribute: "" },
    start: { type: "entity", entity: "home|sensor.total", attribute: "" }, end: { type: "value", value: 0 },
  } });
});

it("suggests the numeric trigger and threshold, rejects an empty range, and lets progress be removed", () => {
  mocks.app.currentHome = mapHome({ "sensor.example": state("sensor.example", "30") }, emptyRegistries, "home");
  const rule = notificationRuleSchema.parse({ ...cameraRule(), kind: "ongoing", trigger: { type: "state", entity: "home|sensor.example", operator: "lt", value: "80" } });
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [rule] };
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show progress bar" }));
  expect(screen.getByLabelText("End / total value")).toHaveValue(80);
  fireEvent.change(screen.getByLabelText("Start value"), { target: { value: "80" } });
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Check progress");
  expect(setNotifications).not.toHaveBeenCalled();
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
  mocks.app.currentHome = mapHome({ "sensor.example": state("sensor.example", "75") }, emptyRegistries, "home");
  view.rerender(content());
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
  mocks.app.currentHome = mapHome({ "sensor.example": state("sensor.example", "unavailable") }, emptyRegistries, "home");
  view.rerender(content());
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.getByText("Progress unavailable. Check the numeric readings and range.")).toBeVisible();
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


it("adds a notification from each empty group and offers exactly three style examples", () => {
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  const styles = within(screen.getByRole("group", { name: "Display as" }));
  expect(styles.getAllByRole("button")).toHaveLength(3);
  fireEvent.click(styles.getByRole("button", { name: "Activity cards" }));
  expect(setNotifications).toHaveBeenLastCalledWith({ presentation: "activity" });
  for (const kind of ["Ongoing tasks", "Current alerts", "Camera popup"]) {
    const group = within(screen.getByRole("region", { name: kind }));
    expect(group.getByText("No notifications in this group yet.")).toBeVisible();
    fireEvent.click(group.getByRole("button", { name: `Add ${kind}` }));
    expect(screen.getByRole("dialog", { name: "Add notification" })).toHaveAccessibleDescription(kind);
    expect(screen.getByRole("region", { name: "Notification preview" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  }
});

it("saves and reopens names and placement for sources, readings and progress attributes", () => {
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
  for (const [name, alias, placement] of entries) {
    expect(screen.getByLabelText(`${name}: display name`)).toHaveValue(alias);
    expect(screen.getByLabelText(`${name}: placement`)).toHaveValue(placement);
  }
});

it("lets camera and event entities have local names and placements", () => {
  mocks.family.notifications = { ...emptyPlanner().notifications, rules: [cameraRule()] };
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Edit Example doorbell" }));
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
