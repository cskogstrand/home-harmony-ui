import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppContext } from "@/contexts/AppContext";
import { FamilyContext } from "@/contexts/FamilyContext";
import { HaHealthContext, noHealth } from "@/contexts/HaHealthContext";
import { SharedConfigurationContext } from "@/contexts/SharedConfigurationContext";
import { RecentActivity } from "@/components/ActivityFeed";
import { CardArtworkSettings } from "@/components/CardArtworkSettings";
import { CardBackdrop, PlannerIllustration } from "@/components/CardArtwork";
import { HomeStatus } from "@/components/HomeStatus";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { todaySectionArtwork, todaySectionIcons } from "@/lib/today-sections";
import { artworkSchema, dashboardSections, plannerArtworkSchema } from "../../shared/configuration";
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

// Standing rule (AGENTS.md, DESIGN.md → Card artwork): a new or changed Today section ships with its icon and card artwork.
describe("Every Today section has an icon and card artwork", () => {
  it.each(dashboardSections)("%s has an icon for its heading and Customize Today", section => {
    expect(todaySectionIcons[section], `Add ${section} to todaySectionIcons in src/lib/today-sections.ts`).toBeTruthy();
  });

  it.each(dashboardSections)("%s has its own card artwork kind with an illustration and a corner scene", section => {
    const kind = todaySectionArtwork[section];
    expect(plannerArtworkSchema.options, `Add ${section} to todaySectionArtwork and plannerArtworkSchema`).toContain(kind);
    expect(Object.entries(todaySectionArtwork).filter(([, other]) => other === kind).map(([key]) => key), "Each section has its own switch").toEqual([section]);
    const { container, unmount } = render(<><PlannerIllustration kind={kind} /><CardBackdrop kind={kind} /></>);
    // The background blob alone means no drawing was added for this kind in CardArtwork.tsx.
    expect(container.querySelectorAll(`.card-illustration[data-illustration="${kind}"] > *`).length, `Draw ${kind} in CardArtwork.tsx`).toBeGreaterThan(1);
    const scene = container.querySelector(".card-backdrop use")?.getAttribute("href")?.replace("#artwork-", "");
    expect(artworkSchema.exclude(["none"]).options, `Pick a scene for ${kind} in CardArtwork.tsx`).toContain(scene);
    unmount();
  });

  it("lists a named switch for every card artwork kind in Settings → Appearance → Card artwork", () => {
    view({}, <CardArtworkSettings disabled={false} />);
    const rows = [...document.querySelectorAll(".card-artwork-options label")];
    expect(rows.map(row => row.querySelector(".card-illustration")?.getAttribute("data-illustration"))).toEqual(plannerArtworkSchema.options);
    for (const row of rows) expect(within(row as HTMLElement).getByRole("switch")).toHaveAccessibleName(/\S/);
  });
});

describe("Card artwork for Latest events and Home status", () => {
  it("decorates Latest events with its heading illustration and corner scene only when its card artwork is on", () => {
    const { unmount } = view({}, <RecentActivity placement="today" />);
    const plain = screen.getByRole("region", { name: "Latest events" });
    expect(plain.querySelector(".card-illustration, .card-backdrop")).toBeNull();
    expect(plain.querySelector(".panel-title-icon")).toBeInTheDocument();
    unmount();
    view({ recentActivity: true }, <RecentActivity placement="today" />);
    const panel = screen.getByRole("region", { name: "Latest events" });
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
    const recent = screen.getByRole("switch", { name: "Latest events" });
    expect(recent).not.toBeChecked();
    fireEvent.click(recent);
    expect(setAppearance).toHaveBeenCalledWith({ plannerArtwork: { homeStatus: true, recentActivity: true } });
  });
});
