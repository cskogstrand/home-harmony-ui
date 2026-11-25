import { expect, it } from "vitest";
import { sourceFile } from "./source-file.mjs";

// The calendar toolbar on phones (DESIGN.md, The Period Yields Rule): at 320–414px and 100–150% text the arrows, the
// period, Today, the view segments and the week cog stay inside the gutter in month, week and day view. jsdom does not
// evaluate container queries, so the layout contract is read from the stylesheet; navigation.test.tsx covers the names.
const calendarCss: string = sourceFile("pages/calendar.css");
const calendarSource: string = sourceFile("pages/Calendar.tsx");

/** The body of the first `@container` block whose query matches, found by brace matching. */
const containerBlock = (query: string) => {
  const start = calendarCss.indexOf(`@container ${query} {`);
  expect(start, `@container ${query}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let index = calendarCss.indexOf("{", start); index < calendarCss.length; index += 1) {
    if (calendarCss[index] === "{") depth += 1;
    if (calendarCss[index] === "}" && --depth === 0) return calendarCss.slice(start, index + 1);
  }
  throw new Error(`Unclosed @container ${query}`);
};
const declarations = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))].map(match => match[1]).join(";");
};

it("queries the toolbar's own width in rem, so larger text moves the breakpoints with it", () => {
  expect(declarations(calendarCss, ".calendar-toolbar")).toMatch(/container: calendar-toolbar \/ inline-size/);
  // Pixel thresholds would keep the one-row layout at 150% text, where the 66px arrows leave the date about 66px.
  expect(calendarCss).not.toMatch(/@container calendar-toolbar \(width < \d+px\)/);
});

it("gives the period its own full row before the arrows would crush it", () => {
  const narrow = containerBlock("calendar-toolbar (width < 20rem)");
  expect(declarations(narrow, ".calendar-navigation")).toMatch(/display: flex/);
  // The arrows, Today and the segments become one wrapping row set; the period leads at full width.
  expect(declarations(narrow, ".calendar-date-navigation")).toMatch(/display: contents/);
  const heading = declarations(narrow, ".calendar-period-heading");
  expect(heading).toMatch(/order: -1/);
  expect(heading).toMatch(/flex: 1 0 100%/);
  expect(declarations(narrow, ".calendar-date-navigation .calendar-period")).toMatch(/width: 100%/);
  // The container block follows the phone media block, so it wins over the phone grid at equal specificity.
  expect(calendarCss.indexOf("@container calendar-toolbar (width < 20rem)")).toBeGreaterThan(calendarCss.indexOf("@media (max-width: 699px)"));
});

it("shortens the visible period and drops the illustration only on the narrowest toolbars", () => {
  expect(declarations(calendarCss, ".calendar-period-short")).toMatch(/display: none/);
  const shorter = containerBlock("calendar-toolbar (width < 13rem)");
  expect(declarations(shorter, ".calendar-period-long")).toMatch(/display: none/);
  expect(declarations(shorter, ".calendar-period-short")).toMatch(/display: inline/);
  expect(declarations(containerBlock("calendar-toolbar (width < 10.5rem)"), ".calendar-period > .illustrated-icon")).toMatch(/display: none/);
});

it("keeps the full period in the name and the announcement whichever form is visible", () => {
  expect(calendarSource).toMatch(/aria-label=\{`\$\{t\("Jump to date"\)\}: \$\{period\}`\}/);
  expect(calendarSource).toMatch(/<span className="calendar-period-text" aria-hidden="true"><span className="calendar-period-long">\{period\}<\/span><span className="calendar-period-short">\{shortPeriod\}<\/span><\/span><span className="sr-only" aria-live="polite">\{period\}<\/span>/);
});
