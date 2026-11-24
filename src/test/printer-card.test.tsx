import { cleanup, fireEvent, render as renderUI, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppContext } from "@/contexts/AppContext";
import { SmartHomeCard } from "@/components/devices/SmartHomeCard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cardDesigns } from "@/components/devices/card-designs";
import { smartHomeCards } from "@/lib/smart-home-cards";
import type { Home } from "@/types/api";
import { emptyConfiguration, emptyPlanner } from "../../shared/configuration";
import { cardServices, configuredCard, printerHome } from "./device-card-fixtures";

const mocks = vi.hoisted(() => ({ app: null, family: null, shared: null, camera: vi.fn(), command: vi.fn() }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => mocks.family }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => mocks.shared }));

const design = cardDesigns.find(item => item.id === "printer_3d")!;
const setHome = (home: Home) => { mocks.app.currentHome = { ...home, timeZone: "Europe/Oslo", temperatureUnit: "°C" }; return home; };
const show = (home: Home, density: "original" | "compact" | "supercompact" = "original") => {
  setHome(home);
  const main = home.entities.find(entity => entity.entityId.endsWith("_print_progress"))!;
  return renderUI(<MemoryRouter><TooltipProvider><SmartHomeCard entity={main} design={design} density={density} /></TooltipProvider></MemoryRouter>,
    { wrapper: ({ children }) => <AppContext.Provider value={{ ...mocks.app }}>{children}</AppContext.Provider> });
};
const card = () => within(screen.getByRole("article"));

beforeEach(() => {
  mocks.camera.mockReset().mockImplementation((_id, _video, _signal, onError) => onError());
  mocks.command.mockReset();
  mocks.app = { watchCameraStream: mocks.camera, watchForecast: vi.fn(), entityHistory: vi.fn().mockResolvedValue([]), homeOnline: true, services: cardServices, commands: {}, command: mocks.command };
  mocks.family = { smartHome: emptyPlanner().smartHome };
  mocks.shared = { state: { loaded: true, config: emptyConfiguration() } };
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("attaches a printer card only to a printer's progress, status or stage sensor", () => {
  const home = printerHome();
  const progress = home.entities.find(entity => entity.entityId.endsWith("_print_progress"))!;
  const nozzle = home.entities.find(entity => entity.entityId.endsWith("_nozzle_temp"))!;
  const layout = [configuredCard(progress.preferenceId, "printer_3d"), configuredCard(nozzle.preferenceId, "printer_3d", { id: "other" })];
  const [printer, other] = smartHomeCards(home.entities, { layout });
  expect(printer.main).toBe(progress);
  expect(other.main).toBeUndefined();
});

it("leads the original card with the progress ring and time left, then media, stage, temperatures and named trays", () => {
  show(printerHome());
  expect(card().getByRole("progressbar", { name: "Print progress" })).toHaveAttribute("aria-valuenow", "42");
  expect(card().getByText("Time left")).toBeVisible();
  expect(card().getByText("1 h 15 min")).toBeVisible();
  expect(card().getByText("Printing")).toBeVisible();
  expect(card().getByRole("button", { name: "Expand Workshop printer camera" })).toBeVisible();
  expect(card().getByText("219.6 °C")).toBeVisible();
  expect(card().getByText("Target 220 °C")).toBeVisible();
  expect(card().getByText("54.8 °C")).toBeVisible();
  expect(card().getByRole("img", { name: "Filament unit tray 1: Example PLA, PLA, In use" })).toBeVisible();
  expect(card().getByRole("img", { name: "Filament unit tray 3: Empty" })).toBeVisible();
  expect(card().getByRole("img", { name: "Workshop printer external spool: Generic PETG, PETG" })).toBeVisible();
  expect(card().queryByRole("button", { name: /history/i })).toBeNull();
  expect(mocks.command).not.toHaveBeenCalled();
});

it("keeps media to the original card and moves temperatures behind a popover in super compact", () => {
  const compact = show(printerHome(), "compact");
  expect(compact.container.querySelector(".dg-printer-media")).toBeNull();
  expect(card().getByRole("progressbar", { name: "Print progress" })).toHaveClass("dg-printer-bar");
  expect(card().getByText("1 h 15 min")).toBeVisible();
  expect(card().getByText("219.6 °C")).toBeVisible();
  compact.unmount();

  const superCompact = show(printerHome(), "supercompact");
  expect(superCompact.container.querySelector(".dg-printer-media")).toBeNull();
  expect(card().getByText("1 h 15 min")).toBeVisible();
  expect(card().getByRole("img", { name: "Filament unit tray 2: Example PLA, PLA" })).toBeVisible();
  expect(card().queryByText("219.6 °C")).toBeNull();
  fireEvent.click(card().getByRole("button", { name: "Temperatures" }));
  expect(screen.getByText("219.6 °C")).toBeVisible();
});

it("shows when a finished print was done, in the home's time zone, with the cover image", () => {
  show(printerHome({ "sensor.workshop_printer_print_status": "finish", "sensor.workshop_printer_print_progress": "100" }));
  expect(card().getByText("Done at 14:20")).toBeVisible();
  expect(card().queryByText("Time left")).toBeNull();
  expect(card().queryByText(/^Target/)).toBeNull();
  expect(card().getByRole("button", { name: "Expand Workshop printer cover image" })).toBeVisible();
  expect(card().queryByRole("button", { name: "Expand Workshop printer camera" })).toBeNull();
});

it("shows the printer's error text for a failed print", () => {
  show(printerHome({
    "sensor.workshop_printer_print_status": "failed",
    "binary_sensor.workshop_printer_print_error": { state: "on", attributes: { code: 1, error: "Example nozzle clog." } },
  }));
  expect(card().getByText("Print failed")).toBeVisible();
  expect(card().getByText("Example nozzle clog.")).toBeVisible();
  expect(card().getByText("Printer error:", { exact: false })).toBeInTheDocument();
});

it("distinguishes an unavailable printer from an idle one", () => {
  const idle = show(printerHome({ "sensor.workshop_printer_print_status": "idle", "sensor.workshop_printer_print_progress": "0" }));
  expect(card().getByText("Ready")).toBeVisible();
  expect(card().getByRole("progressbar", { name: "Print progress" })).toHaveAttribute("aria-valuetext", "Not reported");
  expect(card().getByRole("img", { name: "Filament unit tray 1: Example PLA, PLA, In use" })).toBeVisible();
  expect(card().queryByText("Printer unavailable. Readings return when it reconnects.")).toBeNull();
  idle.unmount();

  const unavailable = Object.fromEntries(["print_status", "print_progress", "current_stage"].map(key => [`sensor.workshop_printer_${key}`, "unavailable"]));
  const { container } = show(printerHome(unavailable));
  expect(card().getByText("Unavailable")).toBeVisible();
  expect(card().getByText("Printer unavailable. Readings return when it reconnects.")).toBeVisible();
  expect(card().queryByText("219.6 °C")).toBeNull();
  expect(card().queryByRole("img", { name: /tray/ })).toBeNull();
  expect(container.querySelector(".dg-printer-media")).toBeNull();
});

it("treats a printing printer as unavailable while Home Assistant is offline", () => {
  mocks.app.homeOnline = false;
  show(printerHome());
  expect(card().getByText("Printer unavailable. Readings return when it reconnects.")).toBeVisible();
  expect(card().queryByText("1 h 15 min")).toBeNull();
});

it("translates the card in Bokmål with local number formatting", () => {
  mocks.shared.state.config.settings.language = "nb";
  show(printerHome());
  expect(card().getByText("Tid igjen")).toBeVisible();
  expect(card().getByText("1 t 15 min")).toBeVisible();
  expect(card().getByText("219,6 °C")).toBeVisible();
  expect(card().getByText("Mål 220 °C")).toBeVisible();
});
