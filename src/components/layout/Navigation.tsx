import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import {
  LayoutDashboard, Lightbulb, DoorOpen, Sparkles, Workflow,
  Zap, Bell, Clock, Settings, HeadsetIcon,
} from "lucide-react";

const mainNavItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/devices", label: "Devices", icon: Lightbulb },
  { path: "/rooms", label: "Rooms", icon: DoorOpen },
  { path: "/moods", label: "Moods", icon: Sparkles },
  { path: "/automation", label: "Automation", icon: Workflow },
];

const mobileNavItems = mainNavItems.slice(0, 5);

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-md safe-area-bottom md:hidden"
         role="navigation" aria-label="Main navigation">
      <div className="flex items-stretch">
        {mobileNavItems.map(item => {
          const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-2xs font-medium transition-colors touch-target",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const allNavItems = [
  ...mainNavItems,
  { path: "/energy", label: "Energy", icon: Zap },
  { path: "/notifications", label: "Notifications", icon: Bell },
  { path: "/history", label: "History", icon: Clock },
  { path: "/settings", label: "Settings", icon: Settings },
];

const supportNavItems = [
  { path: "/support", label: "Support", icon: HeadsetIcon },
];

export function DesktopSidebarNav() {
  const location = useLocation();
  const { currentUser } = useApp();
  const showSupport = currentUser.role === "support" || currentUser.role === "admin";

  const renderItem = (item: typeof allNavItems[0]) => {
    const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors touch-target",
          active
            ? "bg-accent text-accent-foreground"
            : "text-sidebar-foreground hover:bg-accent/50"
        )}
        aria-current={active ? "page" : undefined}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {item.label}
      </Link>
    );
  };

  return (
    <nav className="flex flex-col gap-1 px-2" aria-label="Main navigation">
      {allNavItems.map(renderItem)}
      {showSupport && (
        <>
          <div className="my-2 border-t" />
          <span className="px-3 text-2xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Support</span>
          {supportNavItems.map(renderItem)}
        </>
      )}
    </nav>
  );
}
