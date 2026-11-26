import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { NotificationSettings } from "@/components/NotificationSettings";
import { appVersion } from "@/hooks/use-app-update";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { serializeNotificationRules } from "@/lib/notification-transfer";
import { emptyConfiguration, emptyPlanner } from "../../shared/configuration";
import { notificationRuleSchema, type NotificationRule } from "../../shared/notifications";
import { state } from "./ha-fixtures";

const mocks = vi.hoisted(() => ({ app: {} as Record<string, unknown>, family: {} as Record<string, unknown>, shared: { state: { loaded: true, error: "", config: undefined as ReturnType<typeof emptyConfiguration> } } }));
vi.mock("@/contexts/AppContext", () => ({ useApp: (select = value => value) => select(mocks.app) }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<object>(), useFamily: () => mocks.family }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => mocks.shared }));

type Settings = Partial<ReturnType<typeof emptyPlanner>["notifications"]>;
const setNotifications = vi.fn((_settings: Settings) => true);
const writeText = vi.fn(async (_text: string) => {});
const home = () => mapHome({
  "binary_sensor.example_salt": state("binary_sensor.example_salt", "off", { friendly_name: "Example salt sensor" }),
  "sensor.example_washer": state("sensor.example_washer", "idle", { friendly_name: "Example washer state" }),
}, emptyRegistries, "home");
const salt = () => notificationRuleSchema.parse({
  id: "rule-salt", title: "Example salt", kind: "current", dismissible: false,
  trigger: { type: "state", entity: "home|binary_sensor.example_salt", operator: "eq", value: "on" },
});
const washer = () => notificationRuleSchema.parse({
  id: "rule-washer", title: "Example washer", kind: "ongoing",
  trigger: { type: "state", entity: "home|sensor.example_washer", operator: "eq", value: "running" },
});
const dryer = () => notificationRuleSchema.parse({
  id: "rule-dryer", title: "Example dryer", kind: "ongoing",
  trigger: { type: "state", entity: "home|sensor.example_dryer", operator: "eq", value: "running" },
});
const saved = (rules: NotificationRule[]) => { mocks.family.notifications = { ...emptyPlanner().notifications, rules }; };
const lastRules = () => setNotifications.mock.lastCall![0].rules!;
const openMenu = (name: string) => fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
const renderSettings = () => render(<MemoryRouter><NotificationSettings /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  mocks.app = { currentHome: home(), homeOnline: true, watchEvents: vi.fn(), watchCameraStream: vi.fn(), watchCalendarEvents: vi.fn() };
  mocks.family = { ...emptyPlanner(), today: "2026-11-26", setNotifications };
  mocks.shared.state = { loaded: true, error: "", config: emptyConfiguration() };
  setNotifications.mockReturnValue(true);
  saved([salt(), washer()]);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("copies all rules and one rule as versioned exports and announces the copy", async () => {
  renderSettings();
  openMenu("Export all notification rules");
  fireEvent.click(await screen.findByRole("menuitem", { name: "Copy to clipboard" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
  const all = JSON.parse(writeText.mock.lastCall![0]);
  expect(all).toEqual({ type: "afterglow.notification-rules", version: 1, app: appVersion, rules: [salt(), washer()] });
  await waitFor(() => expect(screen.getAllByRole("status").some(node => node.textContent === "Copied 2 rules to the clipboard.")).toBe(true));

  openMenu("Actions for Example salt");
  fireEvent.click(await screen.findByRole("menuitem", { name: "Copy to clipboard" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  expect(JSON.parse(writeText.mock.lastCall![0]).rules).toEqual([salt()]);
  expect(JSON.parse(writeText.mock.lastCall![0]).rules[0].dismissible).toBe(false);
  await waitFor(() => expect(screen.getAllByRole("status").some(node => node.textContent === "Copied “Example salt” to the clipboard.")).toBe(true));
  expect(setNotifications).not.toHaveBeenCalled();
});

it("downloads one rule from its menu and the saved rule from the editor", async () => {
  const blobs: Blob[] = [];
  vi.stubGlobal("URL", Object.assign(Object.create(URL), { createObjectURL: (blob: Blob) => { blobs.push(blob); return "blob:example"; }, revokeObjectURL: vi.fn() }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  renderSettings();
  openMenu("Actions for Example washer");
  fireEvent.click(await screen.findByRole("menuitem", { name: "Download file" }));
  expect(click).toHaveBeenCalledOnce();
  expect((click.mock.contexts[0] as HTMLAnchorElement).download).toMatch(/^afterglow-notification-example-washer-\d{4}-\d{2}-\d{2}\.json$/);
  expect(JSON.parse(await blobs[0].text()).rules).toEqual([washer()]);

  fireEvent.click(screen.getByRole("button", { name: "Edit Example washer" }));
  fireEvent.click(screen.getByRole("button", { name: /^Notification content/ }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Title" }), { target: { value: "Changed title" } });
  openMenu("Export Example washer");
  expect(await screen.findByText("Exports the saved version, without unsaved changes.")).toBeVisible();
  fireEvent.click(screen.getByRole("menuitem", { name: "Copy to clipboard" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
  expect(JSON.parse(writeText.mock.lastCall![0]).rules).toEqual([washer()]);
  click.mockRestore();
});

it("spaces each export and action icon from its label with the shared menu gap", async () => {
  renderSettings();
  openMenu("Actions for Example salt");
  const items = await screen.findAllByRole("menuitem");
  expect(items.map(item => item.textContent)).toEqual(["Download file", "Copy to clipboard", "Delete"]);
  for (const item of items) {
    expect(item).toHaveClass("flex", "items-center", "gap-3");
    expect(item.firstElementChild?.tagName.toLowerCase()).toBe("svg");
  }
});

it("explains invalid input without leaving the first step", async () => {
  renderSettings();
  fireEvent.click(screen.getByRole("button", { name: "Import notifications" }));
  const dialog = screen.getByRole("dialog", { name: "Import notifications" });
  const text = within(dialog).getByRole("textbox", { name: "Or paste exported rules" });
  fireEvent.change(text, { target: { value: "{ not json" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Preview import" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent("This isn’t valid JSON.");
  expect(text).toHaveAttribute("aria-invalid", "true");
  fireEvent.change(text, { target: { value: JSON.stringify({ type: "afterglow.notification-rules", version: 2, app: "9.0.0", rules: [] }) } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Preview import" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent("newer version of Afterglow. Update Afterglow on this installation");
  expect(setNotifications).not.toHaveBeenCalled();
});

it("previews rules, marks missing entities, resolves each conflict and saves only after confirming", async () => {
  renderSettings();
  const trigger = screen.getByRole("button", { name: "Import notifications" });
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Import notifications" });
  const file = serializeNotificationRules([
    { ...salt(), message: "Updated" }, // same ID
    { ...dryer(), id: "rule-other", title: "Example washer" }, // same name
    dryer(), // new, with an entity missing here
  ], "99.0.0").replace("]\n}", `, ${JSON.stringify({ ...washer(), id: "rule-bad", title: "Example broken", snooze: 5 })}]\n}`);
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Or paste exported rules" }), { target: { value: file } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Preview import" }));

  await waitFor(() => expect(within(dialog).getByText("3 ready to import · 1 can’t be imported")).toHaveFocus());
  expect(within(dialog).getByText(`Exported from Afterglow 99.0.0. This installation runs ${appVersion}.`)).toBeVisible();
  const list = within(dialog).getByRole("list", { name: "Rules to import" });
  const items = within(list).getAllByRole("listitem").filter(item => item.parentElement === list);
  expect(items.map(item => item.querySelector("strong")!.textContent)).toEqual(["Example salt", "Example washer", "Example dryer"]);
  expect(within(items[0]).getByText(/Current alerts · Example salt sensor = on/)).toBeVisible();
  const saltEntities = within(items[0]).getByRole("list", { name: "Entities in Example salt" });
  expect(saltEntities).toHaveTextContent("Example salt sensor");
  expect(within(saltEntities).queryByText("Not found in Home Assistant")).toBeNull();
  const dryerEntities = within(items[2]).getByRole("list", { name: "Entities in Example dryer" });
  expect(within(dryerEntities).getByRole("listitem")).toHaveAttribute("data-missing", "true");
  expect(dryerEntities).toHaveTextContent("sensor.example_dryerNot found in Home Assistant");
  expect(within(items[2]).queryByRole("group")).toBeNull();
  expect(within(dialog).getByRole("heading", { name: "Can’t be imported" }).parentElement).toHaveTextContent(/Example broken.*doesn’t recognise \(snooze\)\. Update Afterglow/);

  const sameId = within(items[0]).getByRole("group", { name: "This rule is already saved here as “Example salt”." });
  expect(within(sameId).getByRole("radio", { name: "Replace" })).toBeChecked();
  const sameName = within(items[1]).getByRole("group", { name: "A saved rule is also called “Example washer”." });
  expect(within(sameName).getByRole("radio", { name: "Keep both" })).toBeChecked();
  expect(sameName).toHaveAccessibleDescription("Adds this rule as “Example washer (2)”.");
  fireEvent.click(within(sameId).getByRole("radio", { name: "Skip" }));
  expect(sameId).toHaveAccessibleDescription("Leaves the saved rule as it is.");
  expect(setNotifications).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole("button", { name: "Import rules" }));
  expect(setNotifications).toHaveBeenCalledOnce();
  const rules = lastRules();
  expect(rules.slice(0, 2)).toEqual([salt(), washer()]);
  expect(rules.slice(2).map(rule => [rule.title, rule.id === "rule-other"])).toEqual([["Example washer (2)", false], ["Example dryer", false]]);
  expect(rules[3]).toEqual(dryer());
  const summary = within(dialog).getByText("Added: 1 · Kept both: 1 · Skipped: 1 · Couldn’t be imported: 1");
  expect(summary).toHaveFocus();
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("replaces a saved rule in place and keeps dismissible", async () => {
  saved([{ ...salt(), dismissible: undefined, message: "Old" }, washer()]);
  renderSettings();
  fireEvent.click(screen.getByRole("button", { name: "Import notifications" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: serializeNotificationRules([salt()], appVersion) } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Preview import" }));
  fireEvent.click(await within(dialog).findByRole("button", { name: "Import rules" }));
  expect(lastRules()).toEqual([salt(), washer()]);
  expect(lastRules()[0].dismissible).toBe(false);
  expect(within(dialog).getByText("Replaced: 1")).toHaveFocus();
});

it("keeps the import draft when saving fails, then saves on retry", async () => {
  setNotifications.mockReturnValueOnce(false);
  renderSettings();
  fireEvent.click(screen.getByRole("button", { name: "Import notifications" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: serializeNotificationRules([dryer()], appVersion) } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Preview import" }));
  fireEvent.click(await within(dialog).findByRole("button", { name: "Import rules" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent("The rules could not be saved. Your import is still here.");
  expect(within(dialog).getByRole("list", { name: "Rules to import" })).toHaveTextContent("Example dryer");
  fireEvent.click(within(dialog).getByRole("button", { name: "Import rules" }));
  expect(setNotifications).toHaveBeenCalledTimes(2);
  expect(lastRules()).toEqual([salt(), washer(), dryer()]);
  expect(within(dialog).getByText("Added: 1")).toBeVisible();
});

it("asks before discarding a previewed import and keeps it on Keep editing", async () => {
  renderSettings();
  fireEvent.click(screen.getByRole("button", { name: "Import notifications" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: serializeNotificationRules([dryer()], appVersion) } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Preview import" }));
  await within(dialog).findByRole("list", { name: "Rules to import" });
  fireEvent.keyDown(dialog, { key: "Escape" });
  const ask = await screen.findByRole("alertdialog", { name: "Discard this import?" });
  fireEvent.click(within(ask).getByRole("button", { name: "Keep editing" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(screen.getByRole("list", { name: "Rules to import" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await act(async () => fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Discard import" })));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(setNotifications).not.toHaveBeenCalled();
});
