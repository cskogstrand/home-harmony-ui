import { addMonths, format, parseISO } from "date-fns";
import { addDays, homeDate, isPlannerDate, sortEvents, weekStart, type FamilyEvent, type TodoListKind } from "@/contexts/FamilyContext";
import { calendarBoundary, calendarDateValue, calendarTimeInput } from "./ha-model";
import type { CalendarEvent, TodoItem } from "@/types/api";
import { todoDueInput } from "./todo-items";

export type CalendarView = "month" | "week" | "day";

export function moveCalendarDate(date: string, view: CalendarView, direction: -1 | 1) {
  return view === "month" ? format(addMonths(parseISO(date), direction), "yyyy-MM-dd") : addDays(date, direction * (view === "week" ? 7 : 1));
}

export function calendarRange(date: string, view: CalendarView, startDay: "today" | "monday") {
  if (view === "month") {
    const first = `${date.slice(0, 7)}-01`;
    const last = addDays(moveCalendarDate(first, "month", 1), -1);
    return { start: weekStart(first), end: addDays(weekStart(last), 7) };
  }
  const start = view === "week" && startDay === "monday" ? weekStart(date) : date;
  return { start, end: addDays(start, view === "week" ? 7 : 1) };
}

export function uniqueCalendarPlans(events: FamilyEvent[]) {
  const seen = new Set<string>();
  return events.filter(event => {
    const id = event.calendarSpan?.id ?? event.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function todoPlans(items: TodoItem[], list: string, kind: TodoListKind, member: string, start: string, end: string, timeZone: string): FamilyEvent[] {
  return items.flatMap(item => {
    const due = todoDueInput(item.due, timeZone), date = due.slice(0, 10);
    if (item.status === "completed" || !due || date < start || date >= end) return [];
    return [{ id: JSON.stringify(["todo", list, item.uid]), todo: { list, kind }, member, date,
      allDay: !due.includes("T"), time: due.slice(11, 16) || "00:00",
      title: item.summary, location: "", note: item.description ?? "" }];
  });
}

export function weekEventRows(events: FamilyEvent[], start: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const spans = uniqueCalendarPlans(sortEvents(events.filter(event => event.date >= start && event.date <= days[6])))
    .map(event => {
      const lastDay = event.calendarSpan?.lastDay ?? event.date;
      return { event, start: days.indexOf(event.date), end: lastDay > days[6] ? 7 : days.indexOf(lastDay) + 1 };
    })
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const rows: typeof spans[] = [[]];
  for (const span of spans) {
    const row = rows.find(row => !row.length || row[row.length - 1].end <= span.start);
    if (row) row.push(span);
    else rows.push([span]);
  }
  return rows;
}

// Expand only the visible range; HA end dates/times are exclusive, including midnight.
export function calendarPlans(event: CalendarEvent, calendarId: string, member: string, start: string, end: string, timeZone: string, index: number): FamilyEvent[] {
  const from = calendarDateValue(event.start), to = calendarDateValue(event.end);
  const allDay = isPlannerDate(from);
  const startTime = Date.parse(allDay ? calendarBoundary(from, timeZone) : from);
  const endTime = Date.parse(isPlannerDate(to) ? calendarBoundary(to, timeZone) : to);
  const firstDay = allDay ? from : homeDate(new Date(startTime), timeZone);
  const lastDay = isPlannerDate(to) ? addDays(to, -1) : homeDate(new Date(endTime - 1), timeZone);
  const calendarSpan = { id: JSON.stringify([calendarId, event.uid ?? index, event.recurrence_id ?? "", from]), firstDay, lastDay };
  const endInput = allDay ? "" : calendarTimeInput(event.end, timeZone);
  const plans: FamilyEvent[] = [];
  for (let day = start; day < end; day = addDays(day, 1)) {
    if (startTime >= Date.parse(calendarBoundary(addDays(day, 1), timeZone)) || endTime <= Date.parse(calendarBoundary(day, timeZone))) continue;
    plans.push({ id: `${calendarSpan.id}:${day}`, calendarId, calendarEvent: event, calendarSpan, member, date: day, allDay, continues: day > firstDay,
      time: allDay || day > firstDay ? "00:00" : new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(startTime)),
      endTime: allDay ? undefined : endInput.slice(11, 16), endDate: allDay ? undefined : endInput.slice(0, 10),
      title: event.summary, location: event.location ?? "", note: event.description ?? "" });
  }
  return plans;
}
