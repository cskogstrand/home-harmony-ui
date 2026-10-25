import { useEffect, useRef } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Bell, BookOpen, CalendarDays, ChevronRight, Database, Globe, House, ListChecks, Palette, SlidersHorizontal, Users, Wifi, WifiOff } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { ConfigurationBackup } from "@/components/ConfigurationBackup";
import { NotificationSettings } from "@/components/NotificationSettings";
import { SmartHomeSettings } from "@/components/SmartHomeSettings";
import { Button } from "@/components/ui/button";
import HomeSettings from "./HomeSettings";
import UserSettings from "./UserSettings";
import "./settings.css";

const groups = [
  { title: "Preferences", items: [
    { id: "appearance", title: "Appearance", description: "Theme, colors and display density", icon: Palette, content: <UserSettings section="appearance" /> },
    { id: "language", title: "Language", description: "Language for every connected screen", icon: Globe, content: <UserSettings section="language" /> },
    { id: "notifications", title: "Notifications", description: "Alerts, ongoing tasks and camera popups", icon: Bell, content: <NotificationSettings /> },
  ] },
  { title: "Household", items: [
    { id: "people", title: "People", description: "Visibility, order, colors and timetable access", icon: Users, content: <HomeSettings section="people" /> },
    { id: "calendars", title: "Calendars", description: "Connect calendars to the right people", icon: CalendarDays, content: <HomeSettings section="calendars" /> },
    { id: "lists", title: "To-do lists", description: "Personal tasks, daily lists and shared shopping", icon: ListChecks, content: <HomeSettings section="lists" /> },
    { id: "timetables", title: "Timetables", description: "School calendars, PDF uploads and images", icon: BookOpen, content: <HomeSettings section="timetables" /> },
  ] },
  { title: "System", items: [
    { id: "smart-home", title: "Smart home", description: "Visible devices, entities and card layouts", icon: SlidersHorizontal, content: <SmartHomeSettings /> },
    { id: "connection", title: "Connection & account", description: "Home Assistant connection and instance details", icon: Wifi, content: <HomeSettings section="connection" /> },
    { id: "backups", title: "Storage and backups", description: "Export, restore and recover shared settings", icon: Database, content: <ConfigurationBackup /> },
  ] },
];

const legacySections: Record<string, string> = {
  connection: "connection", notifications: "notifications", "smart-home-visibility": "smart-home",
  "people-order": "people", timetables: "timetables", "family-calendar": "calendars", "family-lists": "lists",
};

export default function Settings() {
  const { section } = useParams();
  const { hash, search } = useLocation();
  const { t, message } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const shared = useSharedConfiguration();
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = groups.flatMap(group => group.items).find(item => item.id === section);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [section]);
  if (!section && legacySections[hash.slice(1)]) return <Navigate to={`/settings/${legacySections[hash.slice(1)]}${search}`} replace />;
  if (section && !selected) return <Navigate to="/settings" replace />;
  const menu = <nav className="settings-menu glass-surface" aria-label={t("Settings navigation")}>
    {groups.map(group => <section className="settings-group" key={group.title} aria-label={message(group.title)}>
      <h2>{message(group.title)}</h2>
      <ul>{group.items.map(item => <li key={item.id}><Link to={`/settings/${item.id}`} className="settings-row" aria-current={selected?.id === item.id ? "page" : undefined}>
        <item.icon className="settings-row-icon" size={20} strokeWidth={1.8} aria-hidden="true" />
        <span><span className="settings-row-title">{message(item.title)}</span>{!selected && <span className="settings-row-description">{message(item.description)}</span>}</span>
        <ChevronRight className="settings-chevron" size={17} aria-hidden="true" />
      </Link></li>)}</ul>
    </section>)}
  </nav>;

  return <div className={`settings-page ${selected ? "settings-subpage" : "settings-overview"}`}>
    <div className="settings-intro">
      {selected && <Link to="/settings" className="settings-back"><ArrowLeft size={18} aria-hidden="true" />{t("All settings")}</Link>}
      <h1 ref={heading} tabIndex={-1}>{selected ? message(selected.title) : t("Settings")}</h1>
      <p className="page-note">{selected ? message(selected.description) : t("Preferences, people and your connected home.")}</p>
      {!selected && <>
        <Link to="/settings/connection" className="settings-home glass-surface">
          <House size={24} strokeWidth={1.6} aria-hidden="true" />
          <span><strong>{currentHome.name}</strong><span>{homeOnline ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}{homeOnline ? t("Connected") : t("HA offline")}</span></span>
          <ChevronRight size={17} aria-hidden="true" />
        </Link>
        <p className="page-note settings-shared-note">{t("Applies to every screen connected to this server.")}</p>
        <Button variant="outline" asChild><Link to="/onboarding">{t("Get started")}</Link></Button>
      </>}
    </div>
    {menu}
    {selected && <div className="settings-content" key={section}>
      {section !== "backups" && section !== "smart-home" && (shared.state.error || shared.state.dirty && !shared.state.saving) && <div className="settings-storage-warning" role="alert">
        <p>{shared.state.error ? message(shared.state.error) : t("Shared settings are not saved yet.")}</p>
        <Link className="text-link" to="/settings/backups">{t("Storage and backups")}</Link>
      </div>}
      {selected.content}
      {section === "people" && <Link className="settings-related text-link" to="/settings/timetables">{t("Configure timetables")}<ChevronRight size={17} aria-hidden="true" /></Link>}
    </div>}
  </div>;
}
