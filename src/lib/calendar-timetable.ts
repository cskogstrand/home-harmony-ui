import { addDays, homeDate, isPlannerDate, sortEvents, weekStart, type FamilyEvent } from "@/contexts/FamilyContext";
import { calendarBoundary, calendarDateValue } from "./ha-model";
import { calendarPlans } from "./family-calendar";
import type { CalendarEvent } from "@/types/api";
import type { TimetableSettings } from "../../shared/configuration";

export interface TimetableSource {
  id: string;
  name: string;
  roles: TimetableSettings["calendars"][string];
  events: CalendarEvent[];
}
export type TimetableEvent = FamilyEvent & { role: "events" | "closures" | "hours" };

export function timetableEventIsCurrent(event: TimetableEvent, now: Date, today: string) {
  return event.date === today && !event.allDay && !!event.calendarEvent
    && Date.parse(calendarDateValue(event.calendarEvent.start)) <= now.getTime()
    && now.getTime() < Date.parse(calendarDateValue(event.calendarEvent.end));
}

export function timetableWeek(today: string) {
  const monday = weekStart(today);
  return today >= addDays(monday, 5) ? addDays(monday, 7) : monday;
}

export function timetableDays(sources: TimetableSource[], start: string, timeZone: string, member: string) {
  const plans = sources.filter(source => source.roles.some(role => role !== "message")).flatMap(source => source.events.flatMap((event, index) =>
    calendarPlans(event, source.id, member, start, addDays(start, 5), timeZone, index)
      .map(plan => ({ ...plan, roles: source.roles }))));
  return Array.from({ length: 5 }, (_, index) => {
    const date = addDays(start, index);
    const day = plans.filter(plan => plan.date === date);
    const closed = day.some(plan => plan.roles.includes("closures"));
    const popupClosed = day.some(plan => plan.roles.includes("popupClosures"));
    const eventsFor = (roles: TimetableSource["roles"], isClosed = false) => {
      const unique = new Map<string, TimetableEvent>();
      for (const event of day) {
        const selected = event.roles.filter(role => roles.includes(role));
        if (!selected.length) continue;
        const role = selected.includes("closures") || selected.includes("popupClosures") ? "closures" : selected.includes("hours") || selected.includes("popupHours") ? "hours" : "events";
        if (isClosed && role === "hours") continue;
        const plan: TimetableEvent = { ...event, role };
        // Invitations can repeat across calendars with different UIDs and descriptions.
        const key = JSON.stringify([plan.title.trim(), plan.time, plan.endTime, plan.endDate, plan.allDay, plan.location.trim()]);
        const previous = unique.get(key);
        if (!previous || previous.calendarId === plan.calendarId) unique.set(previous ? `${key}:${plan.id}` : key, plan);
        else unique.set(key, { ...previous, note: previous.note.length >= plan.note.length ? previous.note : plan.note,
          role: plan.role === "closures" ? "closures" : previous.role });
      }
      return sortEvents([...unique.values()]) as TimetableEvent[];
    };
    return { date, closed, events: eventsFor(["events", "closures", "hours"], closed), popup: {
      activities: eventsFor(["popupActivities"]), meetings: eventsFor(["popupMeetings"]),
      hours: eventsFor(["popupHours", "popupClosures"], popupClosed), messages: eventsFor(["popupMessages"]),
    } };
  });
}

export function timetableMessages(sources: TimetableSource[], today: string, timeZone: string, member: string) {
  const midnight = Date.parse(calendarBoundary(today, timeZone));
  const tomorrow = Date.parse(calendarBoundary(addDays(today, 1), timeZone));
  const timestamp = (value: CalendarEvent["start"]) => {
    const text = calendarDateValue(value);
    return Date.parse(isPlannerDate(text) ? calendarBoundary(text, timeZone) : text);
  };
  return sources.filter(source => source.roles.includes("message")).map(source => {
    const eligible = source.events.filter(event => timestamp(event.end) > midnight && timestamp(event.end) > timestamp(event.start))
      .sort((a, b) => timestamp(a.start) - timestamp(b.start));
    const todays = eligible.filter(event => timestamp(event.start) < tomorrow);
    const nextDate = eligible.length ? homeDate(new Date(timestamp(eligible[0].start)), timeZone) : "";
    const date = todays.length ? today : nextDate;
    const events = todays.length ? todays : eligible.filter(event => homeDate(new Date(timestamp(event.start)), timeZone) === nextDate);
    const seen = new Set<string>();
    const messages = events.flatMap((event, index) => calendarPlans(event, source.id, member, date, addDays(date, 1), timeZone, index))
      .filter(event => {
        const key = JSON.stringify([event.title.trim(), event.note.trim()]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return { ...source, date, messages };
  });
}
