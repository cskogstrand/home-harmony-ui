import { useI18n } from "@/hooks/use-i18n";
import { useMotionInput } from "@/hooks/use-motion-input";
import { appVersion, useAppUpdate } from "@/hooks/use-app-update";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useMatch, type Location } from "react-router-dom";
import { MainNav, SmartHomeNav } from "./Navigation";
import { useHouseholdSetup } from "@/hooks/use-household-setup";
import { cameraPersonSensors } from "@/lib/camera-detection";
import { sonosMusicDestinations, sonosPlayers } from "@/lib/sonos";
import { MainPages } from "./MainPages";
import { SonosMiniPlayer } from "@/components/sonos/SonosMiniPlayer";
import { PageErrorBoundary } from "@/components/common/PageErrorBoundary";
import { PageContent } from "@/components/common/PageContent";
import { PageSkeleton } from "@/components/common/PageSkeleton";
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
import { AskTheHouse } from "@/components/AskTheHouse";
import { NotificationBell, NotificationCamera } from "@/components/NotificationCenter";
import { Camera, LoaderCircle, Moon, Music2, Play, RefreshCw, Settings, TriangleAlert, UserRound, X } from "lucide-react";

const ArtworkDefinitions = lazy(() => import("@/components/ArtworkDefinitions"));

export function AppLayout({ children }: { children?: ReactNode }) {
  useMotionInput();
  const dock = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    // The dock and the sticky header publish their heights, so scrolling, focus and in-page sticky rows clear both.
    const properties = new Map<Element | null, string>([[dock.current, "--app-dock-height"], [header.current, "--app-header-height"]]);
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) document.documentElement.style.setProperty(properties.get(entry.target)!, `${entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height}px`);
    });
    for (const element of properties.keys()) if (element) observer.observe(element);
    return () => { observer.disconnect(); for (const property of properties.values()) document.documentElement.style.removeProperty(property); };
  }, []);
  useEffect(() => {
    // The header's reading surface appears once content scrolls beneath it; at rest the artwork stays visible behind it.
    const update = () => header.current?.toggleAttribute("data-scrolled", window.scrollY > 0);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const availableVersion = useAppUpdate();
  const { t, message, dateLabel } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const playingGroup = homeOnline ? sonosMusicDestinations(sonosPlayers(currentHome.entities)).find(({ player }) => player.state === "playing") : undefined;
  const musicLabel = playingGroup ? t("Sonos · Music playing") : t("Sonos");
  const { saved, memberName, appearance, smartHome, today, time } = useFamily();
  const shared = useSharedConfiguration();
  const cameraItems = shared.state.config.settings.cameras.items;
  const detectedCameras = homeOnline ? [...cameraPersonSensors(cameraItems, currentHome.entities).values()].filter(sensor => sensor.state === "on").length : 0;
  const cameraLabel = detectedCameras ? t(detectedCameras === 1 ? "Cameras · Person detected on one camera" : "Cameras · Person detected on {count} cameras", { count: detectedCameras }) : t("Cameras");
  const timetableError = shared?.state.timetableError;
  const [dismissedError, setDismissedError] = useState<string>();
  const storageWarning = shared?.state.error || (shared?.state.loaded && !saved && !shared?.state.saving);
  const storageBusy = shared?.state.saving || !shared?.state.loaded;
  const storageMessage = (shared?.state.error && message(shared.state.error)) || (shared.state.saving ? t("Saving shared settings…") : !shared.state.loaded ? t("Loading shared settings…") : !saved ? t("Shared settings are not saved yet.") : t("Shared settings saved."));
  const missingSteps = useHouseholdSetup();
  const setupMessage = missingSteps.length ? t(missingSteps.length === 1 ? "One setup step remaining" : "{count} setup steps remaining", { count: missingSteps.length }) : "";
  const location = useLocation();
  const appearanceSettings = useMatch("/settings/appearance");
  const { pathname } = location;
  const todayPage = pathname === "/";
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
    <header ref={header} className="app-header sticky-header">
      {/* Today has its large ambient clock; every other page carries the time in the wordmark's place, still the link home. */}
      {todayPage ? <Link to="/" className="brand" aria-label={t("Afterglow home")}><span className="brand-mark"><Moon size={23} strokeWidth={1.4} /></span><span className="brand-name">afterglow</span></Link>
        : <Link to="/" className="brand" data-clock="" title={dateLabel(today, { weekday: "long", day: "numeric", month: "long" })}>
          <span className="brand-mark"><Moon size={23} strokeWidth={1.4} /></span>
          <span className="header-clock"><time dateTime={`${today}T${time}`}>{time}</time>{" "}<span className="header-date">{dateLabel(today)}</span>{" "}<span className="sr-only">{t("Afterglow home")}</span></span>
        </Link>}
      <WeatherWidget placement="header" besideClock={!todayPage} />
      {/* Vehicles and controls share one trailing group. On phones it wraps upwards: the controls keep the first row and the vehicle chip drops below when the row cannot hold it. */}
      <div className="header-trail"><VehicleWidgets /><div className="header-actions">
        <AskTheHouse />
        <Link to={playingGroup ? `/sonos?player=${encodeURIComponent(playingGroup.player.entityId)}` : "/sonos"} className="icon-button glass-surface" aria-label={musicLabel} title={musicLabel}>
          <Music2 size={20} aria-hidden="true" />{playingGroup && <span className="header-badge" data-tone="healthy" aria-hidden="true"><Play size={12} fill="currentColor" /></span>}
        </Link>
        <Link to="/cameras" className="icon-button glass-surface" aria-label={cameraLabel} title={cameraLabel}>
          <Camera size={20} aria-hidden="true" />{detectedCameras > 0 && <span className="header-badge" aria-hidden="true"><UserRound size={13} strokeWidth={2.6} />{detectedCameras > 1 && detectedCameras}</span>}
        </Link>
        <HomeStatus /><NotificationBell />
        <div className="relative">
          <Link to="/settings" className="icon-button glass-surface" aria-label={t("Open app settings")} aria-describedby={storageWarning || storageBusy ? "header-storage-status" : setupMessage ? "header-setup-status" : undefined}
            title={storageWarning || storageBusy ? storageMessage : setupMessage || t("Open app settings")}>
            <Settings size={20} aria-hidden="true" />
            {(storageWarning || storageBusy || setupMessage) && <span className="header-badge" data-tone={storageWarning || setupMessage ? "attention" : undefined} aria-hidden="true">
              {storageWarning ? <TriangleAlert size={13} /> : storageBusy ? <LoaderCircle size={13} className="motion-safe:animate-spin" /> : missingSteps.length}
            </span>}
          </Link>
          {setupMessage && <span className="sr-only" id="header-setup-status">{setupMessage}</span>}
          <span role="status" id="header-storage-status" aria-label={t("Settings storage")} className="sr-only">{storageMessage}</span>
        </div>
      </div></div>
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
    <main id="main-content" tabIndex={-1} className={`app-main ${todayPage ? "today-page" : ""}`}>
      {isHomeSection(pathname) && <SmartHomeNav />}
      <MainPages locations={locations} errorFallback={errorFallback} />
      <PageErrorBoundary key={pathname} fallback={errorFallback}>
        <Suspense fallback={<PageSkeleton />}><PageContent active={!mainPath}>{children}</PageContent></Suspense>
      </PageErrorBoundary>
    </main>
    <footer className="app-footer"><span>{t("Version {value1}", { value1: appVersion })}</span></footer>
    <div className="app-dock" ref={dock}><SonosMiniPlayer /><MainNav locations={locations} /></div>
    <NotificationCamera />
  </div>;
}
