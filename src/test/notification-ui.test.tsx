import { chooseEntity } from "./entity-picker-helpers";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
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

const setNotifications = vi.fn(() => true);
const watchEvents = vi.fn();
const watchCameraStream = vi.fn();
const home = (value = "off") => mapHome({ "binary_sensor.example": state("binary_sensor.example", value, { friendly_name: "Example detector" }), "camera.example": state("camera.example", "idle", { friendly_name: "Example camera" }) }, emptyRegistries, "home");
const cameraRule = () => notificationRuleSchema.parse({ id: "example-camera", title: "Example doorbell", kind: "camera", cameraEntity: "home|camera.example", trigger: { type: "state", entity: "home|binary_sensor.example", operator: "eq", value: "on" }, durationSeconds: 10 });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.app = { currentHome: home(), homeOnline: true, watchEvents, watchCameraStream, watchCalendarEvents: vi.fn() };
  mocks.family = { ...emptyPlanner(), today: "2026-10-24", setNotifications };
  mocks.shared.state = { loaded: true, error: "" };
  setNotifications.mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

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
  fireEvent.click(screen.getByRole("button", { name: "Ongoing tasks" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Example wash" } });
  chooseEntity("Source entity", "binary_sensor.example");
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications).toHaveBeenCalledWith({ rules: [expect.objectContaining({ title: "Example wash", kind: "ongoing", trigger: expect.objectContaining({ entity: "home|binary_sensor.example", value: "on" }) })] });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("restricts the camera picker to cameras and allows clearing the optional reading", () => {
  render(<MemoryRouter><NotificationSettings /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Camera popup" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Example camera alert" } });
  chooseEntity("Source entity", "binary_sensor.example");
  fireEvent.click(screen.getByRole("button", { name: "Camera" }));
  const picker = within(screen.getByRole("dialog", { name: "Camera" }));
  expect(picker.queryByRole("button", { name: /Example detector/ })).not.toBeInTheDocument();
  fireEvent.click(picker.getByRole("button", { name: "Example camera · camera.example" }));
  chooseEntity("Additional reading (optional)", "binary_sensor.example");
  fireEvent.click(screen.getByRole("button", { name: "Additional reading (optional)" }));
  fireEvent.click(screen.getByRole("button", { name: "None" }));
  fireEvent.click(screen.getByRole("button", { name: "Save notification" }));
  expect(setNotifications).toHaveBeenCalledWith({ rules: [expect.objectContaining({ kind: "camera", cameraEntity: "home|camera.example", detailEntity: "" })] });
});

it("saves display and page choices through shared settings and disables them when storage is unavailable", () => {
  const content = () => <MemoryRouter><NotificationSettings /></MemoryRouter>;
  const view = render(content());
  expect(screen.getByLabelText("Display as")).toHaveValue("section");
  expect(screen.getByLabelText("Show on")).toHaveValue("main");
  fireEvent.change(screen.getByLabelText("Display as"), { target: { value: "banner" } });
  expect(setNotifications).toHaveBeenLastCalledWith({ presentation: "banner" });
  fireEvent.change(screen.getByLabelText("Show on"), { target: { value: "today" } });
  expect(setNotifications).toHaveBeenLastCalledWith({ pages: "today" });
  mocks.shared.state.error = "Storage unavailable";
  view.rerender(content());
  expect(screen.getByLabelText("Display as")).toBeDisabled();
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
  fireEvent.click(screen.getByRole("button", { name: "Current alerts" }));
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
  expect(screen.getByRole("button", { name: "Current alerts" })).toBeDisabled();
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
