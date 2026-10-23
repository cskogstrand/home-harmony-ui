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
const card = (id: string) => within(document.querySelector(`[data-demo-card="${id}"]`) as HTMLElement);

it("covers the entity families, searches helper aliases and keeps changed values when filtered", () => {
  open();
  expect(screen.getByText("39 designs")).toBeInTheDocument();
  expect(document.querySelectorAll("[data-demo-card]")).toHaveLength(39);
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
