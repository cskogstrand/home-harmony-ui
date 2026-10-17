import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useApp } from "./AppContext";
import type { CalendarEvent } from "@/types/api";
import { SharedConfigurationProvider, useSharedConfiguration } from "./SharedConfigurationContext";
import { calendarSettingsSchema, eventSchema, itemSchema, memberSchema, plannerSettings, emptyPlanner, parseConfiguration, type Configuration, type Planner } from "../../shared/configuration";
export { isPlannerDate } from "../../shared/configuration";

const memberColors = ["#d2bd9e", "#aacbd0", "#cabbce", "#c7d29c"];
export interface FamilyMember { id: string; name: string; initials: string; color: string }
export const newPlannerId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
type FamilyState = Planner & { events: FamilyEvent[]; items: ListItem[] };
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
export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
export function eventTimeLabel(event: FamilyEvent) {
  if (event.allDay) return "All day";
  const start = event.continues ? "Continues" : event.time;
  if (!event.endTime) return start;
  const endDate = event.endDate && event.endDate !== event.date ? `${dateLabel(event.endDate)}, ` : "";
  return `${start} – ${endDate}${event.endTime}`;
}
export const itemIsDone = (item: ListItem, today: string) => item.kind === "daily" ? item.completedOn === today : item.done;
export const sortEvents = (events: FamilyEvent[]) => [...events].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

interface FamilyContextValue extends FamilyState {
  members: FamilyMember[]; allMembers: FamilyMember[]; memberName: (id: MemberId) => string; connectedPlanner: boolean;
  now: Date; today: string; time: string; saved: boolean;
  calendarStart: string;
  exportConfiguration: () => Configuration;
  importConfiguration: (configuration: Configuration) => Promise<void>;
  setAppearance: (settings: Partial<Planner["appearance"]>) => boolean;
  setSelectedAlarm: (id: string) => boolean;
  setCalendarSettings: (settings: Partial<CalendarSettings>) => void;
  compareMembers: (a: MemberId, b: MemberId) => number;
  moveMember: (id: MemberId, direction: -1 | 1) => void;
  isMemberVisible: (id: MemberId) => boolean;
  setMemberVisible: (id: MemberId, visible: boolean) => void;
  setHomeEntities: (ids: string[]) => boolean;
  setCalendarMember: (calendar: string, member: string) => void;
  setTodoList: (kind: ListKind, member: MemberId, list: string) => void;
  saveEvent: (event: FamilyEvent) => boolean;
  deleteEvent: (id: string) => boolean;
  addItem: (text: string, kind: ListKind, member: MemberId) => boolean;
  renameItem: (id: string, text: string) => boolean;
  toggleItem: (id: string) => boolean;
  deleteItem: (id: string) => boolean;
  setTimetable: (child: MemberId, urls: string[]) => boolean;
  hasTimetable: (member: MemberId) => boolean;
  setTimetableEnabled: (member: MemberId, enabled: boolean) => void;
}
const FamilyContext = createContext<FamilyContextValue | null>(null);
export function useFamily() {
  const value = useContext(FamilyContext);
  if (!value) throw new Error("useFamily must be used within FamilyProvider");
  return value;
}
export function FamilyProvider({ children }: { children: ReactNode }) {
  return <SharedConfigurationProvider><FamilyStore>{children}</FamilyStore></SharedConfigurationProvider>;
}
function FamilyStore({ children }: { children: ReactNode }) {
  const { currentHome } = useApp();
  const shared = useSharedConfiguration();
  const connectedPlanner = true;
  const availableMembers: FamilyMember[] = currentHome.entities.filter(e => e.domain === "person").map((person, index) => ({
    id: person.preferenceId, name: person.name,
    initials: person.name.split(/\s+/).map(part => part[0]).slice(0, 2).join(""),
    color: memberColors[index % memberColors.length],
  }));
  const [now, setNow] = useState(() => new Date());
  const today = homeDate(now, currentHome.timeZone);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: currentHome.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const planner: FamilyState = { ...(shared?.state.config.settings ?? emptyPlanner()), events: [], items: [] };
  const setPlanner = (change: (value: FamilyState) => FamilyState) => {
    try { shared.store.updateSettings(settings => plannerSettings(change({ ...settings, events: [], items: [] }))); return true; }
    catch (error) { toast.error(error instanceof Error ? error.message : "Configuration could not be saved."); return false; }
  };
  const rejectLocalContent = () => {
    toast.error("Use Home Assistant calendars and lists. App storage only saves settings.");
    return false;
  };
  useEffect(() => {
    document.documentElement.classList.toggle("dark", planner.appearance.theme === "dark");
    document.documentElement.style.colorScheme = planner.appearance.theme;
  }, [planner.appearance.theme]);
  const exportConfiguration = (): Configuration => shared.state.config;
  const importConfiguration = async (input: Configuration) => { await shared.store.replace(parseConfiguration(JSON.stringify(input))); };
  const memberIds = [...new Set([...planner.memberOrder, ...availableMembers.map(member => member.id)])].filter(id => id !== "everyone");
  const memberRanks = new Map(["everyone", ...memberIds].map((id, index) => [id, index]));
  const compareMembers = (a: MemberId, b: MemberId) => (memberRanks.get(a) ?? memberRanks.size) - (memberRanks.get(b) ?? memberRanks.size);
  const allMembers = availableMembers.sort((a, b) => compareMembers(a.id, b.id));
  const isMemberVisible = (id: MemberId) => id === "everyone" || !planner.hiddenMembers.includes(id);
  const members = allMembers.filter(member => isMemberVisible(member.id));
  const saved = shared.state.loaded && !shared.state.dirty;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000 * 15);
    return () => window.clearInterval(timer);
  }, []);
  return <FamilyContext.Provider value={{ ...planner, members, allMembers, connectedPlanner, compareMembers, isMemberVisible,
    memberName: id => id === "everyone" ? "Everyone" : allMembers.find(m => m.id === id)?.name ?? "Person unavailable",
    now, today, time, saved, exportConfiguration, importConfiguration,
    setAppearance: settings => setPlanner(p => ({ ...p, appearance: { ...p.appearance, ...settings } })),
    setSelectedAlarm: id => setPlanner(p => ({ ...p, selectedAlarm: id })),
    calendarStart: planner.calendar.startDay === "today" ? today : weekStart(today),
    setCalendarSettings: settings => setPlanner(p => ({ ...p, calendar: { ...p.calendar, ...settings } })),
    moveMember: (id, direction) => {
      const index = allMembers.findIndex(member => member.id === id);
      const neighbor = allMembers[index + direction];
      if (index < 0 || !neighbor) return;
      const order = [...memberIds];
      const from = order.indexOf(id), to = order.indexOf(neighbor.id);
      [order[from], order[to]] = [order[to], order[from]];
      setPlanner(p => ({ ...p, memberOrder: order }));
    },
    setMemberVisible: (id, visible) => setPlanner(p => ({ ...p, hiddenMembers: [...p.hiddenMembers.filter(member => member !== id), ...(visible ? [] : [id])] })),
    setHomeEntities: ids => setPlanner(p => ({ ...p, homeEntities: [...new Set(ids)] })),
    setCalendarMember: (calendar, member) => setPlanner(p => {
      const calendarMembers = { ...p.calendarMembers };
      if (member) calendarMembers[calendar] = member; else delete calendarMembers[calendar];
      return { ...p, calendarMembers };
    }),
    setTodoList: (kind, member, list) => setPlanner(p => {
      const owner = kind === "shopping" ? "everyone" : member;
      const todoLists = Object.fromEntries(Object.entries(p.todoLists).filter(([id, assigned]) => id !== list && !(assigned.kind === kind && assigned.member === owner)));
      if (list) todoLists[list] = { kind, member: owner };
      return { ...p, todoLists };
    }),
    saveEvent: rejectLocalContent, deleteEvent: rejectLocalContent, addItem: rejectLocalContent,
    toggleItem: rejectLocalContent, renameItem: rejectLocalContent, deleteItem: rejectLocalContent,
    hasTimetable: member => planner.timetableEnabled[member] ?? !!planner.timetables[member]?.length,
    setTimetableEnabled: (member, enabled) => setPlanner(p => ({ ...p, timetableEnabled: { ...p.timetableEnabled, [member]: enabled } })),
    setTimetable: (child, urls) => {
      const pages = urls.map(url => url.trim()).filter(Boolean);
      if (!pages.length) { toast.error("Add at least one timetable image URL."); return false; }
      try { if (pages.some(url => !/^https?:$/.test(new URL(url, window.location.origin).protocol))) throw new Error(); }
      catch { toast.error("Use an HTTP or HTTPS image URL for every page."); return false; }
      if (!setPlanner(p => ({ ...p, timetables: { ...p.timetables, [child]: pages } }))) return false;
      toast.success("Timetable updated");
      return true;
    },
  }}>{children}</FamilyContext.Provider>;
}
