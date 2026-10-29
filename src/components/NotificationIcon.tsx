import { useEffect, useRef, useState } from "react";
import { AirVent, AlarmSmoke, Battery, Bell, Blinds, Camera, CloudFog, CookingPot, DoorClosed, Droplets, Fence, Footprints, Fuel, Gauge, House, ListChecks, PanelTop, PanelsTopLeft, PlugZap, Refrigerator, Router, ScanEye, ShieldAlert, ShowerHead, Snowflake, Speaker, Sun, Thermometer, Timer, Tv, Utensils, WashingMachine, Waves, Wifi, Wind, Zap, createLucideIcon, type LucideIcon } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "./ui/button";
import { cardDesigns } from "./devices/card-designs";
import { notificationIcons, type NotificationRule } from "../../shared/notifications";

const RobotVacuum = createLucideIcon("RobotVacuum", [
  ["circle", { cx: "12", cy: "11", r: "8", key: "body" }],
  ["path", { d: "M5 8h14", key: "bumper" }],
  ["circle", { cx: "12", cy: "12", r: "2", key: "button" }],
  ["path", { d: "m6 18-2 3m14-3 2 3M12 19v3", key: "brush", className: "notification-brush" }],
]);
const RobotMower = createLucideIcon("RobotMower", [
  ["rect", { x: "5", y: "4", width: "14", height: "15", rx: "5", key: "body" }],
  ["path", { d: "M3 7v4m18-4v4M3 14v4m18-4v4M9 7h6", key: "wheels" }],
  ["path", { d: "m10 11 4 4m0-4-4 4", key: "blade", className: "notification-rotor" }],
  ["path", { d: "m7 22 1-2 1 2m6 0 1-2 1 2", key: "grass" }],
]);

const notificationIconOptions: Record<string, { icon: LucideIcon; label: string; group: string; motion?: string }> = {
  ...Object.fromEntries(cardDesigns.map(design => [design.id, { icon: design.icon, label: design.subtitle, group: design.group }])),
  default: { icon: ListChecks, label: "Automatic icon", group: "General" },
  washing: { icon: WashingMachine, label: "Laundry", group: "Appliances", motion: "washing" },
  dishes: { icon: Utensils, label: "Dishwashing", group: "Appliances", motion: "rock" },
  cleaning: { icon: Wind, label: "Cleaning", group: "Appliances", motion: "sweep" },
  cooking: { icon: CookingPot, label: "Cooking", group: "Appliances", motion: "steam" },
  timer: { icon: Timer, label: "Timer", group: "Helpers", motion: "timer" },
  charging: { icon: PlugZap, label: "Charging", group: "Appliances" },
  vacuum: { icon: RobotVacuum, label: "Robot vacuum", group: "Appliances", motion: "vacuum" },
  lawn_mower: { icon: RobotMower, label: "Robot lawn mower", group: "Appliances", motion: "mower" },
  dryer: { icon: WashingMachine, label: "Dryer", group: "Appliances", motion: "washing" },
  oven: { icon: PanelTop, label: "Oven", group: "Appliances", motion: "heat" },
  refrigerator: { icon: Refrigerator, label: "Refrigerator", group: "Appliances" },
  freezer: { icon: Snowflake, label: "Freezer", group: "Appliances" },
  air_purifier: { icon: Wind, label: "Air purifier", group: "Comfort", motion: "sweep" },
  dehumidifier: { icon: Droplets, label: "Dehumidifier", group: "Comfort", motion: "flow" },
  heat_pump: { icon: AirVent, label: "Heat pump", group: "Comfort", motion: "heat" },
  radiator: { icon: Waves, label: "Radiator", group: "Comfort", motion: "heat" },
  air_conditioner: { icon: AirVent, label: "Air conditioner", group: "Comfort", motion: "sweep" },
  sprinkler: { icon: ShowerHead, label: "Sprinkler", group: "Comfort", motion: "flow" },
  ev_charger: { icon: PlugZap, label: "EV charger", group: "Appliances" },
  solar: { icon: Sun, label: "Solar panels", group: "Insight" },
  blind: { icon: Blinds, label: "Blinds", group: "Covers", motion: "lift" },
  curtain: { icon: PanelsTopLeft, label: "Curtains", group: "Covers", motion: "sweep" },
  awning: { icon: House, label: "Awning", group: "Covers", motion: "lift" },
  damper: { icon: AirVent, label: "Damper", group: "Covers", motion: "sweep" },
  door: { icon: DoorClosed, label: "Door", group: "Covers", motion: "swing" },
  garage: { icon: House, label: "Garage door", group: "Covers", motion: "lift" },
  gate: { icon: Fence, label: "Gate", group: "Covers", motion: "swing" },
  shade: { icon: PanelTop, label: "Shade", group: "Covers", motion: "lift" },
  shutter: { icon: Blinds, label: "Shutter", group: "Covers", motion: "lift" },
  window: { icon: PanelsTopLeft, label: "Window", group: "Covers", motion: "swing" },
  temperature: { icon: Thermometer, label: "Temperature", group: "Insight", motion: "heat" },
  humidity: { icon: Droplets, label: "Humidity", group: "Insight", motion: "flow" },
  battery: { icon: Battery, label: "Battery", group: "Insight" },
  power: { icon: Zap, label: "Power", group: "Insight" },
  energy: { icon: Gauge, label: "Energy", group: "Insight" },
  water: { icon: Waves, label: "Water", group: "Insight", motion: "flow" },
  moisture: { icon: Droplets, label: "Water leak", group: "Security", motion: "flow" },
  smoke: { icon: AlarmSmoke, label: "Smoke detector", group: "Security", motion: "signal" },
  carbon_monoxide: { icon: CloudFog, label: "Carbon monoxide", group: "Security", motion: "signal" },
  gas: { icon: Fuel, label: "Gas detector", group: "Security", motion: "signal" },
  motion: { icon: Footprints, label: "Motion detection", group: "Security", motion: "sweep" },
  occupancy: { icon: ScanEye, label: "Occupancy", group: "Security", motion: "signal" },
  connectivity: { icon: Wifi, label: "Connectivity", group: "Insight", motion: "signal" },
  vibration: { icon: Waves, label: "Vibration", group: "Security", motion: "rock" },
  problem: { icon: ShieldAlert, label: "Problem", group: "Security", motion: "signal" },
  tamper: { icon: ShieldAlert, label: "Tamper", group: "Security", motion: "signal" },
  sound: { icon: Speaker, label: "Sound", group: "Insight", motion: "signal" },
  illuminance: { icon: Sun, label: "Illuminance", group: "Insight" },
  tv: { icon: Tv, label: "TV", group: "Media", motion: "signal" },
  speaker: { icon: Speaker, label: "Speaker", group: "Media", motion: "signal" },
  router: { icon: Router, label: "Router", group: "Media", motion: "signal" },
  doorbell: { icon: Bell, label: "Doorbell", group: "Security", motion: "rock" },
};
const deviceMotions: Record<string, string> = {
  fan: "spin", cover: "lift", climate: "heat", water_heater: "heat", humidifier: "flow", valve: "flow",
  air_quality: "sweep", media_player: "signal", siren: "rock", notify: "rock", voice: "signal", timer: "timer",
};
const groups = ["All", ...new Set(notificationIcons.map(icon => notificationIconOptions[icon].group))];

export function NotificationIcon({ rule, animate = false }: { rule: NotificationRule; animate?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const kind = rule.icon ?? "default";
  const option = notificationIconOptions[kind];
  const Icon = kind === "default" ? rule.kind === "camera" ? Camera : rule.kind === "current" ? Bell : ListChecks : option.icon;
  const animated = animate && rule.animateIcon !== false;
  useEffect(() => {
    if (!animated || !ref.current) return;
    const element = ref.current;
    let visible = !globalThis.IntersectionObserver;
    const update = () => { element.dataset.paused = String(!visible || document.hidden); };
    const observer = globalThis.IntersectionObserver && new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer?.observe(element);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, [animated]);
  return <span ref={ref} className="notification-icon" data-icon={kind} data-motion={option.motion ?? deviceMotions[kind] ?? "pulse"} data-animate={animated} aria-hidden="true"><Icon strokeWidth={1.8} /></span>;
}

export function NotificationIconPicker({ rule, disabled, onChange }: { rule: NotificationRule; disabled: boolean; onChange: (icon: NotificationRule["icon"]) => void }) {
  const { message: t } = useI18n();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("All");
  const query = search.trim().toLocaleLowerCase();
  const icons = notificationIcons.filter(icon => {
    const option = notificationIconOptions[icon];
    return (group === "All" || group === option.group) && `${t(option.label)} ${option.label} ${icon.replace(/_/g, " ")}`.toLocaleLowerCase().includes(query);
  });
  return <div className="notification-icon-picker">
    <div className="notification-icon-filters">
      <label>{t("Search icons")}<input type="search" value={search} disabled={disabled} onChange={event => setSearch(event.target.value)} /></label>
      <label>{t("Icon category")}<select value={group} disabled={disabled} onChange={event => setGroup(event.target.value)}>{groups.map(name => <option key={name} value={name}>{t(name)}</option>)}</select></label>
    </div>
    <p className="page-note">{t("Selected icon: {name}", { name: t(notificationIconOptions[rule.icon ?? "default"].label) })}</p>
    <div className="notification-icon-options" role="group" aria-label={t("Notification icon")}>{icons.map(icon => <Button type="button" key={icon} variant="outline" aria-pressed={(rule.icon ?? "default") === icon} disabled={disabled} onClick={() => onChange(icon)}>
      <NotificationIcon rule={{ ...rule, icon }} animate={rule.kind === "ongoing" && (rule.icon ?? "default") === icon} /><span>{t(notificationIconOptions[icon].label)}</span>
    </Button>)}</div>
    {icons.length === 0 && <p role="status" className="empty-note">{t("No matching icons")}</p>}
  </div>;
}
