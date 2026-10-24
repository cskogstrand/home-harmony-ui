import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SmartHomeCard } from "@/components/devices/SmartHomeCard";
import { SmartHomeSettings } from "@/components/SmartHomeSettings";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cardDesigns, cardDesignFor } from "@/components/devices/card-designs";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { emptyConfiguration, emptyPlanner } from "../../shared/configuration";
import { services, state } from "./ha-fixtures";

const mocks = vi.hoisted(() => ({ app: null, family: null, shared: null, command: vi.fn(), density: vi.fn(), visible: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => mocks.family }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => mocks.shared }));
const climate = () => mapHome({ "climate.example": state("climate.example", "heat", {
  friendly_name: "Example thermostat", supported_features: 1, min_temp: 7, max_temp: 30, temperature: 21.5,
  current_temperature: 20, target_temp_step: .5, hvac_modes: ["heat", "off"],
}) }, emptyRegistries, "example").entities[0];
const open = (entity = climate()) => render(<MemoryRouter><TooltipProvider><SmartHomeCard entity={entity} /></TooltipProvider></MemoryRouter>);

beforeEach(() => {
  mocks.command.mockReset().mockResolvedValue(undefined); mocks.density.mockReset(); mocks.visible.mockReset();
  mocks.app = { homeOnline: true, services, commands: {}, command: mocks.command, currentHome: { entities: [climate()], areas: [], temperatureUnit: "°C" } };
  mocks.family = { smartHome: { ...emptyPlanner().smartHome, knownEntities: [climate().preferenceId] }, setSmartHomeCardDensity: mocks.density, setSmartHomeEntityVisible: mocks.visible };
  mocks.shared = { state: { loaded: true, config: emptyConfiguration() } };
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("automatically selects the climate design, defaults to supercompact, and sends the reported temperature step", async () => {
  open();
  expect(screen.getByRole("article")).toHaveAttribute("data-card-kind", "climate");
  expect(screen.getByRole("article")).toHaveAttribute("data-variant", "Super compact");
  expect(screen.getByRole("link", { name: "Example thermostat details" })).toHaveAttribute("href", "/entities/climate.example");
  fireEvent.click(screen.getByRole("button", { name: "Increase temperature for Example thermostat" }));
  expect(mocks.command).toHaveBeenCalledExactlyOnceWith("climate.example", "temperature", 22);
  expect(screen.getByText("21.5")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "More controls" }));
  expect(screen.getByRole("dialog", { name: "Example thermostat controls" })).toBeVisible();
  fireEvent.change(screen.getByRole("combobox", { name: "Example thermostat mode" }), { target: { value: "off" } });
  expect(screen.getByRole("alertdialog")).toBeVisible();
  expect(mocks.command).toHaveBeenCalledTimes(1);
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(mocks.command).toHaveBeenLastCalledWith("climate.example", "hvac_mode", "off"));
});

it("keeps bounds, unsupported capabilities, offline state and failed commands honest", () => {
  const entity = climate();
  const view = open({ ...entity, attributes: { ...entity.attributes, temperature: 30 } });
  expect(screen.getByRole("button", { name: "Increase temperature for Example thermostat" })).toBeDisabled();
  mocks.app.homeOnline = false;
  view.rerender(<MemoryRouter><TooltipProvider><SmartHomeCard entity={entity} /></TooltipProvider></MemoryRouter>);
  expect(screen.getByText("Offline")).toBeVisible();
  expect(screen.getByRole("button", { name: "Decrease temperature for Example thermostat" })).toBeDisabled();
  mocks.app.homeOnline = true;
  mocks.app.commands = { [entity.entityId]: { pending: true } };
  view.rerender(<MemoryRouter><TooltipProvider><SmartHomeCard entity={entity} /></TooltipProvider></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Decrease temperature for Example thermostat" })).toBeDisabled();
  mocks.app.commands = { [entity.entityId]: { error: "Command failed" } };
  view.rerender(<MemoryRouter><TooltipProvider><SmartHomeCard entity={{ ...entity, attributes: { temperature: 21.5 } }} /></TooltipProvider></MemoryRouter>);
  expect(screen.getByRole("alert")).toHaveTextContent("Command failed");
  expect(screen.queryByRole("button", { name: /temperature for/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "More controls" })).not.toBeInTheDocument();
  expect(mocks.command).not.toHaveBeenCalled();
});

it("uses each entity's stable preference ID for independent sizes and keeps hidden cards configurable", () => {
  mocks.family.smartHome.cardDensities = { [climate().preferenceId]: "compact" };
  const view = open();
  expect(screen.getByRole("article")).toHaveAttribute("data-variant", "Compact");
  mocks.family.smartHome.cardDensities[climate().preferenceId] = "original";
  view.rerender(<MemoryRouter><TooltipProvider><SmartHomeCard entity={climate()} /></TooltipProvider></MemoryRouter>);
  expect(screen.getByRole("article")).toHaveAttribute("data-variant", "Original");
  view.unmount();
  mocks.family.smartHome.hiddenEntities = [climate().preferenceId];
  render(<MemoryRouter><SmartHomeSettings /></MemoryRouter>);
  fireEvent.change(screen.getByRole("combobox", { name: "Group by" }), { target: { value: "none" } });
  const size = screen.getByRole("combobox", { name: "Card size for Example thermostat" });
  expect(size).toHaveValue("original");
  fireEvent.change(size, { target: { value: "supercompact" } });
  expect(mocks.density).toHaveBeenCalledExactlyOnceWith(climate().preferenceId, "supercompact");
  expect(mocks.visible).not.toHaveBeenCalled();
});

it("maps library aliases consistently and keeps unknown domains usable", () => {
  const domains = cardDesigns.flatMap(design => design.domains);
  expect(new Set(domains).size).toBe(domains.length);
  for (const design of cardDesigns) for (const domain of design.domains) expect(cardDesignFor(domain)).toBe(design);
  open({ ...climate(), domain: "future_domain", entityId: "future_domain.example", state: "idle", attributes: {} });
  expect(screen.getByRole("article")).toHaveAttribute("data-card-kind", "future_domain");
  expect(screen.getByText("Idle")).toBeVisible();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
