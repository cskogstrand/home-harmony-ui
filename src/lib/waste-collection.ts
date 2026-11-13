import { calendarTimeInput } from "./ha-model";
import type { CalendarEvent } from "@/types/api";

// Collection calendars can have misleading times and ends; only the local start date counts.
export const wasteCollectionDate = (event: CalendarEvent, timeZone: string) => calendarTimeInput(event.start, timeZone).slice(0, 10);
export const isWasteCollected = (date: string, today: string, time: string) => date === today && time >= "09:00";
