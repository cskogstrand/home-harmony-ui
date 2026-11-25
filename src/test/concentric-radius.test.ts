import { expect, it } from "vitest";
import { sourceFile } from "./source-file.mjs";

// The Concentric Radius Rule (DESIGN.md): an inset surface takes the container's radius minus its inset,
// and a capsule only nests in a capsule track or where it stands free.
const afterglowCss: string = sourceFile("afterglow.css");
const artworkCss: string = sourceFile("artwork.css");
const vehicleCss: string = sourceFile("components/vehicle-widgets.css");

const declarations = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))].map(match => match[1]).join(";");
};

it("keeps segment and tab choices concentric with their tracks", () => {
  expect(declarations(afterglowCss, ".list-tabs")).toMatch(/border-radius: var\(--radius-capsule\)/);
  expect(declarations(afterglowCss, ".list-tabs button")).toMatch(/border-radius: var\(--radius-capsule\)/);
  expect(declarations(afterglowCss, ".calendar-segment button")).toMatch(/min-width: 48px; min-height: 48px/);
  // With artwork on, the capsule choices keep a capsule track instead of a field-radius one.
  expect(artworkCss).not.toMatch(/\.list-tabs[^{]*\{[^}]*border-radius: var\(--radius-field\)/);
  expect(declarations(artworkCss, "[data-artwork] .smart-nav")).toMatch(/border-radius: var\(--radius-capsule\)/);
  expect(declarations(vehicleCss, ".vehicle-view-tabs [role=\"tab\"]")).toMatch(/border-radius: calc\(var\(--radius-inset\) - 3px\)/);
  expect(declarations(vehicleCss, ".vehicle-glance")).toMatch(/border-radius: calc\(var\(--radius-menu\) - 3px\)/);
});
