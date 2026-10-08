import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "@/App";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("completes without the animation delay when reduced motion is enabled", async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  const matchMedia = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({ ...matchMedia(query), matches: query.includes("prefers-reduced-motion") }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  window.history.replaceState(null, "", "/lists?tab=daily");
  render(<App />);
  const checkbox = screen.getByRole("checkbox", { name: "Set the table" });
  fireEvent.click(checkbox);
  expect(screen.getByText("Completed (1)")).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(32); });
  expect(checkbox).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Completed (1)"));
  expect(screen.getByRole("checkbox", { name: "Set the table" })).toBeChecked();
});
