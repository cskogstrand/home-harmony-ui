import { expect, it } from "vitest";
import { sourceFile } from "./source-file.mjs";

// The Concentric Radius Rule (DESIGN.md): an inset surface takes the container's radius minus its inset,
// and a capsule only nests in a capsule track or where it stands free. Containers publish that value as
// --radius-nested, and their inset children read it.
const afterglowCss: string = sourceFile("afterglow.css");
const artworkCss: string = sourceFile("artwork.css");
const vehicleCss: string = sourceFile("components/vehicle-widgets.css");
const settingsCss: string = sourceFile("pages/settings.css");
const smartHomeSettingsCss: string = sourceFile("components/smart-home-settings.css");
const notificationsCss: string = sourceFile("components/notifications.css");
const tabsSource: string = sourceFile("components/ui/tabs.tsx");
const deviceCardsCss: string = sourceFile("components/devices/device-cards.css");
const favoritePickerCss: string = sourceFile("components/favorite-picker.css");

const declarations = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))].map(match => match[1]).join(";");
};
const nested = (value: string) => new RegExp(`--radius-nested: calc\\(${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`);
const usesNested = /border-radius: var\(--radius-nested\)/;

it("keeps segment and tab choices concentric with their tracks", () => {
  expect(declarations(afterglowCss, ".list-tabs")).toMatch(/border-radius: var\(--radius-capsule\)/);
  expect(declarations(afterglowCss, ".list-tabs button")).toMatch(/border-radius: var\(--radius-capsule\)/);
  expect(declarations(afterglowCss, ".calendar-segment button")).toMatch(/min-width: 48px; min-height: 48px/);
  // With artwork on, the capsule choices keep a capsule track instead of a field-radius one.
  expect(artworkCss).not.toMatch(/\.list-tabs[^{]*\{[^}]*border-radius: var\(--radius-field\)/);
  expect(declarations(artworkCss, "[data-artwork] .smart-nav")).toMatch(/border-radius: var\(--radius-capsule\)/);
  expect(declarations(vehicleCss, ".vehicle-tabs .vehicle-view-tabs")).toMatch(nested("var(--radius-inset) - 3px"));
  expect(declarations(vehicleCss, ".vehicle-view-tabs [role=\"tab\"]")).toMatch(usesNested);
  expect(declarations(vehicleCss, ".vehicle-strip")).toMatch(nested("var(--radius-menu) - 3px - 1px"));
  expect(declarations(vehicleCss, ".vehicle-glance")).toMatch(usesNested);
  expect(notificationsCss).toMatch(/\.notification-editor-views \{[^}]*padding: \.25rem; border-radius: var\(--radius-capsule\)/);
  // The shared tab list is 14px with a 4px inset, so its triggers take 10px.
  expect(tabsSource).toMatch(/TabsPrimitive\.List[\s\S]*rounded-md bg-muted p-1/);
  expect(tabsSource).toMatch(/rounded-\[calc\(var\(--radius-md\)_-_4px\)\] px-3 py-1\.5/);
});

it("gives rows and day surfaces their card radius minus the inset", () => {
  expect(declarations(settingsCss, ".settings-menu.settings-card")).toMatch(nested("var(--radius-inset) - .5rem - 1px"));
  expect(declarations(settingsCss, ".settings-menu .settings-row")).toMatch(usesNested);
  expect(declarations(settingsCss, ".settings-panel-menu")).toMatch(nested("var(--radius-inset) - .5rem - 1px"));
  expect(declarations(settingsCss, ".settings-panel-menu a")).toMatch(usesNested);
  expect(declarations(smartHomeSettingsCss, ".smart-card-list > li")).toMatch(nested("var(--radius-inset) - 1px"));
  expect(declarations(smartHomeSettingsCss, ".smart-card-row")).toMatch(usesNested);
  expect(declarations(smartHomeSettingsCss, ".smart-card-row-icon")).toMatch(/border-radius: var\(--radius-field\)/);
  expect(declarations(afterglowCss, ".timetable-week")).toMatch(nested("var(--radius-menu) - .5rem - 1px"));
  expect(declarations(afterglowCss, ".timetable-day")).toMatch(usesNested);
  expect(declarations(afterglowCss, ".timetable-day-trigger::after")).toMatch(usesNested);
  expect(declarations(notificationsCss, ".notification-widget-line.settings-card")).toMatch(nested("var(--radius-inset) - 1px"));
  expect(declarations(notificationsCss, ".notification-line-header")).toMatch(/border-radius: var\(--radius-nested\) var\(--radius-nested\) 0 0/);
  // The super compact scene action fills its unpadded card, so it shares the card's corners.
  expect(declarations(deviceCardsCss, ".dg-supercompact .dg-scene-action")).toMatch(/border-radius: var\(--radius-inset\)/);
  // With artwork on, the Smart home heading row wraps its trailing 2.75rem capsule button with an even .25rem inset.
  const headingRow = declarations(artworkCss, "[data-artwork] .smart-page > section > .section-heading");
  expect(headingRow).toMatch(/--radius-heading-row: calc\(2\.75rem \/ 2 \+ \.25rem\); padding: \.25rem \.25rem \.25rem 1rem;/);
  expect(headingRow).toMatch(/border-radius: var\(--radius-heading-row\)/);
});

it("centres the switch thumb in the capsule ends of the touch-sized track", () => {
  expect(declarations(afterglowCss, ".switch-thumb")).toMatch(/margin-inline-start: calc\(\(max\(28px, 1\.5rem\) - 4px - 1\.25rem\) \/ 2\)/);
  expect(afterglowCss).toMatch(/\[role="switch"\] \{ min-height: 28px; min-width: 48px; \}/);
});

it("keeps menu and popover items concentric with their transient surface", () => {
  // The rem inset keeps the pair concentric when the wall's larger root size grows the padding.
  expect(declarations(afterglowCss, ".motion-menu")).toMatch(nested("var(--radius-menu) - .5rem - 1px"));
  expect(declarations(afterglowCss, ".motion-menu :is([role=\"menuitem\"], [role=\"menuitemcheckbox\"], [role=\"menuitemradio\"])")).toMatch(usesNested);
  expect(declarations(favoritePickerCss, ".favorite-group-popover")).toMatch(nested("var(--radius-menu) - .5rem - 1px"));
  expect(declarations(favoritePickerCss, ".favorite-group-popover [cmdk-item]")).toMatch(usesNested);
});
