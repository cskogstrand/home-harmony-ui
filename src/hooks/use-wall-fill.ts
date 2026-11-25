import { useLayoutEffect, useState, type RefObject } from "react";
import { FILL_MINIMUM_REM, fitFillRows, showFillRows, wallFillHeight } from "@/lib/wall-fill";

/**
 * The height for Today's fill row on the large wall, measured from the board's top, the dock and every other row.
 * Re-measures when the board, the dock or the page above it changes size; returns undefined while disabled or without room.
 */
export function useWallFill(board: RefObject<HTMLElement | null>, enabled: boolean) {
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const element = board.current;
    if (!enabled || !element) return;
    const measure = () => {
      const row = element.querySelector<HTMLElement>(":scope > [data-fill-row]");
      const dock = document.querySelector<HTMLElement>(".app-dock");
      const box = element.getBoundingClientRect();
      // A retained page that is not shown has no layout; keep the last answer until it is visible again.
      if (!row || !dock || !box.height) return;
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const next = wallFillHeight({
        dockTop: dock.getBoundingClientRect().top, boardTop: box.top + window.scrollY, boardHeight: box.height,
        fillRowHeight: row.getBoundingClientRect().height, gap: parseFloat(getComputedStyle(element).rowGap) || 0, minimum: FILL_MINIMUM_REM * root,
      });
      setHeight(previous => previous === next ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const target of [element, document.body, document.querySelector(".app-dock")]) if (target) observer.observe(target);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [board, enabled]);
  return enabled ? height : undefined;
}

/**
 * Keeps a fill panel's extra rows (`[data-fill-extra]`) to those that fit in `height`, as content arrives or the panel resizes.
 * Only child-list and text changes are observed, so hiding rows never triggers another pass.
 */
export function useFillRows(panel: RefObject<HTMLElement | null>, height: number | undefined) {
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    if (height === undefined) { showFillRows(element); return; }
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const fit = () => {
      for (const row of fitFillRows(element, height)) if (!reduceMotion) row.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "cubic-bezier(.23, 1, .32, 1)" });
    };
    fit();
    const mutations = new MutationObserver(fit);
    mutations.observe(element, { childList: true, subtree: true, characterData: true });
    const sizes = new ResizeObserver(fit);
    sizes.observe(element);
    return () => { mutations.disconnect(); sizes.disconnect(); };
  }, [panel, height]);
}
