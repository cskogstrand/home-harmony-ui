import { expect, it } from "vitest";
import { sourceFile } from "./source-file.mjs";

// The phone header (DESIGN.md, The Sticky Header Rule and the vehicle chip): at 375–414px, at 100% and 150% text, the
// time and the header controls keep the first row and nothing overlaps. The vehicle chip sits beside the controls
// while the row can hold it and otherwise moves below them; that never depends on the battery reading.
const afterglowCss: string = sourceFile("afterglow.css");
const vehicleCss: string = sourceFile("components/vehicle-widgets.css");
const assistCss: string = sourceFile("components/assist.css");
const layoutSource: string = sourceFile("components/layout/AppLayout.tsx");

/** The body of the first `@media` block whose query matches, found by brace matching. */
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

it("groups the vehicles and the controls in one trailing group that only takes a box on phones", () => {
  expect(layoutSource).toMatch(/<div className="header-trail"><VehicleWidgets \/><div className="header-actions">/);
  expect(declarations(afterglowCss, ".header-trail")).toMatch(/display: contents/);
});

it("keeps the time and the controls on the first row and lets the chip wrap below the controls", () => {
  const phone = mediaBlock(vehicleCss, "(width <= 767px)");
  expect(declarations(phone, ".app-header:has(.vehicle-chip-strip)")).toMatch(/grid-template-columns: auto minmax\(0, 1fr\)/);
  const trail = declarations(phone, ".app-header:has(.vehicle-chip-strip) .header-trail");
  expect(trail).toMatch(/grid-area: 1 \/ 2/);
  // Wrapping upwards keeps the later item (the controls) on the first row when the chip no longer fits beside them.
  expect(trail).toMatch(/flex-wrap: wrap-reverse/);
  expect(trail).toMatch(/justify-content: flex-end/);
  expect(trail).toMatch(/min-width: 0/);
  // The narrowest screens at large text wrap the controls among themselves instead of pushing them off screen.
  expect(declarations(phone, ".app-header:has(.vehicle-chip-strip) .header-actions")).toMatch(/flex-wrap: wrap/);
  // No fixed breakpoint forces the chip to a row of its own: the wrap decides, at every text size.
  expect(vehicleCss).not.toMatch(/\.vehicle-chip-strip \{ grid-area/);
  expect(vehicleCss).not.toMatch(/@media \(width <= 379px\)/);
  expect(assistCss).not.toMatch(/vehicle-chip-strip/);
});

it("keeps the tablet layout for weather beside the clock away from the phone chip", () => {
  const tablet = mediaBlock(vehicleCss, "(width <= 1100px)");
  for (const line of tablet.split("\n").filter(line => line.includes("header-weather[data-beside-clock]") && line.includes("grid"))) {
    expect(line).toContain(".vehicle-strip:not(.vehicle-chip-strip)");
  }
});

it("gives the chip one width for every reading", () => {
  const strong = declarations(vehicleCss, ".vehicle-chip > strong");
  expect(strong).toMatch(/min-width: 4\.5ch/);
  expect(strong).toMatch(/font-variant-numeric: tabular-nums/);
  // The percentage sits over the state icon and the fill, so the chip stays narrow.
  expect(strong).toMatch(/grid-column: 1 \/ -1/);
  expect(declarations(vehicleCss, ".vehicle-chip > svg + .vehicle-mini-meter")).toMatch(/grid-column: 2/);
  expect(declarations(vehicleCss, ".vehicle-chip")).toMatch(/min-width: 48px; min-height: 48px/);
});

it("uses 44px header targets only below 360px, where five 48px controls and the time cannot share a row", () => {
  expect(declarations(mediaBlock(afterglowCss, "(max-width: 359px)"), ".header-actions .icon-button")).toMatch(/min-width: 44px; min-height: 44px/);
});
