import { cleanup } from "@testing-library/react";
import { vi } from "vitest";

const maxDrainRounds = 100;

/**
 * Leaves fake timers without stranding work they queued. jsdom drives
 * requestAnimationFrame from a Node interval, so under fake timers that interval
 * is fake too; discarding it with a bare `vi.useRealTimers()` leaves jsdom and
 * Motion's shared frame loop waiting for a frame that never comes, and later
 * animations in the same file never finish. Unmount first, run what is still
 * queued, then switch back.
 */
export function restoreRealTimers() {
  if (!vi.isFakeTimers()) return;
  try {
    cleanup();
    for (let round = 0; vi.getTimerCount() > 0; round++) {
      if (round === maxDrainRounds) throw new Error(`${vi.getTimerCount()} fake timers were still rescheduling after unmount and ${maxDrainRounds} drain rounds. Clear the interval or loop that keeps them alive.`);
      vi.runOnlyPendingTimers();
    }
  } finally {
    vi.useRealTimers();
  }
}
