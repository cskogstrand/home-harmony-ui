import { expect, it, vi } from "vitest";
import { sourceFile, testSourceFiles } from "./source-file.mjs";
import { restoreRealTimers } from "./timers";

// Motion keeps the reference to jsdom's requestAnimationFrame it found at import time, and jsdom drives that from a
// Node interval that fake timers replace. Measure a real frame after leaving fake timers with a frame still queued.
const nextFrame = () => new Promise<"frame" | "stalled">(resolve => {
  const fallback = setTimeout(() => resolve("stalled"), 1_000);
  window.requestAnimationFrame(() => { clearTimeout(fallback); resolve("frame"); });
});

it("keeps animation frames running after fake timers are left with a frame still queued", async () => {
  vi.useFakeTimers();
  const queued = vi.fn();
  window.requestAnimationFrame(queued);
  restoreRealTimers();
  expect(queued).toHaveBeenCalledOnce();
  expect(vi.isFakeTimers()).toBe(false);
  expect(await nextFrame()).toBe("frame");
});

it("names a timer that keeps rescheduling instead of draining forever", () => {
  vi.useFakeTimers();
  const interval = setInterval(() => {}, 1_000);
  try {
    expect(() => restoreRealTimers()).toThrow("still rescheduling");
    expect(vi.isFakeTimers()).toBe(false);
  } finally { clearInterval(interval); }
});

it("leaves fake timers only through restoreRealTimers in tests", () => {
  const files: string[] = testSourceFiles([".ts", ".tsx", ".mjs"]);
  const offenders = files
    .filter(file => !["test/timers.ts", "test/timers.test.ts"].includes(file))
    .filter(file => /\bvi\.useRealTimers\(/.test(sourceFile(file)));
  expect(files.length).toBeGreaterThan(20);
  expect(offenders).toEqual([]);
});
