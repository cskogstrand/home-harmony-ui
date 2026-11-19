import { useEffect, useRef } from "react";
import { usePageActive } from "@/contexts/PageActivityContext";

export function useRevealSelection<T extends HTMLElement>(selection: string, optionCount?: number) {
  const row = useRef<T>(null);
  const active = usePageActive();
  useEffect(() => {
    const container = row.current;
    const item = container?.querySelector<HTMLElement>('[aria-current="page"], [aria-pressed="true"], [data-active="true"]');
    if (!active || !container || !item) return;
    const reveal = () => {
      if (container.scrollWidth <= container.clientWidth) return;
      const bounds = container.getBoundingClientRect();
      const target = item.getBoundingClientRect();
      // Move only this row. Scrolling the page would pull the reader away from the content.
      if (target.left < bounds.left) container.scrollLeft += target.left - bounds.left;
      else if (target.right > bounds.right) container.scrollLeft += target.right - bounds.right;
    };
    reveal();
    if (!window.ResizeObserver) return;
    const observer = new ResizeObserver(reveal);
    observer.observe(container);
    observer.observe(item);
    return () => observer.disconnect();
  }, [active, selection, optionCount]);
  return row;
}
