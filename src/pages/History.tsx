import { useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, CircleAlert, ExternalLink, Filter, History as HistoryIcon, ListChecks, ListOrdered, X } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { addDays, useFamily } from "@/contexts/FamilyContext";
import { useActivityPersonSensors, useLogbook } from "@/hooks/use-activity-feed";
import { ActivityRow } from "@/components/ActivityFeed";
import { activityIcons } from "@/components/activity-icons";
import { DeviceIcon } from "@/components/devices/DeviceControl";
import { EntityPicker } from "@/components/EntityPicker";
import { PanelTitle } from "@/components/PanelTitle";
import { SettingsPanels } from "@/components/SettingsPanels";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { calendarBoundary } from "@/lib/ha-model";
import { activityIconCategory, activitySourceCandidates, activitySourceIcon, curateActivity, defaultActivitySources, type ActivityGroup, type ActivityIcon } from "@/lib/activity";
import type { MessageKey } from "@/lib/i18n";
import type { Entity } from "@/types/api";
import { activityCategories, type ActivityCategory } from "../../shared/configuration";
import { homeStatusGroups } from "@/lib/home-status";
import "@/components/activity-feed.css";

const LOG_LIMIT = 300;
const categoryLabels: Record<ActivityCategory, MessageKey> = {
  openings: "Doors and windows", locks: "Locks", alarm: "Alarm", appliances: "Appliances", robots: "Robot vacuums and mowers",
  doorbells: "Doorbells", cameras: "Camera person detection", other: "Other changes",
};
const groupLabel = (group: ActivityGroup) => group === "people" ? "People" : group === "other" ? "Other" : homeStatusGroups[group];
const categoryIcons: Record<ActivityCategory, ActivityIcon> = {
  openings: "door", locks: "lock", alarm: "alarm", appliances: "appliance", robots: "robot", doorbells: "doorbell", cameras: "camera", other: "activity",
};
// Short selections open every type; longer ones (the suggestions are often dozens) start as a list of types and counts.
const OPEN_TYPES_UP_TO = 12;

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
  // Shows the event types hidden in the settings in this view only; the saved choice stays.
  const [showAll, setShowAll] = useState(false);
  const filtered = !!activity.hidden?.length;
  const date = day === "today" ? today : addDays(today, -1);
  const feed = useLogbook({ start: calendarBoundary(date, currentHome.timeZone), end: day === "yesterday" ? calendarBoundary(today, currentHome.timeZone) : undefined });
  const items = curateActivity(feed.events, currentHome.entities, { mode: "full", language, people: activity.people, personSensors, hidden: showAll ? undefined : activity.hidden, timeZone: currentHome.timeZone });
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
    {filtered && <label className="settings-control-row">
      <span>{t("Show all events")}<span className="page-note block" id={`${id}-all`}>{t("Includes the event types hidden under Latest events, in this view only. People coming and going still follow their own setting.")}</span></span>
      <Switch aria-label={t("Show all events")} aria-describedby={`${id}-all`} checked={showAll} onCheckedChange={setShowAll} />
    </label>}
    {feed.status === "stale" && <p className="page-note activity-stale" role="status">{t("Cached activity is stale while Home Assistant is offline.")}</p>}
    {empty ? <p className="empty-note" role="status">{empty}</p>
      : <ol className="activity-list" data-stale={feed.status === "stale" || undefined}>{visible.slice(0, LOG_LIMIT).map(item => <ActivityRow key={item.id} item={item} now={now.getTime()} clock />)}</ol>}
    {visible.length > LOG_LIMIT && <p className="page-note">{t("Showing the latest {count} events.", { count: LOG_LIMIT })}</p>}
    {haUrl ? <a className="text-link min-h-11" href={`${haUrl}/logbook`} target="_blank" rel="noreferrer">{t("Open logbook in Home Assistant")}<ExternalLink size={16} aria-label={t("Opens in a new tab")} /></a>
      : <Link className="text-link min-h-11" to="/settings/connection">{t("Open connection settings")}</Link>}
  </section>;
}

/** The event type's icon (door, lock, robot …); other changes use the device icon. */
function SourceIcon({ entity, icon }: { entity: Entity; icon: ActivityIcon }) {
  if (icon === "activity") return <DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-5 w-5 shrink-0" />;
  const Icon = activityIcons[icon];
  return <Icon size={20} aria-hidden="true" />;
}

type ChosenSourcesProps = { sources: string[]; personSensors: Record<string, string>; hidden: readonly ActivityCategory[]; disabled: boolean; onRemove: (value: string) => void; fallbackFocus: () => void };

/** The chosen sources grouped by event type, readable without opening the picker; each one can be removed on its own. */
function ChosenSources({ sources, personSensors, hidden, disabled, onRemove, fallbackFocus }: ChosenSourcesProps) {
  const { t, language } = useI18n();
  const { currentHome } = useApp();
  const [expanded] = useState(() => sources.length <= OPEN_TYPES_UP_TO);
  const cameras = new Set(Object.keys(personSensors));
  const byId = new Map(currentHome.entities.map(entity => [entity.preferenceId, entity]));
  const name = (entity: Entity) => personSensors[entity.entityId] ?? entity.name;
  const area = (entity: Entity) => currentHome.areas.find(room => room.id === entity.areaId && room.id !== "unassigned")?.name;
  const chosen = sources.flatMap(value => { const entity = byId.get(value); return entity ? [{ value, entity, icon: activitySourceIcon(entity, cameras) }] : []; })
    .sort((a, b) => name(a.entity).localeCompare(name(b.entity), language));
  const missing = sources.filter(value => !byId.has(value));
  const count = (total: number) => t(total === 1 ? "1 source" : "{count} sources", { count: total });
  // Removing a row hands focus to its neighbour, then to the next type, so keyboard users keep their place.
  const remove = (event: MouseEvent<HTMLButtonElement>, value: string) => {
    const row = event.currentTarget.closest("li"), group = row?.closest("details");
    const next = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector("button")
      ?? (group?.nextElementSibling ?? group?.previousElementSibling)?.querySelector("summary");
    if (next) next.focus(); else fallbackFocus();
    onRemove(value);
  };
  const row = (value: string, label: string, detail: string | undefined, icon: ReactNode) => <li key={value} className="activity-source">
    {icon}
    <span className="activity-source-copy"><strong>{label}</strong>{detail && <small>{detail}</small>}</span>
    <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t("Remove {name} from activity sources", { name: label })} onClick={event => remove(event, value)}><X size={18} aria-hidden="true" /></Button>
  </li>;
  const group = (key: string, label: string, icon: ReactNode, total: number, rows: ReactNode, note?: string) => <details key={key} className="activity-source-group" open={expanded}>
    <summary>{icon}<span className="activity-source-type">{label}{note && <small>{note}</small>}</span><span className="activity-source-count">{count(total)}</span><ChevronDown className="activity-source-chevron" size={18} aria-hidden="true" /></summary>
    <ul>{rows}</ul>
  </details>;
  if (!sources.length) return <p className="empty-note activity-sources-empty">{t("No sources chosen. Latest events only shows people coming and going, when they are included.")}</p>;
  return <div className="activity-source-groups">
    {activityCategories.map(category => {
      const members = chosen.filter(member => activityIconCategory(member.icon) === category);
      if (!members.length) return null;
      const Icon = activityIcons[categoryIcons[category]];
      return group(category, t(categoryLabels[category]), <Icon size={20} aria-hidden="true" />, members.length,
        members.map(({ value, entity, icon }) => row(value, name(entity), area(entity), <SourceIcon entity={entity} icon={icon} />)),
        hidden.includes(category) ? t("Hidden under Event types") : undefined);
    })}
    {!!missing.length && group("missing", t("Unavailable sources"), <CircleAlert size={20} aria-hidden="true" />, missing.length,
      missing.map(value => row(value, t("Source unavailable"), value.slice(value.indexOf("|") + 1), <CircleAlert size={20} aria-hidden="true" />)),
      t("Not found in Home Assistant right now."))}
  </div>;
}

/** Latest events on Smart home (and Today, when its section is on): visibility, people and curated sources, shared across screens. */
function RecentActivitySettings() {
  const { t } = useI18n();
  const { currentHome } = useApp();
  const { activity, setActivity } = useFamily();
  const shared = useSharedConfiguration();
  const personSensors = useActivityPersonSensors();
  const id = useId();
  const sourcesTitle = useRef<HTMLHeadingElement>(null);
  const disabled = !shared?.state.loaded || !!shared.state.error;
  const sources = activity.sources ?? defaultActivitySources(currentHome.entities, Object.keys(personSensors));
  return <div className="settings-stack">
    <section className="settings-card settings-preferences" aria-labelledby={`${id}-recent`}>
      <PanelTitle icon={HistoryIcon} id={`${id}-recent`}>{t("Latest events")}</PanelTitle>
      <label className="settings-control-row">
        <span>{t("Show on Smart home")}<span className="page-note block" id={`${id}-panel`}>{t("The latest changes from your activity sources, below your cards.")}</span></span>
        <Switch aria-label={t("Show on Smart home")} aria-describedby={`${id}-panel`} checked={activity.panel} disabled={disabled} onCheckedChange={panel => setActivity({ panel })} />
      </label>
      <label className="settings-control-row">
        <span>{t("Include people coming and going")}<span className="page-note block" id={`${id}-people`}>{t("Off by default, so a shared screen does not show where people are. Also applies to the activity log.")}</span></span>
        <Switch aria-label={t("Include people coming and going")} aria-describedby={`${id}-people`} checked={activity.people} disabled={disabled} onCheckedChange={people => setActivity({ people })} />
      </label>
    </section>
    <section className="settings-card settings-preferences" aria-labelledby={`${id}-types`}>
      <PanelTitle icon={Filter} id={`${id}-types`}>{t("Event types")}</PanelTitle>
      <p className="page-note" id={`${id}-types-note`}>{t("Turn off what you do not want to see in Latest events and the activity log.")}</p>
      {activityCategories.map(category => <label key={category} className="settings-control-row">
        <span>{t(categoryLabels[category])}</span>
        <Switch aria-label={t(categoryLabels[category])} aria-describedby={`${id}-types-note`} checked={!activity.hidden?.includes(category)} disabled={disabled}
          onCheckedChange={shown => setActivity({ hidden: shown ? (activity.hidden ?? []).filter(value => value !== category) : [...activity.hidden ?? [], category] })} />
      </label>)}
    </section>
    <section className="settings-card" aria-labelledby={`${id}-sources`}>
      <PanelTitle ref={sourcesTitle} tabIndex={-1} icon={ListChecks} id={`${id}-sources`}>{t("Activity sources")}</PanelTitle>
      <p className="page-note" id={`${id}-sources-note`}>{t(activity.sources ? "Your chosen sources." : "Suggested: doors, windows, locks, the alarm, appliances, robots, doorbells and camera person detection.")}</p>
      <p className="page-note activity-sources-people">{t(activity.people ? "People coming and going are included as well, under Latest events above." : "People coming and going are left out. Turn them on under Latest events above.")}</p>
      <EntityPicker multiple className="activity-sources-picker" label={t("Choose activity sources")} hideLabel describedBy={`${id}-sources-note`} entities={activitySourceCandidates(currentHome.entities)}
        value={sources} disabled={disabled} onChange={ids => setActivity({ sources: ids })} missingLabel={() => t("Source unavailable")}
        placeholder={t("Choose activity sources")} getLabel={entity => personSensors[entity.entityId] ?? entity.name} />
      <ChosenSources sources={sources} personSensors={personSensors} hidden={activity.hidden ?? []} disabled={disabled}
        onRemove={value => setActivity({ sources: sources.filter(source => source !== value) })} fallbackFocus={() => sourcesTitle.current?.focus()} />
      {activity.sources && <Button variant="outline" className="mt-4" disabled={disabled} onClick={() => setActivity({ sources: undefined })}>{t("Use suggested sources")}</Button>}
    </section>
  </div>;
}

/** Settings → System → Activity: the full log and the Latest events settings. */
export default function History() {
  const { t } = useI18n();
  const { activity, dashboard } = useFamily();
  const shown = activity.panel ? dashboard.recentActivity ? "Shown on Smart home and Today" : "Shown on Smart home" : dashboard.recentActivity ? "Shown on Today" : "Hidden";
  return <SettingsPanels panels={[
    { id: "log", label: t("Activity log"), icon: ListOrdered, content: <ActivityLog /> },
    { id: "recent", label: t("Latest events"), detail: t(shown), icon: HistoryIcon, content: <RecentActivitySettings /> },
  ]} />;
}
