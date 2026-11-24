import type { Entity } from "@/types/api";

/** One market interval: start and end in epoch milliseconds, price per kWh in the sensor's currency. */
export interface PriceSlot { start: number; end: number; price: number }

/** Sensors offered in Settings: a price per kWh or a monetary reading. The owner decides which one to use. */
export function isPriceSensor(entity: Entity) {
  if (entity.domain !== "sensor") return false;
  const unit = String(entity.attributes.unit_of_measurement ?? "").trim();
  return /\/\s*kWh$/i.test(unit) || entity.attributes.device_class === "monetary";
}

/** The currency in a "EUR/kWh"-style unit, or the whole unit when it names none. */
export function priceCurrency(unit: unknown) {
  const text = String(unit ?? "").trim();
  return text.replace(/\s*\/\s*kWh$/i, "") || text;
}

const nordPoolSlot = (value: unknown): PriceSlot | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const { start, end, price } = value as Record<string, unknown>;
  const from = typeof start === "string" ? Date.parse(start) : NaN, to = typeof end === "string" ? Date.parse(end) : NaN;
  // Nord Pool reports prices per MWh; the dashboard shows them per kWh like the sensors.
  return Number.isFinite(from) && Number.isFinite(to) && to > from && typeof price === "number" && Number.isFinite(price) ? { start: from, end: to, price: price / 1000 } : undefined;
};

/**
 * Reads a `nordpool.get_prices_for_date` response. It is keyed by price area; the area code is taken from the
 * sensor's unique ID (for example "XX1-current_price"), or the only area when the entry has one.
 */
export function nordPoolSlots(response: unknown, uniqueId = ""): PriceSlot[] {
  if (!response || typeof response !== "object" || Array.isArray(response)) return [];
  const areas = Object.keys(response);
  const segments = uniqueId.split("-");
  const area = areas.find(code => segments.includes(code)) ?? (areas.length === 1 ? areas[0] : undefined);
  const list = area ? (response as Record<string, unknown>)[area] : undefined;
  return Array.isArray(list) ? list.flatMap(item => nordPoolSlot(item) ?? []) : [];
}

/** Sorted, without duplicate starts (today's and tomorrow's answers may overlap at midnight). */
export function mergeSlots(...series: PriceSlot[][]) {
  const byStart = new Map<number, PriceSlot>();
  for (const slot of series.flat()) byStart.set(slot.start, slot);
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

/** The local calendar date (YYYY-MM-DD) of an instant in the home time zone. */
export function localDate(time: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(time));
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}

/** The calendar date after a YYYY-MM-DD date. */
export function nextDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

/** Slots that start on a local date. A daylight-saving change day has 23 or 25 hours of them. */
export function slotsOnDate(slots: PriceSlot[], date: string, timeZone: string) {
  return slots.filter(slot => localDate(slot.start, timeZone) === date);
}

export function currentSlot(slots: PriceSlot[], now: number) {
  return slots.find(slot => slot.start <= now && now < slot.end);
}

/**
 * The cheapest unbroken window of `hours` that starts at or after the current interval and ends within
 * `horizonHours` from now, by time-weighted average. Display only: nothing is scheduled or started.
 */
export function cheapestWindow(slots: PriceSlot[], now: number, hours = 3, horizonHours = 24) {
  const length = hours * 3600000, limit = now + horizonHours * 3600000;
  const upcoming = slots.filter(slot => slot.end > now && slot.start < limit);
  let best: { start: number; end: number; average: number } | undefined;
  for (let first = 0; first < upcoming.length; first++) {
    const start = upcoming[first].start, end = start + length;
    if (end > limit) break;
    let cost = 0, covered = start;
    for (let index = first; index < upcoming.length && covered < end; index++) {
      const slot = upcoming[index];
      if (slot.start !== covered) break; // a gap in the series: no complete window from here
      const until = Math.min(slot.end, end);
      cost += slot.price * (until - covered);
      covered = until;
    }
    if (covered < end) continue;
    const average = cost / length;
    if (!best || average < best.average) best = { start, end, average };
  }
  return best;
}
