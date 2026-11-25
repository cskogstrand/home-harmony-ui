import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Lists from "@/pages/Lists";
import { ListKindIcon } from "@/components/FamilyLists";
import type { ListItem } from "@/contexts/FamilyContext";

const shared = vi.hoisted(() => ({ plannerArtwork: {} as Record<string, boolean> }));
const family = vi.hoisted(() => ({
  connectedPlanner: false, todoLists: {}, today: "2026-01-01", isMemberVisible: () => true,
  items: [
    { id: "a", text: "Example item", kind: "shopping", member: "everyone", done: false },
    { id: "b", text: "Example task", kind: "tasks", member: "everyone", done: false },
  ] as ListItem[],
}));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => ({ state: { loaded: true, config: { settings: { language: "en", appearance: { plannerArtwork: shared.plannerArtwork } } } } }) }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/FamilyContext")>(), useFamily: () => family }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => ({ currentHome: { entities: [] }, homeOnline: true }) }));
vi.mock("@/components/NotificationCenter", () => ({ NotificationList: () => null }));
vi.mock("@/components/FamilyLists", async importOriginal => ({ ...await importOriginal<typeof import("@/components/FamilyLists")>(), ListPanel: () => <p>List body</p> }));

afterEach(() => { cleanup(); shared.plannerArtwork = {}; });

const renderLists = () => render(<MemoryRouter initialEntries={["/lists?tab=tasks"]}><Lists /></MemoryRouter>);
const tab = (name: RegExp) => within(screen.getByRole("group", { name: "Family lists" })).getByRole("button", { name });

describe("list tab icons", () => {
  it("shows each list type's heading glyph beside the label and count", () => {
    renderLists();
    const expected = { "Daily rhythm": "list-checks", Shopping: "shopping-basket", "Family tasks": "clipboard-list", Homework: "book-open" };
    for (const [label, glyph] of Object.entries(expected)) {
      const button = tab(new RegExp(`^${label}`));
      const icon = button.querySelector(".list-kind-icon");
      expect(icon?.querySelector(`svg.lucide-${glyph}`)).toBeInTheDocument();
      expect(button.firstElementChild).toBe(icon);
      expect(icon?.querySelector(".card-illustration")).toBeNull();
    }
    expect(tab(/^Shopping/)).toHaveAccessibleName("Shopping 1");
    expect(tab(/^Family tasks/)).toHaveAttribute("aria-pressed", "true");
    expect(tab(/^Daily rhythm/)).toHaveAttribute("aria-pressed", "false");
  });

  it("hides the icon from assistive technology so the label stays the tab's name", () => {
    renderLists();
    for (const button of within(screen.getByRole("group", { name: "Family lists" })).getAllByRole("button")) {
      const icon = button.querySelector(".list-kind-icon");
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(button.textContent?.startsWith(icon?.textContent ?? "x")).toBe(true);
      expect(icon?.textContent).toBe("");
    }
    expect(tab(/^Homework/)).toHaveAccessibleName("Homework 0");
  });

  it("uses the heading illustration when that list type has artwork on, keeping the glyph for compact and forced-colour views", () => {
    shared.plannerArtwork = { shopping: true };
    renderLists();
    const icon = tab(/^Shopping/).querySelector(".list-kind-icon");
    expect(icon?.querySelector('.card-illustration[data-illustration="shopping"]')).toBeInTheDocument();
    expect(icon?.querySelector("svg.lucide-shopping-basket")).toBeInTheDocument();
    expect(tab(/^Family tasks/).querySelector(".card-illustration")).toBeNull();
    expect(tab(/^Shopping/)).toHaveAccessibleName("Shopping 1");
  });

  it("falls back to a neutral list glyph for an unknown list type", () => {
    const { container } = render(<ListKindIcon kind="garden" />);
    const icon = container.querySelector(".list-kind-icon");
    expect(icon).toHaveAttribute("data-list-kind", "other");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon?.querySelector("svg.lucide-list")).toBeInTheDocument();
    expect(icon?.querySelector(".card-illustration")).toBeNull();
  });
});
