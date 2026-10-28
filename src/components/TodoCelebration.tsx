import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";

export function TodoCelebration({ origin, onComplete }: { origin: { x: number; y: number }; onComplete: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const duration = reduceMotion ? 160 : 240;
    const easing = getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "cubic-bezier(0.23, 1, 0.32, 1)";
    const animations = Array.from(root.children, (child, index) => {
      const angle = Math.PI + (index / 11) * Math.PI;
      const distance = 32 + index % 3 * 14;
      const x = Math.cos(angle) * distance, y = Math.sin(angle) * distance - 10;
      return child.animate?.(reduceMotion ? [{ opacity: 1 }, { opacity: 0 }] : [
        { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${index % 2 ? 160 : -160}deg)`, opacity: 0 },
      ], { duration, easing, fill: "forwards" });
    });
    const timer = window.setTimeout(onComplete, duration);
    return () => { window.clearTimeout(timer); animations.forEach(animation => animation?.cancel()); };
  }, [origin, reduceMotion, onComplete]);
  // A portal keeps the burst at the checkmark while its completed row moves away.
  return createPortal(<div ref={ref} className={`todo-celebration${reduceMotion ? " todo-celebration-reduced" : ""}`} style={{ left: origin.x, top: origin.y }} aria-hidden="true">
    {Array.from({ length: reduceMotion ? 1 : 12 }, (_, index) => <i key={index} />)}
  </div>, document.body);
}
