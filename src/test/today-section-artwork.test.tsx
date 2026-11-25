import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppContext } from "@/contexts/AppContext";
import { FamilyContext } from "@/contexts/FamilyContext";
import { HaHealthContext, noHealth } from "@/contexts/HaHealthContext";
import { SharedConfigurationContext } from "@/contexts/SharedConfigurationContext";
import { RecentActivity } from "@/components/ActivityFeed";
import { CardArtworkSettings } from "@/components/CardArtworkSettings";
import { HomeStatus } from "@/components/HomeStatus";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";

// Fictional home: one smoke detector that is reporting smoke, so Home status has an issue to show on Today.
const smoke = "binary_sensor.example_smoke";
const home = mapHome({ [smoke]: state(smoke, "on", { device_class: "smoke", friendly_name: "Example smoke alarm" }) }, emptyRegistries, "home");
const setAppearance = vi.fn();

function view(plannerArtwork: Record<string, boolean>, children: ReactNode) {
  const shared = { state: { loaded: true, error: "", config: { settings: { language: "en", appearance: { plannerArtwork } } } } };
  const app = { homeOnline: true, connectionStatus: "connected", currentHome: home, subscribeLogbook: vi.fn(() => vi.fn()) };
  const family = {
    dashboard: { statusSources: [`home|${smoke}`] }, setDashboard: vi.fn(), selectedAlarm: "", activity: { panel: true, people: false }, now: new Date(),
    cameras: { items: [] }, appearance: { plannerArtwork }, setAppearance, smartHome: { layout: [] }, setSmartHomeCardArtwork: vi.fn(),
  };
  return render(<MemoryRouter><SharedConfigurationContext.Provider value={shared as never}><AppContext.Provider value={app as never}>
    <FamilyContext.Provider value={family as never}><HaHealthContext.Provider value={noHealth}>{children}</HaHealthContext.Provider></FamilyContext.Provider>
  </AppContext.Provider></SharedConfigurationContext.Provider></MemoryRouter>);
}
afterEach(() => { cleanup(); setAppearance.mockClear(); });

describe("Card artwork for Recent at home and Home status", () => {
  it("decorates Recent at home with its heading illustration and corner scene only when its card artwork is on", () => {
    const { unmount } = view({}, <RecentActivity placement="today" />);
    const plain = screen.getByRole("region", { name: "Recent at home" });
    expect(plain.querySelector(".card-illustration, .card-backdrop")).toBeNull();
    expect(plain.querySelector(".panel-title-icon")).toBeInTheDocument();
    unmount();
    view({ recentActivity: true }, <RecentActivity placement="today" />);
    const panel = screen.getByRole("region", { name: "Recent at home" });
    expect(panel.querySelector('.panel-title .card-illustration[data-illustration="recentActivity"]')).toBeInTheDocument();
    expect(panel.querySelector(":scope > .card-backdrop use")).toHaveAttribute("href", "#artwork-aurora");
  });

  it("keeps the Home status warning visible as a badge on its illustration", () => {
    const { unmount } = view({}, <HomeStatus card />);
    const plain = screen.getByRole("button", { name: /Home status · 1 issue/ });
    expect(plain.querySelector(".housing-card-alert")).toBeInTheDocument();
    expect(plain.querySelector(".card-illustration, .card-backdrop, .header-badge")).toBeNull();
    unmount();
    view({ homeStatus: true }, <HomeStatus card />);
    const card = screen.getByRole("button", { name: /Home status · 1 issue/ });
    expect(card.querySelector('.housing-card-icon > .card-illustration[data-illustration="homeStatus"]')).toBeInTheDocument();
    expect(card.querySelector('.housing-card-icon > .header-badge[data-tone="attention"]')).toBeInTheDocument();
    // The glyph stays for forced colors and increased contrast, where the illustration is hidden.
    expect(card.querySelector(".housing-card-icon > .housing-card-alert")).toBeInTheDocument();
    expect(card.querySelector(":scope > .card-backdrop use")).toHaveAttribute("href", "#artwork-harbor");
  });

  it("offers both sections in Settings → Appearance → Card artwork and saves each choice on its own", () => {
    view({ homeStatus: true }, <CardArtworkSettings disabled={false} />);
    expect(screen.getByRole("switch", { name: "Home status" })).toBeChecked();
    const recent = screen.getByRole("switch", { name: "Recent at home" });
    expect(recent).not.toBeChecked();
    fireEvent.click(recent);
    expect(setAppearance).toHaveBeenCalledWith({ plannerArtwork: { homeStatus: true, recentActivity: true } });
  });
});
