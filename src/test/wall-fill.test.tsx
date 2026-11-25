import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useRef } from "react";
import { fitFillRows, wallFillHeight } from "@/lib/wall-fill";
import { useFillRows } from "@/hooks/use-wall-fill";

/**
 * A tiny block layout for jsdom: every element stacks its visible children below its own `data-h` height, starting at `data-top`.
 * Rects are computed on demand, so hiding a row moves everything after it, as in a browser.
 */
function rect(element: Element): DOMRect {
  const own = (node: Element) => Number((node as HTMLElement).dataset.h ?? 0);
  const height = (node: Element): number => (node as HTMLElement).hidden ? 0 : own(node) + [...node.children].reduce((sum, child) => sum + height(child), 0);
  const top = (node: Element): number => {
    const parent = node.parentElement;
    if (!parent || (node as HTMLElement).dataset.top) return Number((node as HTMLElement).dataset.top ?? 0);
    let offset = top(parent) + own(parent);
    for (const sibling of parent.children) { if (sibling === node) break; offset += height(sibling); }
    return offset;
  };
  const y = top(element), h = height(element);
  return { top: y, bottom: y + h, height: h, left: 0, right: 600, width: 600, x: 0, y, toJSON: () => ({}) } as DOMRect;
}
beforeEach(() => { vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) { return rect(this); }); });
afterEach(() => vi.restoreAllMocks());

const rows = (count: number, required: number, height = 60) => Array.from({ length: count }, (_, index) =>
  `<li data-h="${height}" ${index >= required ? "data-fill-extra" : ""}>Example row ${index + 1}</li>`).join("");
const panel = (html: string) => {
  const element = document.createElement("section");
  element.dataset.top = "100";
  element.innerHTML = html;
  document.body.append(element);
  return element;
};
const visible = (element: Element) => [...element.querySelectorAll("li")].filter(row => !(row as HTMLElement).hidden).map(row => row.textContent);

describe("wall fill", () => {
  it("takes the fill row's height from the rest of the board, never from the fill row itself", () => {
    const geometry = { dockTop: 2442, boardTop: 124, gap: 20, minimum: 320 };
    // 2670 px board with a 507 px fill row: the other rows take 2163 px, leaving 135 px, too little to fill.
    expect(wallFillHeight({ ...geometry, boardHeight: 2670, fillRowHeight: 507 })).toBeUndefined();
    const roomy = wallFillHeight({ ...geometry, boardHeight: 1800, fillRowHeight: 300 });
    expect(roomy).toBe(798);
    // Growing or shrinking the fill row changes the board by the same amount, so the answer stays the same.
    expect(wallFillHeight({ ...geometry, boardHeight: 2298, fillRowHeight: 798 })).toBe(roomy);
    expect(wallFillHeight({ ...geometry, boardHeight: 1600, fillRowHeight: 100 })).toBe(roomy);
  });

  it("shows only whole rows that end inside the box and always keeps the usual rows", () => {
    const element = panel(`<h2 data-h="50">Recent at home</h2><ol>${rows(20, 3)}</ol>`);
    fitFillRows(element, 400);
    // 100 + 400 = 500 px; the heading ends at 150, so five 60 px rows end at 450 and a sixth would end at 510.
    expect(visible(element)).toEqual(["Example row 1", "Example row 2", "Example row 3", "Example row 4", "Example row 5"]);
    expect(element.querySelectorAll("li[hidden]")).toHaveLength(15);
    fitFillRows(element, 100);
    expect(visible(element)).toEqual(["Example row 1", "Example row 2", "Example row 3"]);
    fitFillRows(element, 2000);
    expect(visible(element)).toHaveLength(20);
  });

  it("shares extra rows between lists in turn and never shows a later list's rows out of order", () => {
    const list = (name: string) => `<div data-fill-group><h3 data-h="40">${name}</h3><ul>${rows(6, 3, 50).replace(/Example row/g, name)}</ul></div>`;
    const element = panel(`<h2 data-h="50">Daily rhythm</h2>${list("A")}${list("B")}`);
    // Required: 50 + 2 × (40 + 150) = 430 px, ending at 530. Two more 50 px rows fit in 100 + 540 = 640.
    fitFillRows(element, 540);
    expect(visible(element)).toEqual(["A 1", "A 2", "A 3", "A 4", "B 1", "B 2", "B 3", "B 4"]);
  });

  it("does not observe its own hiding, so changing rows cannot start another pass", async () => {
    let passes = 0;
    function Panel({ count, height }: { count: number; height?: number }) {
      const ref = useRef<HTMLElement>(null);
      useFillRows(ref, height);
      passes++;
      return <section ref={ref} data-top="0"><h2 data-h="50">Recent at home</h2><ol>{Array.from({ length: count }, (_, index) =>
        <li key={index} data-h="60" data-fill-extra={index >= 3 || undefined}>Example row {index + 1}</li>)}</ol></section>;
    }
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const { container, rerender } = render(<Panel count={12} height={400} />);
    await Promise.resolve();
    const shown = () => [...container.querySelectorAll("li")].filter(row => !row.hidden).length;
    expect(shown()).toBe(5);
    const fit = vi.spyOn(HTMLElement.prototype, "querySelectorAll");
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fit).not.toHaveBeenCalled();
    rerender(<Panel count={14} height={400} />);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(shown()).toBe(5);
    const calls = fit.mock.calls.length;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fit.mock.calls.length).toBe(calls);
    rerender(<Panel count={14} />);
    expect(shown()).toBe(14);
    expect(passes).toBe(3);
    vi.unstubAllGlobals();
  });
});
