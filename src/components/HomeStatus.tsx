import { Activity, ArrowLeft, BatteryCharging, Check, ChevronRight, CircleDashed, CloudSun, Droplets, Flame, House, Lamp, LockKeyhole, Radar, SlidersHorizontal, Thermometer, TriangleAlert, WashingMachine, WifiOff, Zap } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useHaHealth } from "@/contexts/HaHealthContext";
import { useI18n } from "@/hooks/use-i18n";
import { entityDetailPath } from "@/lib/device-model";
import { entityReading, entityStateLabel } from "@/lib/ha-model";
import { fallbackRepairTitle, type MaintenanceItem } from "@/lib/ha-health";
import { defaultHomeStatusSources, homeReadingState, homeStatusGroup, homeStatusGroups, type HomeStatusGroup } from "@/lib/home-status";
import type { Entity } from "@/types/api";
import { PlannerCardBackdrop, PlannerCardIcon } from "./CardArtwork";
import { EntityPicker } from "./EntityPicker";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import houseArtwork from "@/assets/home-status.svg?no-inline";
import "./home-status.css";

const statusIcons = { loading: Activity, offline: WifiOff, setup: CircleDashed, attention: TriangleAlert, healthy: Check };
const groups = { ...homeStatusGroups, missing: "Unmatched sources" } as const;
type Group = keyof typeof groups;
const icons = { fire: Flame, water: Droplets, access: LockKeyhole, security: Radar, climate: Thermometer, energy: Zap,
  lighting: Lamp, appliances: WashingMachine, outdoors: CloudSun, maintenance: BatteryCharging, missing: CircleDashed };
const examples = {
  fire: "Smoke, heat and gas detectors", water: "Leak sensors, valves and water meters", access: "Door contacts, windows and locks",
  security: "Alarm panels, motion and occupancy", climate: "Temperature, humidity and air quality", energy: "Electricity use, power and voltage",
  lighting: "Lights and illuminance", appliances: "Appliance switches, cycles and robots", outdoors: "Weather, rainfall and garden sensors",
  maintenance: "Batteries, connectivity and updates",
} as const satisfies Record<HomeStatusGroup, string>;
type Reading = { id: string; entity?: Entity; group: Group; state: ReturnType<typeof homeReadingState> };
// Safety alerts first, then other alerts and Home Assistant maintenance, then missing readings.
const readingPriority = (reading: Reading) => reading.state === "unavailable" ? 2 : ["fire", "water", "security"].includes(reading.group) ? 0 : 1;
type Issue = { kind: "reading"; reading: Reading } | { kind: "health"; item: MaintenanceItem };
const healthLabels = {
  failed: ["Automatic backup", "Failed"], stale: ["Automatic backup", "More than 2 days old"], "agent-errors": ["Backup location", "Error"],
} as const;

export function HomeStatus({ card = false }: { card?: boolean }) {
  const { t, number, language, reading: formatReading } = useI18n();
  const { currentHome, homeOnline, connectionStatus } = useApp();
  const { dashboard, setDashboard, selectedAlarm } = useFamily();
  const health = useHaHealth();
  const shared = useSharedConfiguration();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"overview" | "readings" | "sources" | Group>("overview");
  const group = view === "overview" || view === "readings" || view === "sources" ? undefined : view;
  const heading = useRef<HTMLHeadingElement>(null);
  const backTo = useRef<typeof view>();
  const list = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { sources, readings, issues } = useMemo(() => {
    const sources = dashboard.statusSources ?? defaultHomeStatusSources(currentHome.entities, selectedAlarm);
    const selected = new Set(sources);
    const byId = new Map(currentHome.entities.filter(e => selected.has(e.preferenceId)).map(e => [e.preferenceId, e]));
    const readings = sources.map((id): Reading => {
      const entity = byId.get(id);
      return { id, entity, group: entity && homeStatusGroup(entity) || "missing" as const, state: homeReadingState(entity) };
    });
    const issues = readings.filter(r => r.state !== "reported").sort((a, b) => readingPriority(a) - readingPriority(b));
    return { sources, readings, issues };
  }, [currentHome.entities, dashboard.statusSources, selectedAlarm]);
  const loading = shared && !shared.state.loaded && !shared.state.error || ["connecting", "syncing"].includes(connectionStatus);
  const offline = !homeOnline || shared && !shared.state.loaded;
  const live = !loading && !offline;
  // Only actionable Home Assistant maintenance joins the readings: error and critical repairs and backup problems.
  const attention: Issue[] = live ? [...issues.map(reading => ({ kind: "reading" as const, reading })), ...health.items.map(item => ({ kind: "health" as const, item }))]
    .sort((a, b) => (a.kind === "reading" ? readingPriority(a.reading) : 1) - (b.kind === "reading" ? readingPriority(b.reading) : 1)) : [];
  const count = attention.length;
  const status = loading ? "loading" : offline ? "offline" : count ? "attention" : !sources.length ? "setup" : "healthy";
  const StatusIcon = statusIcons[status];
  const tone = status === "healthy" || status === "attention" ? status : "neutral";
  let scene: string = status;
  const first = attention[0]?.kind === "reading" ? attention[0].reading : undefined;
  if (first) {
    if (first.state === "unavailable") scene = "missing";
    else if (first.group === "fire" || first.entity?.domain === "alarm_control_panel") scene = "alarm";
    else if (first.group === "water") scene = "leak";
    else if (first.entity?.attributes.device_class === "battery") scene = "battery";
  }
  const summary = loading ? t("Checking home status…") : offline ? t("Home status unavailable")
    : count ? t(count === 1 ? "1 issue" : "{count} issues", { count }) : !sources.length ? t("No sources selected") : t("No issues reported");
  const label = [t("Home status"), summary].join(" · ");
  function readingValue(entity?: Entity) {
    if (!live || !entity || homeReadingState(entity) === "unavailable") return t("No reading");
    if (entity.domain === "climate") return formatReading(Number(entity.attributes.current_temperature), { unit: currentHome.temperatureUnit, deviceClass: "temperature" });
    return entity.domain === "sensor" ? entityReading(entity, language) : entityStateLabel(entity, language);
  }
  function healthText(item: MaintenanceItem) {
    if (item.kind === "repair") return { name: item.issue.title ?? fallbackRepairTitle(item.issue), value: t(item.issue.severity === "critical" ? "Critical" : "Error") };
    const [name, value] = healthLabels[item.kind];
    return { name: t(name), value: t(value) };
  }
  function issueRow(issue: Issue) {
    if (issue.kind === "reading") return readingRow(issue.reading);
    const { name, value } = healthText(issue.item);
    return <li key={issue.item.id}><Link to="/settings/ha-health" onClick={() => onOpenChange(false)}>
      <span className="housing-source-name"><strong>{name}</strong><small>{t("Home Assistant")}</small></span>
      <span className="housing-issue-value">{value}</span><ChevronRight size={16} aria-hidden="true" /></Link></li>;
  }
  const firstIssue = attention[0] && (attention[0].kind === "reading"
    ? { name: attention[0].reading.entity?.name ?? t("Unavailable"), value: readingValue(attention[0].reading.entity) } : healthText(attention[0].item));
  function readingRow(r: Reading) {
    const room = r.entity && r.entity.areaId !== "unassigned" && currentHome.areas.find(area => area.id === r.entity.areaId)?.name;
    const name = r.entity?.name ?? r.id.slice(r.id.indexOf("|") + 1);
    const content = <><span className="housing-source-name"><strong>{name}</strong>{room && <small>{room}</small>}</span>
      <span className={live && r.state !== "reported" ? "housing-issue-value" : ""}>{readingValue(r.entity)}</span></>;
    return <li key={r.id}>{r.entity ? <Link to={entityDetailPath(r.entity)} onClick={() => onOpenChange(false)}>{content}<ChevronRight size={16} aria-hidden="true" /></Link>
      : <div>{content}</div>}</li>;
  }
  const groupReadings = readings.filter(r => r.group === group);
  const candidates = group && group !== "missing" ? currentHome.entities.filter(entity => homeStatusGroup(entity) === group) : [];
  const monitored = (Object.keys(groups) as Group[]).filter(key => readings.some(r => r.group === key));
  const sourceCount = t(sources.length === 1 ? "1 source" : "{count} sources", { count: sources.length });
  const coverage = monitored.length <= 2 ? [sourceCount, ...monitored.map(key => t(groups[key]))].join(" · ")
    : t("{sources} sources across {groups} categories", { sources: sources.length, groups: monitored.length });
  const title = group ? t(groups[group]) : t(view === "sources" ? "Manage sources" : view === "readings" ? "Readings" : "Home status");
  function back() {
    backTo.current = view;
    setView(group ? "sources" : "overview");
  }
  useLayoutEffect(() => {
    if (!open) return;
    const previous = list.current?.querySelector<HTMLButtonElement>(`[data-to="${backTo.current}"]`);
    (previous ?? heading.current)?.focus();
    backTo.current = undefined;
  }, [view, open]);
  const onOpenChange = (value: boolean) => { setOpen(value); if (!value) { setView("overview"); backTo.current = undefined; } };
  if (card && !count && !open) return null;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    {card ? count > 0 && <DialogTrigger asChild><button ref={trigger} type="button" className="glow-panel housing-card">
      <PlannerCardBackdrop kind="homeStatus" />
      {/* With card artwork on, the illustration leads and the warning rides on it as a badge, like the header's Home status button. */}
      <PlannerCardIcon kind="homeStatus" className="housing-card-icon"
        badge={<span className="header-badge" data-tone="attention" aria-hidden="true"><TriangleAlert size={13} strokeWidth={2.6} /></span>}>
        <TriangleAlert className="housing-card-alert" aria-hidden="true" /></PlannerCardIcon><span><strong>{t("Home status")} · {summary}</strong>
        <small>{firstIssue.name} · {firstIssue.value}</small></span><ChevronRight aria-hidden="true" /></button></DialogTrigger>
      : <DialogTrigger asChild><button type="button" id="home-status-button" className="icon-button glass-surface" data-tone={tone} aria-label={label} title={label}>
        <House size={21} aria-hidden="true" />
        {status !== "healthy" && <span className="header-badge" data-tone={tone} aria-hidden="true"><StatusIcon size={13} strokeWidth={2.6} />{count > 0 && number(count)}</span>}
      </button></DialogTrigger>}
    {!card && <span className="sr-only" role="status" aria-atomic="true">{label}</span>}
    {open && <DialogContent className="housing-modal" onOpenAutoFocus={event => { event.preventDefault(); heading.current?.focus(); }}
      onCloseAutoFocus={event => {
        if (card && !trigger.current) { event.preventDefault(); document.getElementById("home-status-button")?.focus(); }
      }}>
      <DialogHeader className="housing-head">
        {view !== "overview" && <Button type="button" variant="ghost" size="icon" onClick={back} aria-label={t("Back")}><ArrowLeft size={19} aria-hidden="true" /></Button>}
        <DialogTitle ref={heading} tabIndex={-1}>{title}</DialogTitle>
        <DialogDescription className="sr-only">{t("Home readings grouped by function.")}</DialogDescription>
      </DialogHeader>
      <div className="housing-scroll" ref={list} key={view}>
        {view === "overview" && <>
          <div className="housing-summary" data-tone={tone} data-scene={scene}>
            <div className="housing-summary-copy"><h3>{summary}</h3>{!count && <p>{loading ? t("Waiting for live readings.") : offline ? t("Reconnect to see current readings.")
              : !sources.length ? t("Choose which devices to monitor.") : coverage}</p>}</div>
            <svg className="housing-scene" viewBox="0 0 320 198" width="320" height="198" aria-hidden="true" focusable="false">
              <use href={houseArtwork + "#" + scene} />
            </svg>
          </div>
          {count > 0 && <ul className="housing-readings housing-issues">{attention.slice(0, 3).map(issueRow)}</ul>}
          {count > 3 && <details className="housing-more"><summary>{t("More issues ({count})", { count: count - 3 })}</summary><ul className="housing-readings">{attention.slice(3).map(issueRow)}</ul></details>}
          <div className="housing-actions">
            {!!sources.length && <button type="button" data-to="readings" onClick={() => setView("readings")}>{t("View readings")}<ChevronRight size={16} aria-hidden="true" /></button>}
            <button type="button" data-to="sources" onClick={() => setView("sources")}><SlidersHorizontal size={16} aria-hidden="true" />{t("Manage sources")}</button>
          </div>
        </>}
        {view === "readings" && <>
          {!live && <p className="housing-note">{summary}</p>}
          {!monitored.length && <p className="housing-note">{t("No sources selected")}</p>}
          {monitored.map(key => <section key={key} className="housing-measurements">
            <h3>{t(groups[key])}</h3><ul className="housing-readings">{readings.filter(r => r.group === key).map(readingRow)}</ul>
          </section>)}
        </>}
        {view === "sources" && <div className="housing-catalog">
          {[...monitored, ...(Object.keys(homeStatusGroups) as HomeStatusGroup[]).filter(key => !monitored.includes(key))].map(key => {
            const Icon = icons[key];
            const members = readings.filter(r => r.group === key).length;
            return <button type="button" key={key} data-to={key} onClick={() => setView(key)}><Icon size={19} aria-hidden="true" />
              <span>{t(groups[key])}</span>{members > 0 && <small>{t(members === 1 ? "1 source" : "{count} sources", { count: members })}</small>}<ChevronRight size={16} aria-hidden="true" /></button>;
          })}
        </div>}
        {group && <div className="housing-setup">
          {group !== "missing" && <p className="housing-note">{t(examples[group])}</p>}
          {!live && <p className="housing-note">{summary}</p>}
          {live && !candidates.length && !groupReadings.length && <p className="housing-note">{t("Connect a compatible device to Home Assistant to see it here.")}</p>}
          <EntityPicker multiple label={t("Choose sources for {group}", { group: t(groups[group]) })}
            entities={candidates} value={groupReadings.map(r => r.id)} disabled={!live || !shared?.state.loaded || !!shared.state.error || !candidates.length && !groupReadings.length}
            onChange={ids => setDashboard({ statusSources: [...readings.filter(r => r.group !== group).map(r => r.id), ...ids] })} />
        </div>}
      </div>
    </DialogContent>}
  </Dialog>;
}
