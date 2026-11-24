import { useI18n } from "@/hooks/use-i18n";
import { useMotionInput } from "@/hooks/use-motion-input";
import { appVersion, useAppUpdate } from "@/hooks/use-app-update";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useMatch, type Location } from "react-router-dom";
import { MainNav, SmartHomeNav } from "./Navigation";
import { cameraPersonSensors } from "@/lib/camera-detection";
import { sonosMusicDestinations, sonosPlayers } from "@/lib/sonos";
import { MainPages } from "./MainPages";
import { SonosMiniPlayer } from "@/components/sonos/SonosMiniPlayer";
import { PageErrorBoundary } from "@/components/common/PageErrorBoundary";
import { PageContent } from "@/components/common/PageContent";
import { isHomeSection, mainPagePath } from "@/lib/navigation";
import { VehicleWidgets } from "@/components/VehicleWidgets";
import { ArtworkImage } from "@/components/ArtworkImage";
import { WeatherWidget } from "@/components/WeatherWidget";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";
import { StateWrapper } from "@/components/common/StateWrapper";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { HomeStatus } from "@/components/HomeStatus";
import { NotificationBell, NotificationCamera } from "@/components/NotificationCenter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Camera, Check, LoaderCircle, Moon, Music2, Play, RefreshCw, Settings, TriangleAlert, UserRound, X } from "lucide-react";

const ArtworkDefinitions = lazy(() => import("@/components/ArtworkDefinitions"));

export function AppLayout({ children }: { children?: ReactNode }) {
  useMotionInput();
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => document.documentElement.style.setProperty("--app-dock-height", `${entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height}px`));
    if (dock.current) observer.observe(dock.current);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--app-dock-height"); };
  }, []);
  const availableVersion = useAppUpdate();
  const { t, message } = useI18n();
  const { currentUser, currentHome, homeOnline } = useApp();
  const musicPlaying = homeOnline && sonosMusicDestinations(sonosPlayers(currentHome.entities)).some(({ player }) => player.state === "playing");
  const musicLabel = musicPlaying ? t("Sonos · Music playing") : t("Sonos");
  const { saved, memberName, appearance, smartHome } = useFamily();
  const shared = useSharedConfiguration();
  const cameraItems = shared.state.config.settings.cameras.items;
  const detectedCameras = homeOnline ? [...cameraPersonSensors(cameraItems, currentHome.entities).values()].filter(sensor => sensor.state === "on").length : 0;
  const cameraLabel = detectedCameras ? t(detectedCameras === 1 ? "Cameras · Person detected on one camera" : "Cameras · Person detected on {count} cameras", { count: detectedCameras }) : t("Cameras");
  const timetableError = shared?.state.timetableError;
  const [dismissedError, setDismissedError] = useState<string>();
  const storageWarning = shared?.state.error || (shared?.state.loaded && !saved && !shared?.state.saving);
  const storageBusy = shared?.state.saving || !shared?.state.loaded;
  const storageMessage = (shared?.state.error && message(shared.state.error)) || (shared.state.saving ? t("Saving shared settings…") : !shared.state.loaded ? t("Loading shared settings…") : !saved ? t("Shared settings are not saved yet.") : t("Shared settings saved."));
  const location = useLocation();
  const appearanceSettings = useMatch("/settings/appearance");
  const { pathname } = location;
  const mainPath = mainPagePath(pathname);
  const [locations, setLocations] = useState<Record<string, Location>>({});
  if (mainPath && locations[mainPath] !== location) setLocations({ ...locations, [mainPath]: location });
  const errorFallback = <div role="alert"><StateWrapper state="error" errorDescription={t("This page could not be loaded. Refresh the app and try again.")} onRetry={() => window.location.reload()}>{null}</StateWrapper></div>;
  const artwork = appearance.artwork === "none" ? undefined : appearance.artwork;
  const cardArtwork = Object.values(appearance.plannerArtwork).some(Boolean) || smartHome.layout.some(card => card.illustrated);
  return <div data-artwork={artwork} className={`afterglow-app board-spacing${appearance.compactMode ? " compact-mode" : ""}`}><a className="skip-link" href="#main-content">{t("Skip to content")}</a>
    {(artwork || appearanceSettings || cardArtwork) && <PageErrorBoundary fallback={null}><Suspense fallback={null}><ArtworkDefinitions /></Suspense></PageErrorBoundary>}
    {artwork && <div className="artwork-background" aria-hidden="true">
      <ArtworkImage artwork={artwork} className="artwork-ground" />
      <ArtworkImage artwork={artwork} className="artwork-horizon" />
    </div>}
    <header className="app-header"><Link to="/" className="brand" aria-label={t("Afterglow home")}><span className="brand-mark"><Moon size={23} strokeWidth={1.4} /></span><span>afterglow</span></Link>
      <VehicleWidgets /><WeatherWidget placement="header" /><div className="header-actions">
        <Link to="/sonos" className="icon-button glass-surface" aria-label={musicLabel} title={musicLabel}>
          <Music2 size={20} aria-hidden="true" />{musicPlaying && <span className="header-badge" data-tone="healthy" aria-hidden="true"><Play size={12} fill="currentColor" /></span>}
        </Link>
        <Link to="/cameras" className="icon-button glass-surface" aria-label={cameraLabel} title={cameraLabel}>
          <Camera size={20} aria-hidden="true" />{detectedCameras > 0 && <span className="header-badge" aria-hidden="true"><UserRound size={13} strokeWidth={2.6} />{detectedCameras > 1 && detectedCameras}</span>}
        </Link>
        <HomeStatus /><NotificationBell />
        <div className="relative">
          <DropdownMenu><DropdownMenuTrigger className="icon-button glass-surface" aria-label={t("Open app settings")} title={storageMessage}><Settings size={20} /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60"><DropdownMenuLabel>{currentUser?.name ?? t("Household dashboard")}</DropdownMenuLabel><DropdownMenuItem asChild><Link to="/settings">{t("All settings")}</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/settings/appearance">{t("Appearance")}</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/onboarding">{t("Get started")}</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/settings/backups">{t("Storage and backups")}</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <span role="status" aria-label={t("Settings storage")} className={`pointer-events-none absolute bottom-1 right-1 rounded-full bg-background p-0.5 ${storageWarning ? "text-warning" : "text-muted-foreground"}`}>
            {storageWarning ? <TriangleAlert size={12} aria-hidden="true" /> : storageBusy ? <LoaderCircle size={12} aria-hidden="true" className="motion-safe:animate-spin" /> : <Check size={12} aria-hidden="true" />}
            <span className="sr-only">{storageMessage}</span>
          </span>
        </div>
      </div>
    </header>
    {availableVersion && <div className="connection-banner" role="status">
      <RefreshCw size={19} aria-hidden="true" /><span className="min-w-0 flex-1">{t("Version {version} is available. Refresh the app to update.", { version: availableVersion })}</span>
      <Button variant="outline" onClick={() => window.location.reload()}>{t("Refresh app")}</Button>
    </div>}
    {timetableError && timetableError.id !== dismissedError && <div className="connection-banner" role="alert">
      <TriangleAlert size={19} aria-hidden="true" /><span className="min-w-0 flex-1"><strong>{t("{value1}’s timetable upload failed.", { value1: memberName(timetableError.member) })}</strong>{message(timetableError.message)} <Link to="/settings/timetables">{t("Timetable settings")}</Link></span>
      <button type="button" className="icon-button" aria-label={t("Dismiss timetable error")} onClick={() => setDismissedError(timetableError.id)}><X size={19} aria-hidden="true" /></button>
    </div>}
    <ConnectionBanner />
    <main id="main-content" tabIndex={-1} className={`app-main ${pathname === "/" ? "today-page" : ""}`}>
      {isHomeSection(pathname) && <SmartHomeNav />}
      <MainPages locations={locations} errorFallback={errorFallback} />
      <PageErrorBoundary key={pathname} fallback={errorFallback}>
        <Suspense fallback={<p role="status">{t("Loading…")}</p>}><PageContent active={!mainPath}>{children}</PageContent></Suspense>
      </PageErrorBoundary>
    </main>
    <footer className="app-footer"><span>{t("Version {value1}", { value1: appVersion })}</span></footer>
    <div className="app-dock" ref={dock}><SonosMiniPlayer /><MainNav locations={locations} /></div>
    <NotificationCamera />
  </div>;
}
