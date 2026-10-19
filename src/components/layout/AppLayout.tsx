import { useI18n } from "@/hooks/use-i18n";
import { useMotionInput } from "@/hooks/use-motion-input";
import { Suspense, useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { MainNav, SmartHomeNav } from "./Navigation";
import { isHomeSection } from "@/lib/navigation";
import { HomeSwitcher } from "./HomeSwitcher";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Check, LoaderCircle, Moon, Settings, TriangleAlert, Wifi, WifiOff, X } from "lucide-react";
import appConfig from "../../../config.yaml?raw";

const appVersion = appConfig.match(/^version:\s*["']?([^"'\s]+)/m)![1];

export function AppLayout() {
  useMotionInput();
  const { t, message } = useI18n();
  const { currentUser, homeOnline } = useApp();
  const { saved, memberName, appearance } = useFamily();
  const shared = useSharedConfiguration();
  const timetableError = shared?.state.timetableError;
  const [dismissedError, setDismissedError] = useState<string>();
  const storageWarning = shared?.state.error || (shared?.state.loaded && !saved && !shared?.state.saving);
  const storageBusy = shared?.state.saving || !shared?.state.loaded;
  const storageMessage = (shared?.state.error && message(shared.state.error)) || (shared.state.saving ? t("Saving shared settings…") : !shared.state.loaded ? t("Loading shared settings…") : !saved ? t("Shared settings are not saved yet.") : t("Shared settings saved."));
  const { pathname } = useLocation();
  return <div className={`afterglow-app${appearance.compactMode ? " compact-mode" : ""}`}><a className="skip-link" href="#main-content">{t("Skip to content")}</a>
    <header className="app-header"><Link to="/" className="brand" aria-label={t("Afterglow home")}><span className="brand-mark"><Moon size={23} strokeWidth={1.4} /></span><span>afterglow</span></Link>
      <div className="header-home"><HomeSwitcher /></div><div className="header-actions"><span className="hub-state">{homeOnline ? <Wifi size={15} /> : <WifiOff size={15} />}<span>{homeOnline ? "Home Assistant" : t("HA offline")}</span></span>
        <div className="relative">
          <DropdownMenu><DropdownMenuTrigger className="icon-button" aria-label={t("Open app settings")} title={storageMessage}><Settings size={20} /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60"><DropdownMenuLabel>{currentUser?.name ?? t("Household dashboard")}</DropdownMenuLabel><DropdownMenuItem asChild><Link to="/user-settings">{t("App preferences")}</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/settings">{t("Home settings")}</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/onboarding">{t("Get started")}</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/user-settings">{t("Storage and backups")}</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <span role="status" aria-label={t("Settings storage")} className={`pointer-events-none absolute bottom-1 right-1 rounded-full bg-background p-0.5 ${storageWarning ? "text-warning" : "text-muted-foreground"}`}>
            {storageWarning ? <TriangleAlert size={12} aria-hidden="true" /> : storageBusy ? <LoaderCircle size={12} aria-hidden="true" className="motion-safe:animate-spin" /> : <Check size={12} aria-hidden="true" />}
            <span className="sr-only">{storageMessage}</span>
          </span>
        </div>
      </div>
    </header>
    {timetableError && timetableError.id !== dismissedError && <div className="connection-banner" role="alert">
      <TriangleAlert size={19} aria-hidden="true" /><span className="min-w-0 flex-1"><strong>{t("{value1}’s timetable upload failed.", { value1: memberName(timetableError.member) })}</strong>{message(timetableError.message)} <Link to="/school">{t("Open School")}</Link></span>
      <button type="button" className="icon-button" aria-label={t("Dismiss timetable error")} onClick={() => setDismissedError(timetableError.id)}><X size={19} aria-hidden="true" /></button>
    </div>}
    <ConnectionBanner />
    <main id="main-content" tabIndex={-1} className={`app-main ${pathname === "/" ? "today-page" : ""}`}>
      {isHomeSection(pathname) && <SmartHomeNav />}
      <Suspense fallback={<p role="status">{t("Loading…")}</p>}><PageOutlet /></Suspense>
    </main>
    <footer className="app-footer"><span>{t("Version {value1}", { value1: appVersion })}</span></footer>
    <MainNav />
  </div>;
}

function PageOutlet() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const section = hash && document.getElementById(hash.slice(1));
    if (section) section.scrollIntoView?.(); else window.scrollTo?.(0, 0);
  }, [pathname, hash]);
  return <Outlet />;
}
