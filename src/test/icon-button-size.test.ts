import { expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button-variants";
import { sourceFile, sourceFiles } from "./source-file.mjs";

// The Round Icon Rule (DESIGN.md): a shared icon button is a circle on every screen. The base layer gives every
// button a 48px minimum height, so the icon size must carry the same minimum on both axes or phones get 44 × 48 ovals.
const afterglowCss: string = sourceFile("afterglow.css");
const deviceCardsCss: string = sourceFile("components/devices/device-cards.css");
const sonosCss: string = sourceFile("pages/sonos.css");
const vehicleCss: string = sourceFile("components/vehicle-widgets.css");

const declarations = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))].map(match => match[1]).join(";");
};

it("gives the icon size the touch minimum on both axes", () => {
  expect(afterglowCss).toMatch(/button, \[role="combobox"\], \[role="tab"\] \{ min-height: 48px; \}/);
  const icon = buttonVariants({ size: "icon" }).split(/\s+/);
  expect(icon).toEqual(expect.arrayContaining(["rounded-full", "h-11", "w-11", "min-h-[48px]", "min-w-[48px]"]));
});

it("never narrows a shared icon button with a smaller size class", () => {
  const offenders: string[] = [];
  let seen = 0;
  const files: string[] = sourceFiles(".tsx");
  for (const file of files) {
    const source: string = sourceFile(file);
    for (const match of source.matchAll(/size="icon"/g)) {
      const start = source.lastIndexOf("<Button", match.index);
      const end = source.slice(match.index).search(/[^=]>/) + match.index;
      const tag = source.slice(start, end);
      const className = /className="([^"]*)"/.exec(tag)?.[1] ?? "";
      seen += 1;
      if (/(?:^|\s)(?:h|w|size|min-h|min-w)-(?:\d|\[)/.test(className)) offenders.push(`${file}: ${className}`);
    }
  }
  expect(seen).toBeGreaterThan(40);
  expect(offenders).toEqual([]);
});

it("keeps resized icon buttons square and at least 48px", () => {
  expect(declarations(deviceCardsCss, ".dg-popover-heading > button")).toMatch(/width: 48px; height: 48px/);
  expect(declarations(sonosCss, ".sonos-mini .sonos-transport button")).toMatch(/width: 48px; height: 48px/);
  expect(declarations(vehicleCss, ".vehicle-map-expand, .vehicle-map-fullscreen > button:last-child")).toMatch(/width: 48px; height: 48px/);
  // The camera status overlay is the documented exception: a 44px rounded square, pinned on both axes.
  expect(declarations(deviceCardsCss, ".smart-entity-media .smart-media-status")).toMatch(/width: 44px; height: 44px; min-width: 44px; min-height: 44px/);
});
