import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MainNav } from "@/components/layout/Navigation";
import { sourceFile } from "./source-file.mjs";

// Phone and compact tablet dock (DESIGN.md, The Caption Stays Rule): at 320–414px and 150% text, "Kalender" and
// "Smarthjem" are wider than an equal fifth of the dock. Captions stay visible and inside their own destination: a
// destination never narrows below its caption's widest syllable, and a long word breaks at a hyphenation point.
const afterglowCss: string = sourceFile("afterglow.css");
const familyProvider: string = sourceFile("contexts/FamilyProvider.tsx");

const mediaBlock = (css: string, query: string) => {
  const start = css.indexOf(`@media ${query} {`);
  expect(start, `@media ${query}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let index = css.indexOf("{", start); index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}" && --depth === 0) return css.slice(start, index + 1);
  }
  throw new Error(`Unclosed @media ${query}`);
};
const declarations = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))].map(match => match[1]).join(";");
};

it("renders every destination as an icon over a caption with the destination's accessible name", () => {
  render(<MemoryRouter initialEntries={["/calendar"]}><MainNav /></MemoryRouter>);
  const links = screen.getAllByRole("link");
  expect(links.map(link => link.textContent)).toEqual(["Today", "Calendar", "Lists", "School", "Smart home"]);
  for (const link of links) {
    expect(link.querySelector(":scope > svg")).toHaveAttribute("aria-hidden", "true");
    expect(link.querySelector(":scope > span")).toHaveTextContent(link.textContent!);
    expect(link).toHaveAccessibleName(link.textContent!);
  }
});

it("lets a long caption take the room it needs and break between syllables, never into its neighbour", () => {
  const compact = mediaBlock(afterglowCss, "(max-width: 999px)");
  // The base rule lets destinations shrink to nothing (min-width: 0); compact docks restore the content minimum.
  expect(declarations(afterglowCss, ".family-dock a")).toMatch(/min-width: 0/);
  expect(declarations(compact, ".family-dock a")).toMatch(/min-width: auto/);
  const caption = declarations(compact, ".family-dock a > span");
  expect(caption).toMatch(/-webkit-hyphens: auto; hyphens: auto/);
  // break-word, not anywhere: it keeps the syllable as the minimum width instead of single letters.
  expect(caption).toMatch(/overflow-wrap: break-word/);
  for (const query of ["(max-width: 999px)", "(max-width: 699px)"]) {
    expect(declarations(mediaBlock(afterglowCss, query), ".family-dock a")).not.toMatch(/white-space: nowrap|text-overflow/);
  }
  // Hyphenation follows the page language, which the household's language sets.
  expect(familyProvider).toMatch(/document\.documentElement\.lang = language;/);
});
