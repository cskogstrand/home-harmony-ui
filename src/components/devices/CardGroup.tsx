import { useLayoutEffect, useRef, type ReactNode } from "react";
import { groupedCardHeights } from "@/lib/smart-home-cards";

export function CardGroup({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cards = [...grid.querySelectorAll<HTMLElement>(":scope > .dg-card")];
        const heights = cards.map(card => {
          const style = getComputedStyle(card);
          return [...card.children].reduce((height, child) => {
            const css = getComputedStyle(child);
            return height + child.getBoundingClientRect().height + parseFloat(css.marginTop) + parseFloat(css.marginBottom);
          }, parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth));
        });
        const singleColumn = getComputedStyle(grid).gridTemplateColumns.split(" ").length === 1;
        groupedCardHeights(heights).forEach((height, index) => { cards[index].style.minHeight = singleColumn ? "" : `${Math.ceil(height)}px`; });
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    grid.querySelectorAll(":scope > .dg-card > *").forEach(child => observer.observe(child));
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [children]);
  return <div ref={ref} className="smart-device-grid">{children}</div>;
}
