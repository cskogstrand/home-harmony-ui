import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpCircle, BellRing, DatabaseBackup, ExternalLink, Wrench } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useHaHealth } from "@/contexts/HaHealthContext";
import { useI18n } from "@/hooks/use-i18n";
import { activityTime } from "@/lib/activity";
import type { MessageKey } from "@/lib/i18n";
import { available } from "@/lib/ha-model";
import { backupProblems, fallbackRepairTitle, type PersistentNotification, type RepairIssue } from "@/lib/ha-health";
import { PanelTitle } from "./PanelTitle";
import { Button } from "./ui/button";
import "./ha-health.css";

const severityOrder = { critical: 0, error: 1, warning: 2 } as const;
const severityLabel = { critical: "Critical", error: "Error", warning: "Warning" } as const;

/** "in 14 hours", "10 hours ago", "3 days ago". */
function relativeTime(when: number, now: number, locale: string) {
  const diff = when - now, abs = Math.abs(diff);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  // Round the size, not the signed value, so past and future times round alike.
  const count = (unit: number) => Math.sign(diff) * Math.round(abs / unit) || 0;
  if (abs < 3600000) return format.format(count(60000), "minute");
  if (abs < 48 * 3600000) return format.format(count(3600000), "hour");
  return format.format(count(86400000), "day");
}

function HaLink({ path, children }: { path: string; children: ReactNode }) {
  const { t } = useI18n();
  const haUrl = useApp(app => app.haUrl);
  return haUrl ? <a className="text-link" href={`${haUrl}${path}`} target="_blank" rel="noreferrer">{children}<ExternalLink size={16} aria-label={t("Opens in a new tab")} /></a>
    : <Link className="text-link" to="/settings/connection">{t("Open connection settings")}</Link>;
}

/** Notification text as plain text; Markdown links keep their label and open when they point to Home Assistant or https. */
function NotificationText({ text }: { text: string }) {
  const haUrl = useApp(app => app.haUrl);
  const parts = text.replace(/\*\*|__/g, "").split(/\[([^\]\n]+)\]\(([^)\s]+)\)/);
  return <p className="health-message">{parts.map((part, index) => {
    if (index % 3 === 0) return <Fragment key={index}>{part}</Fragment>;
    if (index % 3 === 2) return null;
    const target = parts[index + 1];
    const href = target.startsWith("/") && !target.startsWith("//") ? haUrl && `${haUrl}${target}` : /^https:\/\//i.test(target) ? target : undefined;
    return href ? <a key={index} href={href} target="_blank" rel="noreferrer">{part}</a> : <Fragment key={index}>{part}</Fragment>;
  })}</p>;
}

function Repairs({ issues }: { issues?: RepairIssue[] }) {
  const { t } = useI18n();
  const id = useId();
  const { repairs } = useHaHealth();
  const open = (issues ?? []).filter(issue => !issue.ignored).sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  const ignored = (issues ?? []).length - open.length;
  return <section className="settings-card" aria-labelledby={`${id}-title`}>
    <PanelTitle icon={Wrench} id={`${id}-title`}>{t("Repairs")}</PanelTitle>
    {repairs.status === "loading" ? <p className="empty-note" role="status">{t("Checking Home Assistant…")}</p>
      : repairs.status === "unavailable" ? <p className="empty-note" role="status">{t("Repairs are unavailable right now.")}</p>
      : !open.length ? <p className="empty-note">{t("No repairs need attention.")}</p>
      : <ul className="health-list">{open.map(issue => <li key={`${issue.domain}:${issue.issueId}`}>
        <span className="health-severity" data-severity={issue.severity}>{t(severityLabel[issue.severity])}</span>
        <strong>{issue.title ?? fallbackRepairTitle(issue)}</strong>
        {issue.learnMoreUrl && <a className="text-link" href={issue.learnMoreUrl} target="_blank" rel="noreferrer">{t("Learn more")}<ExternalLink size={16} aria-label={t("Opens in a new tab")} /></a>}
      </li>)}</ul>}
    {ignored > 0 && <p className="page-note">{t(ignored === 1 ? "1 ignored repair is not shown." : "{count} ignored repairs are not shown.", { count: ignored })}</p>}
    <HaLink path="/config/repairs">{t("Open repairs in Home Assistant")}</HaLink>
  </section>;
}

function Notifications() {
  const { t, locale } = useI18n();
  const id = useId();
  const { homeOnline, subscribePersistentNotifications, dismissPersistentNotification, currentHome } = useApp();
  const { now } = useFamily();
  const [notifications, setNotifications] = useState<PersistentNotification[] | null | undefined>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    // Screens without the subscription (isolated tests, older clients) keep checking.
    if (!homeOnline || !subscribePersistentNotifications) return;
    return subscribePersistentNotifications(next => { setNotifications(next); setLoaded(true); });
  }, [homeOnline, subscribePersistentNotifications]);
  if (loaded && notifications === undefined) return null;
  async function dismiss(notification: PersistentNotification) {
    setBusy(previous => ({ ...previous, [notification.id]: true }));
    setErrors(({ [notification.id]: _, ...rest }) => rest);
    try { await dismissPersistentNotification(notification.id); }
    catch (error) { setErrors(previous => ({ ...previous, [notification.id]: (error as Error).message })); }
    finally { setBusy(({ [notification.id]: _, ...rest }) => rest); }
  }
  const list = notifications ?? [];
  return <section className="settings-card" aria-labelledby={`${id}-title`}>
    <PanelTitle icon={BellRing} id={`${id}-title`}>{t("Notifications from Home Assistant")}</PanelTitle>
    {!homeOnline ? <p className="empty-note" role="status">{t("Reconnect to Home Assistant to see its notifications.")}</p>
      : !loaded ? <p className="empty-note" role="status">{t("Checking Home Assistant…")}</p>
      : notifications === null ? <p className="empty-note" role="status">{t("Notifications are unavailable right now.")}</p>
      : !list.length ? <p className="empty-note">{t("No notifications from Home Assistant.")}</p>
      : <ul className="health-list">{list.map(notification => <li key={notification.id} aria-labelledby={`${id}-${notification.id}`}>
        <div className="health-item-head">
          <strong id={`${id}-${notification.id}`}>{notification.title ?? t("Notification")}</strong>
          {notification.created !== undefined && <time dateTime={new Date(notification.created).toISOString()}>{activityTime(notification.created, now.getTime(), locale, currentHome.timeZone)}</time>}
        </div>
        <NotificationText text={notification.message} />
        <Button type="button" variant="outline" size="sm" className="health-action" disabled={busy[notification.id]} aria-busy={busy[notification.id] || undefined}
          aria-label={t("Dismiss {title}", { title: notification.title ?? t("Notification") })} onClick={() => void dismiss(notification)}>
          {busy[notification.id] ? t("Dismissing…") : t("Dismiss")}
        </Button>
        {errors[notification.id] && <p role="alert" className="text-destructive">{t(errors[notification.id] as MessageKey)}</p>}
      </li>)}</ul>}
    <HaLink path="/notifications">{t("Open notifications in Home Assistant")}</HaLink>
  </section>;
}

function Backups() {
  const { t, locale } = useI18n();
  const id = useId();
  const { backup, checkedAt } = useHaHealth();
  const { currentHome } = useApp();
  const { now } = useFamily();
  const value = backup.status === "ready" ? backup.value : undefined;
  const problems = backupProblems(value, checkedAt ?? now.getTime());
  const when = (time?: number) => time === undefined ? undefined : <time dateTime={new Date(time).toISOString()}
    title={new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: currentHome.timeZone }).format(time)}>{relativeTime(time, now.getTime(), locale)}</time>;
  return <section className="settings-card" aria-labelledby={`${id}-title`}>
    <PanelTitle icon={DatabaseBackup} id={`${id}-title`}>{t("Backups")}</PanelTitle>
    {backup.status === "loading" ? <p className="empty-note" role="status">{t("Checking Home Assistant…")}</p>
      : !value ? <p className="empty-note" role="status">{t("Backup status is unavailable right now.")}</p>
      : <>
        {problems.includes("failed") && <p className="health-problem" role="status">{t("The last automatic backup failed.")}</p>}
        {problems.includes("stale") && <p className="health-problem" role="status">{t("The last successful automatic backup is more than 2 days old.")}</p>}
        <dl className="health-facts">
          <div><dt>{t("Last successful automatic backup")}</dt><dd>{when(value.lastCompleted) ?? t("None yet")}</dd></div>
          <div><dt>{t("Next scheduled backup")}</dt><dd>{when(value.next) ?? t("Not scheduled")}</dd></div>
        </dl>
        {value.agentErrors.length > 0 && <>
          <p className="health-problem" role="status">{t("A backup location reported an error.")}</p>
          <ul className="health-list">{value.agentErrors.map(error => <li key={error.agent}><strong>{error.agent}</strong>{error.message && <span className="health-message">{error.message}</span>}</li>)}</ul>
        </>}
      </>}
    <HaLink path="/config/backup">{t("Open backups in Home Assistant")}</HaLink>
  </section>;
}

function Updates() {
  const { t } = useI18n();
  const id = useId();
  const entities = useApp(app => app.currentHome.entities);
  const updates = entities.filter(entity => entity.domain === "update" && available(entity) && entity.state === "on");
  return <section className="settings-card" aria-labelledby={`${id}-title`}>
    <PanelTitle icon={ArrowUpCircle} id={`${id}-title`}>{t("Updates")}</PanelTitle>
    {!updates.length ? <p className="empty-note">{t("No updates are waiting.")}</p>
      : <ul className="health-list">{updates.map(entity => <li key={entity.entityId}>
        <strong>{String(entity.attributes.title || "") || entity.name}</strong>
        {typeof entity.attributes.latest_version === "string" && <span className="health-message">{t("Version {version} is available.", { version: entity.attributes.latest_version })}</span>}
      </li>)}</ul>}
    <HaLink path="/config/updates">{t("Install updates in Home Assistant")}</HaLink>
  </section>;
}

/** Settings → System → Home Assistant health: repairs, notifications, backups and updates. Reads that need an administrator token hide when refused. */
export function HaHealthSettings() {
  const { t } = useI18n();
  const { repairs, backup, refresh } = useHaHealth();
  // Opening the section reads repairs and backup status again.
  useEffect(() => { refresh(); }, [refresh]);
  const hidden = repairs.status === "hidden" && backup.status === "hidden";
  return <div className="settings-stack">
    {hidden && <p className="page-note">{t("Repairs and backup status need a Home Assistant administrator token on the dashboard server.")}</p>}
    {repairs.status !== "hidden" && <Repairs issues={repairs.status === "ready" ? repairs.value : undefined} />}
    <Notifications />
    {backup.status !== "hidden" && <Backups />}
    <Updates />
  </div>;
}
