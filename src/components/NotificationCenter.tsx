import { notificationTriggers, visibleWidgetRows } from "../../shared/notifications";
import { PanelTitle } from "@/components/PanelTitle";
import { useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { Bell, Camera, ChevronRight, Clock3, Image, ImageOff, ListChecks, VideoOff, X } from "lucide-react";
import { configuredCamera } from "../../shared/cameras";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { CameraPersonSnapshot } from "./CameraPersonSnapshot";
import { NotificationDebugContext, useNotifications } from "@/contexts/NotificationContext";
import { usePageActive } from "@/contexts/PageActivityContext";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { matchingTodoItem } from "@/lib/todo-items";
import { available, entityStateLabel, supportsAction } from "@/lib/ha-model";
import { matchesState, notificationEntity, notificationMinutesLeft, notificationProgress, notificationReadings, notificationWidgetMedia, previewNotificationEvent, progressSourceValue, showsLiveActivityPreview, type HomeNotification } from "@/lib/notifications";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { EntityMedia, MediaSurface } from "./devices/EntityMedia";
import { DeviceIcon } from "./devices/DeviceControl";
import type { Entity } from "@/types/api";
import type { NotificationPresentation, NotificationRule, NotificationWidgetSlot } from "../../shared/notifications";
import { NotificationIcon } from "./NotificationIcon";
import { NotificationProgress } from "./NotificationProgress";
import "./devices/device-cards.css";
import "./notifications.css";

export function NotificationBell() {
  const { message: t } = useI18n();
  const { notifications, errors, statusMessage } = useNotifications();
  const titles = notifications.filter(item => item.rule.kind !== "camera").map(item => item.eventTitle || item.rule.title).join(", ");
  const status = statusMessage ? t(statusMessage) : errors.length ? t("Some notification sources are unavailable") : "";
  // Only real alerts earn the filled count. Startup, waiting and source states are explained on Today and /notifications.
  const label = notifications.length ? t("Notifications: {count} active", { count: notifications.length }) : t("Notifications");
  return <><Link id="notification-bell" to="/notifications" className="icon-button glass-surface relative" aria-label={label} title={label}>
    <Bell size={20} aria-hidden="true" />{notifications.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground" aria-hidden="true">{notifications.length}</span>}
  </Link><span role="status" aria-atomic="true" className="sr-only">{[titles && t("Active notifications: {titles}", { titles }), status || (!notifications.length && t("No active notifications"))].filter(Boolean).join(" · ")}</span></>;
}

type PreviewMode = "current" | "sample";

function NotificationCameraFeed({ item, cameraId = item.rule.cameraEntity, cameraMedia = item.rule.cameraMedia, preview, compact = false, thumbnail = false, inDialog = false }: { item: HomeNotification; cameraId?: string; cameraMedia?: "live" | "person"; preview?: PreviewMode; compact?: boolean; thumbnail?: boolean; inDialog?: boolean }) {
  const { message: t } = useI18n();
  const shared = useSharedConfiguration();
  const { camera } = useNotifications();
  const selected = configuredCamera(shared?.state.config.settings.cameras, cameraId);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { ref.current?.toggleAttribute("inert", thumbnail); }, [thumbnail]);
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
    {inDialog && <p className="notification-media-caption">{selected?.name || t("Camera")}</p>}
    {preview === "sample" || !visible ? <div className="notification-camera-placeholder"><Camera size={compact ? 24 : 32} aria-hidden="true" /><span className={compact ? "sr-only" : undefined}>{t(preview === "sample" ? "Camera preview" : "Stream paused")}</span></div>
      : !selected ? <p role="status">{thumbnail && <VideoOff size={20} aria-hidden="true" />}<span className={thumbnail ? "sr-only" : undefined}>{t("Camera unavailable. Check the selected camera in notification settings.")}</span></p>
      : cameraMedia === "person" ? <CameraPersonSnapshot key={selected.id} cameraId={selected.id} />
      : <MediaSurface camera={selected} expanded={inDialog} controls={false} showPerson={!thumbnail && item.rule.showPersonSnapshot} />}
    {!thumbnail && <button type="button" className="smart-media-open" disabled={!!preview} aria-haspopup="dialog"
      aria-label={t("Show camera")} onClick={event => { event.currentTarget.focus({ preventScroll: true }); camera(item.id, true); }} />}
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

function NotificationImageFeed({ image, preview, compact = false, thumbnail = false, inDialog = false }: { image?: Entity; preview?: PreviewMode; compact?: boolean; thumbnail?: boolean; inDialog?: boolean }) {
  const { message: t } = useI18n();
  return <div className="notification-image-feed" ref={node => { node?.toggleAttribute("inert", thumbnail); }}>
    {inDialog && <p className="notification-media-caption">{image?.name || t("Image")}</p>}
    {preview === "sample" ? <div className="notification-camera-placeholder"><Image size={compact ? 24 : 32} aria-hidden="true" /><span className={compact ? "sr-only" : undefined}>{t("Image preview")}</span></div>
      : image?.domain === "image" ? <EntityMedia key={image.preferenceId} entity={image} trimTransparent showExpandIcon={false} />
      : <p role="status">{thumbnail && <ImageOff size={20} aria-hidden="true" />}<span className={thumbnail ? "sr-only" : undefined}>{t("Image unavailable. Choose another image in notification settings.")}</span></p>}
  </div>;
}

function useEventTime(item: HomeNotification) {
  const { message: t, locale } = useI18n();
  const { currentHome } = useApp();
  if (item.eventAllDay) return t("All day");
  if (item.eventStart === undefined) return;
  const time = new Intl.DateTimeFormat(locale, { timeZone: currentHome.timeZone, hour: "2-digit", minute: "2-digit" }).format(item.eventStart);
  return t(item.eventStart > Date.now() ? "Starts at {time}" : "Started at {time}", { time });
}

function useTimeLeft(rule: NotificationRule | undefined, entities: Entity[], required = false) {
  const { message: t } = useI18n();
  if (!rule) return;
  const minutes = notificationMinutesLeft(rule, entities, Date.now());
  if (minutes === undefined) return rule.timeLeftEntity || required ? t("Time left unavailable") : undefined;
  return minutes < 60 ? t("{minutes} min left", { minutes }) : t("{hours} h {minutes} min left", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

function useReadingValue() {
  const { message: t, language, locale } = useI18n();
  const { currentHome } = useApp();
  return (entity?: Entity, attribute?: string) => {
    const raw = attribute ? entity?.attributes[attribute] : entity?.state;
    if (!entity || !available(entity) || entity.attributes.mode === "password" || !["string", "number", "boolean"].includes(typeof raw)) {
      return { value: t("Entity unavailable"), unit: "" };
    }
    const value = !attribute && entity.attributes.device_class === "timestamp" && Number.isFinite(Date.parse(String(raw)))
      ? new Intl.DateTimeFormat(locale, { timeZone: currentHome.timeZone, hour: "2-digit", minute: "2-digit" }).format(Date.parse(String(raw)))
      : entityStateLabel(attribute ? { ...entity, domain: "sensor", state: String(raw) } : entity, language);
    const unit = !attribute && typeof entity.attributes.unit_of_measurement === "string" ? ` ${entity.attributes.unit_of_measurement}` : "";
    return { value, unit };
  };
}

function ShoppingAction({ action, preview }: { action: NotificationRule["shoppingAction"]; preview?: PreviewMode }) {
  const { currentHome, homeOnline, services, todoItems, command } = useApp();
  const { todoLists } = useFamily();
  const { message: t } = useI18n();
  const list = todoLists[action.list]?.kind === "shopping" && currentHome.entities.find(entity => entity.domain === "todo" && entity.preferenceId === action.list);
  const listId = list ? list.entityId : undefined;
  const writable = homeOnline && !!list && available(list) && supportsAction(list, "add_item", services);
  const request = useRef<AbortController>();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    setBusy(false); setFeedback("");
    return () => { request.current?.abort(); request.current = undefined; };
  }, [listId, action.item, writable, preview]);
  const add = async () => {
    if (!writable || preview || request.current) return;
    const attempt = new AbortController();
    request.current = attempt;
    setBusy(true); setFeedback("");
    try {
      const existing = matchingTodoItem(await todoItems(list.entityId), action.item);
      if (attempt.signal.aborted) return;
      if (existing && existing.status !== "completed") { setFeedback("This item is already on the list."); return; }
      if (existing && !supportsAction(list, "update_item", services)) { setFeedback("This list cannot reopen completed items."); return; }
      if (existing) await command(list.entityId, "update_item", { item: existing.uid, status: "needs_action" });
      else await command(list.entityId, "add_item", { item: action.item });
      if (!attempt.signal.aborted) setFeedback("Added to shopping list.");
    } catch (error) {
      if (!attempt.signal.aborted) setFeedback(error instanceof Error ? error.message : "List unavailable");
    } finally {
      if (request.current === attempt) { request.current = undefined; setBusy(false); }
    }
  };
  return <div className="mt-3 grid justify-items-start gap-1">
    <Button type="button" variant="outline" className="max-w-full whitespace-normal [overflow-wrap:anywhere]" disabled={!!preview || !writable || busy} onClick={add}>{t("Add {item} to shopping list", { item: action.item })}</Button>
    <small role="status">{busy ? t("Updating list…") : !preview && !writable ? t("List unavailable") : t(feedback)}</small>
  </div>;
}

export function NotificationRow({ item, condensed = false, activity = false, compactActivity = false, inDialog = false, preview, entities: previewEntities }: { item: HomeNotification; condensed?: boolean; activity?: boolean; compactActivity?: boolean; inDialog?: boolean; preview?: PreviewMode; entities?: Entity[] }) {
  const { message: t } = useI18n();
  const readingValue = useReadingValue();
  const { currentHome } = useApp();
  const { dismiss } = useNotifications();
  const entities = previewEntities ?? currentHome.entities;
  const showDetails = inDialog || !condensed || !!preview;
  const readings = notificationReadings(item.rule).map(reading => ({ ...reading, position: reading.placement === "auto" ? reading.defaultPlacement : reading.placement }))
    .filter(reading => reading.position !== "hidden" && !(!showDetails && reading.placement === "auto" && reading.position === "subtitle"));
  const at = (position: string) => readings.filter(reading => reading.position === position);
  const row = useAlertFocusOnRemoval();
  const showCamera = item.rule.kind === "camera" ? !inDialog : item.rule.kind === "ongoing" && !!item.rule.cameraEntity;
  const cameraPosition = activity ? item.rule.cameraPlacement ?? "footer" : "footer";
  const imagePosition = activity ? item.rule.imagePlacement ?? "left" : "footer";
  const cameraContent = showCamera && <NotificationCameraFeed item={item} preview={preview} compact={cameraPosition !== "footer"} inDialog={inDialog} />;
  const imageContent = item.rule.imageEntity && <NotificationImageFeed image={notificationEntity(entities, item.rule.imageEntity)} preview={preview} compact={imagePosition !== "footer"} inDialog={inDialog} />;
  const hasColumn = (position: "left" | "right") => at(position).length > 0 || showCamera && cameraPosition === position || !!imageContent && imagePosition === position;
  const eventTime = useEventTime(item);
  const timeLeft = useTimeLeft(inDialog && item.rule.kind === "ongoing" ? item.rule : undefined, entities, showsLiveActivityPreview(item.rule) && item.rule.icon === "printer_3d");
  const renderReadings = (position: string, prominent = false) => {
    const group = at(position);
    if (!group.length) return null;
    const items = group.map(reading => {
      const entity = notificationEntity(entities, reading.entity);
      const name = reading.name || `${entity?.name ?? t("Entity unavailable")}${reading.attribute ? ` · ${reading.attribute}` : ""}`;
      const { value, unit } = readingValue(entity, reading.attribute);
      const key = JSON.stringify([reading.entity, reading.attribute]);
      const hideName = activity && reading.hideName;
      if (inDialog) return <div key={key}>
        <dt className={hideName ? "sr-only" : undefined}>
          {entity?.attributes.device_class === "timestamp" ? <Clock3 aria-hidden="true" /> : <DeviceIcon type={entity?.domain ?? "sensor"} deviceClass={entity?.attributes.device_class} />}
          {name}
        </dt>
        <dd>{value}{unit && <small>{unit}</small>}</dd>
      </div>;
      return prominent ? <div key={key}><span className={hideName ? "sr-only" : undefined}>{name}</span><strong>{value}{unit && <small>{unit}</small>}</strong></div> : <p key={key} className="text-sm">{hideName ? <span className="sr-only">{name}: </span> : `${name} · `}{value}{unit}</p>;
    });
    return inDialog ? <dl className="notification-dialog-readings">{items}</dl> : items;
  };
  const subtitle = renderReadings("subtitle");
  const footer = renderReadings("footer");
  const icon = <NotificationIcon rule={item.rule} animate={activity && item.rule.kind === "ongoing"} />;
  const dismissAction = item.rule.kind !== "ongoing" && <Button type="button" disabled={!!preview} size="icon" variant="ghost" className="shrink-0" aria-label={t("Dismiss {name}", { name: item.eventTitle || item.rule.title })} onClick={() => dismiss(item.id)}><X size={18} aria-hidden="true" /></Button>;
  const title = <strong className="block">{item.eventTitle || item.rule.title}</strong>;
  const Tag = inDialog ? "div" : "li";
  const style = activity ? `notification-activity${compactActivity ? " notification-activity-compact" : ""}` : condensed ? "notification-row flex min-w-0 flex-1 basis-56 items-start gap-2 py-1 text-sm" : "notification-row flex items-start gap-3 border-t py-3 first:border-0";
  const progress = item.rule.kind === "ongoing" && item.rule.progress && <NotificationProgress progress={item.rule.progress} entities={entities} title={item.rule.title} caption={timeLeft} inDialog={inDialog} />;
  return <Tag ref={inDialog ? undefined : row} className={inDialog ? `notification-dialog-body ${style}` : style}>
    {!inDialog && !activity && icon}
    <div className="notification-body min-w-0 flex-1 break-words">
      {!inDialog && (activity ? <div className="notification-activity-heading">{title}{icon}{dismissAction}</div> : title)}
      {!inDialog && showDetails && item.eventTitle && <p className="text-sm text-muted-foreground">{item.rule.title} · {eventTime}</p>}
      {inDialog && item.rule.kind === "ongoing" && (progress || (timeLeft && <p className="notification-time-left"><Clock3 aria-hidden="true" />{timeLeft}</p>))}
      {showDetails && item.rule.message && !(inDialog && item.rule.kind === "camera") && <p className={inDialog ? "notification-dialog-message" : "text-sm"}>{item.rule.message}</p>}
      {subtitle && <div data-placement="subtitle" className="text-muted-foreground">{subtitle}</div>}
      {(hasColumn("left") || hasColumn("right")) && <div className={activity ? "notification-activity-readings" : ""}>
        {(["left", "right"] as const).map(position => hasColumn(position) && <div key={position} data-placement={position}>
          {imagePosition === position && imageContent && <div className="notification-media-side">{imageContent}</div>}
          {cameraPosition === position && showCamera && <div className="notification-media-side">{cameraContent}</div>}
          {renderReadings(position, activity)}
        </div>)}
      </div>}
      {readings.some(reading => !notificationEntity(entities, reading.entity)) && <p className="text-sm text-muted-foreground">{t("Some additional readings are unavailable")}</p>}
      {imagePosition === "footer" && imageContent}
      {cameraPosition === "footer" && cameraContent}
      {footer && <div data-placement="footer" className="notification-reading-footer">{footer}</div>}
      {!inDialog && progress}
      {item.rule.kind === "current" && item.rule.shoppingAction && <ShoppingAction action={item.rule.shoppingAction} preview={preview} />}
    </div>
    {!inDialog && !activity && dismissAction}
  </Tag>;
}

function WidgetFields({ rule, entities, slots }: { rule: NotificationRule; entities: Entity[]; slots: NotificationWidgetSlot[] }) {
  const { message: t, number } = useI18n();
  const readingValue = useReadingValue();
  const last = slots.reduce((count, slot, index) => slot.type === "empty" ? count : index + 1, 0);
  if (!last) return null;
  return <dl className="notification-widget-fields" data-layout={rule.widget.slotLayout}
    style={{ gridTemplateColumns: `repeat(${last}, minmax(0, 1fr))` }}>
    {slots.map((slot, index) => {
      if (slot.type === "empty") return null;
      const entity = "entity" in slot && slot.entity ? notificationEntity(entities, slot.entity) : undefined;
      const name = slot.name?.trim();
      let label: string, value: string, bar: ReactNode;
      if (slot.type === "text") {
        label = name || t("Free text");
        value = slot.text;
      } else if (slot.type === "reading") {
        label = name || entity?.name || slot.entity?.split("|").pop() || t("Sensor");
        const reading = readingValue(entity);
        value = reading.value + reading.unit;
      } else if (slot.type === "remaining") {
        label = name || t("Time remaining");
        const minutes = notificationMinutesLeft(rule, entities, Date.now(), slot.entity);
        value = minutes === undefined ? t("Unavailable") : minutes < 60 ? t("{minutes} min", { minutes }) : t("{hours} h {minutes} min", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
      } else {
        label = name || entity?.name || t("Progress");
        const raw = slot.entity ? progressSourceValue({ type: "entity", entity: slot.entity, attribute: "" }, entities) : rule.progress && notificationProgress(rule.progress, entities)?.percent;
        const percent = raw === undefined ? null : Math.min(100, Math.max(0, raw));
        value = percent === null ? t("Unavailable") : `${number(Math.round(percent))}%`;
        bar = <Progress value={percent} aria-label={label} aria-valuetext={value} className="h-1" />;
      }
      return <div key={index} style={{ gridColumn: index + 1 }}>
        <dt title={label} className={slot.hideName || slot.type === "text" && !name ? "sr-only" : undefined}>{label}</dt><dd title={value}>{bar}<span>{value}</span></dd>
      </div>;
    })}
  </dl>;
}

export function NotificationBoardGrid({ children }: { children: ReactNode }) {
  const { notifications } = useFamily();
  return <ul className="notification-board-layout" data-grid-zoom={notifications.gridZoom}>{children}</ul>;
}

export function NotificationTile({ item, presentation, preview, entities: previewEntities, onOpen }: { item: HomeNotification; presentation: NotificationPresentation; preview?: PreviewMode; entities?: Entity[]; onOpen: (opener: HTMLButtonElement) => void }) {
  const { message: t } = useI18n();
  const { notifications } = useFamily();
  const { currentHome } = useApp();
  const { dismiss } = useNotifications();
  const entities = previewEntities ?? currentHome.entities;
  const { rule } = item;
  const widget = rule.widget;
  const name = widget?.title?.trim() || item.eventTitle || rule.title;
  const eventTime = useEventTime(item);
  const subtitle = widget?.text?.trim() || eventTime || (rule.kind === "current" && rule.message);
  const media = notificationWidgetMedia(rule);
  const hasMedia = media.type !== "none";
  const doorbell = rule.kind === "camera";
  const print = rule.kind === "ongoing" && rule.icon === "printer_3d" && media.type === "live";
  const rows = visibleWidgetRows(widget, notifications.gridZoom);
  const custom = rows !== undefined;
  const hasFields = rows?.some(row => row.some(slot => slot.type !== "empty"));
  const showTitle = !(hasFields && widget?.slotLayout === "lines") && (!print || !!widget?.title?.trim() || !!subtitle || custom);
  const dense = hasFields || !!subtitle && rule.kind === "ongoing";
  const size = widget?.size ?? notifications.defaultWidgetWidth;
  const columns = { auto: dense ? 2 : 1, small: 1, medium: 2, large: 3 }[size];
  const row = useAlertFocusOnRemoval();
  const bodyId = useId();
  const action = doorbell ? "Open camera for {name}" : presentation.startsWith("activity") ? "Open activity card for {name}" : "Show details for {name}";
  return <li ref={row} className={hasMedia ? "notification-glance notification-live-thumbnail" : "notification-glance"}
    data-widget-columns={columns} data-widget-dense={dense || undefined}>
    <div className="notification-widget-main">
      {!hasMedia && <NotificationIcon rule={rule} />}
      <div id={bodyId} className="notification-body min-w-0 flex-1 break-words">
        {media.type === "image" ? <NotificationImageFeed image={notificationEntity(entities, media.entity)} preview={preview} thumbnail /> : "cameraId" in media &&
          <NotificationCameraFeed item={item} cameraId={media.cameraId} cameraMedia={media.type} preview={preview} compact thumbnail />}
        <div className="notification-preview-copy">
          {showTitle && <div className="notification-glance-caption"><strong>{name}</strong>{subtitle && <small>{subtitle}</small>}</div>}
          {custom ? rows.map((slots, index) => <WidgetFields key={index} rule={rule} entities={entities} slots={slots} />)
            : rule.kind === "ongoing" && <ActivityPreviewReadings item={item} entities={entities} printPreview={print} />}
        </div>
      </div>
      {!hasMedia && !doorbell && <ChevronRight className="notification-glance-chevron" aria-hidden="true" />}
      {doorbell && <Button type="button" disabled={!!preview} variant="ghost" size="icon" className="notification-widget-dismiss" aria-label={t("Dismiss {name}", { name })} onClick={() => dismiss(item.id)}><X size={16} aria-hidden="true" /></Button>}
    </div>
    <button type="button" className="notification-thumbnail-open" aria-haspopup="dialog" aria-describedby={bodyId}
      aria-label={t(action, { name })} onClick={event => onOpen(event.currentTarget)} />
  </li>;
}

function ActivityPreviewReadings({ item, entities, printPreview }: { item: HomeNotification; entities: Entity[]; printPreview: boolean }) {
  const { message: t, number } = useI18n();
  const percent = item.rule.progress && notificationProgress(item.rule.progress, entities)?.percent;
  const timeLeft = useTimeLeft(item.rule, entities, printPreview);
  const showBar = !!item.rule.progress || printPreview;
  if (!showBar && !timeLeft) return null;
  return <div className="notification-thumbnail-readings">
    {showBar && <Progress value={percent ?? null} className="h-1" aria-label={t("Progress for {name}", { name: item.rule.title })}
      aria-valuetext={percent === undefined ? t("Progress unavailable") : t("{percent}% complete", { percent: number(Math.round(percent)) })} />}
    {timeLeft ? <span>{timeLeft}</span> : item.rule.progress?.text !== "none" && percent !== undefined && <span>{number(Math.round(percent))}%</span>}
  </div>;
}

function NotificationDetailHeader({ item, kind, inline, children }: { item: HomeNotification; kind?: string; inline?: boolean; children?: ReactNode }) {
  const { message: t, locale } = useI18n();
  const { currentHome } = useApp();
  const calendar = item.eventStart !== undefined || item.eventAllDay;
  const eventTime = useEventTime(item);
  const zone = { timeZone: currentHome.timeZone };
  const date = item.eventStart === undefined ? undefined : new Intl.DateTimeFormat(locale, { ...zone, weekday: "short", day: "numeric", month: "short" }).format(item.eventStart);
  const label = kind ?? (calendar && item.rule.title !== item.eventTitle ? item.rule.title : t(calendar ? "Calendar event" : item.rule.kind === "ongoing" ? "Ongoing task" : "Current alert"));
  const when = calendar ? [date, eventTime].filter(Boolean).join(" · ") : item.rule.kind === "current" && item.expiresAt !== undefined
    ? t("Triggered at {time}", { time: new Intl.DateTimeFormat(locale, { ...zone, hour: "2-digit", minute: "2-digit" }).format(item.startedAt) }) : undefined;
  return <DialogHeader className="notification-dialog-header">
    <NotificationIcon rule={item.rule} animate={item.rule.kind === "ongoing"} />
    <div className="min-w-0">
      <p className="notification-dialog-kind">{label}</p>
      {inline ? <h4>{item.eventTitle || item.rule.title}</h4> : <DialogTitle tabIndex={-1}>{item.eventTitle || item.rule.title}</DialogTitle>}
      {when && <p className="notification-event-time"><Clock3 aria-hidden="true" />{when}</p>}
      {children}
    </div>
  </DialogHeader>;
}

function returnToNotification(opener: HTMLElement | null) {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"][data-state="open"]:not([aria-hidden="true"])');
  if (opener?.isConnected && !opener.closest('[inert], [hidden], [aria-hidden="true"]') && (!dialog || dialog.contains(opener))) opener.focus({ preventScroll: true });
  else (dialog ?? document.getElementById("notification-bell") ?? document.getElementById("main-content"))?.focus({ preventScroll: true });
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

export function NotificationSurface({ items: notifications, compact, presentation, preview, entities, children }: {
  items: HomeNotification[]; compact: boolean; presentation: NotificationPresentation;
  preview?: PreviewMode; entities?: Entity[]; children?: ReactNode;
}) {
  const { message: t } = useI18n();
  const style = (item: HomeNotification) => item.rule.presentation ?? presentation;
  const banner = compact && (notifications.length ? notifications.every(item => style(item) === "banner") : presentation === "banner");
  const sectionFrame = !banner && (notifications.length ? notifications.every(item => style(item) === "section" || (!compact && style(item) === "banner")) : !["activity", "activity-compact"].includes(presentation));
  const groups = [
    { kind: "ongoing", title: "Ongoing tasks", icon: ListChecks },
    { kind: "current", title: "Current alerts", icon: Bell },
    { kind: "camera", title: "Camera popup", icon: Camera },
  ] as const;
  const visibleItems = (items: HomeNotification[]) => compact ? items.slice(0, 3) : items;
  const bannerItems = banner ? visibleItems([...groups].reverse().flatMap(group => notifications.filter(item => item.rule.kind === group.kind))) : [];
  const row = (item: HomeNotification) => {
    const type = style(item);
    return <NotificationRow key={item.id} item={item} condensed={compact && type === "banner"}
      activity={type === "activity" || type === "activity-compact"} compactActivity={type === "activity-compact"}
      entities={entities} preview={preview} />;
  };
  return <section className={banner ? "notification-banner mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-primary/20 px-4 py-2" : sectionFrame ? "glow-panel mb-5" : "notification-activities mb-5"} aria-label={t("Active notifications")}>
    {children}
    {banner ? <ul className="flex min-w-0 flex-1 basis-72 flex-wrap gap-x-5 gap-y-2">{bannerItems.map(row)}</ul> : <div className="notification-groups">
      {groups.map(group => {
        const items = notifications.filter(item => item.rule.kind === group.kind);
        const banners = compact ? items.filter(item => style(item) === "banner") : [];
        const sections = items.filter(item => style(item) === "section" || (!compact && style(item) === "banner"));
        const cards = items.filter(item => ["activity", "activity-compact"].includes(style(item)));
        const hideHeading = compact && notifications.every(item => item.rule.kind === group.kind);
        return items.length > 0 && <section key={group.kind} className="min-w-0" aria-label={t(group.title)}>
          {(!preview || !hideHeading) && <PanelTitle as="h3" icon={group.icon} className={hideHeading ? "sr-only" : "mb-3 text-sm font-semibold text-muted-foreground"}>{t(group.title)}</PanelTitle>}
          <div className="notification-group-styles">
            {!!banners.length && <ul className="notification-banner-list">{visibleItems(banners).map(row)}</ul>}
            {!!sections.length && <ul className={sectionFrame ? "" : "notification-section-list"}>{visibleItems(sections).map(row)}</ul>}
            {!!cards.length && <ul className="notification-activity-grid">{cards.map(row)}</ul>}
          </div>
        </section>;
      })}
    </div>}
  </section>;
}

export function NotificationList({ compact = false, presentation }: { compact?: boolean; presentation?: NotificationPresentation }) {
  const { message: t } = useI18n();
  const { notifications: settings } = useFamily();
  const { pathname } = useLocation();
  const active = usePageActive();
  const style = presentation ?? settings?.presentation ?? "section";
  const slot = useRef<HTMLDivElement>(null);
  const moreLink = useAlertFocusOnRemoval();
  const errorRow = useAlertFocusOnRemoval();
  useLayoutEffect(() => {
    const node = slot.current;
    if (!node || !window.ResizeObserver) return;
    const measure = () => {
      const bounds = node.getBoundingClientRect();
      // With an empty slot the heading marks where the alerts will appear.
      return bounds.height ? bounds : { height: 0, bottom: node.previousElementSibling?.getBoundingClientRect().bottom ?? 0 };
    };
    let { height, bottom } = measure();
    const onScroll = () => {
      const bounds = measure();
      if (bounds.height === height) bottom = bounds.bottom;
    };
    const observer = new ResizeObserver(() => {
      const bounds = measure();
      // Only compensate the part of an offscreen resize the browser did not already anchor.
      const change = bounds.height - height;
      const shift = bounds.bottom - bottom;
      if (bottom <= 0 && window.scrollY > 0 && change * shift > 0) {
        window.scrollBy(0, Math.sign(shift) * Math.min(Math.abs(change), Math.abs(shift)));
      }
      height = bounds.height;
      bottom = measure().bottom;
    });
    observer.observe(node);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [active, compact, pathname]);
  const { notifications: allNotifications, errors, waitingRules, statusMessage, retry, dismiss, camera } = useNotifications();
  const { previewStartedAt } = useContext(NotificationDebugContext);
  const previewAll = compact && pathname === "/" && previewStartedAt !== undefined;
  const [selectedId, select] = useState<string>();
  const opener = useRef<HTMLButtonElement | null>(null);
  const eligible = allNotifications.filter(({ rule }) => pathname === "/" || (rule.pages ?? settings?.pages) === "main");
  if (active && previewAll) {
    const activeRules = new Set(eligible.map(item => item.rule.id));
    for (const rule of settings.rules) {
      if (activeRules.has(rule.id)) continue;
      eligible.push({ id: `${rule.id}:preview`, rule, startedAt: previewStartedAt, popup: false,
        ...previewNotificationEvent(rule, previewStartedAt, rule.title) });
    }
  }
  const selected = active && selectedId ? eligible.find(item => item.id === selectedId) : undefined;
  if (selectedId && !selected) select(undefined);
  if (!active) return null;
  const sourceErrors = !!errors.length && <div ref={errorRow} role="status" className="notification-source-error"><p>{t("Could not read sources for {rules}.", { rules: errors.join(", ") })}</p><Link className="text-link min-h-11" to="/settings/notifications">{t("Notification settings")}</Link><Button variant="outline" onClick={retry}>{t("Retry")}</Button></div>;
  if (!compact) return <NotificationSurface items={allNotifications} compact={false} presentation={style}>
    {sourceErrors}
    {!!waitingRules?.length && <p className="page-note notification-waiting">{t("Waiting for a reading for {rules}.", { rules: waitingRules.join(", ") })}</p>}
    {!allNotifications.length && !errors.length && !waitingRules?.length && <p className="empty-note">{t(statusMessage ?? "Nothing needs your attention right now.")}</p>}
  </NotificationSurface>;
  const hasMedia = ({ rule }: HomeNotification) => rule.kind !== "camera" && notificationWidgetMedia(rule).type !== "none";
  const media = eligible.filter(hasMedia);
  const rows = eligible.filter(item => !hasMedia(item));
  const priority = { camera: 0, current: 1, ongoing: 2 };
  rows.sort((a, b) => priority[a.rule.kind] - priority[b.rule.kind]);
  const compactRows = previewAll ? rows : rows.slice(0, 3);
  const previewMode = previewAll ? "current" : undefined;
  const preview = (item: HomeNotification) => {
    const type = item.rule.presentation ?? style;
    return <NotificationTile key={item.id} item={item} presentation={type} preview={previewMode} onOpen={button => {
      if (item.rule.kind === "camera" && !previewAll) camera(item.id, true);
      else { opener.current = button; select(item.id); }
    }} />;
  };
  const detailProps = { item: selected, presentation: selected?.rule.presentation ?? style, preview: previewMode, onReturn: () => {
    select(id => id === selected?.id ? undefined : id);
    returnToNotification(opener.current);
  } } as const;
  return <div ref={slot} className="notification-slot"><AnimatePresence initial={false}>{(previewAll || eligible.length > 0 || !!sourceErrors) && <NotificationPresence key="notifications">
    <section aria-label={t(previewAll ? "Notification preview" : "Active notifications")}>
      {previewAll && <Link className="text-link min-h-11 text-sm" to="/settings/debug">{t("Previewing all notifications")}<ChevronRight size={16} aria-hidden="true" /></Link>}
      {previewAll && !eligible.length && <p className="empty-note">{t("No saved notification rules.")}</p>}
      {sourceErrors}
      {!!eligible.length && <NotificationBoardGrid>{[...media, ...compactRows].map(preview)}</NotificationBoardGrid>}
      {!!eligible.length && allNotifications.length > media.length + compactRows.length && <Link ref={moreLink} className="text-link min-h-11 text-sm" to="/notifications">{t("View all ({count})", { count: allNotifications.length })}</Link>}
    </section>
  </NotificationPresence>}</AnimatePresence>
    {selected && <Dialog key={selected.id} defaultOpen>
      {selected.rule.kind === "camera" ? <NotificationCameraContent {...detailProps} />
        : <NotificationDetailContent {...detailProps} onDismiss={() => { dismiss(selected.id); select(undefined); }} />}
    </Dialog>}
  </div>;
}

export function NotificationDetailContent({ item, presentation, preview, entities, inline = false, onDismiss, onReturn }: {
  item: HomeNotification; presentation: NotificationPresentation; preview?: PreviewMode; entities?: Entity[]; inline?: boolean; onDismiss?: () => void; onReturn?: () => void;
}) {
  const { message: t } = useI18n();
  const content = <>
    <NotificationDetailHeader item={item} inline={inline} />
    <NotificationRow item={item} inDialog condensed={presentation === "banner"} activity={presentation.startsWith("activity")} compactActivity={presentation === "activity-compact"} preview={preview} entities={entities} />
    {item.rule.kind === "current" && <div className="notification-dialog-actions"><Button type="button" variant="outline" disabled={!!preview} onClick={onDismiss}>{t("Dismiss notification")}</Button></div>}
  </>;
  if (inline) return <fieldset disabled className="notification-inline-popup notification-detail-dialog glass-surface glass-modal" data-presentation={presentation} aria-label={t("Popup preview")}>{content}</fieldset>;
  return <DialogContent className="notification-detail-dialog" aria-describedby={undefined}
    data-media={!!(item.rule.imageEntity || item.rule.kind === "ongoing" && item.rule.cameraEntity) || undefined}
    data-presentation={presentation}
    onOpenAutoFocus={event => { event.preventDefault(); (event.currentTarget as HTMLElement).querySelector("h2")?.focus({ preventScroll: true }); }}
    onCloseAutoFocus={event => { event.preventDefault(); onReturn?.(); }}>{content}</DialogContent>;
}

export function NotificationCamera() {
  const { notifications, camera } = useNotifications();
  const item = notifications.find(item => item.popup && item.rule.kind === "camera") ?? notifications.find(item => item.popup && item.rule.kind === "ongoing" && item.rule.cameraEntity);
  const { notifications: settings } = useFamily();
  const presentation = item?.rule.presentation ?? settings?.presentation;
  return <Dialog open={!!item} onOpenChange={open => { if (!open && item) camera(item.id, false); }}>
    <NotificationCameraContent item={item} presentation={presentation} />
  </Dialog>;
}

export function NotificationCameraContent({ item, presentation, preview, entities, inline = false, onReturn }: {
  item?: HomeNotification; presentation: NotificationPresentation; preview?: PreviewMode; entities?: Entity[]; inline?: boolean; onReturn?: () => void;
}) {
  const { message: t } = useI18n();
  const { currentHome } = useApp();
  const shared = useSharedConfiguration();
  const selectedCamera = item && configuredCamera(shared?.state.config.settings.cameras, item.rule.cameraEntity);
  const seconds = preview && item ? item.rule.durationSeconds : item?.expiresAt === undefined ? undefined : Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000));
  const countdown = seconds !== undefined && !notificationTriggers(item.rule).some(trigger => trigger.type === "state" && matchesState(trigger, notificationEntity(entities ?? currentHome.entities, trigger.entity)));
  const returnFocus = useRef<HTMLElement | null>(null);
  const Description = inline ? "p" : DialogDescription;
  const close = <Button type="button" variant="outline" disabled={inline}>{t("Close camera")}</Button>;
  const content = <>
      {item && <NotificationDetailHeader item={item} inline={inline} kind={t(item.rule.cameraMedia === "person" ? "Person snapshot" : item.rule.kind === "camera" ? "Camera popup" : "Camera")}>
        <Description role={countdown ? "timer" : undefined} aria-live="off" className="mt-1 text-sm text-muted-foreground tabular-nums">{countdown ? t("Closes in {time}", { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }) : t(item.rule.kind === "ongoing" ? "Closes when this task ends." : "Closes automatically when this alert expires.")}</Description>
      </NotificationDetailHeader>}
      <div className="notification-camera-dialog-scroll">{preview === "sample" ? <div className="notification-camera-placeholder"><Camera size={32} aria-hidden="true" />{t(item?.rule.cameraMedia === "person" ? "Person snapshot" : "Camera preview")}</div> : selectedCamera ? item.rule.cameraMedia === "person"
        ? <CameraPersonSnapshot key={item.id} cameraId={selectedCamera.id} />
        : <MediaSurface key={`${item.id}-${selectedCamera.id}`} camera={selectedCamera} expanded={!inline} showPerson />
        : <p role="status">{t("Camera unavailable. Check the selected camera in notification settings.")}</p>}
        {item?.rule.message && <p className="mt-3 break-words">{item.rule.message}</p>}
        {item?.rule.kind === "camera" && <NotificationRow item={item} inDialog preview={preview} entities={entities} activity={presentation?.startsWith("activity")} compactActivity={presentation === "activity-compact"} />}
      </div>
      <div className="flex justify-end">{inline ? close : <DialogClose asChild>{close}</DialogClose>}</div>
  </>;
  if (inline) return <fieldset disabled className="notification-inline-popup notification-camera-dialog glass-surface glass-modal" aria-label={t("Popup preview")}>{content}</fieldset>;
  return <DialogContent className="smart-media-dialog notification-camera-dialog" onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => {
      event.preventDefault();
      if (onReturn) onReturn(); else returnToNotification(returnFocus.current);
    }}>{content}</DialogContent>;
}
