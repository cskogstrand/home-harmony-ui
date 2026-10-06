import { useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { MainNav, SmartHomeNav, isHomeSection } from "./Navigation";
import { HomeSwitcher } from "./HomeSwitcher";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Moon, Settings, Wifi, WifiOff } from "lucide-react";

export function AppLayout() {
  const { currentUser, homeOnline } = useApp();
  const { saved } = useFamily();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo?.(0, 0); }, [pathname]);
  return <div className="afterglow-app"><a className="skip-link" href="#main-content">Skip to content</a>
    <header className="app-header"><Link to="/" className="brand" aria-label="Afterglow home"><span className="brand-mark"><Moon size={23} strokeWidth={1.4} /></span><span>afterglow<small>FAMILY, AT THE CENTRE</small></span></Link>
      <div className="header-home"><HomeSwitcher /></div><div className="header-actions"><span className="hub-state">{homeOnline ? <Wifi size={15} /> : <WifiOff size={15} />}<span>{homeOnline ? "Home Assistant" : "HA offline"}</span></span>
        <DropdownMenu><DropdownMenuTrigger className="icon-button" aria-label="Open app settings"><Settings size={20} /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60"><DropdownMenuLabel>{currentUser?.name ?? "Local planner"}</DropdownMenuLabel><DropdownMenuItem asChild><Link to="/user-settings">App preferences</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/settings">Home settings</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
    </header>
    <ConnectionBanner />
    <main id="main-content" className={`app-main ${pathname === "/" ? "today-page" : ""}`}>
      {isHomeSection(pathname) && <SmartHomeNav />}
      <Outlet />
    </main>
    <footer className="app-footer"><span>Local family planner · {saved ? "Planner saved on this screen" : "Changes aren’t being saved"}</span><span>Made for the moments in between.</span></footer>
    <MainNav />
  </div>;
}
