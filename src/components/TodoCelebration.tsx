import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";

export function TodoCelebration({ origin, onComplete }: { origin: { x: number; y: number }; onComplete: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const duration = reduceMotion ? 160 : 1600;
    const animations = Array.from(root.children, (child, index) => {
      const angle = Math.PI + (index / 31) * Math.PI;
      const spread = Math.cos(angle) * (120 + index % 5 * 24);
      const lift = Math.sin(angle) * (220 + index % 4 * 35) - 70;
      const frames = reduceMotion ? [{ opacity: 1 }, { opacity: 0 }] : Array.from({ length: 17 }, (_, step) => {
        const progress = step / 16;
        const x = spread * progress * (2 - progress), y = lift * progress + 280 * progress ** 2;
        return { offset: progress, transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${(index % 2 ? 1 : -1) * (300 + index % 4 * 90) * progress}deg)`, opacity: Math.min(1, (1 - progress) / .3) };
      });
      return child.animate?.(frames, { duration, easing: "linear", fill: "forwards" });
    });
    let active = true;
    const finish = () => { if (active) onComplete(); };
    const running = animations.filter((animation): animation is Animation => !!animation);
    const timer = running.length ? undefined : window.setTimeout(finish, duration);
    if (running.length) void Promise.all(running.map(animation => animation.finished)).then(finish, finish);
    return () => { active = false; window.clearTimeout(timer); running.forEach(animation => animation.cancel()); };
  }, [origin, reduceMotion, onComplete]);
  // A portal lets confetti escape the list's clipping without shifting its rows.
  return createPortal(<div ref={ref} className={`todo-celebration${reduceMotion ? " todo-celebration-reduced" : ""}`} style={{ left: origin.x, top: origin.y }} aria-hidden="true">
    {Array.from({ length: reduceMotion ? 1 : 32 }, (_, index) => <i key={index} />)}
  </div>, document.body);
}
