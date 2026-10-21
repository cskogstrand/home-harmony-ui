import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "./AppContext";
import { FamilyContext, homeDate, weekStart, type FamilyState, type FamilyMember, type MemberId } from "./FamilyContext";
import { useSharedConfiguration } from "./SharedConfigurationContext";
import { SharedConfigurationProvider } from "./SharedConfigurationProvider";
import { plannerSettings, emptyPlanner, parseConfiguration, type Configuration } from "../../shared/configuration";
import { memberPalette } from "@/lib/member-colors";

export function FamilyProvider({ children }: { children: ReactNode }) {
  return <SharedConfigurationProvider><FamilyStore>{children}</FamilyStore></SharedConfigurationProvider>;
}
function FamilyStore({ children }: { children: ReactNode }) {
  const { t, message, language } = useI18n();
  const { currentHome } = useApp();
  const shared = useSharedConfiguration();
  const planner: FamilyState = { ...(shared?.state.config.settings ?? emptyPlanner()), events: [], items: [] };
  const connectedPlanner = true;
  const availableMembers: FamilyMember[] = currentHome.entities.filter(e => e.domain === "person").map((person, index) => ({
    id: person.preferenceId, name: person.name,
    initials: person.name.split(/\s+/).map(part => part[0]).slice(0, 2).join(""),
    color: planner.memberColors[person.preferenceId] ?? memberPalette[index % memberPalette.length].color,
    // shortcut: only uploaded HA photos are supported; add other picture sources when needed.
    picture: typeof person.attributes.entity_picture === "string" && /^\/api\/image\/serve\/[a-f0-9]{32}\/(original|256x256|512x512)$/.test(person.attributes.entity_picture)
      ? person.attributes.entity_picture : undefined,
  }));
  const [now, setNow] = useState(() => new Date());
  const today = homeDate(now, currentHome.timeZone);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: currentHome.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const setPlanner = (change: (value: FamilyState) => FamilyState) => {
    try { shared.store.updateSettings(settings => plannerSettings(change({ ...settings, events: [], items: [] }))); return true; }
    catch (error) { toast.error(message(error instanceof Error ? error.message : "Configuration could not be saved.")); return false; }
  };
  const rejectLocalContent = () => {
    toast.error(t("Use Home Assistant calendars and lists. App storage only saves settings."));
    return false;
  };
  useEffect(() => {
    document.documentElement.classList.toggle("dark", planner.appearance.theme === "dark");
    document.documentElement.style.colorScheme = planner.appearance.theme;
    document.documentElement.dataset.colorPalette = planner.appearance.colorPalette;
  }, [planner.appearance.theme, planner.appearance.colorPalette]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t("Afterglow · Family at home");
  }, [language, t]);
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
    memberName: id => id === "everyone" ? t("Everyone") : allMembers.find(m => m.id === id)?.name ?? t("Person unavailable"),
    memberColor: id => planner.memberColors[id] ?? allMembers.find(member => member.id === id)?.color ?? "#c4d5a3",
    now, today, time, saved, exportConfiguration, importConfiguration,
    setLanguage: language => setPlanner(p => ({ ...p, language })),
    setAppearance: settings => setPlanner(p => ({ ...p, appearance: { ...p.appearance, ...settings } })),
    setDashboard: settings => setPlanner(p => ({ ...p, dashboard: { ...p.dashboard, ...settings } })),
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
    setMemberColor: (id, color) => setPlanner(p => ({ ...p, memberColors: { ...p.memberColors, [id]: color } })),
    setHomeEntities: ids => setPlanner(p => ({ ...p, homeEntities: [...new Set(ids)] })),
    setSmartHomeDeviceVisible: (id, visible) => setPlanner(p => ({ ...p, smartHome: { ...p.smartHome, hiddenDevices: [...p.smartHome.hiddenDevices.filter(device => device !== id), ...(visible ? [] : [id])] } })),
    setSmartHomeEntityVisible: (id, visible) => setPlanner(p => ({ ...p, smartHome: { ...p.smartHome, hiddenEntities: [...p.smartHome.hiddenEntities.filter(entity => entity !== id), ...(visible ? [] : [id])] } })),
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
    hasTimetable: member => planner.timetableEnabled[member] ?? (planner.timetableSettings[member]?.type === "calendar" || !!planner.timetables[member]?.length),
    setTimetableEnabled: (member, enabled) => setPlanner(p => ({ ...p, timetableEnabled: { ...p.timetableEnabled, [member]: enabled } })),
    setTimetableSettings: (member, settings) => setPlanner(p => ({ ...p, timetableSettings: { ...p.timetableSettings,
      [member]: { type: "images", education: "school", calendars: {}, ...p.timetableSettings[member], ...settings },
    } })),
    setTimetable: (child, urls) => {
      const pages = urls.map(url => url.trim()).filter(Boolean);
      if (!pages.length) { toast.error(t("Add at least one timetable image URL.")); return false; }
      try { if (pages.some(url => !/^https?:$/.test(new URL(url, window.location.origin).protocol))) throw new Error(); }
      catch { toast.error(t("Use an HTTP or HTTPS image URL for every page.")); return false; }
      if (!setPlanner(p => ({ ...p, timetables: { ...p.timetables, [child]: pages } }))) return false;
      toast.success(t("Timetable updated"));
      return true;
    },
  }}>{children}</FamilyContext.Provider>;
}
