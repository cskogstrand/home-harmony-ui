import { isHomeSection, mainPagePath, moreItems, smartItems } from "@/lib/navigation";
import { useI18n } from "@/hooks/use-i18n";
import { Link, useLocation, type Location } from "react-router-dom";
import { BookOpen, CalendarDays, ChevronDown, House, ListChecks, SlidersHorizontal } from "lucide-react";
import { useRevealSelection } from "@/hooks/use-reveal-selection";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const mainItems = [
  { path: "/", label: "Today", icon: House },
  { path: "/calendar", label: "Calendar", icon: CalendarDays },
  { path: "/lists", label: "Lists", icon: ListChecks },
  { path: "/school", label: "School", icon: BookOpen },
  { path: "/home", label: "Smart home", icon: SlidersHorizontal },
];
export function MainNav({ locations = {} }: { locations?: Record<string, Location> }) {
  const { t, message } = useI18n();
  const { pathname } = useLocation();
  return <nav className="family-dock glass-surface" aria-label={t("Main navigation")}>{mainItems.map(item => <Link className="press-feedback" to={locations[item.path] ?? item.path} key={item.path} aria-current={(item.path === "/home" ? isHomeSection(pathname) : mainPagePath(pathname) === item.path) ? "page" : undefined}><item.icon size={23} strokeWidth={1.8} aria-hidden="true" /><span>{message(item.label)}</span></Link>)}</nav>;
}
export function SmartHomeNav() {
  const { t, message } = useI18n();
  const { pathname } = useLocation();
  const nav = useRevealSelection<HTMLDivElement>(pathname);
  const current = pathname.toLowerCase();
  const active = (path: string) => current === path || current.startsWith(`${path}/`) || path === "/devices" && current.startsWith("/entities/");
  const selectedMore = moreItems.find(item => active(item.path));
  const moreLabel = selectedMore ? message(selectedMore.label) : t("More controls");
  return <nav className="smart-nav" aria-label={t("Smart home navigation")}>
    <div ref={nav} className="smart-nav-links">{smartItems.map(item => <Link key={item.path} to={item.path} aria-current={active(item.path) ? "page" : undefined}><item.icon size={18} aria-hidden="true" />{message(item.label)}</Link>)}</div>
    <div className="smart-more"><DropdownMenu>
      <DropdownMenuTrigger data-active={!!selectedMore} aria-label={moreLabel}><span className="smart-more-full">{moreLabel}</span><span className="smart-more-short" aria-hidden="true">{selectedMore ? moreLabel : t("More")}</span><ChevronDown size={16} aria-hidden="true" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="smart-menu">{moreItems.map(item => <DropdownMenuItem asChild key={item.path}><Link to={item.path} aria-current={active(item.path) ? "page" : undefined}><item.icon size={18} aria-hidden="true" />{message(item.label)}</Link></DropdownMenuItem>)}</DropdownMenuContent>
    </DropdownMenu></div>
  </nav>;
}
