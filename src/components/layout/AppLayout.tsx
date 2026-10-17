import { useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { MainNav, SmartHomeNav, isHomeSection } from "./Navigation";
import { HomeSwitcher } from "./HomeSwitcher";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Check, LoaderCircle, Moon, Settings, TriangleAlert, Wifi, WifiOff } from "lucide-react";
import appConfig from "../../../config.yaml?raw";

const appVersion = appConfig.match(/^version:\s*["']?([^"'\s]+)/m)![1];

export function AppLayout() {
  const { currentUser, homeOnline } = useApp();
  const { saved } = useFamily();
  const shared = useSharedConfiguration();
  const storageWarning = shared?.state.error || !shared?.online || (shared?.state.loaded && !saved && !shared?.state.saving);
  const storageBusy = shared?.state.saving || !shared?.state.loaded;
  const storageMessage = shared?.state.error || (!shared?.online ? "Connect to Home Assistant to load and save shared settings." : shared.state.saving ? "Saving shared settings…" : !shared.state.loaded ? "Loading shared settings…" : !saved ? "Shared settings are not saved yet." : "Shared settings saved.");
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const section = hash && document.getElementById(hash.slice(1));
    if (section) section.scrollIntoView?.(); else window.scrollTo?.(0, 0);
  }, [pathname, hash]);
  return <div className="afterglow-app"><a className="skip-link" href="#main-content">Skip to content</a>
    <header className="app-header"><Link to="/" className="brand" aria-label="Afterglow home"><span className="brand-mark"><Moon size={23} strokeWidth={1.4} /></span><span>afterglow<small>FAMILY, AT THE CENTRE</small></span></Link>
      <div className="header-home"><HomeSwitcher /></div><div className="header-actions"><span className="hub-state">{homeOnline ? <Wifi size={15} /> : <WifiOff size={15} />}<span>{homeOnline ? "Home Assistant" : "HA offline"}</span></span>
        <div className="relative">
          <DropdownMenu><DropdownMenuTrigger className="icon-button" aria-label="Open app settings" title={shared?.enabled ? storageMessage : undefined}><Settings size={20} /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60"><DropdownMenuLabel>{currentUser?.name ?? "Local planner"}</DropdownMenuLabel><DropdownMenuItem asChild><Link to="/user-settings">App preferences</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/settings">Home settings</Link></DropdownMenuItem>{shared?.enabled && <DropdownMenuItem asChild><Link to="/user-settings">Storage and backups</Link></DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
          {shared?.enabled && <span role="status" aria-label="Settings storage" className={`pointer-events-none absolute bottom-1 right-1 rounded-full bg-background p-0.5 ${storageWarning ? "text-warning" : "text-muted-foreground"}`}>
            {storageWarning ? <TriangleAlert size={12} aria-hidden="true" /> : storageBusy ? <LoaderCircle size={12} aria-hidden="true" className="motion-safe:animate-spin" /> : <Check size={12} aria-hidden="true" />}
            <span className="sr-only">{storageMessage}</span>
          </span>}
        </div>
      </div>
    </header>
    <ConnectionBanner />
    <main id="main-content" className={`app-main ${pathname === "/" ? "today-page" : ""}`}>
      {isHomeSection(pathname) && <SmartHomeNav />}
      <Outlet />
    </main>
    <footer className="app-footer"><span><span className="whitespace-nowrap">Version {appVersion}</span> · {shared?.enabled ? "Shared app settings" : "Local family planner"} · {saved ? shared?.enabled ? "Settings saved on the server" : "Planner saved on this screen" : "Changes aren’t being saved"}</span><span>Made for the moments in between.</span></footer>
    <MainNav />
  </div>;
}
