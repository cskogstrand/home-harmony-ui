import { createI18n } from "@/lib/i18n";
import { createContext, useContext } from "react";
import { z } from "zod";
import { getISOWeek } from "date-fns";
import type { CalendarEvent } from "@/types/api";
import { calendarSettingsSchema, eventSchema, itemSchema, memberSchema, type CardDensity, type Configuration, type Planner, type TimetableSettings, type DeviceCardSettings } from "../../shared/configuration";
export { isPlannerDate } from "../../shared/configuration";

export interface FamilyMember { id: string; name: string; initials: string; color: string; picture?: string }
export const newPlannerId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export type FamilyState = Planner & { events: FamilyEvent[]; items: ListItem[] };
export type CalendarSettings = z.infer<typeof calendarSettingsSchema>;
export type FamilyEvent = z.infer<typeof eventSchema> & {
  calendarId?: string; calendarEvent?: CalendarEvent; allDay?: boolean; continues?: boolean; endDate?: string;
  calendarSpan?: { id: string; firstDay: string; lastDay: string };
};
export type ListItem = z.infer<typeof itemSchema>;
export type MemberId = z.infer<typeof memberSchema>;
export type ListKind = ListItem["kind"];

export function homeDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function weekStart(date: string) {
  return addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
}
export function weekNumber(date: string) {
  return getISOWeek(new Date(`${date}T12:00:00`));
}
export const { dateLabel, eventTimeLabel } = createI18n("en");
export const itemIsDone = (item: ListItem, today: string) => item.kind === "daily" ? item.completedOn === today : item.done;
export const sortEvents = (events: FamilyEvent[]) => [...events].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

interface FamilyContextValue extends FamilyState {
  members: FamilyMember[]; allMembers: FamilyMember[]; memberName: (id: MemberId) => string; connectedPlanner: boolean;
  memberColor: (id: MemberId) => string;
  now: Date; today: string; time: string; saved: boolean;
  calendarStart: string;
  exportConfiguration: () => Configuration;
  importConfiguration: (configuration: Configuration) => Promise<void>;
  setLanguage: (language: Planner["language"]) => boolean;
  setAppearance: (settings: Partial<Planner["appearance"]>) => boolean;
  setDashboard: (settings: Partial<Planner["dashboard"]>) => boolean;
  setNotifications: (settings: Partial<Planner["notifications"]>) => boolean;
  setSelectedAlarm: (id: string) => boolean;
  setWeatherEntity: (id: string) => boolean;
  setWasteCalendarEntity: (id: string) => boolean;
  setWasteCollectionDays: (days: number) => boolean;
  setWeatherTemperatureEntity: (id: string) => boolean;
  setWeatherPlacement: (settings: Partial<Planner["weatherPlacement"]>) => boolean;
  setCalendarSettings: (settings: Partial<CalendarSettings>) => void;
  compareMembers: (a: MemberId, b: MemberId) => number;
  moveMember: (id: MemberId, direction: -1 | 1) => void;
  isMemberVisible: (id: MemberId) => boolean;
  setMemberVisible: (id: MemberId, visible: boolean) => void;
  setMemberColor: (id: MemberId, color: string) => boolean;
  setHomeEntities: (ids: string[]) => boolean;
  saveSmartHomeCard: (card: DeviceCardSettings) => boolean;
  removeSmartHomeCard: (id: string) => boolean;
  clearSmartHome: () => boolean;
  setSmartHomeCardDensity: (id: string, density: CardDensity) => boolean;
  moveSmartHomeCard: (id: string, group: string, beforeId?: string) => boolean;
  setCalendarMember: (calendar: string, member: string) => void;
  setTodoList: (kind: ListKind, member: MemberId, list: string) => void;
  saveEvent: (event: FamilyEvent) => boolean;
  deleteEvent: (id: string) => boolean;
  addItem: (text: string, kind: ListKind, member: MemberId) => boolean;
  renameItem: (id: string, text: string) => boolean;
  toggleItem: (id: string) => boolean;
  deleteItem: (id: string) => boolean;
  setTimetable: (child: MemberId, urls: string[]) => boolean;
  setTimetableSettings: (member: MemberId, settings: Partial<TimetableSettings>) => boolean;
  hasTimetable: (member: MemberId) => boolean;
  setTimetableEnabled: (member: MemberId, enabled: boolean) => void;
}
export const FamilyContext = createContext<FamilyContextValue | null>(null);
export function useFamily() {
  const value = useContext(FamilyContext);
  if (!value) throw new Error("useFamily must be used within FamilyProvider");
  return value;
}
