import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useApp } from "./AppContext";
import type { CalendarEvent } from "@/types/api";
import { SharedConfigurationProvider, useSharedConfiguration } from "./SharedConfigurationContext";
import { calendarSettingsSchema, eventSchema, itemSchema, memberSchema, emptyConfiguration, emptyPlanner, parseConfiguration, remapPlanner, type Configuration, type Planner } from "../../shared/configuration";
export { isPlannerDate } from "../../shared/configuration";

const demoMembers = [
  { id: "anna", name: "Anna", initials: "A", color: "#d2bd9e" },
  { id: "erik", name: "Erik", initials: "Er", color: "#aacbd0" },
  { id: "emma", name: "Emma", initials: "Em", color: "#cabbce" },
  { id: "leo", name: "Leo", initials: "L", color: "#c7d29c" },
] as const;
export interface FamilyMember { id: string; name: string; initials: string; color: string }
export const newPlannerId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const plannerSchema = z.object({
  events: z.array(eventSchema), items: z.array(itemSchema),
  timetables: z.record(z.union([z.string().transform(url => url ? [url] : []), z.array(z.string())])),
  timetableEnabled: z.record(z.boolean()).catch({}),
  calendar: calendarSettingsSchema.catch({ view: "week", startDay: "today" }),
  homeEntities: z.record(z.array(z.string())).catch({}),
  memberOrder: z.array(memberSchema).catch([]),
  hiddenMembers: z.array(memberSchema).catch([]),
  calendarMembers: z.record(memberSchema).default({}),
  todoLists: z.record(z.object({ kind: z.enum(["daily", "shopping", "tasks"]), member: memberSchema })).default({}),
});
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
    calendar: { view: "week", startDay: "today" },
    homeEntities: {},
    memberOrder: [],
    hiddenMembers: [],
    calendarMembers: {},
    todoLists: {},
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
    timetables: { emma: ["/timetables/emma.svg"], leo: ["/timetables/leo.svg"] },
    timetableEnabled: {},
  };
}

interface FamilyContextValue extends Planner {
  members: FamilyMember[]; allMembers: FamilyMember[]; memberName: (id: MemberId) => string; connectedPlanner: boolean;
  now: Date; today: string; time: string; saved: boolean;
  plannerId: string; plannerIds: string[]; selectPlanner: (id: string) => void;
  calendarStart: string;
  exportConfiguration: () => Configuration;
  importConfiguration: (configuration: Configuration) => Promise<void>;
  browserConfiguration: () => Configuration;
  setCalendarSettings: (settings: Partial<CalendarSettings>) => void;
  compareMembers: (a: MemberId, b: MemberId) => number;
  moveMember: (id: MemberId, direction: -1 | 1) => void;
  isMemberVisible: (id: MemberId) => boolean;
  setMemberVisible: (id: MemberId, visible: boolean) => void;
  setHomeEntities: (instance: string, ids: string[]) => boolean;
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
  return <SharedConfigurationProvider><FamilySelection>{children}</FamilySelection></SharedConfigurationProvider>;
}
function FamilySelection({ children }: { children: ReactNode }) {
  const { currentHome, haUrl } = useApp();
  const shared = useSharedConfiguration();
  // Keep the original household keys; HA connection changes never migrate local data.
  const [localPlannerIds] = useState(() => {
    const ids = new Set(["home-1"]);
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("afterglow-planner-v1:") && !key.endsWith(":unreadable-backup")) ids.add(key.slice("afterglow-planner-v1:".length));
      }
    } catch { /* Local storage may be unavailable. */ }
    return [...ids];
  });
  const plannerIds = [...new Set([...localPlannerIds, ...Object.keys(shared?.state.config.planners ?? {})])];
  const [plannerId, setPlannerId] = useState(() => {
    try { const id = localStorage.getItem("afterglow-selected-planner"); if (plannerIds.includes(id)) return id; } catch { /* Use the existing default. */ }
    return "home-1";
  });
  useEffect(() => {
    const ids = Object.keys(shared?.state.config.planners ?? {});
    if (shared?.enabled && shared.state.loaded && ids.length && !ids.includes(plannerId)) setPlannerId(ids[0]);
  }, [shared?.enabled, shared?.state.loaded, shared?.state.config, plannerId]);
  const selectPlanner = (id: string) => {
    if (!plannerIds.includes(id)) return;
    setPlannerId(id);
    try { localStorage.setItem("afterglow-selected-planner", id); } catch { /* Selection remains in memory. */ }
  };
  // Once an instance is configured, reconnects/logout must never restore demo content.
  return <FamilyStore key={`${haUrl}|${plannerId}`} homeId={plannerId} plannerIds={plannerIds} selectPlanner={selectPlanner} timeZone={currentHome.timeZone}>{children}</FamilyStore>;
}
function FamilyStore({ children, homeId, timeZone, plannerIds, selectPlanner }: { children: ReactNode; homeId: string; timeZone: string; plannerIds: string[]; selectPlanner: (id: string) => void }) {
  const { currentHome, haUrl } = useApp();
  const shared = useSharedConfiguration();
  const connectedPlanner = !!haUrl;
  const availableMembers: FamilyMember[] = connectedPlanner ? currentHome.entities.filter(e => e.domain === "person").map((person, index) => ({
    id: person.preferenceId, name: person.name,
    initials: person.name.split(/\s+/).map(part => part[0]).slice(0, 2).join(""),
    color: demoMembers[index % demoMembers.length].color,
  })) : [...demoMembers];
  const [now, setNow] = useState(() => new Date());
  const today = homeDate(now, timeZone);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const key = connectedPlanner ? `afterglow-connected-planner-v1:${haUrl}:${homeId}` : `afterglow-planner-v1:${homeId}`;
  const [localPlanner, setLocalPlanner] = useState<Planner>(() => {
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
    if (!connectedPlanner) return samplePlanner(today);
    // Old starter data stays intact; only display preferences carry into the real household.
    let preferences: Partial<Planner> = {};
    try { preferences = plannerSchema.partial().parse(JSON.parse(localStorage.getItem(`afterglow-planner-v1:${homeId}`) ?? "{}")); } catch { /* Start with empty preferences. */ }
    return { events: [], items: [], timetables: {}, timetableEnabled: {}, calendarMembers: {}, todoLists: {}, memberOrder: [], hiddenMembers: [], calendar: preferences.calendar ?? { view: "week", startDay: "today" }, homeEntities: preferences.homeEntities ?? {} };
  });
  const stored = shared?.state.config.planners[homeId];
  const planner = shared?.enabled ? stored ? remapPlanner(stored.planner, stored.instanceUrl, haUrl) : emptyPlanner() : localPlanner;
  const setPlanner = (change: (value: Planner) => Planner) => {
    if (!shared?.enabled) { setLocalPlanner(change); return true; }
    try { shared.store.updatePlanner(homeId, haUrl, change); return true; }
    catch (error) { toast.error(error instanceof Error ? error.message : "Configuration could not be saved."); return false; }
  };
  const browserConfiguration = (): Configuration => {
    const config = emptyConfiguration();
    const prefix = haUrl ? `afterglow-connected-planner-v1:${haUrl}:` : "afterglow-planner-v1:";
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix) || key.endsWith(":unreadable-backup")) continue;
      const data = plannerSchema.parse(JSON.parse(localStorage.getItem(key)));
      config.planners[key.slice(prefix.length)] = { instanceUrl: haUrl, planner: data };
    }
    if (!shared?.enabled) config.planners[homeId] = { instanceUrl: haUrl, planner: localPlanner };
    return parseConfiguration(JSON.stringify(config));
  };
  const exportConfiguration = (): Configuration => shared?.enabled ? shared.state.config : { ...emptyConfiguration(), planners: { [homeId]: { instanceUrl: haUrl, planner: localPlanner } } };
  const importConfiguration = async (input: Configuration) => {
    const config = parseConfiguration(JSON.stringify(input));
    if (shared?.enabled) { await shared.store.replace(config); return; }
    const entries = Object.values(config.planners);
    if (entries.length !== 1) throw new Error("Browser-only mode restores one planner at a time. Use the storage server to restore a full instance backup.");
    const next = remapPlanner(entries[0].planner, entries[0].instanceUrl, haUrl);
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { throw new Error("This browser cannot save the backup. The current planner has not been replaced."); }
    setLocalPlanner(next);
  };
  const memberIds = [...new Set([...planner.memberOrder, ...availableMembers.map(member => member.id)])].filter(id => id !== "everyone");
  const memberRanks = new Map(["everyone", ...memberIds].map((id, index) => [id, index]));
  const compareMembers = (a: MemberId, b: MemberId) => (memberRanks.get(a) ?? memberRanks.size) - (memberRanks.get(b) ?? memberRanks.size);
  const allMembers = availableMembers.sort((a, b) => compareMembers(a.id, b.id));
  const isMemberVisible = (id: MemberId) => id === "everyone" || !planner.hiddenMembers.includes(id);
  const members = allMembers.filter(member => isMemberVisible(member.id));
  const [locallySaved, setSaved] = useState(true);
  const saved = shared?.enabled ? shared.state.loaded && !shared.state.dirty : locallySaved;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000 * 15);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (shared?.enabled) return;
    try { localStorage.setItem(key, JSON.stringify(localPlanner)); setSaved(true); }
    catch { setSaved(false); toast.error("This browser cannot save changes. Keep this tab open to retain your planner."); }
  }, [key, localPlanner, shared?.enabled]);
  return <FamilyContext.Provider value={{ ...planner, members, allMembers, connectedPlanner, compareMembers, isMemberVisible,
    memberName: id => id === "everyone" ? "Everyone" : allMembers.find(m => m.id === id)?.name ?? "Person unavailable",
    now, today, time, saved, plannerId: homeId, plannerIds, selectPlanner, exportConfiguration, importConfiguration, browserConfiguration,
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
    setHomeEntities: (instance, ids) => setPlanner(p => ({ ...p, homeEntities: { ...p.homeEntities, [instance]: [...new Set(ids)] } })),
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
    saveEvent: event => {
      if (event.calendarId) return false;
      const valid = eventSchema.safeParse(event);
      if (!valid.success) { toast.error("Check the event details before saving."); return false; }
      return setPlanner(p => ({ ...p, events: sortEvents([...p.events.filter(e => e.id !== event.id), valid.data]) }));
    },
    deleteEvent: id => setPlanner(p => ({ ...p, events: p.events.filter(e => e.id !== id) })),
    addItem: (text, kind, member) => {
      const valid = itemSchema.safeParse({ id: newPlannerId(), text, kind, member, done: false });
      return valid.success && setPlanner(p => ({ ...p, items: [...p.items, valid.data] }));
    },
    toggleItem: id => setPlanner(p => ({ ...p, items: p.items.map(i => i.id === id ? { ...i, done: !itemIsDone(i, today), completedOn: itemIsDone(i, today) ? "" : today } : i) })),
    renameItem: (id, text) => {
      const valid = itemSchema.shape.text.safeParse(text);
      if (!valid.success) { toast.error("Enter an item within 120 characters."); return false; }
      return setPlanner(p => ({ ...p, items: p.items.map(item => item.id === id ? { ...item, text: valid.data } : item) }));
    },
    deleteItem: id => setPlanner(p => ({ ...p, items: p.items.filter(i => i.id !== id) })),
    hasTimetable: member => planner.timetableEnabled[member] ?? !!planner.timetables[member]?.length,
    setTimetableEnabled: (member, enabled) => setPlanner(p => ({ ...p, timetableEnabled: { ...p.timetableEnabled, [member]: enabled } })),
    setTimetable: (child, urls) => {
      const pages = urls.map(url => url.trim()).filter(Boolean);
      if (!pages.length) { toast.error("Add at least one timetable image URL."); return false; }
      try { if (pages.some(url => !/^https?:$/.test(new URL(url, window.location.origin).protocol))) throw new Error(); }
      catch { toast.error("Use an HTTP or HTTPS image URL for every page."); return false; }
      if (!setPlanner(p => ({ ...p, timetables: { ...p.timetables, [child]: pages } }))) return false;
      toast.success(shared?.enabled ? "Timetable updated" : "Timetable updated on this screen");
      return true;
    },
  }}>{children}</FamilyContext.Provider>;
}
