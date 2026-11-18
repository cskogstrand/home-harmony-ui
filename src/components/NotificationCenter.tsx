import { notificationTriggers } from "../../shared/notifications";
import { PanelTitle } from "@/components/PanelTitle";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { Bell, Camera, ChevronDown, Image, ListChecks, X } from "lucide-react";
import { configuredCamera } from "../../shared/cameras";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { CameraPersonSnapshot } from "./CameraPersonSnapshot";
import { useNotifications } from "@/contexts/NotificationContext";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { available, entityStateLabel } from "@/lib/ha-model";
import { matchesState, notificationEntity, notificationReadings, showsOngoingSummary, type HomeNotification } from "@/lib/notifications";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { EntityMedia, MediaSurface } from "./devices/EntityMedia";
import type { Entity } from "@/types/api";
import type { NotificationPresentation } from "../../shared/notifications";
import { NotificationIcon } from "./NotificationIcon";
import { NotificationProgress } from "./NotificationProgress";
import "./devices/device-cards.css";
import "./notifications.css";

export function NotificationBell() {
  const { message: t } = useI18n();
  const { notifications, errors } = useNotifications();
  const titles = notifications.filter(item => item.rule.kind !== "camera").map(item => item.eventTitle || item.rule.title).join(", ");
  return <><Link id="notification-bell" to="/notifications" className="icon-button glass-surface relative" aria-label={t("Notifications: {count} active", { count: notifications.length })}>
    <Bell size={20} aria-hidden="true" />{(notifications.length > 0 || errors.length > 0) && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground" aria-hidden="true">{notifications.length || "!"}</span>}
  </Link><span role="status" aria-atomic="true" className="sr-only">{titles ? t("Active notifications: {titles}", { titles }) : notifications.length ? "" : t("No active notifications")}</span></>;
}

type PreviewMode = "current" | "sample";

function NotificationCameraFeed({ item, preview, compact = false }: { item: HomeNotification; preview?: PreviewMode; compact?: boolean }) {
  const { message: t } = useI18n();
  const shared = useSharedConfiguration();
  const { camera } = useNotifications();
  const selected = configuredCamera(shared?.state.config.settings.cameras, item.rule.cameraEntity);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!globalThis.IntersectionObserver && !document.hidden);
  useEffect(() => {
    if (preview === "sample") return;
    let inView = !globalThis.IntersectionObserver;
    const update = () => setVisible(inView && !document.hidden);
    const observer = globalThis.IntersectionObserver && new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); }, { rootMargin: "100px" });
    if (ref.current) observer?.observe(ref.current);
    document.addEventListener("visibilitychange", update); update();
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, [preview]);
  return <div ref={ref} className="notification-camera-feed smart-media-preview">
    {preview === "sample" || !visible ? <div className="notification-camera-placeholder"><Camera size={compact ? 24 : 32} aria-hidden="true" /><span className={compact ? "sr-only" : undefined}>{t(preview === "sample" ? "Camera preview" : "Stream paused")}</span></div>
      : !selected ? <p role="status">{t("Camera unavailable. Check the selected camera in notification settings.")}</p>
      : item.rule.cameraMedia === "person" ? <CameraPersonSnapshot key={selected.id} cameraId={selected.id} />
      : <MediaSurface camera={selected} showPerson={item.rule.showPersonSnapshot} />}
    <button type="button" className="smart-media-open" disabled={!!preview} aria-haspopup="dialog"
      aria-label={t("Show camera")} onClick={() => camera(item.id, true)} />
  </div>;
}

function restoreAlertFocus(container: HTMLElement | null) {
  if (container?.contains(document.activeElement)) document.getElementById("notification-bell")?.focus({ preventScroll: true });
}

function useAlertFocusOnRemoval() {
  const element = useRef<HTMLElement | null>(null);
  return useCallback((node: HTMLElement | null) => {
    if (!node) restoreAlertFocus(element.current);
    element.current = node;
  }, []);
}

export function NotificationRow({ item, condensed = false, activity = false, compactActivity = false, preview, neighbor = false, entities: previewEntities }: { item: HomeNotification; condensed?: boolean; activity?: boolean; compactActivity?: boolean; preview?: PreviewMode; neighbor?: boolean; entities?: Entity[] }) {
  const { message: t, language, locale } = useI18n();
  const { currentHome } = useApp();
  const { dismiss } = useNotifications();
  const entities = previewEntities ?? currentHome.entities;
  const readings = notificationReadings(item.rule).map(reading => ({ ...reading, position: reading.placement === "auto" ? reading.defaultPlacement : reading.placement }))
    .filter(reading => reading.position !== "hidden" && !(condensed && reading.placement === "auto" && reading.position === "subtitle"));
  const at = (position: string) => readings.filter(reading => reading.position === position);
  const row = useAlertFocusOnRemoval();
  const showCamera = item.rule.kind === "camera" || item.rule.kind === "ongoing" && !!item.rule.cameraEntity;
  const cameraPosition = activity ? item.rule.cameraPlacement ?? "footer" : "footer";
  const imagePosition = activity ? item.rule.imagePlacement ?? "left" : "footer";
  const image = notificationEntity(entities, item.rule.imageEntity ?? "");
  const cameraContent = showCamera && <NotificationCameraFeed item={item} preview={preview} compact={cameraPosition !== "footer"} />;
  const imageContent = item.rule.imageEntity && <div className="notification-image-feed">
    {preview === "sample" ? <div className="notification-camera-placeholder"><Image size={imagePosition === "footer" ? 32 : 24} aria-hidden="true" /><span className={imagePosition === "footer" ? undefined : "sr-only"}>{t("Image preview")}</span></div>
      : image?.domain === "image" ? <EntityMedia key={image.preferenceId} entity={image} trimTransparent showExpandIcon={false} />
      : <p role="status">{t("Image unavailable. Choose another image in notification settings.")}</p>}
  </div>;
  const hasColumn = (position: "left" | "right") => at(position).length > 0 || showCamera && cameraPosition === position || !!imageContent && imagePosition === position;
  const time = new Intl.DateTimeFormat(locale, { timeZone: currentHome.timeZone, hour: "2-digit", minute: "2-digit" });
  const renderReading = (reading: typeof readings[number], prominent = false) => {
    const entity = notificationEntity(entities, reading.entity);
    const name = reading.name || `${entity?.name ?? t("Entity unavailable")}${reading.attribute ? ` · ${reading.attribute}` : ""}`;
    const raw = reading.attribute ? entity?.attributes[reading.attribute] : entity?.state;
    const readable = entity && available(entity) && entity.attributes.mode !== "password" && ["string", "number", "boolean"].includes(typeof raw);
    const value = !readable ? t("Entity unavailable") : !reading.attribute && entity.attributes.device_class === "timestamp" && Number.isFinite(Date.parse(String(raw))) ? time.format(Date.parse(String(raw))) : entityStateLabel(reading.attribute ? { ...entity, domain: "sensor", state: String(raw) } : entity, language);
    const unit = readable && !reading.attribute && typeof entity.attributes.unit_of_measurement === "string" ? ` ${entity.attributes.unit_of_measurement}` : "";
    const key = JSON.stringify([reading.entity, reading.attribute]);
    const hideName = activity && reading.hideName;
    return prominent ? <div key={key}><span className={hideName ? "sr-only" : undefined}>{name}</span><strong>{value}{unit && <small>{unit}</small>}</strong></div> : <p key={key} className="text-sm">{hideName ? <span className="sr-only">{name}: </span> : `${name} · `}{value}{unit}</p>;
  };
  const icon = <NotificationIcon rule={item.rule} animate={activity && item.rule.kind === "ongoing"} />;
  const dismissAction = item.rule.kind !== "ongoing" && <Button type="button" disabled={!!preview} size="icon" variant="ghost" className="shrink-0" aria-label={t("Dismiss {name}", { name: item.eventTitle || item.rule.title })} onClick={() => dismiss(item.id)}><X size={18} aria-hidden="true" /></Button>;
  const title = <strong className="block">{item.eventTitle || item.rule.title}</strong>;
  return <li ref={row} data-preview-neighbor={neighbor || undefined} className={activity ? `notification-activity${compactActivity ? " notification-activity-compact" : ""}` : condensed ? "notification-row flex min-w-0 flex-1 basis-56 items-start gap-2 py-1 text-sm" : "notification-row flex items-start gap-3 border-t py-3 first:border-0"}>
    {!activity && icon}
    <div className="notification-body min-w-0 flex-1 break-words">
      {activity ? <div className="notification-activity-heading">{title}{icon}{dismissAction}</div> : title}
      {!condensed && item.eventTitle && <p className="text-sm text-muted-foreground">{item.rule.title} · {t(item.eventStart > Date.now() ? "Starts at {time}" : "Started at {time}", { time: time.format(item.eventStart) })}</p>}
      {!condensed && item.rule.message && <p className="text-sm">{item.rule.message}</p>}
      {!!at("subtitle").length && <div data-placement="subtitle" className="text-muted-foreground">{at("subtitle").map(reading => renderReading(reading))}</div>}
      {(hasColumn("left") || hasColumn("right")) && <div className={activity ? "notification-activity-readings" : ""}>
        {(["left", "right"] as const).map(position => hasColumn(position) && <div key={position} data-placement={position}>
          {imagePosition === position && imageContent && <div className="notification-media-side">{imageContent}</div>}
          {cameraPosition === position && showCamera && <div className="notification-media-side">{cameraContent}</div>}
          {at(position).map(reading => renderReading(reading, activity))}
        </div>)}
      </div>}
      {readings.some(reading => !notificationEntity(entities, reading.entity)) && <p className="text-sm text-muted-foreground">{t("Some additional readings are unavailable")}</p>}
      {imagePosition === "footer" && imageContent}
      {cameraPosition === "footer" && cameraContent}
      {!!at("footer").length && <div data-placement="footer" className="notification-reading-footer">{at("footer").map(reading => renderReading(reading))}</div>}
      {item.rule.kind === "ongoing" && item.rule.progress && <NotificationProgress progress={item.rule.progress} entities={entities} title={item.rule.title} />}
    </div>
    {!activity && dismissAction}
  </li>;
}

function NotificationPresence({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!present) restoreAlertFocus(ref.current);
    ref.current?.toggleAttribute("inert", !present);
  }, [present]);
  return <motion.div className="notification-presence" ref={ref} aria-hidden={!present || undefined}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .16 }}>
    {children}
  </motion.div>;
}

export function NotificationSurface({ items: notifications, compact, presentation, viewAllCount, preview, entities, focus, children }: {
  items: HomeNotification[]; compact: boolean; presentation: NotificationPresentation; viewAllCount?: number;
  preview?: PreviewMode; entities?: Entity[]; focus?: HomeNotification; children?: ReactNode;
}) {
  const { message: t } = useI18n();
  const headingRef = useAlertFocusOnRemoval();
  const style = (item: HomeNotification) => item.rule.presentation ?? presentation;
  const banner = compact && (notifications.length ? notifications.every(item => style(item) === "banner") : presentation === "banner");
  const sectionFrame = !banner && (notifications.length ? notifications.every(item => style(item) === "section" || (!compact && style(item) === "banner")) : !["activity", "activity-compact"].includes(presentation));
  const groups = [
    { kind: "ongoing", title: "Ongoing tasks", icon: ListChecks },
    { kind: "current", title: "Current alerts", icon: Bell },
    { kind: "camera", title: "Camera popup", icon: Camera },
  ] as const;
  const visibleItems = (items: HomeNotification[]) => {
    if (!compact || items.length <= 3) return items;
    return focus && items.indexOf(focus) >= 3 ? [...items.slice(0, 2), focus] : items.slice(0, 3);
  };
  const bannerItems = banner ? visibleItems([...groups].reverse().flatMap(group => notifications.filter(item => item.rule.kind === group.kind))) : [];
  const row = (item: HomeNotification) => {
    const type = style(item);
    const neighbor = !!focus && item !== focus;
    // Keep the draft’s first-row divider when earlier section rows are out of view.
    if (neighbor && type === "section") return <li key={item.id} hidden />;
    return <NotificationRow key={item.id} item={item} neighbor={neighbor} condensed={compact && type === "banner"}
      activity={type === "activity" || type === "activity-compact"} compactActivity={type === "activity-compact"}
      entities={neighbor ? undefined : entities} preview={preview} />;
  };
  const viewAll = viewAllCount !== undefined && t("View all ({count})", { count: viewAllCount });
  const heading = viewAll && <div ref={headingRef} className={`${banner ? "ml-auto" : "mb-3 justify-between"} flex flex-wrap items-center gap-2`}>
    <PanelTitle icon={Bell} className={banner ? "sr-only" : "font-semibold"}>{t("Happening now")}</PanelTitle>
    {preview ? <span className="text-link text-sm">{viewAll}</span> : <Link className="text-link text-sm" to="/notifications">{viewAll}</Link>}
  </div>;
  return <section className={banner ? "notification-banner mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-primary/20 px-4 py-2" : sectionFrame ? "glow-panel mb-5" : "notification-activities mb-5"} aria-label={t("Active notifications")}>
    {!banner && heading}
    {children}
    {banner ? <ul className="flex min-w-0 flex-1 basis-72 flex-wrap gap-x-5 gap-y-2">{bannerItems.map(row)}</ul> : <div className="notification-groups">
      {groups.map(group => {
        if (focus && focus.rule.kind !== group.kind) return null;
        const items = notifications.filter(item => item.rule.kind === group.kind);
        const banners = compact ? items.filter(item => style(item) === "banner") : [];
        const sections = items.filter(item => style(item) === "section" || (!compact && style(item) === "banner"));
        const cards = items.filter(item => ["activity", "activity-compact"].includes(style(item)));
        const includesFocus = (items: HomeNotification[]) => items.length > 0 && (!focus || items.includes(focus));
        const hideHeading = compact && notifications.every(item => item.rule.kind === group.kind);
        return items.length > 0 && <section key={group.kind} className="min-w-0" aria-label={t(group.title)}>
          {(!preview || !hideHeading) && <PanelTitle as="h3" icon={group.icon} className={hideHeading ? "sr-only" : "mb-3 text-sm font-semibold text-muted-foreground"}>{t(group.title)}</PanelTitle>}
          <div className="notification-group-styles">
            {includesFocus(banners) && <ul className="notification-banner-list">{visibleItems(banners).map(row)}</ul>}
            {includesFocus(sections) && <ul className={sectionFrame ? "" : "notification-section-list"}>{visibleItems(sections).map(row)}</ul>}
            {includesFocus(cards) && <ul className="notification-activity-grid">{cards.map(row)}</ul>}
          </div>
        </section>;
      })}
    </div>}
    {banner && heading}
  </section>;
}

export function NotificationList({ compact = false, presentation = "section" }: { compact?: boolean; presentation?: NotificationPresentation }) {
  const { message: t } = useI18n();
  const { notifications: settings } = useFamily();
  const { pathname } = useLocation();
  const phone = useIsMobile();
  const slot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = slot.current;
    if (!node || !window.ResizeObserver) return;
    let { height, bottom } = node.getBoundingClientRect();
    const onScroll = () => {
      const bounds = node.getBoundingClientRect();
      if (bounds.height === height) bottom = bounds.bottom;
    };
    const observer = new ResizeObserver(() => {
      const bounds = node.getBoundingClientRect();
      // Only compensate the part of an offscreen resize the browser did not already anchor.
      const change = bounds.height - height;
      const shift = bounds.bottom - bottom;
      if (bottom <= 0 && window.scrollY > 0 && change * shift > 0) {
        window.scrollBy(0, Math.sign(shift) * Math.min(Math.abs(change), Math.abs(shift)));
      }
      height = bounds.height;
      bottom = node.getBoundingClientRect().bottom;
    });
    observer.observe(node);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [compact, pathname]);
  const { notifications: allNotifications, errors, retry } = useNotifications();
  const notifications = allNotifications.filter(item => !compact || pathname === "/" || (item.rule.pages ?? settings.pages) === "main");
  const shown = !compact || notifications.length > 0 || errors.length > 0;
  const summarize = compact && showsOngoingSummary(notifications, phone, errors);
  const [expanded, setExpanded] = useState(false);
  const summaryRef = useAlertFocusOnRemoval();
  const content = <NotificationSurface items={notifications} compact={compact} presentation={presentation}
    viewAllCount={compact && !summarize ? allNotifications.length : undefined}>
    {!!errors.length && <div role="status" className="mb-3 w-full"><p>{t("Some notification sources could not be loaded. Check the Home Assistant connection and permissions.")}</p><Button variant="outline" onClick={retry}>{t("Retry")}</Button></div>}
    {!notifications.length && !errors.length && <p className="empty-note">{t("Nothing needs your attention right now.")}</p>}
  </NotificationSurface>;
  return compact ? <div ref={slot} className="notification-slot"><AnimatePresence initial={false}>{shown && <NotificationPresence key="notifications">
    {summarize && <div ref={summaryRef} className="notification-summary">
      <button type="button" aria-expanded={expanded} aria-controls="ongoing-alert-details" onClick={() => setExpanded(!expanded)}>
        <ListChecks aria-hidden="true" /><span><strong>{t("Ongoing tasks")}</strong><small>{notifications.slice(0, 3).map(item => item.rule.title).join(" · ")}</small></span><ChevronDown aria-hidden="true" />
      </button>
      <Link className="text-link" to="/notifications">{t("View all ({count})", { count: allNotifications.length })}</Link>
    </div>}
    <div id="ongoing-alert-details" hidden={summarize && !expanded}>{(!summarize || expanded) && content}</div>
  </NotificationPresence>}</AnimatePresence></div> : content;
}

export function NotificationCamera() {
  const { message: t } = useI18n();
  const { currentHome } = useApp();
  const { notifications, camera } = useNotifications();
  const item = notifications.find(item => item.popup && (item.rule.kind === "camera" || item.rule.kind === "ongoing" && item.rule.cameraEntity));
  const shared = useSharedConfiguration();
  const selectedCamera = item && configuredCamera(shared?.state.config.settings.cameras, item.rule.cameraEntity);
  const seconds = item?.expiresAt === undefined ? undefined : Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000));
  const countdown = seconds !== undefined && !notificationTriggers(item.rule).some(trigger => trigger.type === "state" && matchesState(trigger, notificationEntity(currentHome.entities, trigger.entity)));
  const returnFocus = useRef<HTMLElement | null>(null);
  return <Dialog open={!!item} onOpenChange={open => { if (!open && item) camera(item.id, false); }}>
    <DialogContent className="smart-media-dialog" onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => {
      event.preventDefault();
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
      else document.querySelector<HTMLElement>("#main-content")?.focus();
    }}>
      <DialogHeader><div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1"><DialogTitle>{item?.rule.title}</DialogTitle>
        <p role={countdown ? "timer" : undefined} aria-live="off" className="text-sm tabular-nums text-muted-foreground">{countdown ? t("Closes in {time}", { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }) : t(item?.rule.kind === "ongoing" ? "Closes when this task ends." : "Closes automatically when this alert expires.")}</p>
      </div><DialogDescription>{item?.rule.message || t(item?.rule.cameraMedia === "person" ? "Person snapshot" : item?.rule.kind === "ongoing" ? "Live camera" : "Live camera alert")}</DialogDescription></DialogHeader>
      {selectedCamera ? item.rule.cameraMedia === "person"
        ? <CameraPersonSnapshot key={item.id} cameraId={selectedCamera.id} />
        : <MediaSurface key={`${item.id}-${selectedCamera.id}`} camera={selectedCamera} expanded />
        : <p role="status">{t("Camera unavailable. Check the selected camera in notification settings.")}</p>}
      <div className="flex justify-end"><Button variant="outline" onClick={() => { if (item) camera(item.id, false); }}>{t("Close camera")}</Button></div>
    </DialogContent>
  </Dialog>;
}
