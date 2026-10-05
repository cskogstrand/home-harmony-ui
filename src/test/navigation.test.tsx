import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import App from "@/App";
import { mockHomes } from "@/mock/data";

it("navigates from the dashboard to a device and back to the device list", async () => {
  // jsdom has no layout engine; Radix sliders still need this browser API.
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  window.history.replaceState(null, "", "/");
  const home = mockHomes[0];
  const device = home.rooms.flatMap(room => room.devices).find(device => device.online)!;
  const { unmount } = render(<App />);

  try {
    expect(screen.getByRole("heading", { level: 1, name: home.name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: device.name }));
    expect(await screen.findByRole("heading", { level: 1, name: device.name })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/devices/${device.id}`);

    fireEvent.click(within(screen.getByRole("main")).getByRole("link", { name: "Devices" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Devices" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/devices");
  } finally {
    unmount();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  }
});
