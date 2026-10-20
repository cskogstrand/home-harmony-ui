import { useEffect, useMemo, useRef, useState } from "react";

type ItemSnapshot = { id: string; text: string; complete: boolean };
export type ItemFeedback = "added" | "edited" | "completed" | "reopened";

export function useListItemFeedback(items: ItemSnapshot[] | null) {
  const previousItems = useRef<Map<string, ItemSnapshot> | null>(null);
  const [feedback, setFeedback] = useState(new Map<string, ItemFeedback>());
  const currentItems = useMemo(() => items && new Map(items.map(item => [item.id, item])), [items]);
  const { changes, activeFeedback } = useMemo(() => {
    const changes = new Map<string, ItemFeedback>();
    if (previousItems.current && currentItems) {
      for (const item of currentItems.values()) {
        const before = previousItems.current.get(item.id);
        if (!before) changes.set(item.id, "added");
        else if (before.complete !== item.complete) changes.set(item.id, item.complete ? "completed" : "reopened");
        else if (before.text !== item.text) changes.set(item.id, "edited");
      }
    }
    return { changes, activeFeedback: new Map([...feedback, ...changes].filter(([id]) => currentItems?.has(id))) };
  }, [currentItems, feedback]);

  useEffect(() => {
    const previous = previousItems.current;
    previousItems.current = currentItems;
    // Initial loads and reconnects establish a baseline, not a list of additions.
    if (!previous || !currentItems) {
      if (previous) setFeedback(new Map());
      return;
    }
    if (changes.size) setFeedback(activeFeedback);
  }, [currentItems, changes.size, activeFeedback]);

  useEffect(() => {
    if (!feedback.size) return;
    const timer = window.setTimeout(() => setFeedback(new Map()), 800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  return activeFeedback;
}
