import { PanelTitle } from "@/components/PanelTitle";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Bell, Camera, ListChecks, X } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, entityStateLabel } from "@/lib/ha-model";
import { matchesState, notificationEntity, notificationReadings, type HomeNotification } from "@/lib/notifications";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { MediaSurface } from "./devices/EntityMedia";
import type { Entity } from "@/types/api";
import { NotificationIcon } from "./NotificationIcon";
import { NotificationProgress } from "./NotificationProgress";
import "./devices/device-cards.css";
import "./notifications.css";

export function NotificationBell() {
  const { message: t } = useI18n();
  const { notifications, errors } = useNotifications();
  const titles = notifications.filter(item => item.rule.kind !== "camera").map(item => item.eventTitle || item.rule.title).join(", ");
  return <><Link to="/notifications" className="icon-button glass-surface relative" aria-label={t("Notifications: {count} active", { count: notifications.length })}>
    <Bell size={20} aria-hidden="true" />{(notifications.length > 0 || errors.length > 0) && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground" aria-hidden="true">{notifications.length || "!"}</span>}
  </Link><span role="status" aria-atomic="true" className="sr-only">{titles ? t("Active notifications: {titles}", { titles }) : notifications.length ? "" : t("No active notifications")}</span></>;
}

export function NotificationRow({ item, condensed = false, activity = false, preview = false, entities: previewEntities }: { item: HomeNotification; condensed?: boolean; activity?: boolean; preview?: boolean; entities?: Entity[] }) {
  const { message: t, language, locale } = useI18n();
  const { currentHome } = useApp();
  const { dismiss, camera } = useNotifications();
  const entities = previewEntities ?? currentHome.entities;
  const readings = notificationReadings(item.rule).map(reading => ({ ...reading, position: reading.placement === "auto" ? reading.defaultPlacement : reading.placement }))
    .filter(reading => reading.position !== "hidden" && !(condensed && reading.placement === "auto" && reading.position === "subtitle"));
  const at = (position: string) => readings.filter(reading => reading.position === position);
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
    return prominent ? <div key={key}><strong>{value}{unit && <small>{unit}</small>}</strong><span className={hideName ? "sr-only" : undefined}>{name}</span></div> : <p key={key} className="text-sm">{hideName ? <span className="sr-only">{name}: </span> : `${name} · `}{value}{unit}</p>;
  };
  return <li className={activity ? "notification-activity" : condensed ? "notification-row flex min-w-0 flex-1 basis-56 items-start gap-2 py-1 text-sm" : "notification-row flex items-start gap-3 border-t py-3 first:border-0"}>
    <NotificationIcon rule={item.rule} animate={activity && item.rule.kind === "ongoing"} />
    <div className="min-w-0 flex-1 break-words"><strong className="block">{item.eventTitle || item.rule.title}</strong>
      {!condensed && item.eventTitle && <p className="text-sm text-muted-foreground">{item.rule.title} · {t(item.eventStart > Date.now() ? "Starts at {time}" : "Started at {time}", { time: time.format(item.eventStart) })}</p>}
      {!condensed && item.rule.message && <p className="text-sm">{item.rule.message}</p>}
      {!!at("subtitle").length && <div data-placement="subtitle" className="text-muted-foreground">{at("subtitle").map(reading => renderReading(reading))}</div>}
      {(at("left").length > 0 || at("right").length > 0) && <div className={activity ? "notification-activity-readings" : ""}>
        {(["left", "right"] as const).map(position => at(position).length > 0 && <div key={position} data-placement={position}>{at(position).map(reading => renderReading(reading, activity))}</div>)}
      </div>}
      {readings.some(reading => !notificationEntity(entities, reading.entity)) && <p className="text-sm text-muted-foreground">{t("Some additional readings are unavailable")}</p>}
      {item.rule.kind === "ongoing" && item.rule.progress && <NotificationProgress progress={item.rule.progress} entities={entities} title={item.rule.title} />}
      {!!at("footer").length && <div data-placement="footer" className="notification-reading-footer">{at("footer").map(reading => renderReading(reading))}</div>}
      {item.rule.kind === "camera" && <Button type="button" disabled={preview} variant="link" className="h-auto px-0" onClick={() => camera(item.id, true)}>{t("Show camera")}</Button>}
    </div>
    {item.rule.kind !== "ongoing" && <Button type="button" disabled={preview} size="icon" variant="ghost" className="shrink-0" aria-label={t("Dismiss {name}", { name: item.eventTitle || item.rule.title })} onClick={() => dismiss(item.id)}><X size={18} aria-hidden="true" /></Button>}
  </li>;
}

export function NotificationList({ compact = false, presentation = "section" }: { compact?: boolean; presentation?: "banner" | "section" | "activity" }) {
  const { message: t } = useI18n();
  const { notifications, errors, retry } = useNotifications();
  if (compact && !notifications.length && !errors.length) return null;
  const banner = compact && presentation === "banner";
  const activity = presentation === "activity";
  const groups = [
    { kind: "ongoing", title: "Ongoing tasks", icon: ListChecks },
    { kind: "current", title: "Current alerts", icon: Bell },
    { kind: "camera", title: "Camera popup", icon: Camera },
  ] as const;
  const ordered = groups.flatMap(group => notifications.filter(item => item.rule.kind === group.kind));
  const heading = compact && <div className={`${banner ? "ml-auto" : "mb-3 justify-between"} flex flex-wrap items-center gap-2`}><PanelTitle icon={Bell} className={banner ? "sr-only" : "font-semibold"}>{t("Happening now")}</PanelTitle><Link className="text-link text-sm" to="/notifications">{t("View all ({count})", { count: notifications.length })}</Link></div>;
  return <section className={activity ? "notification-activities mb-5" : banner ? "mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2" : "glow-panel mb-5"} aria-label={t("Active notifications")}>
    {!banner && heading}
    {!!errors.length && <div role="status" className="mb-3 w-full"><p>{t("Some notification sources could not be loaded. Check the Home Assistant connection and permissions.")}</p><Button variant="outline" onClick={retry}>{t("Retry")}</Button></div>}
    {!notifications.length && !errors.length && <p className="empty-note">{t("Nothing needs your attention right now.")}</p>}
    {banner ? <ul className="flex min-w-0 flex-1 basis-72 flex-wrap gap-x-5 gap-y-2">{ordered.slice(0, 3).map(item => <NotificationRow key={item.id} item={item} condensed />)}</ul> : <div className="notification-groups">
      {groups.map(group => {
        const items = notifications.filter(item => item.rule.kind === group.kind);
        return items.length > 0 && <section key={group.kind} className="min-w-0" aria-label={t(group.title)}>
          <PanelTitle as="h3" icon={group.icon} className="mb-3 text-sm font-semibold text-muted-foreground">{t(group.title)}</PanelTitle>
          <ul className={activity ? "notification-activity-grid" : ""}>{(compact ? items.slice(0, 3) : items).map(item => <NotificationRow key={item.id} item={item} activity={activity} />)}</ul>
        </section>;
      })}
    </div>}
    {banner && heading}
  </section>;
}

export function NotificationCamera() {
  const { message: t } = useI18n();
  const { currentHome } = useApp();
  const { notifications, camera } = useNotifications();
  const item = notifications.find(item => item.popup && item.rule.kind === "camera");
  const entity = item && notificationEntity(currentHome.entities, item.rule.cameraEntity);
  const source = item && "entity" in item.rule.trigger ? notificationEntity(currentHome.entities, item.rule.trigger.entity) : undefined;
  const seconds = item?.expiresAt === undefined ? undefined : Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000));
  const countdown = seconds !== undefined && !matchesState(item.rule, source);
  const returnFocus = useRef<HTMLElement | null>(null);
  return <Dialog open={!!item} onOpenChange={open => { if (!open && item) camera(item.id, false); }}>
    <DialogContent className="smart-media-dialog" onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => {
      event.preventDefault();
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
      else document.querySelector<HTMLElement>("#main-content")?.focus();
    }}>
      <DialogHeader><div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1"><DialogTitle>{item?.rule.title}</DialogTitle>
        <p role={countdown ? "timer" : undefined} aria-live="off" className="text-sm tabular-nums text-muted-foreground">{countdown ? t("Closes in {time}", { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }) : t("Closes automatically when this alert expires.")}</p>
      </div><DialogDescription>{item?.rule.message || t("Live camera alert")}</DialogDescription></DialogHeader>
      {entity?.domain === "camera" ? <MediaSurface key={entity.entityId} entity={entity} expanded /> : <p role="status">{t("Camera unavailable. Check the selected camera in notification settings.")}</p>}
      <div className="flex justify-end"><Button variant="outline" onClick={() => { if (item) camera(item.id, false); }}>{t("Close camera")}</Button></div>
    </DialogContent>
  </Dialog>;
}
