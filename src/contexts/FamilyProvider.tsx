import { memo, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useI18n, useRememberLanguage } from "@/hooks/use-i18n";
import { useApp } from "./AppContext";
import { FamilyContext, homeDate, weekStart, type FamilyState, type FamilyMember, type MemberId } from "./FamilyContext";
import { useSharedConfiguration } from "./SharedConfigurationContext";
import { SharedConfigurationProvider } from "./SharedConfigurationProvider";
import { plannerSettings, emptyPlanner, parseConfiguration, defaultTodoDisplay, type Configuration } from "../../shared/configuration";
import { memberPalette } from "@/lib/member-colors";
import { moveSmartHomeCard } from "@/lib/smart-home-cards";
import { modalGlassProperties } from "@/lib/modal-glass";

type HomePerson = Pick<FamilyMember, "id" | "name" | "picture">;

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { currentHome } = useApp();
  const people: HomePerson[] = currentHome.entities.filter(entity => entity.domain === "person").map(person => ({
    id: person.preferenceId, name: person.name,
    // shortcut: only uploaded HA photos are supported; add other picture sources when needed.
    picture: typeof person.attributes.entity_picture === "string" && /^\/api\/image\/serve\/[a-f0-9]{32}\/(original|256x256|512x512)$/.test(person.attributes.entity_picture)
      ? person.attributes.entity_picture : undefined,
  }));
  return <SharedConfigurationProvider><FamilyStore people={people} timeZone={currentHome.timeZone}>{children}</FamilyStore></SharedConfigurationProvider>;
}
const FamilyStore = memo(function FamilyStore({ children, people, timeZone }: { children: ReactNode; people: HomePerson[]; timeZone: string }) {
  const { t, message, language } = useI18n();
  useRememberLanguage();
  const shared = useSharedConfiguration();
  const planner: FamilyState = { ...(shared?.state.config.settings ?? emptyPlanner()), events: [], items: [] };
  const connectedPlanner = true;
  const availableMembers: FamilyMember[] = people.map((person, index) => ({
    ...person,
    initials: person.name.split(/\s+/).map(part => part[0]).slice(0, 2).join(""),
    color: planner.memberColors[person.id] ?? memberPalette[index % memberPalette.length].color,
  }));
  const [now, setNow] = useState(() => new Date());
  const today = homeDate(now, timeZone);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
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
    const properties = modalGlassProperties(planner.appearance);
    for (const [name, value] of Object.entries(properties)) document.documentElement.style.setProperty(name, value);
    return () => { for (const name of Object.keys(properties)) document.documentElement.style.removeProperty(name); };
  }, [planner.appearance]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t("Afterglow · Family at home");
  }, [language, t]);
  const exportConfiguration = (): Configuration => shared.state.config;
  const importConfiguration = async (input: Configuration) => { await shared.store.replace(parseConfiguration(JSON.stringify(input))); };
  const memberIds = [...new Set([...planner.memberOrder, ...availableMembers.map(member => member.id)])].filter(id => id !== "everyone");
  const memberRanks = new Map(memberIds.map((id, index) => [id, index]));
  const compareMembers = (a: MemberId, b: MemberId) => (memberRanks.get(a) ?? memberRanks.size) - (memberRanks.get(b) ?? memberRanks.size);
  const allMembers = availableMembers.sort((a, b) => compareMembers(a.id, b.id));
  const isMemberVisible = (id: MemberId) => id !== "everyone" && !planner.hiddenMembers.includes(id);
  const members = allMembers.filter(member => isMemberVisible(member.id));
  const saved = shared.state.loaded && !shared.state.dirty;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000 * 15);
    return () => window.clearInterval(timer);
  }, []);
  return <FamilyContext.Provider value={{ ...planner, members, allMembers, connectedPlanner, compareMembers, isMemberVisible,
    memberName: id => allMembers.find(m => m.id === id)?.name ?? t("Person unavailable"),
    memberColor: id => planner.memberColors[id] ?? allMembers.find(member => member.id === id)?.color ?? "#c4d5a3",
    now, today, time, saved, exportConfiguration, importConfiguration,
    setLanguage: language => setPlanner(p => ({ ...p, language })),
    setAppearance: settings => setPlanner(p => ({ ...p, appearance: { ...p.appearance, ...settings } })),
    setDashboard: settings => setPlanner(p => ({ ...p, dashboard: { ...p.dashboard, ...settings } })),
    setNotifications: settings => setPlanner(p => ({ ...p, notifications: { ...p.notifications, ...settings } })),
    setSelectedAlarm: id => setPlanner(p => ({ ...p, selectedAlarm: id })),
    setMorningSummaryEntity: id => setPlanner(p => ({ ...p, morningSummaryEntity: id })),
    setMorningSummaryScript: id => setPlanner(p => ({ ...p, morningSummaryScript: id })),
    setMorningSummaryPlaybackEntity: id => setPlanner(p => ({ ...p, morningSummaryPlaybackEntity: id })),
    updateVehicle: (id, changes) => setPlanner(p => ({ ...p, vehicles: p.vehicles.map(car => car.id === id ? { ...car, ...changes } : car) })),
    setVehicleVisible: (vehicle, visible) => setPlanner(p => ({ ...p, vehicles: visible
      ? [...p.vehicles.filter(car => car.id !== vehicle.id), vehicle] : p.vehicles.filter(car => car.id !== vehicle.id) })),
    setWeatherEntity: id => setPlanner(p => ({ ...p, weatherEntity: id })),
    setWasteCalendarEntity: id => setPlanner(p => ({ ...p, wasteCalendarEntity: id })),
    setWasteCollectionDays: days => setPlanner(p => ({ ...p, wasteCollectionDays: days })),
    setWeatherTemperatureEntity: id => setPlanner(p => ({ ...p, weatherTemperatureEntity: id })),
    setWeatherPlacement: settings => setPlanner(p => ({ ...p, weatherPlacement: { ...p.weatherPlacement, ...settings } })),
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
    setHomeEntities: (ids, groups, groupNames) => setPlanner(p => ({ ...p, homeEntities: [...new Set(ids)], homeEntityGroups: Object.fromEntries(ids.filter(id => groups[id]?.trim()).map(id => [id, groups[id].trim()])), homeGroups: [...new Set(groupNames.map(name => name.trim()).filter(Boolean))] })),
    saveSmartHomeCard: card => setPlanner(p => ({ ...p, smartHome: { layout: p.smartHome.layout.some(item => item.id === card.id)
      ? p.smartHome.layout.map(item => item.id === card.id ? { ...card, illustrated: item.illustrated } : item) : [...p.smartHome.layout, card] } })),
    removeSmartHomeCard: id => setPlanner(p => ({ ...p, smartHome: { layout: p.smartHome.layout.filter(card => card.id !== id) } })),
    clearSmartHome: () => setPlanner(p => ({ ...p, smartHome: { layout: [] } })),
    setSmartHomeCardArtwork: (id, illustrated) => setPlanner(p => ({ ...p, smartHome: { layout: p.smartHome.layout.map(card => card.id === id ? { ...card, illustrated } : card) } })),
    setSmartHomeCardDensity: (id, density) => setPlanner(p => ({ ...p, smartHome: { layout: p.smartHome.layout.map(card => card.id === id ? { ...card, density } : card) } })),
    moveSmartHomeCard: (id, group, beforeId) => setPlanner(p => ({ ...p, smartHome: moveSmartHomeCard(p.smartHome, id, group, beforeId) })),
    setCalendarMember: (calendar, member) => setPlanner(p => {
      const calendarMembers = { ...p.calendarMembers };
      if (member) calendarMembers[calendar] = member; else delete calendarMembers[calendar];
      return { ...p, calendarMembers };
    }),
    setTodoList: (kind, member, list, previous) => setPlanner(p => {
      const owner = kind === "shopping" ? "everyone" : member;
      const todoLists = Object.fromEntries(Object.entries(p.todoLists).filter(([id, assigned]) => {
        if (assigned.kind !== kind) return true;
        return kind === "shopping" ? id !== previous : assigned.member !== member;
      }));
      if (list) todoLists[list] = { ...p.todoLists[list], kind, member: owner };
      return { ...p, todoLists };
    }),
    setTodoListDisplay: (list, display) => setPlanner(p => p.todoLists[list] ? ({ ...p, todoLists: { ...p.todoLists,
      [list]: { ...p.todoLists[list], display: { ...defaultTodoDisplay, ...p.todoLists[list].display, ...display } },
    } }) : p),
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
}, (prev, next) => prev.children === next.children && prev.timeZone === next.timeZone
  && prev.people.length === next.people.length && prev.people.every((person, i) => {
    const other = next.people[i];
    return person.id === other.id && person.name === other.name && person.picture === other.picture;
  }));
