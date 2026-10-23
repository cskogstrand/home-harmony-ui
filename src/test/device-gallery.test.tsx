import { cleanup, fireEvent, render, screen, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DeviceGallery from "@/pages/DeviceGallery";

const language = vi.hoisted(() => ({ value: "en" }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => ({ state: { config: { settings: { language: language.value } } } }) }));

beforeEach(() => {
  language.value = "en";
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const open = () => render(<MemoryRouter><DeviceGallery /></MemoryRouter>);
const card = (id: string, variant = "Original") => within(document.querySelector(`[data-demo-card="${id}"][data-variant="${variant}"]`) as HTMLElement);

it("covers the entity families, searches helper aliases and keeps changed values when filtered", () => {
  open();
  expect(screen.getByText("39 designs")).toBeInTheDocument();
  expect(document.querySelectorAll('[data-variant="Original"]')).toHaveLength(39);
  expect(document.querySelectorAll('[data-variant="Compact"]')).toHaveLength(39);
  fireEvent.keyDown(card("light").getByRole("slider", { name: "Brightness" }), { key: "End" });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "input_number" } });
  expect(screen.getByText("1 design")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Fine-tune it" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "A softer glow" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "light" } });
  expect(card("light").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "100");
  fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
  expect(card("light").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "72");
});

it("keeps unavailable controls disabled, restores them and retains values on a failed command", () => {
  open();
  fireEvent.change(screen.getByRole("combobox", { name: "Demo state" }), { target: { value: "Unavailable" } });
  expect(card("light").getByRole("button", { name: "Toggle demo light" })).toBeDisabled();
  expect(card("light").getByRole("slider", { name: "Brightness" })).toHaveAttribute("data-disabled");
  fireEvent.click(card("light").getByRole("button", { name: "Restore demo" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Demo state" }), { target: { value: "Command failed" } });
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

it("compares independent controls and retains both versions when switching views and filters", () => {
  open();
  expect(screen.getByRole("button", { name: "Compare", pressed: true })).toBeVisible();
  fireEvent.keyDown(card("light", "Compact").getByRole("slider", { name: "Brightness" }), { key: "End" });
  expect(card("light").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "72");
  fireEvent.click(screen.getByRole("button", { name: "Compact" }));
  expect(card("light").queryByRole("slider", { name: "Brightness" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "vacuum" } });
  expect(card("light", "Compact").queryByRole("slider", { name: "Brightness" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "light" } });
  fireEvent.click(screen.getByRole("button", { name: "Compare" }));
  expect(card("light", "Compact").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "100");
  expect(card("light").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "72");
  fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
  expect(card("light", "Compact").getByRole("slider", { name: "Brightness" })).toHaveAttribute("aria-valuenow", "72");
});

it("keeps compact icon actions named, device states explicit and risky commands confirmed", async () => {
  open();
  const close = card("cover", "Compact").getByRole("button", { name: "Close" });
  expect(close.textContent).toBe("");
  fireEvent.click(close);
  expect(card("cover", "Compact").getByRole("slider", { name: "Open position" })).toHaveAttribute("aria-valuenow", "0");
  fireEvent.click(card("vacuum", "Compact").getByRole("button", { name: "Start" }));
  expect(card("vacuum", "Compact").getByText("Cleaning")).toBeVisible();
  fireEvent.click(card("vacuum", "Compact").getByRole("button", { name: "Return to dock" }));
  expect(card("vacuum", "Compact").getByText("Docked")).toBeVisible();
  expect(card("switch", "Compact").queryByRole("switch", { name: "Outlet power" })).not.toBeInTheDocument();
  fireEvent.click(card("switch", "Compact").getByRole("button", { name: "Toggle demo outlet" }));
  expect(card("switch", "Compact").getByText("Off · no power draw")).toBeVisible();
  fireEvent.click(card("lock", "Compact").getByRole("button", { name: "Unlock demo door" }));
  expect(card("lock", "Compact").getByText("Locked")).toBeVisible();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirm" })); });
  expect(card("lock", "Compact").getByText("Unlocked")).toBeVisible();
  expect(card("lock").getByText("Locked")).toBeVisible();
});

it("preserves compact advanced controls, translations and unavailable recovery", () => {
  language.value = "nb";
  open();
  fireEvent.click(card("light", "Compact").getByText("Farge og effekter"));
  fireEvent.click(card("light", "Compact").getByRole("button", { name: "Farge" }));
  expect(card("light", "Compact").getByLabelText("Egendefinert farge")).toBeVisible();
  fireEvent.change(screen.getByRole("combobox", { name: "Demotilstand" }), { target: { value: "Unavailable" } });
  expect(card("light", "Compact").getByRole("slider", { name: "Lysstyrke" })).toHaveAttribute("data-disabled");
  expect(card("cover", "Compact").getByRole("button", { name: "Lukk" })).toBeDisabled();
  fireEvent.click(card("light", "Compact").getByRole("button", { name: "Gjenopprett demo" }));
  expect(card("light", "Compact").getByRole("slider", { name: "Lysstyrke" })).not.toHaveAttribute("data-disabled");
});
