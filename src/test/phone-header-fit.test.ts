import { expect, it } from "vitest";
import { sourceFile } from "./source-file.mjs";

// The phone header (DESIGN.md, The Sticky Header Rule and the vehicle chip): at 375–414px, at 100% and 150% text, the
// time and the header controls keep the first row and nothing overlaps. The vehicle chip sits beside the controls
// while the row can hold it and otherwise moves below them; that never depends on the battery reading.
const afterglowCss: string = sourceFile("afterglow.css");
const vehicleCss: string = sourceFile("components/vehicle-widgets.css");
const assistCss: string = sourceFile("components/assist.css");
const layoutSource: string = sourceFile("components/layout/AppLayout.tsx");
const homeStatusSource: string = sourceFile("components/HomeStatus.tsx");
const notificationSource: string = sourceFile("components/NotificationCenter.tsx");

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

it("sizes the home link to the time it shows, never under the 44px target", () => {
  // The trailing group and its wrap see the link's box, so the box must hold the visible time at every text size.
  const brand = declarations(mediaBlock(afterglowCss, "(max-width: 699px)"), ".brand");
  expect(brand).toMatch(/width: max-content/);
  expect(brand).toMatch(/min-width: 44px/);
  // The chip header's own column for the time is auto, so it follows the link instead of a fixed share of the row.
  expect(declarations(mediaBlock(vehicleCss, "(width <= 767px)"), ".app-header:has(.vehicle-chip-strip)")).toMatch(/grid-template-columns: auto /);
});

it("leaves the chip header's columns to the vehicle stylesheet", () => {
  // afterglow.css can load after vehicle-widgets.css: an equally specific header grid there (weather in the header) would
  // replace the time's auto column with a 1fr one that lets the time overflow beneath the chip.
  const headerGrids = [...afterglowCss.matchAll(/(?:^|\n)\s*([^{}\n]*\.app-header[^{}\n]*)\{([^}]*grid-template-columns[^}]*)\}/g)].map(match => match[1].trim());
  expect(headerGrids.length).toBeGreaterThan(0);
  for (const selector of headerGrids) {
    if (selector === ".app-header") continue; // Less specific than the chip rule, which always wins.
    expect(selector).toContain(":not(:has(.vehicle-chip-strip))");
  }
});

it("keeps the Sonos play badge in the control's corner, clear of the music icon at large text", () => {
  expect(layoutSource).toMatch(/<Music2 size=\{20\} aria-hidden="true" \/>\{playingGroup && <span className="header-badge header-badge-glyph"/);
  const glyph = declarations(afterglowCss, ".header-badge.header-badge-glyph");
  // Sized and placed from the control, not the text: 40% of a 48px circle is the 100%-text badge, at any text size.
  expect(glyph).toMatch(/width: 40%/);
  expect(glyph).toMatch(/aspect-ratio: 1/);
  expect(glyph).toMatch(/min-width: 0/);
  expect(glyph).toMatch(/padding: 0/);
  expect(glyph).toMatch(/inset-block-start: -7\.5%/);
  expect(glyph).not.toMatch(/\d(?:r?em|ch)\b/);
});

it("grows the camera and settings counts away from their icons, with Caption digits at every text size", () => {
  // Glyph-only states (one camera, storage warning or saving) use the glyph badge; counts use the count badge.
  expect(layoutSource).toMatch(/className=\{`header-badge \$\{detectedCameras > 1 \? "header-badge-count" : "header-badge-glyph"\}`\}/);
  expect(layoutSource).toMatch(/\{detectedCameras < 10 && <UserRound /);
  expect(layoutSource).toMatch(/className=\{`header-badge \$\{storageWarning \|\| storageBusy \? "header-badge-glyph" : "header-badge-count"\}`\}/);
  // Every header badge picks a variant: the 1.2rem base badge grew down over the icon at 150% text.
  expect(layoutSource).not.toMatch(/className="header-badge"/);
  // Digits stay at Caption, the smallest content size, rather than shrinking to make room.
  expect(declarations(afterglowCss, ".header-badge")).toMatch(/font-size: var\(--type-caption\)/);
  const count = declarations(afterglowCss, ".header-badge.header-badge-count");
  // Anchored by its lower edge a third of the way down the control (where the glyph badge ends) and in the end corner,
  // so larger text raises the badge above the control and more digits widen it along the icon's empty headroom.
  expect(count).toMatch(/inset-block: auto 67\.5%/);
  expect(count).not.toMatch(/inset-inline/);
  // As tall and wide as the glyph badge at 100% text (40% of the control), and 1.25em of the Caption digits when larger.
  expect(count).toMatch(/height: max\(40%, 1\.25em\)/);
  expect(count).toMatch(/min-width: max\(40%, 1\.25em\)/);
  expect(count).toMatch(/padding-inline: \.25em/);
  // A badge on the wrapped lower row (320px at 150% text) rises into this gap instead of onto the control above.
  expect(declarations(mediaBlock(vehicleCss, "(width <= 767px)"), ".app-header:has(.vehicle-chip-strip) .header-actions")).toMatch(/row-gap: 8px/);
});

it("grows the home status count away from the house like the camera and settings counts", () => {
  // Glyph-only states (checking, offline, no sources) use the glyph badge; issue counts use the count badge.
  expect(homeStatusSource).toMatch(/className=\{`header-badge \$\{count > 0 \? "header-badge-count" : "header-badge-glyph"\}`\}/);
  // The warning stays beside one digit; two digits drop it so the badge stays within the control at 150% text.
  expect(homeStatusSource).toMatch(/\{count < 10 && <StatusIcon /);
  // The header button never falls back to the 1.2rem base badge, which grew down over the house at 150% text.
  const headerButton = homeStatusSource.slice(homeStatusSource.indexOf('id="home-status-button"'));
  expect(headerButton.slice(0, headerButton.indexOf("</DialogTrigger>"))).not.toMatch(/className="header-badge"/);
});

it("grows the notification count away from the bell and keeps it inside the control", () => {
  // The bell's count is the shared count badge with the filled primary tone, not a corner pill of its own: at 150% text
  // that pill grew down over the bell, and it sat 4px past the control's edge, onto the gear beside it on phones.
  const start = notificationSource.indexOf('id="notification-bell"');
  const bell = notificationSource.slice(start, notificationSource.indexOf("</Link>", start));
  expect(bell).toMatch(/<span className="header-badge header-badge-count" data-tone="active" aria-hidden="true">\{notifications\.length\}<\/span>/);
  expect(bell).not.toMatch(/-right-1|-top-1/);
  expect(declarations(afterglowCss, '.header-badge[data-tone="active"]')).toMatch(/background: hsl\(var\(--primary\)\); color: hsl\(var\(--primary-foreground\)\)/);
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
