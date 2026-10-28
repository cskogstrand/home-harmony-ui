import { PanelTitle } from "@/components/PanelTitle";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Bell, Camera, ListChecks, X } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, entityStateLabel } from "@/lib/ha-model";
import { matchesState, notificationEntity, type HomeNotification } from "@/lib/notifications";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { MediaSurface } from "./devices/EntityMedia";
import "./devices/device-cards.css";

export function NotificationBell() {
  const { message: t } = useI18n();
  const { notifications, errors } = useNotifications();
  const titles = notifications.filter(item => item.rule.kind !== "camera").map(item => item.eventTitle || item.rule.title).join(", ");
  return <><Link to="/notifications" className="icon-button glass-surface relative" aria-label={t("Notifications: {count} active", { count: notifications.length })}>
    <Bell size={20} aria-hidden="true" />{(notifications.length > 0 || errors.length > 0) && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground" aria-hidden="true">{notifications.length || "!"}</span>}
  </Link><span role="status" aria-atomic="true" className="sr-only">{titles ? t("Active notifications: {titles}", { titles }) : notifications.length ? "" : t("No active notifications")}</span></>;
}

function NotificationRow({ item, condensed = false }: { item: HomeNotification; condensed?: boolean }) {
  const { message: t, language, locale } = useI18n();
  const { currentHome } = useApp();
  const { dismiss, camera } = useNotifications();
  const source = "entity" in item.rule.trigger ? notificationEntity(currentHome.entities, item.rule.trigger.entity) : undefined;
  const details = item.rule.detailEntities.map(id => notificationEntity(currentHome.entities, id));
  const Icon = item.rule.kind === "ongoing" ? ListChecks : item.rule.kind === "camera" ? Camera : Bell;
  const time = new Intl.DateTimeFormat(locale, { timeZone: currentHome.timeZone, hour: "2-digit", minute: "2-digit" });
  return <li className={condensed ? "flex min-w-0 flex-1 basis-56 items-start gap-2 py-1 text-sm" : "flex items-start gap-3 border-t py-3 first:border-0"}>
    <Icon className="mt-1 shrink-0 text-primary" size={20} aria-hidden="true" />
    <div className="min-w-0 flex-1 break-words"><strong className="block">{item.eventTitle || item.rule.title}</strong>
      {!condensed && item.eventTitle && <p className="text-sm text-muted-foreground">{item.rule.title} · {t(item.eventStart > Date.now() ? "Starts at {time}" : "Started at {time}", { time: time.format(item.eventStart) })}</p>}
      {!condensed && item.rule.message && <p className="text-sm">{item.rule.message}</p>}
      {!condensed && source && item.rule.trigger.type === "state" && <p className="text-sm text-muted-foreground">{source.name} · {entityStateLabel(source, language)}</p>}
      {details.map((detail, index) => detail && <p key={item.rule.detailEntities[index]} className="text-sm">{detail.name} · {entityStateLabel(detail, language)}{available(detail) && typeof detail.attributes.unit_of_measurement === "string" ? ` ${detail.attributes.unit_of_measurement}` : ""}</p>)}
      {details.some(detail => !detail) && <p className="text-sm text-muted-foreground">{t("Some additional readings are unavailable")}</p>}
      {item.rule.kind === "camera" && <Button variant="link" className="h-auto px-0" onClick={() => camera(item.id, true)}>{t("Show camera")}</Button>}
    </div>
    {item.rule.kind !== "ongoing" && <Button size="icon" variant="ghost" className="shrink-0" aria-label={t("Dismiss {name}", { name: item.eventTitle || item.rule.title })} onClick={() => dismiss(item.id)}><X size={18} aria-hidden="true" /></Button>}
  </li>;
}

export function NotificationList({ compact = false, presentation = "section" }: { compact?: boolean; presentation?: "banner" | "section" }) {
  const { message: t } = useI18n();
  const { notifications, errors, retry } = useNotifications();
  if (compact && !notifications.length && !errors.length) return null;
  const banner = compact && presentation === "banner";
  const heading = compact && <div className={`${banner ? "ml-auto" : "mb-3 justify-between"} flex flex-wrap items-center gap-2`}><PanelTitle icon={Bell} className={banner ? "sr-only" : "font-semibold"}>{t("Happening now")}</PanelTitle><Link className="text-link text-sm" to="/notifications">{t("View all ({count})", { count: notifications.length })}</Link></div>;
  return <section className={banner ? "mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2" : "glow-panel mb-5"} aria-label={t("Active notifications")}>
    {!banner && heading}
    {!!errors.length && <div role="status" className="mb-3 w-full"><p>{t("Some notification sources could not be loaded. Check the Home Assistant connection and permissions.")}</p><Button variant="outline" onClick={retry}>{t("Retry")}</Button></div>}
    {!notifications.length && !errors.length && <p className="empty-note">{t("Nothing needs your attention right now.")}</p>}
    {banner ? <ul className="flex min-w-0 flex-1 basis-72 flex-wrap gap-x-5 gap-y-2">{notifications.slice(0, 3).map(item => <NotificationRow key={item.id} item={item} condensed />)}</ul> : <div className={notifications.some(item => item.rule.kind === "ongoing") && notifications.some(item => item.rule.kind !== "ongoing") ? "grid gap-5 lg:grid-cols-2" : ""}>
      {(["ongoing", "current"] as const).map(kind => {
        const items = notifications.filter(item => (item.rule.kind === "ongoing") === (kind === "ongoing"));
        return items.length > 0 && <div key={kind} className="min-w-0"><PanelTitle as="h3" icon={kind === "ongoing" ? ListChecks : Bell} className="text-sm font-semibold text-muted-foreground">{t(kind === "ongoing" ? "Ongoing tasks" : "Current alerts")}</PanelTitle><ul>{(compact ? items.slice(0, 3) : items).map(item => <NotificationRow key={item.id} item={item} />)}</ul></div>;
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
