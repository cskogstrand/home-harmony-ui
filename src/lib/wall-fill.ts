/**
 * Filling the large wall's free space (Customize Today → Free space on the wall).
 *
 * The fill row's height comes from the page layout, never from its own content: the free space is the room between the board's top
 * and the dock, minus everything else on the board. The fill panel then shows its usual rows plus as many extra whole rows as fit.
 * Neither step reads the fill panel's own height, so showing or hiding rows can never feed back into the space it was given.
 */

/** The large portrait wall, the same query that sets the wall's reading scale in the stylesheet. */
export const wallQuery = "(min-width: 1000px) and (min-height: 1400px) and (orientation: portrait)";
/** Most rows a fill panel renders before measuring which of them fit. */
export const FILL_ROW_CAP = 20;
/** Rows Latest events keeps when it fills the space, so a busy day can take room from it. Lists keep their usual three. */
export const FILL_REQUIRED_ACTIVITY_ROWS = 3;
/** Below this much free space (a heading plus three rows), the fill section keeps its usual length and the board scrolls as before. */
export const FILL_MINIMUM_REM = 16;

export interface WallGeometry {
  /** Top of the fixed dock, in viewport pixels. */
  dockTop: number;
  /** Top of the board in document pixels (viewport top plus scroll). */
  boardTop: number;
  boardHeight: number;
  /** Height of the row holding the fill section; subtracted so the result never depends on it. */
  fillRowHeight: number;
  /** Space kept between the board and the dock. */
  gap: number;
  minimum: number;
}

/** The height the fill row should take, or undefined when the rest of the board leaves too little room. */
export function wallFillHeight({ dockTop, boardTop, boardHeight, fillRowHeight, gap, minimum }: WallGeometry) {
  const free = Math.floor(dockTop - gap - boardTop - (boardHeight - fillRowHeight));
  return free >= minimum ? free : undefined;
}

const inFlow = (element: Element) => !(element as HTMLElement).hidden && !["absolute", "fixed"].includes(getComputedStyle(element).position);
function contentBottom(panel: HTMLElement) {
  let bottom = panel.getBoundingClientRect().top;
  for (const child of panel.children) if (inFlow(child)) bottom = Math.max(bottom, child.getBoundingClientRect().bottom);
  return bottom;
}

/**
 * Shows the extra rows (`[data-fill-extra]`) of a fill panel that end inside `height` from the panel's top, taking them in turn from each
 * `[data-fill-group]` (one list per person) so no group hogs the space, and hides the rest from layout and assistive technology.
 * Rows that are not extra always stay. Returns the rows that became visible.
 */
export function fitFillRows(panel: HTMLElement, height: number) {
  const extras = [...panel.querySelectorAll<HTMLElement>("[data-fill-extra]")];
  const before = new Map(extras.map(row => [row, row.hidden]));
  for (const row of extras) row.hidden = true;
  const style = getComputedStyle(panel);
  const limit = panel.getBoundingClientRect().top + height - (parseFloat(style.paddingBottom) || 0) - (parseFloat(style.borderBottomWidth) || 0) + .5;
  const groups = new Map<Element, HTMLElement[]>();
  for (const row of extras) {
    const group = row.parentElement?.closest("[data-fill-group]") ?? panel;
    groups.set(group, [...groups.get(group) ?? [], row]);
  }
  const queues = [...groups.values()];
  fit: for (let rank = 0; queues.some(queue => queue.length > rank); rank++) {
    for (const queue of queues) {
      const row = queue[rank];
      if (!row) continue;
      row.hidden = false;
      if (contentBottom(panel) > limit) { row.hidden = true; break fit; }
    }
  }
  return extras.filter(row => before.get(row) && !row.hidden);
}

/** Shows every extra row again, for when the panel stops filling. */
export function showFillRows(panel: HTMLElement) {
  for (const row of panel.querySelectorAll<HTMLElement>("[data-fill-extra]")) row.hidden = false;
}
