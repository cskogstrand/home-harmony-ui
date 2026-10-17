import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FamilyProvider, useFamily } from "@/contexts/FamilyContext";
import { ConfigurationBackup } from "@/components/ConfigurationBackup";
import { emptyConfiguration, emptyPlanner, parseConfiguration } from "../../shared/configuration";

const app = vi.hoisted(() => ({ haUrl: "http://ha.local:8123", homeOnline: true, currentHome: { timeZone: "UTC", entities: [] }, configurationRequest: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
const backup = () => ({ ...emptyConfiguration(), planners: { "home-1": { instanceUrl: app.haUrl, planner: { ...emptyPlanner(), memberOrder: ["restored-person"], hiddenMembers: ["restored-person"] } } } });
function Probe() {
  const { memberOrder, hiddenMembers, setCalendarSettings } = useFamily();
  return <><output aria-label="People order">{memberOrder.join(",")}</output><output aria-label="Hidden people">{hiddenMembers.join(",")}</output><button onClick={() => setCalendarSettings({ view: "people" })}>Change view</button></>;
}
const mount = () => render(<FamilyProvider><ConfigurationBackup /><Probe /></FamilyProvider>);
const upload = async (contents: string) => {
  const file = Object.assign(new File([contents], "backup.json", { type: "application/json" }), { text: async () => contents });
  await act(async () => fireEvent.change(screen.getByLabelText("Configuration backup file"), { target: { files: [file] } }));
};
beforeEach(() => {
  vi.stubEnv("MODE", "server");
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

it("confirms restore, leaves cancellation untouched, and applies a validated backup", async () => {
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

it("preserves browser data and migrates it only after explicit confirmation", async () => {
  const key = `afterglow-connected-planner-v1:${app.haUrl}:home-1`;
  const original = JSON.stringify(backup().planners["home-1"].planner);
  localStorage.setItem(key, original);
  mount(); await screen.findByText("Shared configuration saved.");
  expect(screen.getByLabelText("People order")).toBeEmptyDOMElement();
  expect(localStorage.getItem(key)).toBe(original);
  fireEvent.click(screen.getByRole("button", { name: "Use settings from this browser" }));
  expect(app.configurationRequest.mock.calls.some(([method]) => method === "PUT")).toBe(false);
  await act(async () => fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Restore configuration" })));
  expect(screen.getByLabelText("People order")).toHaveTextContent("restored-person");
  expect(localStorage.getItem(key)).toBe(original);
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

it("exports only configuration and can restore it in browser-only mode", async () => {
  vi.stubEnv("MODE", "development");
  localStorage.setItem("home-harmony:ha-session", "fixture-private-login");
  mount();
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
  expect(parseConfiguration(await text).format).toBe("home-harmony-config");
  await upload(JSON.stringify(backup()));
  await act(async () => fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Restore configuration" })));
  await waitFor(() => expect(screen.getByLabelText("People order")).toHaveTextContent("restored-person"));
  expect(screen.getByLabelText("Hidden people")).toHaveTextContent("restored-person");
  expect(localStorage.getItem("home-harmony:ha-session")).toBe("fixture-private-login");
  expect(app.configurationRequest).not.toHaveBeenCalled();
});
