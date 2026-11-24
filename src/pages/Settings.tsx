import { useContext, useEffect, useRef } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Bell, BookOpen, Bug, CalendarDays, Camera, CarFront, ChevronDown, ChevronRight, Clock, CloudSun, Database, Globe, HeartPulse, ListChecks, Monitor, Package, Palette, SlidersHorizontal, TriangleAlert, Users, Wifi, Workflow, Zap } from "lucide-react";
import { useHouseholdSetup } from "@/hooks/use-household-setup";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useHaHealth } from "@/contexts/HaHealthContext";
import { NotificationDebugContext } from "@/contexts/NotificationContext";
import { useI18n } from "@/hooks/use-i18n";
import { ConfigurationBackup } from "@/components/ConfigurationBackup";
import { NotificationSettings } from "@/components/NotificationSettings";
import { DangerZoneSettings, SmartHomeSettings } from "@/components/SmartHomeSettings";
import { CameraConnections } from "@/components/CameraConnections";
import { CameraSettings } from "@/components/CameraSettings";
import { Switch } from "@/components/ui/switch";
import { PanelTitle } from "@/components/PanelTitle";
import { SharedSettingsStatus } from "@/components/common/SharedSettingsStatus";
import { VehicleSettings } from "@/components/VehicleSettings";
import { EnergySettings } from "@/components/EnergySettings";
import { HaHealthSettings } from "@/components/HaHealthSettings";
import HomeSettings from "./HomeSettings";
import UserSettings from "./UserSettings";
import Automations from "./Automations";
import Integrations from "./Integrations";
import History from "./History";
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
  { id: "household", title: "Household", description: "People, calendars, lists and timetables", icon: Users, items: [
    { id: "people", title: "People", description: "Visibility, order, colors and timetable access", icon: Users, content: <HomeSettings section="people" /> },
    { id: "calendars", title: "Calendars", description: "Connect calendars to the right people", icon: CalendarDays, content: <HomeSettings section="calendars" /> },
    { id: "lists", title: "To-do lists", description: "Personal tasks, daily lists and shared shopping", icon: ListChecks, content: <HomeSettings section="lists" /> },
    { id: "timetables", title: "Timetables", description: "School calendars, PDF uploads and images", icon: BookOpen, content: <HomeSettings section="timetables" /> },
  ] },
  { id: "screen", title: "Screen and alerts", description: "Appearance, language, weather and notifications", icon: Monitor, items: [
    { id: "appearance", title: "Appearance", description: "Theme, colors, artwork, glass and display density", icon: Palette, content: <UserSettings section="appearance" /> },
    { id: "language", title: "Language", description: "Language for every connected screen", icon: Globe, content: <UserSettings section="language" /> },
    { id: "weather", title: "Weather", description: "Weather source and where to show it", icon: CloudSun, content: <HomeSettings section="weather" /> },
    { id: "notifications", title: "Notifications", description: "Alerts, ongoing tasks and camera popups", icon: Bell, content: <NotificationSettings /> },
  ] },
  { id: "devices", title: "Devices", description: "Smart home, cars and cameras", icon: SlidersHorizontal, items: [
    { id: "smart-home", title: "Smart home", description: "Cards, entities and dashboard layout", icon: SlidersHorizontal, content: <SmartHomeSettings /> },
    { id: "vehicles", title: "Electric vehicles", description: "Choose which cars appear in the header", icon: CarFront, content: <VehicleSettings /> },
    { id: "electricity-price", title: "Electricity price", description: "Price sensor for Car & energy", icon: Zap, content: <EnergySettings /> },
    { id: "cameras", title: "Cameras", description: "Add cameras and choose their connections", icon: Camera, content: <CameraSettings /> },
    { id: "camera-connections", title: "Camera connections", description: "Home Assistant, go2rtc and Frigate servers", icon: Wifi, content: <CameraConnections /> },
  ] },
  { id: "system", title: "System", description: "Home Assistant, automations, backups and troubleshooting", icon: Wifi, items: [
    { id: "connection", title: "Connection & account", description: "Home Assistant connection and instance details", icon: Wifi, content: <HomeSettings section="connection" /> },
    { id: "ha-health", title: "Home Assistant health", description: "Repairs, notifications, backups and updates from Home Assistant", icon: HeartPulse, content: <HaHealthSettings /> },
    { id: "automations", title: "Automations", description: "Turn automations on or off and run their actions", icon: Workflow, content: <Automations /> },
    { id: "integrations", title: "Integrations", description: "Add and manage Home Assistant integrations", icon: Package, content: <Integrations /> },
    { id: "activity", title: "Activity", description: "What has happened at home, from Home Assistant history", icon: Clock, content: <History /> },
    { id: "backups", title: "Storage and backups", description: "Export, restore and recover shared settings", icon: Database, content: <ConfigurationBackup /> },
    { id: "debug", title: "Debug", description: "Test features in this tab until you reload.", icon: Bug, content: <DebugSettings /> },
    { id: "danger-zone", title: "Danger zone", description: "Clear the Smart home dashboard on every screen", icon: TriangleAlert, content: <DangerZoneSettings /> },
  ] },
] as const;

// These sections act on this tab or directly on Home Assistant, not on the shared settings file. Activity also holds shared Recent at home settings.
const localSections = new Set<string | undefined>(["debug", "automations", "integrations", "ha-health"]);

const legacySections: Record<string, string> = {
  connection: "connection", notifications: "notifications", "smart-home-visibility": "smart-home",
  "people-order": "people", timetables: "timetables", "family-calendar": "calendars", "family-lists": "lists",
};

export default function Settings() {
  const { section } = useParams();
  const { hash, search } = useLocation();
  const [params, setParams] = useSearchParams();
  const { t, number } = useI18n();
  const remaining = useHouseholdSetup();
  const shared = useSharedConfiguration();
  const heading = useRef<HTMLHeadingElement>(null);
  const health = useHaHealth();
  // Without an administrator token Home Assistant refuses the health reads; the section stays reachable but out of the menu.
  const healthHidden = health.repairs.status === "hidden" && health.backup.status === "hidden";
  const attention = health.items.length;
  // A small count on System and Home Assistant health when repairs or backups need the owner.
  const countBadge = attention > 0 && <span className="settings-count"><span aria-hidden="true">{number(attention)}</span>
    <span className="sr-only">{t(attention === 1 ? "1 item needs attention" : "{count} items need attention", { count: attention })}</span></span>;
  const group = groups.find(group => group.items.some(item => item.id === section));
  const selected = group?.items.find(item => item.id === section);
  useEffect(() => { heading.current?.focus(); }, [section]);
  if (!section && legacySections[hash.slice(1)]) return <Navigate to={`/settings/${legacySections[hash.slice(1)]}${search}`} replace />;
  if (section === "smart-home" && params.get("panel") === "reset" && !params.has("card")) {
    const next = new URLSearchParams(params);
    next.delete("panel");
    return <Navigate to={{ pathname: "/settings/danger-zone", search: next.toString(), hash }} replace />;
  }
  if (section && !selected) return <Navigate to="/settings" replace />;

  if (selected && group) return <div className="settings-page settings-subpage">
    <header className="settings-intro">
      <Link to={`/settings?group=${group.id}`} className="settings-back"><ArrowLeft size={18} aria-hidden="true" />{t("All settings")}</Link>
      <PanelTitle as="h1" icon={selected.icon} ref={heading} tabIndex={-1}>{t(selected.title)}</PanelTitle>
      <p className="page-note">{t(selected.description)}</p>
    </header>
    <div className="settings-content" key={section}>
      {!localSections.has(section) && (section === "backups" ? <p className="shared-settings-status">{t("Applies to every screen connected to this server.")}</p> : <SharedSettingsStatus showRecovery />)}
      {selected.content}
      {section === "people" && <Link className="settings-related text-link" to="/settings/timetables">{t("Configure timetables")}<ChevronRight size={17} aria-hidden="true" /></Link>}
    </div>
  </div>;

  const next = remaining[0];
  return <div className="settings-page settings-overview">
    <header className="settings-intro">
      <PanelTitle as="h1" icon={SlidersHorizontal} ref={heading} tabIndex={-1}>{t("Settings")}</PanelTitle>
    </header>
    {(shared?.state.error || shared?.state.dirty) && <SharedSettingsStatus showRecovery />}
    <Link className="settings-guide-link" to={next ? `/onboarding?step=${next.id}` : "/onboarding"}>
      <span><strong>{t(next ? "Continue setup" : "Guided setup")}</strong>
        <span>{next ? t(next.title) : t("Connect your home, then choose people, calendars and lists.")}</span></span>
      <ArrowRight size={22} aria-hidden="true" />
    </Link>
    <nav className="settings-menu settings-card" aria-label={t("Settings navigation")}>
      {groups.map(group => {
        const open = params.get("group") === group.id;
        return <section className="settings-group" key={group.id}>
          <h2><button type="button" className="settings-row settings-category" aria-expanded={open} aria-controls={`group-${group.id}`}
            onClick={() => setParams(previous => {
              if (open) previous.delete("group"); else previous.set("group", group.id);
              return previous;
            }, { replace: true, preventScrollReset: true })}>
            <group.icon size={23} aria-hidden="true" />
            <span><strong>{t(group.title)}</strong><small>{t(group.description)}</small></span>
            {group.id === "system" && countBadge}
            <ChevronDown className="settings-chevron" size={19} aria-hidden="true" />
          </button></h2>
          <ul id={`group-${group.id}`} hidden={!open}>{group.items.filter(item => item.id !== "ha-health" || !healthHidden).map(item => <li key={item.id}>
            <Link to={`/settings/${item.id}`} className="settings-row settings-item">
              <item.icon size={18} aria-hidden="true" /><span>{t(item.title)}</span>{item.id === "ha-health" && countBadge}<ChevronRight size={16} aria-hidden="true" />
            </Link>
          </li>)}</ul>
        </section>;
      })}
    </nav>
  </div>;
}
