import { expect, it } from "vitest";
import { sourceFile, sourceFiles } from "./source-file.mjs";

// Menu rows (DESIGN.md, Navigation and transient menus): the shared DropdownMenuItem owns the space between a row's
// icon and its label, so every menu spaces them the same and a new menu cannot ship its icon against the text.
const dropdownSource: string = sourceFile("components/ui/dropdown-menu.tsx");
const sharedGap = "gap-3";

const classesOf = (component: string) => {
  const start = dropdownSource.indexOf(`const ${component} = `);
  const body = dropdownSource.slice(start, dropdownSource.indexOf(".displayName", start));
  return (/cn\(\s*"([^"]*)"/.exec(body)?.[1] ?? "").split(/\s+/);
};

it("spaces and centres the icon in every shared menu row", () => {
  for (const component of ["DropdownMenuItem", "DropdownMenuSubTrigger"]) {
    expect(classesOf(component)).toEqual(expect.arrayContaining(["flex", "items-center", sharedGap, "[&>svg]:shrink-0"]));
  }
});

it("never overrides the shared gap from a menu's stylesheet or class", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(".css") as string[]) {
    for (const [, selector, body] of sourceFile(file).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/\[role="menuitem(?:checkbox|radio)?"\]/.test(selector) && /(?:^|[;\s])(?:column-)?gap\s*:/.test(body)) offenders.push(`${file}: ${selector.trim()}`);
    }
  }
  let seen = 0;
  for (const file of sourceFiles(".tsx") as string[]) {
    if (file.startsWith("components/ui/")) continue;
    const source: string = sourceFile(file);
    for (const match of source.matchAll(/<DropdownMenuItem\b[^>]*>/g)) {
      seen += 1;
      const className = /className="([^"]*)"/.exec(match[0])?.[1] ?? "";
      if (/(?:^|\s)!?(?:gap|gap-x|space-x)-/.test(className)) offenders.push(`${file}: ${className}`);
    }
  }
  expect(seen).toBeGreaterThan(5);
  expect(offenders).toEqual([]);
});
