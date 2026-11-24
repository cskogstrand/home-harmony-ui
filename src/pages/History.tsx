import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, ListOrdered } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { addDays, useFamily } from "@/contexts/FamilyContext";
import { useActivityPersonSensors, useLogbook } from "@/hooks/use-activity-feed";
import { ActivityRow } from "@/components/ActivityFeed";
import { PanelTitle } from "@/components/PanelTitle";
import { calendarBoundary } from "@/lib/ha-model";
import { curateActivity, type ActivityGroup } from "@/lib/activity";
import { homeStatusGroups } from "@/lib/home-status";
import "@/components/activity-feed.css";

const LOG_LIMIT = 300;
const groupLabel = (group: ActivityGroup) => group === "people" ? "People" : group === "other" ? "Other" : homeStatusGroups[group];

/** The full activity log for today or yesterday, filtered by area and type. */
function ActivityLog() {
  const { t, message, language } = useI18n();
  const { currentHome, haUrl } = useApp();
  const { activity, now, today } = useFamily();
  const personSensors = useActivityPersonSensors();
  const id = useId();
  const [day, setDay] = useState<"today" | "yesterday">("today");
  const [area, setArea] = useState("all");
  const [group, setGroup] = useState("all");
  const date = day === "today" ? today : addDays(today, -1);
  const feed = useLogbook({ start: calendarBoundary(date, currentHome.timeZone), end: day === "yesterday" ? calendarBoundary(today, currentHome.timeZone) : undefined });
  const items = curateActivity(feed.events, currentHome.entities, { mode: "full", language, people: activity.people, personSensors });
  const areas = currentHome.areas.filter(room => room.id === area || items.some(item => item.areaId === room.id));
  const groups = [...new Set([...items.map(item => item.group), ...(group === "all" ? [] : [group as ActivityGroup])])];
  const visible = items.filter(item => (area === "all" || item.areaId === area) && (group === "all" || item.group === group));
  const empty = feed.status === "loading" ? t("Loading activity…") : feed.status === "unavailable" ? t("Activity is unavailable right now.")
    : !items.length ? t("Nothing was logged on this day.") : !visible.length && t("No activity matches these filters.");
  return <section className="settings-card" aria-labelledby={`${id}-title`}>
    <PanelTitle icon={ListOrdered} id={`${id}-title`}>{t("Activity log")}</PanelTitle>
    <div className="activity-filters">
      <div className="calendar-segment" role="group" aria-label={t("Day")}>
        {(["today", "yesterday"] as const).map(value => <button type="button" key={value} aria-pressed={day === value} onClick={() => setDay(value)}>{t(value === "today" ? "Today" : "Yesterday")}</button>)}
      </div>
      <label>{t("Area")}<select value={area} onChange={event => setArea(event.target.value)}>
        <option value="all">{t("All areas")}</option>
        {areas.map(room => <option key={room.id} value={room.id}>{room.id === "unassigned" ? t("Unassigned") : room.name}</option>)}
      </select></label>
      <label>{t("Type")}<select value={group} onChange={event => setGroup(event.target.value)}>
        <option value="all">{t("All types")}</option>
        {groups.map(value => <option key={value} value={value}>{message(groupLabel(value))}</option>)}
      </select></label>
    </div>
    {feed.status === "stale" && <p className="page-note activity-stale" role="status">{t("Cached activity is stale while Home Assistant is offline.")}</p>}
    {empty ? <p className="empty-note" role="status">{empty}</p>
      : <ol className="activity-list" data-stale={feed.status === "stale" || undefined}>{visible.slice(0, LOG_LIMIT).map(item => <ActivityRow key={item.id} item={item} now={now.getTime()} clock />)}</ol>}
    {visible.length > LOG_LIMIT && <p className="page-note">{t("Showing the latest {count} events.", { count: LOG_LIMIT })}</p>}
    {haUrl ? <a className="text-link min-h-11" href={`${haUrl}/logbook`} target="_blank" rel="noreferrer">{t("Open logbook in Home Assistant")}<ExternalLink size={16} aria-label={t("Opens in a new tab")} /></a>
      : <Link className="text-link min-h-11" to="/settings/connection">{t("Open connection settings")}</Link>}
  </section>;
}

/** Settings → System → Activity. */
export default function History() {
  return <div className="settings-stack"><ActivityLog /></div>;
}
