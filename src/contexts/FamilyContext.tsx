import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useApp } from "./AppContext";

export const familyMembers = [
  { id: "anna", name: "Anna", initials: "A", color: "#d2bd9e" },
  { id: "erik", name: "Erik", initials: "Er", color: "#aacbd0" },
  { id: "emma", name: "Emma", initials: "Em", color: "#cabbce" },
  { id: "leo", name: "Leo", initials: "L", color: "#c7d29c" },
] as const;
const memberSchema = z.enum(["anna", "erik", "emma", "leo", "everyone"]);
export function isPlannerDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export const newPlannerId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dateSchema = z.string().refine(isPlannerDate);
const eventSchema = z.object({
  id: z.string(), title: z.string().trim().min(1).max(100), date: dateSchema,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), member: memberSchema,
  location: z.string().max(150), note: z.string().max(200),
});
const itemSchema = z.object({
  id: z.string(), text: z.string().trim().min(1).max(120),
  kind: z.enum(["daily", "shopping", "tasks"]), member: memberSchema,
  done: z.boolean(), completedOn: z.string().optional(),
});
const calendarSettingsSchema = z.object({
  view: z.enum(["people", "week"]), startDay: z.enum(["today", "monday"]),
});
const plannerSchema = z.object({
  events: z.array(eventSchema), items: z.array(itemSchema),
  timetables: z.object({ emma: z.string(), leo: z.string() }),
  calendar: calendarSettingsSchema.catch({ view: "people", startDay: "today" }),
});
export type CalendarSettings = z.infer<typeof calendarSettingsSchema>;
export type FamilyEvent = z.infer<typeof eventSchema>;
export type ListItem = z.infer<typeof itemSchema>;
type Planner = z.infer<typeof plannerSchema>;
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
export const memberName = (id: MemberId) => familyMembers.find(m => m.id === id)?.name ?? "Everyone";
export const itemIsDone = (item: ListItem, today: string) => item.kind === "daily" ? item.completedOn === today : item.done;
export const sortEvents = (events: FamilyEvent[]) => [...events].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

function samplePlanner(today: string): Planner {
  const start = weekStart(today);
  const events: FamilyEvent[] = [
    { id: "football", title: "Football practice", date: today, time: "16:30", member: "leo", location: "Sports hall", note: "Erik drives · Leave at 16:15" },
    { id: "piano", title: "Piano lesson", date: today, time: "17:00", member: "emma", location: "Music school", note: "Bring the music book" },
    { id: "home", title: "Home from work", date: today, time: "17:15", member: "anna", location: "Home", note: "Time to catch up" },
    { id: "dinner", title: "Dinner together", date: today, time: "18:00", member: "everyone", location: "Around the table", note: "Tomato pasta & a little conversation" },
    { id: "parents", title: "Parents’ meeting", date: addDays(start, 1), time: "18:30", member: "anna", location: "School · Room 4", note: "Year 5 autumn meeting" },
    { id: "swimming", title: "Swimming", date: addDays(start, 2), time: "16:00", member: "leo", location: "Local pool", note: "Pack swim bag" },
    { id: "forest", title: "Forest day", date: addDays(start, 3), time: "08:30", member: "emma", location: "School", note: "Warm layers & a packed lunch" },
    { id: "pickup", title: "Pick up groceries", date: addDays(start, 3), time: "17:00", member: "erik", location: "On the way home", note: "Check the shared shopping list" },
    { id: "pizza", title: "Friday pizza", date: addDays(start, 4), time: "18:00", member: "everyone", location: "Home", note: "Everyone picks a topping" },
    { id: "walk", title: "A walk in the woods", date: addDays(start, 5), time: "11:00", member: "everyone", location: "Lake trail", note: "Bring cocoa" },
  ];
  return {
    events: sortEvents(events),
    calendar: { view: "people", startDay: "today" },
    items: [
      { id: "d1", text: "Pack tomorrow’s school bags", kind: "daily", member: "emma", done: false },
      { id: "d2", text: "Set the table", kind: "daily", member: "leo", done: false },
      { id: "d3", text: "Empty the dishwasher", kind: "daily", member: "erik", done: false },
      { id: "s1", text: "Oat milk", kind: "shopping", member: "everyone", done: false },
      { id: "s2", text: "Bananas", kind: "shopping", member: "everyone", done: false },
      { id: "s3", text: "Pasta & cherry tomatoes", kind: "shopping", member: "everyone", done: false },
      { id: "t1", text: "Book winter tyre change", kind: "tasks", member: "erik", done: false },
      { id: "t2", text: "Return library books", kind: "tasks", member: "anna", done: false },
    ],
    timetables: { emma: "/timetables/emma.svg", leo: "/timetables/leo.svg" },
  };
}

interface FamilyContextValue extends Planner {
  now: Date; today: string; time: string; saved: boolean;
  plannerId: string; plannerIds: string[]; selectPlanner: (id: string) => void;
  calendarStart: string;
  setCalendarSettings: (settings: Partial<CalendarSettings>) => void;
  saveEvent: (event: FamilyEvent) => void;
  deleteEvent: (id: string) => void;
  addItem: (text: string, kind: ListKind, member: MemberId) => void;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => void;
  setTimetable: (child: "emma" | "leo", url: string) => void;
}
const FamilyContext = createContext<FamilyContextValue | null>(null);
export function useFamily() {
  const value = useContext(FamilyContext);
  if (!value) throw new Error("useFamily must be used within FamilyProvider");
  return value;
}
export function FamilyProvider({ children }: { children: ReactNode }) {
  const { currentHome } = useApp();
  // Keep the original household keys; HA connection changes never migrate local data.
  const [plannerIds] = useState(() => {
    const ids = new Set(["home-1"]);
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("afterglow-planner-v1:") && !key.endsWith(":unreadable-backup")) ids.add(key.slice("afterglow-planner-v1:".length));
      }
    } catch { /* Local storage may be unavailable. */ }
    return [...ids];
  });
  const [plannerId, setPlannerId] = useState(() => {
    try { const id = localStorage.getItem("afterglow-selected-planner"); if (plannerIds.includes(id)) return id; } catch { /* Use the existing default. */ }
    return "home-1";
  });
  const selectPlanner = (id: string) => {
    if (!plannerIds.includes(id)) return;
    setPlannerId(id);
    try { localStorage.setItem("afterglow-selected-planner", id); } catch { /* Selection remains in memory. */ }
  };
  return <FamilyStore key={plannerId} homeId={plannerId} plannerIds={plannerIds} selectPlanner={selectPlanner} timeZone={currentHome.timeZone}>{children}</FamilyStore>;
}
function FamilyStore({ children, homeId, timeZone, plannerIds, selectPlanner }: { children: ReactNode; homeId: string; timeZone: string; plannerIds: string[]; selectPlanner: (id: string) => void }) {
  const [now, setNow] = useState(() => new Date());
  const today = homeDate(now, timeZone);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  // ponytail: this planner is local to one browser; replace the store when family accounts/sync are connected.
  const key = `afterglow-planner-v1:${homeId}`;
  const [planner, setPlanner] = useState<Planner>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = plannerSchema.safeParse(JSON.parse(raw));
          if (parsed.success) return parsed.data;
        } catch { /* Keep malformed JSON below, too. */ }
        localStorage.setItem(`${key}:unreadable-backup`, raw);
      }
    } catch { /* Storage may be unavailable; the save effect reports that state. */ }
    return samplePlanner(today);
  });
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000 * 15);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(planner)); setSaved(true); }
    catch { setSaved(false); toast.error("This browser cannot save changes. Keep this tab open to retain your planner."); }
  }, [key, planner]);
  return <FamilyContext.Provider value={{ ...planner, now, today, time, saved, plannerId: homeId, plannerIds, selectPlanner,
    calendarStart: planner.calendar.startDay === "today" ? today : weekStart(today),
    setCalendarSettings: settings => setPlanner(p => ({ ...p, calendar: { ...p.calendar, ...settings } })),
    saveEvent: event => {
      const valid = eventSchema.safeParse(event);
      if (!valid.success) { toast.error("Check the event details before saving."); return; }
      setPlanner(p => ({ ...p, events: sortEvents([...p.events.filter(e => e.id !== event.id), valid.data]) }));
    },
    deleteEvent: id => setPlanner(p => ({ ...p, events: p.events.filter(e => e.id !== id) })),
    addItem: (text, kind, member) => {
      const valid = itemSchema.safeParse({ id: newPlannerId(), text, kind, member, done: false });
      if (valid.success) setPlanner(p => ({ ...p, items: [...p.items, valid.data] }));
    },
    toggleItem: id => setPlanner(p => ({ ...p, items: p.items.map(i => i.id === id ? { ...i, done: !itemIsDone(i, today), completedOn: itemIsDone(i, today) ? "" : today } : i) })),
    deleteItem: id => setPlanner(p => ({ ...p, items: p.items.filter(i => i.id !== id) })),
    setTimetable: (child, url) => {
      try { if (!/^https?:$/.test(new URL(url, window.location.origin).protocol)) throw new Error(); }
      catch { toast.error("Use an HTTP or HTTPS image URL."); return; }
      setPlanner(p => ({ ...p, timetables: { ...p.timetables, [child]: url } }));
      toast.success("Timetable updated on this screen");
    },
  }}>{children}</FamilyContext.Provider>;
}
