import { isPlannerDate } from "../../shared/configuration";

const wallTime = (date: string, time: string) => isPlannerDate(date) && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time) ? Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}Z`) : NaN;
const fields = (value: number) => ({ date: new Date(value).toISOString().slice(0, 10), time: new Date(value).toISOString().slice(11, 16) });

export function newPlanTimes(date: string, today: string, time: string) {
  const current = wallTime(date, date === today ? time : "09:00");
  const start = date === today ? (Math.floor(current / 1_800_000) + 1) * 1_800_000 : current;
  return { start: fields(start), end: fields(start + 3_600_000) };
}

export function shiftedPlanEnd(date: string, time: string, endDate: string, endTime: string, nextDate: string, nextTime: string) {
  const duration = wallTime(endDate, endTime) - wallTime(date, time);
  const next = wallTime(nextDate, nextTime) + duration;
  if (!Number.isFinite(next) || duration < 0) return undefined;
  const result = fields(next);
  if (!isPlannerDate(result.date)) return undefined;
  return { ...result, time: endTime.length === 8 ? new Date(next).toISOString().slice(11, 19) : result.time };
}
