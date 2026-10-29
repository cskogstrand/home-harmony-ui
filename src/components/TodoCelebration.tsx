import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";

export function TodoCelebration({ origin, wholeList = false, onComplete }: { origin: { x: number; y: number }; wholeList?: boolean; onComplete: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const duration = wholeList ? reduceMotion ? 1600 : 2080 : reduceMotion ? 160 : 1600;
    const { width, height } = root.getBoundingClientRect();
    const animations = Array.from(root.querySelectorAll("i"), (child, index) => {
      const angle = Math.PI + (index / 31) * Math.PI;
      const spread = Math.cos(angle) * (120 + index % 5 * 24);
      const lift = Math.sin(angle) * (220 + index % 4 * 35) - 70;
      const frames = reduceMotion ? [{ opacity: 1 }, { opacity: 0 }] : Array.from({ length: 17 }, (_, step) => {
        const progress = step / 16;
        const x = wholeList ? (index % 2 ? width : 0) + (index % 2 ? -1 : 1) * width * (.2 + index % 16 / 20) * progress * (2 - progress) : spread * progress * (2 - progress);
        const y = wholeList ? height * (.9 - (2.4 + index % 5 / 10) * progress + 2.7 * progress ** 2) : lift * progress + 280 * progress ** 2;
        return { offset: progress, transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${(index % 2 ? 1 : -1) * (300 + index % 4 * 90) * progress}deg)`, opacity: Math.min(1, (1 - progress) / .3) };
      });
      return child.animate?.(frames, { duration: wholeList ? 1600 : duration, delay: wholeList ? Math.floor(index / 32) * 240 : 0, easing: "linear", fill: "both" });
    });
    const message = root.querySelector(".todo-celebration-message");
    if (message) {
      const easing = getComputedStyle(root).getPropertyValue("--ease-out").trim() || "cubic-bezier(0.23, 1, 0.32, 1)";
      const resting = reduceMotion ? {} : { transform: "scale(1)" };
      const away = reduceMotion ? {} : { transform: "scale(.95)" };
      animations.push(message.animate?.([
        { opacity: 0, ...away, offset: 0, easing },
        { opacity: 1, ...resting, offset: (reduceMotion ? 160 : 240) / duration },
        { opacity: 1, ...resting, offset: 1 - 160 / duration, easing },
        { opacity: 0, ...away, offset: 1 },
      ], { duration, fill: "both" }));
      if (!reduceMotion) {
        animations.push(message.querySelector("svg")?.animate?.([
          { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" },
        ], { duration: 800, delay: 60, easing: "ease-in", fill: "both" }));
        animations.push(message.querySelector("strong")?.animate?.([
          { opacity: 0, transform: "translateY(15%) scale(.95)" },
          { opacity: 1, transform: "translateY(0%) scale(1)" },
        ], { duration: 240, delay: 240, easing, fill: "both" }));
      }
    }
    let active = true;
    const finish = () => { if (active) onComplete(); };
    const running = animations.filter((animation): animation is Animation => !!animation);
    const timer = running.length ? undefined : window.setTimeout(finish, duration);
    if (running.length) void Promise.all(running.map(animation => animation.finished)).then(finish, finish);
    return () => { active = false; window.clearTimeout(timer); running.forEach(animation => animation.cancel()); };
  }, [origin, wholeList, reduceMotion, onComplete]);
  // A portal lets confetti escape the list's clipping without shifting its rows.
  const celebration = <div ref={ref} className={`todo-celebration${wholeList ? " todo-celebration-list" : ""}${reduceMotion ? " todo-celebration-reduced" : ""}`} style={wholeList ? undefined : { left: origin.x, top: origin.y }} aria-hidden="true">
    {Array.from({ length: reduceMotion ? wholeList ? 0 : 1 : wholeList ? 96 : 32 }, (_, index) => <i key={index} />)}
    {wholeList && <div className="todo-celebration-message glass-surface"><Check aria-hidden="true" /><strong>{t("All done!")}</strong><span>{t("Every item, checked.")}</span></div>}
  </div>;
  return wholeList ? celebration : createPortal(celebration, document.body);
}
