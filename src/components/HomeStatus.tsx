import { Activity, ArrowLeft, BatteryCharging, ChevronRight, CircleCheck, CircleDashed, CloudSun, Droplets, Flame, Lamp, LockKeyhole, Radar, SlidersHorizontal, Thermometer, TriangleAlert, WashingMachine, WifiOff, Zap } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { entityDetailPath } from "@/lib/device-model";
import { entityStateLabel } from "@/lib/ha-model";
import { defaultHomeStatusSources, homeReadingState, homeStatusGroup, homeStatusGroups, type HomeStatusGroup } from "@/lib/home-status";
import type { Entity } from "@/types/api";
import { EntityPicker } from "./EntityPicker";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import houseArtwork from "@/assets/home-status.svg?no-inline";
import "./home-status.css";

const statusIcons = { loading: Activity, offline: WifiOff, setup: CircleDashed, attention: TriangleAlert, healthy: CircleCheck };
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

export function HomeStatus({ card = false }: { card?: boolean }) {
  const { t, number, language } = useI18n();
  const { currentHome, homeOnline, connectionStatus } = useApp();
  const { dashboard, setDashboard, selectedAlarm } = useFamily();
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
    const readings = sources.map(id => {
      const entity = byId.get(id);
      return { id, entity, group: entity && homeStatusGroup(entity) || "missing" as const, state: homeReadingState(entity) };
    });
    const issuePriority = (reading: typeof readings[number]) => {
      if (reading.state === "unavailable") return 2;
      return ["fire", "water", "security"].includes(reading.group) ? 0 : 1;
    };
    const issues = readings.filter(r => r.state !== "reported").sort((a, b) => issuePriority(a) - issuePriority(b));
    return { sources, readings, issues };
  }, [currentHome.entities, dashboard.statusSources, selectedAlarm]);
  const loading = shared && !shared.state.loaded && !shared.state.error || ["connecting", "syncing"].includes(connectionStatus);
  const offline = !homeOnline || shared && !shared.state.loaded;
  const live = !loading && !offline;
  const count = live ? issues.length : 0;
  const status = loading ? "loading" : offline ? "offline" : !sources.length ? "setup" : count ? "attention" : "healthy";
  const StatusIcon = statusIcons[status];
  const tone = status === "healthy" || status === "attention" ? status : "neutral";
  let scene: string = status;
  if (status === "attention") {
    const first = issues[0];
    if (first.state === "unavailable") scene = "missing";
    else if (first.group === "fire" || first.entity?.domain === "alarm_control_panel") scene = "alarm";
    else if (first.group === "water") scene = "leak";
    else if (first.entity?.attributes.device_class === "battery") scene = "battery";
  }
  const summary = loading ? t("Checking home status…") : offline ? t("Home status unavailable") : !sources.length ? t("No sources selected")
    : count ? t(count === 1 ? "1 issue" : "{count} issues", { count }) : t("No issues reported");
  const label = [t("Home status"), summary].join(" · ");
  function readingValue(entity?: Entity) {
    if (!live || !entity || homeReadingState(entity) === "unavailable") return t("No reading");
    if (entity.domain === "climate") return [number(Number(entity.attributes.current_temperature)), currentHome.temperatureUnit].filter(Boolean).join(" ");
    return [entityStateLabel(entity, language), entity.domain === "sensor" && entity.attributes.unit_of_measurement].filter(Boolean).join(" ");
  }
  function readingRow(r: typeof readings[number]) {
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
    {card ? count > 0 && <DialogTrigger asChild><button ref={trigger} type="button" className="glow-panel housing-card col-span-full">
      <TriangleAlert aria-hidden="true" /><span><strong>{t("Home status")} · {summary}</strong>
        <small>{issues[0].entity?.name ?? t("Unavailable")} · {readingValue(issues[0].entity)}</small></span><ChevronRight aria-hidden="true" /></button></DialogTrigger>
      : <DialogTrigger asChild><button type="button" id="home-status-button" className="icon-button glass-surface housing-trigger" data-tone={tone} aria-label={label} title={label}>
        <StatusIcon size={21} aria-hidden="true" />{count > 0 && <span className="housing-badge" aria-hidden="true">{number(count)}</span>}</button></DialogTrigger>}
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
          {count > 0 && <ul className="housing-readings housing-issues">{issues.slice(0, 3).map(readingRow)}</ul>}
          {count > 3 && <details className="housing-more"><summary>{t("More issues ({count})", { count: count - 3 })}</summary><ul className="housing-readings">{issues.slice(3).map(readingRow)}</ul></details>}
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
