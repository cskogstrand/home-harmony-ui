import { useI18n } from "@/hooks/use-i18n";
import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { House, CalendarDays, ListChecks, BookOpen, SlidersHorizontal, Grid2X2, Lightbulb, DoorOpen, MapPin, Sparkles, Shield, Zap, Workflow, Clock, Bell, Settings, Package } from "lucide-react";

const familyPaths = ["/", "/calendar", "/lists", "/school"];
export const isHomeSection = (path: string) => !familyPaths.includes(path) && !["/user-settings", "/onboarding"].includes(path);
const mainItems = [
  { path: "/", label: "Today", icon: House },
  { path: "/calendar", label: "Our week", icon: CalendarDays },
  { path: "/lists", label: "Lists", icon: ListChecks },
  { path: "/school", label: "School", icon: BookOpen },
  { path: "/home", label: "Smart home", icon: SlidersHorizontal },
];
export function MainNav() {
  const { t, message } = useI18n();
  const { pathname } = useLocation();
  return <nav className="family-dock" aria-label={t("Main navigation")}>{mainItems.map(item => <Link to={item.path} key={item.path} aria-current={(item.path === "/home" ? isHomeSection(pathname) : pathname === item.path) ? "page" : undefined}><item.icon size={23} strokeWidth={1.6} /><span>{message(item.label)}</span></Link>)}</nav>;
}
const smartItems = [
  { path: "/home", label: "Overview", icon: Grid2X2 }, { path: "/areas", label: "Areas", icon: DoorOpen },
  { path: "/zones", label: "Zones", icon: MapPin },
  { path: "/devices", label: "Devices", icon: Lightbulb }, { path: "/moods", label: "Scenes", icon: Sparkles },
  { path: "/alarm", label: "Security", icon: Shield }, { path: "/energy", label: "Car & energy", icon: Zap },
  { path: "/automations", label: "Automations", icon: Workflow }, { path: "/notifications", label: "Alerts", icon: Bell },
  { path: "/history", label: "Activity", icon: Clock }, { path: "/integrations", label: "Integrations", icon: Package },
  { path: "/settings", label: "Home settings", icon: Settings },
];
export function SmartHomeNav() {
  const { t, message } = useI18n();
  const { pathname } = useLocation();
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    navigation.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
  }, [pathname]);
  return <nav ref={navigation} className="smart-nav" aria-label={t("Smart home navigation")}>{smartItems.map(item => <Link key={item.path} to={item.path} aria-current={pathname === item.path || pathname.startsWith(`${item.path}/`) || item.path === "/devices" && pathname.startsWith("/entities/") ? "page" : undefined}><item.icon size={16} />{message(item.label)}</Link>)}</nav>;
}
