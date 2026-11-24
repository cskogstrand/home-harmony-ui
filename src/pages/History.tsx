import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, History as HistoryIcon, ListChecks, ListOrdered } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { addDays, useFamily } from "@/contexts/FamilyContext";
import { useActivityPersonSensors, useLogbook } from "@/hooks/use-activity-feed";
import { ActivityRow } from "@/components/ActivityFeed";
import { EntityPicker } from "@/components/EntityPicker";
import { PanelTitle } from "@/components/PanelTitle";
import { SettingsPanels } from "@/components/SettingsPanels";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { calendarBoundary } from "@/lib/ha-model";
import { activitySourceCandidates, curateActivity, defaultActivitySources, type ActivityGroup } from "@/lib/activity";
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

/** Recent at home on Smart home: visibility, people and curated sources, shared across screens. */
function RecentActivitySettings() {
  const { t } = useI18n();
  const { currentHome } = useApp();
  const { activity, setActivity } = useFamily();
  const shared = useSharedConfiguration();
  const personSensors = useActivityPersonSensors();
  const id = useId();
  const disabled = !shared?.state.loaded || !!shared.state.error;
  const sources = activity.sources ?? defaultActivitySources(currentHome.entities, Object.keys(personSensors));
  return <div className="settings-stack">
    <section className="settings-card settings-preferences" aria-labelledby={`${id}-recent`}>
      <PanelTitle icon={HistoryIcon} id={`${id}-recent`}>{t("Recent at home")}</PanelTitle>
      <label className="settings-control-row">
        <span>{t("Show on Smart home")}<span className="page-note block" id={`${id}-panel`}>{t("The latest changes from your activity sources, below your cards.")}</span></span>
        <Switch aria-label={t("Show on Smart home")} aria-describedby={`${id}-panel`} checked={activity.panel} disabled={disabled} onCheckedChange={panel => setActivity({ panel })} />
      </label>
      <label className="settings-control-row">
        <span>{t("Include people coming and going")}<span className="page-note block" id={`${id}-people`}>{t("Off by default, so a shared screen does not show where people are. Also applies to the activity log.")}</span></span>
        <Switch aria-label={t("Include people coming and going")} aria-describedby={`${id}-people`} checked={activity.people} disabled={disabled} onCheckedChange={people => setActivity({ people })} />
      </label>
    </section>
    <section className="settings-card" aria-labelledby={`${id}-sources`}>
      <PanelTitle icon={ListChecks} id={`${id}-sources`}>{t("Activity sources")}</PanelTitle>
      <p className="page-note" id={`${id}-sources-note`}>{t(activity.sources ? "Your chosen sources." : "Suggested: doors, windows, locks, the alarm, appliances, robots, doorbells and camera person detection.")}</p>
      <EntityPicker multiple label={t("Choose activity sources")} hideLabel describedBy={`${id}-sources-note`} entities={activitySourceCandidates(currentHome.entities)}
        value={sources} disabled={disabled} onChange={ids => setActivity({ sources: ids })} missingLabel={() => t("Source unavailable")} />
      {activity.sources && <Button variant="outline" className="mt-4" disabled={disabled} onClick={() => setActivity({ sources: undefined })}>{t("Use suggested sources")}</Button>}
    </section>
  </div>;
}

/** Settings → System → Activity: the full log and the Recent at home settings. */
export default function History() {
  const { t } = useI18n();
  const { activity } = useFamily();
  return <SettingsPanels panels={[
    { id: "log", label: t("Activity log"), icon: ListOrdered, content: <ActivityLog /> },
    { id: "recent", label: t("Recent at home"), detail: t(activity.panel ? "Shown on Smart home" : "Hidden"), icon: HistoryIcon, content: <RecentActivitySettings /> },
  ]} />;
}
