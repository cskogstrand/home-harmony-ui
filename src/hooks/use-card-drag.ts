import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

interface DropTarget { group: string; beforeId?: string }
function targetAt(x: number, y: number): DropTarget | null {
  const hit = document.elementFromPoint(x, y);
  const group = hit?.closest<HTMLElement>("[data-smart-group]");
  if (!group) return null;
  const item = hit.closest<HTMLElement>("[data-smart-card]");
  if (!item) return { group: group.dataset.smartGroup! };
  const rect = item.getBoundingClientRect();
  const singleColumn = getComputedStyle(item.parentElement!).gridTemplateColumns.split(" ").length === 1;
  const after = singleColumn ? y > rect.top + rect.height / 2 : x > rect.left + rect.width / 2;
  const next = after ? item.nextElementSibling as HTMLElement | null : item;
  return { group: group.dataset.smartGroup!, beforeId: next?.dataset.smartCard };
}

export function useCardDrag(enabled: boolean, onMove: (id: string, group: string, beforeId?: string) => void) {
  const pointer = useRef<{ id: string; pointerId: number; startX: number; startY: number; x: number; y: number; active: boolean } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number; target: DropTarget | null } | null>(null);
  const cancel = useCallback(() => { pointer.current = null; setDragging(null); }, []);
  useEffect(() => { if (!enabled) { pointer.current = null; setDragging(null); } }, [enabled]);
  const active = !!dragging;
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const scroll = () => {
      const p = pointer.current;
      if (!p) return;
      const delta = p.y < 90 ? -12 : p.y > window.innerHeight - 120 ? 12 : 0;
      if (delta) {
        window.scrollBy(0, delta);
        const target = targetAt(p.x, p.y);
        setDragging(current => current && current.target?.group === target?.group && current.target?.beforeId === target?.beforeId ? current : { id: p.id, x: p.x, y: p.y, target });
      }
      frame = requestAnimationFrame(scroll);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    frame = requestAnimationFrame(scroll);
    window.addEventListener("keydown", escape);
    window.addEventListener("blur", cancel);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", escape); window.removeEventListener("blur", cancel); };
  }, [active, cancel]);
  return { dragging, cancel,
    start: (id: string, event: PointerEvent<HTMLButtonElement>) => {
      if (!enabled || event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointer.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false };
    },
    move: (event: PointerEvent<HTMLButtonElement>) => {
      const p = pointer.current;
      if (!p || p.pointerId !== event.pointerId) return;
      p.x = event.clientX; p.y = event.clientY;
      if (!p.active && Math.hypot(p.x - p.startX, p.y - p.startY) < 6) return;
      p.active = true;
      setDragging({ id: p.id, x: p.x, y: p.y, target: targetAt(p.x, p.y) });
    },
    drop: (event: PointerEvent<HTMLButtonElement>) => {
      const p = pointer.current;
      if (enabled && p?.active && p.pointerId === event.pointerId) {
        const target = targetAt(event.clientX, event.clientY);
        if (target) onMove(p.id, target.group, target.beforeId);
      }
      cancel();
    },
  };
}
