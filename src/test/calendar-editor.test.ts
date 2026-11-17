import { expect, it } from "vitest";
import { newPlanTimes, shiftedPlanEnd } from "@/lib/calendar-editor";

it("starts today at the next half hour and future dates at nine", () => {
  expect(newPlanTimes("2026-11-17", "2026-11-17", "10:05")).toEqual({ start: { date: "2026-11-17", time: "10:30" }, end: { date: "2026-11-17", time: "11:30" } });
  expect(newPlanTimes("2026-11-18", "2026-11-17", "23:45").start).toEqual({ date: "2026-11-18", time: "09:00" });
  expect(newPlanTimes("2026-12-31", "2026-12-31", "23:45")).toEqual({ start: { date: "2027-01-01", time: "00:00" }, end: { date: "2027-01-01", time: "01:00" } });
});
it("preserves duration and seconds across dates without changing incomplete input", () => {
  expect(shiftedPlanEnd("2026-11-17", "23:00", "2026-11-18", "01:00", "2026-11-18", "10:00")).toEqual({ date: "2026-11-18", time: "12:00" });
  expect(shiftedPlanEnd("2026-11-17", "10:00:15", "2026-11-17", "11:00:30", "2026-11-17", "12:00:00")).toEqual({ date: "2026-11-17", time: "13:00:15" });
  expect(shiftedPlanEnd("2026-11-17", "10:00", "2026-11-17", "", "2026-11-18", "10:00")).toBeUndefined();
  expect(shiftedPlanEnd("2026-11-17", "10:00", "2026-11-17", "11:00", "", "10:00")).toBeUndefined();
});
