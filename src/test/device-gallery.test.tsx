import { cleanup, fireEvent, render, screen, within, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DeviceGallery from "@/pages/DeviceGallery";

// Each case mounts 117 real cards; allow headroom when test workers compete for CPU.
vi.setConfig({ testTimeout: 15_000 });

const language = vi.hoisted(() => ({ value: "en" }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => ({ state: { config: { settings: { language: language.value } } } }) }));

beforeEach(() => {
  language.value = "en";
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const open = () => render(<MemoryRouter><DeviceGallery /></MemoryRouter>);
const settingsName = () => language.value === "nb" ? "Demoinnstillinger" : "Playground settings";
const openSettings = () => {
  fireEvent.click(screen.getByLabelText(settingsName(), { selector: "button" }));
  // Scope settings queries to the popover; the gallery mounts 117 cards.
  return within(screen.getByRole("dialog", { name: settingsName() }));
};
const closeSettings = () => fireEvent.click(within(screen.getByRole("dialog", { name: settingsName() })).getByRole("button", { name: language.value === "nb" ? "Lukk" : "Close" }));
const chooseView = (name: string) => { const settings = openSettings(); fireEvent.click(settings.getByRole("button", { name })); closeSettings(); };
const demoState = (value: string) => { const settings = openSettings(); fireEvent.change(settings.getByRole("combobox", { name: language.value === "nb" ? "Demotilstand" : "Demo state" }), { target: { value } }); closeSettings(); };
const resetDemo = () => { const settings = openSettings(); fireEvent.click(settings.getByRole("button", { name: "Reset demo" })); closeSettings(); };
const card = (id: string, variant = "Original") => within(document.querySelector(`[data-demo-card="${id}"][data-variant="${variant}"]`) as HTMLElement);

it("covers the entity families, searches helper aliases and keeps changed values when filtered", () => {
  open();
  expect(screen.getByText("39 designs")).toBeInTheDocument();
  expect(document.querySelectorAll('[data-variant="Original"]')).toHaveLength(39);
  expect(document.querySelectorAll('[data-variant="Compact"]')).toHaveLength(39);
  expect(document.querySelectorAll('[data-variant="Super compact"]')).toHaveLength(39);
  fireEvent.keyDown(card("light").getByRole("slider", { name: "Brightness" }), { key: "End" });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "input_number" } });
  expect(screen.getByText("1 design")).toBeInTheDocument();
  expect(card("number").getByRole("heading", { name: "Fine-tune it" })).toBeVisible();
  expect(card("light").queryByRole("heading", { name: "A softer glow" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "light" } });
  expect(card("light").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "100");
  resetDemo();
  expect(card("light").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "72");
});

it("keeps unavailable controls disabled, restores them and retains values on a failed command", () => {
  open();
  demoState("Unavailable");
  expect(card("light").getByRole("button", { name: "Toggle demo light" })).toBeDisabled();
  expect(card("light").getByRole("slider", { name: "Brightness" })).toHaveAttribute("data-disabled");
  fireEvent.click(card("light").getByRole("button", { name: "Restore demo" }));
  demoState("Command failed");
  expect(card("light").getByRole("alert")).toHaveTextContent("Your settings are unchanged");
  fireEvent.click(card("light").getByRole("button", { name: "Retry demo" }));
  expect(card("light").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "72");
});

it("confirms a lock action, changes media tracks, and runs a timer that pauses", async () => {
  vi.useFakeTimers();
  open();
  fireEvent.click(card("lock").getByRole("button", { name: "Unlock demo door" }));
  expect(card("lock").getByText("Locked")).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirm" })); });
  expect(card("lock").getByText("Unlocked")).toBeInTheDocument();
  fireEvent.click(card("media_player").getByRole("button", { name: "Next track" }));
  expect(card("media_player").getByText("A slower morning")).toBeInTheDocument();
  fireEvent.click(card("timer").getByRole("button", { name: "Start" }));
  act(() => vi.advanceTimersByTime(3000));
  expect(card("timer").getByText("04:57")).toBeInTheDocument();
  fireEvent.click(card("timer").getByRole("button", { name: "Pause" }));
  act(() => vi.advanceTimersByTime(2000));
  expect(card("timer").getByText("04:57")).toBeInTheDocument();
});

it("uses stable option values in Norwegian and provides search recovery", () => {
  language.value = "nb";
  open();
  const select = card("select").getByRole("combobox", { name: "Husmodus" });
  fireEvent.change(select, { target: { value: "Eco" } });
  expect(select).toHaveValue("Eco");
  expect(card("select").getAllByText("Øko")).toHaveLength(2);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no-such-device" } });
  expect(screen.getByText("Ingen treff")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Nullstill filtre" }));
  expect(screen.getByText("39 design")).toBeInTheDocument();
});

it("keeps all three versions independent through view changes, filters and reset", () => {
  open();
  expect(screen.queryByRole("button", { name: "Compare" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Demo state" })).not.toBeInTheDocument();
  openSettings();
  expect(screen.getByRole("button", { name: "Compare", pressed: true })).toBeVisible();
  closeSettings();
  fireEvent.keyDown(card("light", "Compact").getByRole("slider", { name: "Brightness" }), { key: "End" });
  fireEvent.keyDown(card("light", "Super compact").getByRole("slider", { name: "Brightness" }), { key: "Home" });
  expect(card("light").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "72");
  chooseView("Super compact");
  expect(card("light").queryByRole("slider", { name: "Brightness" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "vacuum" } });
  expect(card("light", "Super compact").queryByRole("slider", { name: "Brightness" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "light" } });
  chooseView("Compare");
  expect(card("light", "Compact").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "100");
  expect(card("light", "Super compact").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "1");
  expect(card("light").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "72");
  resetDemo();
  expect(card("light", "Compact").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "72");
  expect(card("light", "Super compact").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "72");
});

it.each(["Compact", "Super compact"])("keeps %s icon actions named and risky commands confirmed", async variant => {
  open();
  const close = card("cover", variant).getByRole("button", { name: "Close" });
  expect(close.textContent).toBe("");
  fireEvent.click(close);
  expect(card("cover", variant).getByRole("slider", { name: "Open position" })).toHaveAttribute("aria-valuenow", "0");
  fireEvent.click(card("vacuum", variant).getByRole("button", { name: "Start" }));
  expect(card("vacuum", variant).getByText("Cleaning")).toBeVisible();
  fireEvent.click(card("vacuum", variant).getByRole("button", { name: "Return to dock" }));
  expect(card("vacuum", variant).getByText("Docked")).toBeVisible();
  expect(card("switch", variant).queryByRole("switch", { name: "Outlet power" })).not.toBeInTheDocument();
  fireEvent.click(card("switch", variant).getByRole("button", { name: "Toggle demo outlet" }));
  expect(card("switch", variant).getByText("Off · no power draw")).toBeVisible();
  fireEvent.click(card("lock", variant).getByRole("button", { name: "Unlock demo door" }));
  expect(card("lock", variant).getByText("Locked")).toBeVisible();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirm" })); });
  expect(card("lock", variant).getByText("Unlocked")).toBeVisible();
  expect(card("lock").getByText("Locked")).toBeVisible();
});

it("preserves compact advanced controls, translations and unavailable recovery", () => {
  language.value = "nb";
  open();
  fireEvent.click(card("light", "Compact").getByText("Farge og effekter"));
  fireEvent.click(card("light", "Compact").getByRole("button", { name: "Farge" }));
  expect(card("light", "Compact").getByLabelText("Egendefinert farge")).toBeVisible();
  demoState("Unavailable");
  expect(card("light", "Compact").getByRole("slider", { name: "Lysstyrke" })).toHaveAttribute("data-disabled");
  expect(card("cover", "Compact").getByRole("button", { name: "Lukk" })).toBeDisabled();
  fireEvent.click(card("light", "Compact").getByRole("button", { name: "Gjenopprett demo" }));
  expect(card("light", "Compact").getByRole("slider", { name: "Lysstyrke" })).not.toHaveAttribute("data-disabled");
});

it("retains popover changes, restores keyboard focus and closes controls when the card is hidden", async () => {
  open();
  const trigger = card("light", "Super compact").getByRole("button", { name: "Color & effects" });
  fireEvent.click(trigger);
  const controls = screen.getByRole("dialog", { name: "Light controls" });
  fireEvent.change(within(controls).getByRole("combobox", { name: "Light effect" }), { target: { value: "Candle" } });
  fireEvent.keyDown(controls, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  expect(within(screen.getByRole("dialog", { name: "Light controls" })).getByRole("combobox", { name: "Light effect" })).toHaveValue("Candle");
  chooseView("Original");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  chooseView("Super compact");
  fireEvent.click(trigger);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "vacuum" } });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "light" } });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(trigger);
  expect(screen.getByRole("combobox", { name: "Light effect" })).toHaveValue("Candle");
});

it("keeps super compact readings clear and translated popup controls disabled while unavailable", () => {
  language.value = "nb";
  open();
  chooseView("Superkompakt");
  fireEvent.click(card("sensor", "Super compact").getByRole("button", { name: "Måledetaljer" }));
  const sensorControls = within(screen.getByRole("dialog", { name: "Kontroller for Sensor" }));
  const reading = sensorControls.getByRole("combobox", { name: "Måling" });
  fireEvent.change(reading, { target: { value: "Humidity" } });
  fireEvent.click(sensorControls.getByRole("button", { name: "Lukk kontroller" }));
  expect(card("sensor", "Super compact").getByText("Luftfuktighet")).toBeVisible();
  demoState("Unavailable");
  fireEvent.click(card("light", "Super compact").getByRole("button", { name: "Farge og effekter" }));
  const lightControls = within(screen.getByRole("dialog", { name: "Kontroller for Lys" }));
  expect(lightControls.getByRole("combobox", { name: "Lyseffekt" })).toBeDisabled();
  expect(lightControls.getByRole("slider", { name: "Lysvarme" })).toHaveAttribute("data-disabled");
  fireEvent.click(lightControls.getByRole("button", { name: "Lukk kontroller" }));
  fireEvent.click(card("light", "Super compact").getByRole("button", { name: "Gjenopprett demo" }));
  fireEvent.click(card("light", "Super compact").getByRole("button", { name: "Farge og effekter" }));
  expect(within(screen.getByRole("dialog", { name: "Kontroller for Lys" })).getByRole("combobox", { name: "Lyseffekt" })).toBeEnabled();
});

it("shows the water heater mode after its controls close", () => {
  open();
  fireEvent.click(card("water_heater", "Super compact").getByRole("button", { name: "More controls" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Water heater controls" })).getByRole("button", { name: "Off" }));
  fireEvent.click(screen.getByRole("button", { name: "Close controls" }));
  expect(card("water_heater", "Super compact").getByText("Hot water target · Off")).toBeVisible();
});
