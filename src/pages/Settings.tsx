import { useContext, useEffect, useRef } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Bell, BookOpen, Bug, CalendarDays, Camera, CarFront, ChevronRight, CloudSun, Database, Globe, House, ListChecks, Palette, SlidersHorizontal, Users, Wifi, WifiOff } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { NotificationDebugContext } from "@/contexts/NotificationContext";
import { useI18n } from "@/hooks/use-i18n";
import { ConfigurationBackup } from "@/components/ConfigurationBackup";
import { NotificationSettings } from "@/components/NotificationSettings";
import { SmartHomeSettings } from "@/components/SmartHomeSettings";
import { CameraConnections } from "@/components/CameraConnections";
import { CameraSettings } from "@/components/CameraSettings";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PanelTitle } from "@/components/PanelTitle";
import { SharedSettingsStatus } from "@/components/common/SharedSettingsStatus";
import { VehicleSettings } from "@/components/VehicleSettings";
import HomeSettings from "./HomeSettings";
import UserSettings from "./UserSettings";
import "./settings.css";

function DebugSettings() {
  const { t } = useI18n();
  const { previewStartedAt, setPreviewStartedAt } = useContext(NotificationDebugContext);
  return <section className="settings-card settings-preferences">
    <PanelTitle icon={Bell}>{t("Notifications")}</PanelTitle>
    <label className="settings-control-row">
      <span>{t("Show all notifications")}<span className="page-note block" id="notification-debug-description">{t("Show every saved rule on Today, including disabled rules.")}</span></span>
      <Switch aria-label={t("Show all notifications")} aria-describedby="notification-debug-description" checked={previewStartedAt !== undefined}
        onCheckedChange={enabled => setPreviewStartedAt(enabled ? Date.now() : undefined)} />
    </label>
    {previewStartedAt !== undefined && <Link className="text-link min-h-11" to="/">{t("Go to Today")}<ChevronRight size={17} aria-hidden="true" /></Link>}
  </section>;
}

const groups = [
  { title: "Preferences", icon: SlidersHorizontal, items: [
    { id: "appearance", title: "Appearance", description: "Theme, colors, artwork, glass and display density", icon: Palette, content: <UserSettings section="appearance" /> },
    { id: "language", title: "Language", description: "Language for every connected screen", icon: Globe, content: <UserSettings section="language" /> },
    { id: "notifications", title: "Notifications", description: "Alerts, ongoing tasks and camera popups", icon: Bell, content: <NotificationSettings /> },
    { id: "weather", title: "Weather", description: "Weather source and where to show it", icon: CloudSun, content: <HomeSettings section="weather" /> },
  ] },
  { title: "Household", icon: Users, items: [
    { id: "vehicles", title: "Electric vehicles", description: "Choose which cars appear in the header", icon: CarFront, content: <VehicleSettings /> },
    { id: "people", title: "People", description: "Visibility, order, colors and timetable access", icon: Users, content: <HomeSettings section="people" /> },
    { id: "calendars", title: "Calendars", description: "Connect calendars to the right people", icon: CalendarDays, content: <HomeSettings section="calendars" /> },
    { id: "lists", title: "To-do lists", description: "Personal tasks, daily lists and shared shopping", icon: ListChecks, content: <HomeSettings section="lists" /> },
    { id: "timetables", title: "Timetables", description: "School calendars, PDF uploads and images", icon: BookOpen, content: <HomeSettings section="timetables" /> },
  ] },
  { title: "System", icon: Wifi, items: [
    { id: "cameras", title: "Cameras", description: "Add cameras and choose their connections", icon: Camera, content: <CameraSettings /> },
    { id: "camera-connections", title: "Camera connections", description: "Home Assistant, go2rtc and Frigate servers", icon: Wifi, content: <CameraConnections /> },
    { id: "smart-home", title: "Smart home", description: "Cards, entities and dashboard layout", icon: SlidersHorizontal, content: <SmartHomeSettings /> },
    { id: "connection", title: "Connection & account", description: "Home Assistant connection and instance details", icon: Wifi, content: <HomeSettings section="connection" /> },
    { id: "backups", title: "Storage and backups", description: "Export, restore and recover shared settings", icon: Database, content: <ConfigurationBackup /> },
    { id: "debug", title: "Debug", description: "Test features in this tab until you reload.", icon: Bug, content: <DebugSettings /> },
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
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = groups.flatMap(group => group.items).find(item => item.id === section);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [section]);
  if (!section && legacySections[hash.slice(1)]) return <Navigate to={`/settings/${legacySections[hash.slice(1)]}${search}`} replace />;
  if (section && !selected) return <Navigate to="/settings" replace />;
  const menu = <nav className="settings-menu settings-stack" aria-label={t("Settings navigation")}>
    {groups.map(group => <section className="settings-group settings-card" key={group.title} aria-label={message(group.title)}>
      <PanelTitle icon={group.icon}>{message(group.title)}</PanelTitle>
      <ul>{group.items.map(item => <li key={item.id}><Link to={`/settings/${item.id}`} className="settings-row" aria-current={selected?.id === item.id ? "page" : undefined}>
        <item.icon className="settings-row-icon" size={20} strokeWidth={1.8} aria-hidden="true" />
        <span><span className="settings-row-title">{message(item.title)}</span> {!selected && <span className="settings-row-description">{message(item.description)}</span>}</span>
        <ChevronRight className="settings-chevron" size={17} aria-hidden="true" />
      </Link></li>)}</ul>
    </section>)}
  </nav>;

  return <div className={`settings-page ${selected ? "settings-subpage" : "settings-overview"}`}>
    <div className="settings-intro">
      {selected && <Link to="/settings" className="settings-back"><ArrowLeft size={18} aria-hidden="true" />{t("All settings")}</Link>}
      <PanelTitle as="h1" icon={selected?.icon ?? SlidersHorizontal} ref={heading} tabIndex={-1}>{selected ? message(selected.title) : t("Settings")}</PanelTitle>
      <p className="page-note">{selected ? message(selected.description) : t("Preferences, people and your connected home.")}</p>
      {!selected && <>
        <Link to="/settings/connection" className="settings-home glass-surface">
          <House size={24} strokeWidth={1.6} aria-hidden="true" />
          <span><strong>{currentHome.name}</strong><span>{homeOnline ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}{homeOnline ? t("Connected") : t("HA offline")}</span></span>
          <ChevronRight size={17} aria-hidden="true" />
        </Link>
        <p className="page-note settings-shared-note">{t("Settings are shared across screens. Debug tools apply only to this tab.")}</p>
        <Button variant="outline" asChild><Link to="/onboarding">{t("Get started")}</Link></Button>
      </>}
    </div>
    {menu}
    {selected && <div className="settings-content" key={section}>
      {section !== "debug" && (section === "backups" ? <p className="shared-settings-status">{t("Applies to every screen connected to this server.")}</p> : <SharedSettingsStatus showRecovery />)}
      {selected.content}
      {section === "people" && <Link className="settings-related text-link" to="/settings/timetables">{t("Configure timetables")}<ChevronRight size={17} aria-hidden="true" /></Link>}
    </div>}
  </div>;
}
