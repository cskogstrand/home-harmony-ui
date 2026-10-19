import { useEffect } from "react";

// Capture before React handles an action, including controls rendered in portals.
export function useMotionInput() {
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => { root.dataset.motionInput = "pointer"; };
    const keyboard = () => { root.dataset.motionInput = "keyboard"; };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", keyboard, true);
      delete root.dataset.motionInput;
    };
  }, []);
}
