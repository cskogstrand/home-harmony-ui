import { useLayoutEffect, useRef, type ReactNode } from "react";
import { rowCardHeights } from "@/lib/smart-home-cards";

export function CardGroup({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const items = [...grid.querySelectorAll<HTMLElement>(":scope > .smart-card-item")];
        const cards = items.map(item => item.querySelector<HTMLElement>(".dg-card")!);
        const heights = cards.map((card, index) => {
          const style = getComputedStyle(card);
          const height = [...card.children].reduce((height, child) => {
            const css = getComputedStyle(child);
            return height + child.getBoundingClientRect().height + parseFloat(css.marginTop) + parseFloat(css.marginBottom);
          }, parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth));
          return { top: items[index].offsetTop, height };
        });
        const singleColumn = getComputedStyle(grid).gridTemplateColumns.split(" ").length === 1;
        rowCardHeights(heights).forEach((height, index) => { cards[index].style.minHeight = singleColumn ? "" : `${Math.ceil(height)}px`; });
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    grid.querySelectorAll(".dg-card > *, :scope > .smart-card-item").forEach(child => observer.observe(child));
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [children]);
  return <div ref={ref} className="smart-device-grid">{children}</div>;
}
