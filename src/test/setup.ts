import "@testing-library/jest-dom";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { restoreRealTimers } from "./timers";

configure({ asyncUtilTimeout: 5_000 });

// Runs after each test file's own afterEach hooks, so no test can leak into the next one through timers:
// - A test that leaves fake timers on fails here, after its timers are drained and restored so the following tests
//   still get working animation frames.
// - Radix restores focus from a setTimeout(0) after an open dialog unmounts. Let that callback run now; otherwise it
//   fires during the next test and moves focus into that test's dialog.
afterEach(async () => {
  const leftFakeTimers = vi.isFakeTimers();
  restoreRealTimers();
  cleanup();
  await new Promise(resolve => setTimeout(resolve, 0));
  if (leftFakeTimers) throw new Error("Fake timers were still active after the test. Call restoreRealTimers() from src/test/timers.ts in afterEach.");
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
