import { useCallback, useSyncExternalStore } from "react";

/** Whether a CSS media query matches, following later changes such as rotation or resizing. */
export function useMediaQuery(query: string) {
  const subscribe = useCallback((notify: () => void) => {
    const list = window.matchMedia?.(query);
    list?.addEventListener?.("change", notify);
    return () => list?.removeEventListener?.("change", notify);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(query).matches ?? false, () => false);
}

/** The phone layout breakpoint shared with the stylesheet's `max-width: 699px` rules. */
export const phoneQuery = "(max-width: 699px)";
