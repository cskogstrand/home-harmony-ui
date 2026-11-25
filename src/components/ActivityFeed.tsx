import { Link } from "react-router-dom";
import { Activity, AppWindow, ArrowUpRight, BellRing, Bot, Cctv, DoorOpen, History, Lock, Power, ShieldCheck, Tractor, UserRound, WashingMachine, Warehouse, type LucideIcon } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { useActivityPersonSensors, useLogbook } from "@/hooks/use-activity-feed";
import { activityTime, curateActivity, curatedActivityEntityIds, RECENT_ACTIVITY_LIMIT, type ActivityIcon, type ActivityItem } from "@/lib/activity";
import { PanelTitle } from "./PanelTitle";
import "./activity-feed.css";

const icons: Record<ActivityIcon, LucideIcon> = {
  door: DoorOpen, garage: Warehouse, window: AppWindow, lock: Lock, alarm: ShieldCheck, appliance: WashingMachine, robot: Bot, mower: Tractor,
  camera: Cctv, doorbell: BellRing, person: UserRound, power: Power, activity: Activity,
};
/** One event: icon, sentence linking to the entity, folded change count and time (relative, or the clock time with `clock`). */
export function ActivityRow({ item, now, clock = false }: { item: ActivityItem; now: number; clock?: boolean }) {
  const { message, t, locale } = useI18n();
  const { timeZone } = useApp().currentHome;
  const Icon = icons[item.icon];
  const sentence = message(item.sentence);
  const time = clock ? new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(item.when) : activityTime(item.when, now, locale, timeZone);
  return <li className="activity-row">
    <Icon size={20} aria-hidden="true" />
    <span className="activity-sentence">
      {item.path ? <Link to={item.path}>{sentence}</Link> : sentence}
      {item.count > 1 && <small>{t("{count} changes", { count: item.count })}</small>}
    </span>
    <time dateTime={new Date(item.when).toISOString()} title={new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(item.when)}>{time}</time>
  </li>;
}

/**
 * Recent at home: a curated, live list of what happened in the last 24 hours.
 * Smart home follows the Activity panel switch; Today shows it whenever its own section is on. Both use the same sources and people choice.
 */
export function RecentActivity({ placement = "smartHome" }: { placement?: "smartHome" | "today" }) {
  const { t, language } = useI18n();
  const { entities } = useApp().currentHome;
  const { activity, now } = useFamily();
  const personSensors = useActivityPersonSensors();
  const entityIds = curatedActivityEntityIds(entities, { ...activity, personSensors });
  const visible = placement === "today" || activity.panel;
  const feed = useLogbook({ hours: 24, entityIds, enabled: visible && entityIds.length > 0 });
  if (!visible) return null;
  const since = now.getTime() - 86400000;
  const items = curateActivity(feed.events.filter(event => event.when >= since), entities,
    { mode: "curated", language, people: activity.people, sources: activity.sources, personSensors, limit: RECENT_ACTIVITY_LIMIT });
  const empty = !entityIds.length ? <p className="empty-note">{t("No activity sources are selected.")} <Link className="text-link" to="/settings/activity?panel=recent">{t("Choose sources")}</Link></p>
    : feed.status === "loading" ? <p className="empty-note" role="status">{t("Loading activity…")}</p>
    : feed.status === "unavailable" ? <p className="empty-note" role="status">{t("Activity is unavailable right now.")}</p>
    : !items.length && <p className="empty-note">{t("Nothing has happened in the last 24 hours.")}</p>;
  return <section className="glow-panel activity-panel" aria-labelledby="recent-activity-title">
    <div className="panel-heading">
      <PanelTitle icon={History} id="recent-activity-title">{t("Recent at home")}</PanelTitle>
      <Link className="text-link" to="/settings/activity">{t("All activity")}<ArrowUpRight size={17} aria-hidden="true" /></Link>
    </div>
    {feed.status === "stale" && <p className="page-note activity-stale" role="status">{t("Cached activity is stale while Home Assistant is offline.")}</p>}
    {empty || <ol className="activity-list" data-stale={feed.status === "stale" || undefined}>{items.map(item => <ActivityRow key={item.id} item={item} now={now.getTime()} />)}</ol>}
  </section>;
}
