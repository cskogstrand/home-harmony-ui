import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FamilyProvider } from "@/contexts/FamilyProvider";
import { useFamily } from "@/contexts/FamilyContext";
import { ConfigurationBackup } from "@/components/ConfigurationBackup";
import UserSettings from "@/pages/UserSettings";
import { emptyConfiguration, emptyPlanner, parseConfiguration } from "../../shared/configuration";

const app = vi.hoisted(() => ({ haUrl: "http://ha.local:8123", homeOnline: true, currentHome: { timeZone: "UTC", entities: [] }, configurationRequest: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
const backup = () => ({ ...emptyConfiguration(), settings: { ...emptyPlanner(), memberOrder: ["restored-person"], hiddenMembers: ["restored-person"] } });
function Probe() {
  const { memberOrder, hiddenMembers, appearance, selectedAlarm, setCalendarSettings, setAppearance, setSelectedAlarm, addItem } = useFamily();
  return <><output aria-label="People order">{memberOrder.join(",")}</output><output aria-label="Hidden people">{hiddenMembers.join(",")}</output><output aria-label="App preferences">{JSON.stringify({ appearance, selectedAlarm })}</output><button onClick={() => setCalendarSettings({ view: "people" })}>Change view</button><button onClick={() => setAppearance({ theme: "light", compactMode: true })}>Change appearance</button><button onClick={() => setSelectedAlarm(`${app.haUrl}|alarm.one`)}>Select alarm</button><button onClick={() => addItem("Must stay in HA", "tasks", "everyone")}>Add local content</button></>;
}
const mount = () => render(<FamilyProvider><ConfigurationBackup /><Probe /></FamilyProvider>);
it("defaults old appearance settings to normal timetables and validates the new preference", () => {
  const old = { ...emptyConfiguration(), settings: { ...emptyPlanner(), appearance: { theme: "dark", compactMode: false } } };
  expect(parseConfiguration(JSON.stringify(old)).settings.appearance.darkTimetables).toBe(false);
  for (const darkTimetables of [true, false]) {
    const updated = { ...old, settings: { ...old.settings, appearance: { ...old.settings.appearance, darkTimetables } } };
    expect(parseConfiguration(JSON.stringify(updated)).settings.appearance.darkTimetables).toBe(darkTimetables);
  }
  expect(() => parseConfiguration(JSON.stringify({ ...old, settings: { ...old.settings, appearance: { ...old.settings.appearance, darkTimetables: "true" } } }))).toThrow();
});

const upload = async (contents: string) => {
  const file = Object.assign(new File([contents], "backup.json", { type: "application/json" }), { text: async () => contents });
  await act(async () => fireEvent.change(screen.getByLabelText("Configuration backup file"), { target: { files: [file] } }));
};
beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { get length() { return storage.size; }, key: (i: number) => [...storage.keys()][i], getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  app.homeOnline = true;
  let config = emptyConfiguration(), revision = 0;
  app.configurationRequest.mockReset().mockImplementation(async (method, body, expected) => {
    if (method === "PUT") {
      if (expected !== String(revision).padStart(64, "0")) return { ok: false, status: 409 };
      config = parseConfiguration(body); revision++;
    }
    return { ok: true, status: 200, json: async () => ({ revision: String(revision).padStart(64, "0"), config: structuredClone(config) }) };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each(["development", "production"])("uses shared storage by default in %s and restores only after confirmation", async mode => {
  vi.stubEnv("MODE", mode);
  mount();
  await screen.findByText("Shared configuration saved.");
  await upload(JSON.stringify(backup()));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("entire shared configuration");
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
  expect(app.configurationRequest.mock.calls.some(([method]) => method === "PUT")).toBe(false);
  await upload(JSON.stringify(backup()));
  await act(async () => fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Restore configuration" })));
  expect(screen.getByLabelText("People order")).toHaveTextContent("restored-person");
  expect(screen.getByLabelText("Hidden people")).toHaveTextContent("restored-person");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

it("rejects an invalid backup before confirmation and never sends it to storage", async () => {
  mount(); await screen.findByText("Shared configuration saved.");
  await upload(JSON.stringify({ ...backup(), access_token: "fixture-secret" }));
  expect(screen.getByRole("alert")).toHaveTextContent("not a valid Home Harmony");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(app.configurationRequest.mock.calls.some(([method]) => method === "PUT")).toBe(false);
});

it("ignores old browser settings and loads shared settings while HA is offline", async () => {
  app.homeOnline = false;
  localStorage.setItem("afterglow-connected-planner-v1:http://ha.local:8123:home-1", JSON.stringify(backup().settings));
  mount(); await screen.findByText("Shared configuration saved.");
  expect(screen.getByLabelText("People order")).toBeEmptyDOMElement();
  expect(screen.queryByRole("button", { name: "Use settings from this browser" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Change appearance" }));
  await screen.findByText("Shared configuration saved.");
  expect(app.configurationRequest.mock.calls.some(([method]) => method === "PUT")).toBe(true);
});

it("keeps failed imports recoverable and blocks editing while a conflict is unresolved", async () => {
  mount(); await screen.findByText("Shared configuration saved.");
  app.configurationRequest.mockResolvedValue({ ok: false, status: 409 });
  await upload(JSON.stringify(backup()));
  await act(async () => fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Restore configuration" })));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Another screen changed");
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: "Export unsaved configuration" })).toBeEnabled();
  const count = app.configurationRequest.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Change view" }));
  expect(app.configurationRequest.mock.calls).toHaveLength(count);
});

it("exports only configuration and restores it through shared storage", async () => {
  vi.stubEnv("MODE", "browser");
  localStorage.setItem("home-harmony:ha-session", "fixture-private-login");
  mount(); await screen.findByText("Shared configuration saved.");
  const create = vi.fn((_blob: Blob) => "blob:fixture");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "Export configuration" }));
  expect(create).toHaveBeenCalledOnce();
  const reader = new FileReader();
  const text = new Promise<string>(resolve => { reader.onload = () => resolve(String(reader.result)); });
  reader.readAsText(create.mock.calls[0][0]);
  expect(await text).not.toContain("fixture-private-login");
  expect(await text).not.toMatch(/"events"|"items"/);
  expect(parseConfiguration(await text).format).toBe("home-harmony-config");
  await upload(JSON.stringify(backup()));
  await act(async () => fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Restore configuration" })));
  await waitFor(() => expect(screen.getByLabelText("People order")).toHaveTextContent("restored-person"));
  expect(screen.getByLabelText("Hidden people")).toHaveTextContent("restored-person");
  expect(localStorage.getItem("home-harmony:ha-session")).toBe("fixture-private-login");
  expect(app.configurationRequest).toHaveBeenCalled();
});

it("persists app preferences across reloads and does not save local list content", async () => {
  const view = mount();
  await screen.findByText("Shared configuration saved.");
  fireEvent.click(screen.getByRole("button", { name: "Change appearance" }));
  await screen.findByText("Shared configuration saved.");
  fireEvent.click(screen.getByRole("button", { name: "Select alarm" }));
  await screen.findByText("Shared configuration saved.");
  const count = app.configurationRequest.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Add local content" }));
  expect(app.configurationRequest).toHaveBeenCalledTimes(count);
  const saved = parseConfiguration(app.configurationRequest.mock.calls.filter(([method]) => method === "PUT").slice(-1)[0][1]);
  expect(saved.settings).toMatchObject({ appearance: { theme: "light", compactMode: true }, selectedAlarm: `${app.haUrl}|alarm.one` });
  expect(JSON.stringify(saved)).not.toMatch(/"events"|"items"|Must stay in HA/);
  view.unmount(); mount();
  await screen.findByText("Shared configuration saved.");
  expect(screen.getByLabelText("App preferences")).toHaveTextContent('"theme":"light"');
  expect(screen.getByLabelText("App preferences")).toHaveTextContent('"compactMode":true');
  expect(screen.getByLabelText("App preferences")).toHaveTextContent("alarm.one");
});

it.each([
  ["Sage", "sage"], ["Mist", "mist"], ["Rose", "rose"], ["Olive", "olive"],
  ["Clay", "clay"], ["Lavender", "lavender"], ["Seafoam", "seafoam"], ["Honey", "honey"], ["Slate", "slate"],
])("applies %s globally, keeps dark mode independent, and restores the choice after reload", async (name, colorPalette) => {
  const view = render(<FamilyProvider><UserSettings /></FamilyProvider>);
  await screen.findByText("Shared configuration saved.");
  expect(screen.getByRole("radio", { name: "Pearl" })).toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name }));
  await screen.findByText("Shared configuration saved.");
  expect(document.documentElement).toHaveAttribute("data-color-palette", colorPalette);
  expect(document.documentElement).toHaveClass("dark");
  fireEvent.click(screen.getByRole("switch", { name: "Toggle dark mode" }));
  await screen.findByText("Shared configuration saved.");
  expect(document.documentElement).not.toHaveClass("dark");
  expect(screen.getByRole("radio", { name })).toBeChecked();
  view.unmount();
  render(<FamilyProvider><UserSettings /></FamilyProvider>);
  await screen.findByText("Shared configuration saved.");
  expect(screen.getByRole("radio", { name })).toBeChecked();
  expect(document.documentElement).toHaveAttribute("data-color-palette", colorPalette);
  expect(document.documentElement).not.toHaveClass("dark");
});

it("keeps a failed palette save as an unsaved draft and blocks further choices until recovery", async () => {
  render(<FamilyProvider><UserSettings /></FamilyProvider>);
  await screen.findByText("Shared configuration saved.");
  app.configurationRequest.mockResolvedValue({ ok: false, status: 409 });
  fireEvent.click(screen.getByRole("radio", { name: "Sand" }));
  await screen.findByText(/Another screen changed the configuration/);
  expect(document.documentElement).toHaveAttribute("data-color-palette", "sand");
  expect(screen.getByRole("radio", { name: "Sand" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Dusk" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Export unsaved configuration" })).toBeEnabled();
});
