import { useMemo, useRef, useState } from "react";
import { CarFront, CircleHelp, CircleParking, Download, Fan, Gauge, LoaderCircle, Moon, Pause, Plug, Power, Unplug, Wifi, WifiOff, Zap, type LucideIcon } from "lucide-react";
import { AppContext, useApp } from "@/contexts/AppContext";
import { homeDate, useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { deviceName } from "@/lib/device-model";
import { cabinClimate, cabinState, driveStatus, vehicleImageSource, teslaVehicles, vehicleCommandReport, vehicleGroup, vehicleSystems, vehicleSummary, type Vehicle, type VehicleSystem } from "@/lib/vehicles";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { VehicleAccess, VehicleCabin, VehicleJourney, VehicleSystemPanel } from "./VehicleSystems";
import { VehiclePhoto } from "./VehiclePhoto";
import { vehicleViews } from "./vehicle-views";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Planner } from "../../shared/configuration";
import "./vehicle-widgets.css";

const activityIcons: Partial<Record<ReturnType<typeof driveStatus>["label"], LucideIcon>> = {
  Asleep: Moon, Offline: WifiOff, "Polling paused": Pause, Updating: Download, Starting: Power, "Waking up": Power,
  Online: Wifi, Unavailable: WifiOff, Parked: CircleParking, Driving: Gauge, "state.charging": Zap, "Drive status unknown": CircleHelp,
};

// connectionStarting: the first connection after a load is still within its grace period, so nothing is offline yet.
function vehicleGlance(vehicle: Vehicle | undefined, homeOnline: boolean, connectionStarting = false) {
  const entities = vehicle?.entities ?? [];
  const summary = vehicleSummary(homeOnline ? entities : []);
  const live = homeOnline && !!vehicle;
  const drive = driveStatus(live ? entities : []);
  const paused = !live || drive.label === "Asleep" || drive.label === "Offline" || drive.label === "Unavailable" || drive.label === "Polling paused";
  const charging = !paused && (drive.label === "state.charging" || (summary.charging && drive.label !== "Driving"));
  const level = summary.battery ? Number(summary.battery.state) : undefined;
  const connecting = !homeOnline && connectionStarting;
  return { entities, summary, live, drive, paused, charging, level, connecting };
}
type Glance = ReturnType<typeof vehicleGlance>;

function glanceIcon({ live, charging, paused, drive, connecting }: Glance) {
  if (charging) return Zap;
  if (paused) return live ? activityIcons[drive.label] ?? WifiOff : connecting ? LoaderCircle : WifiOff;
}

/** Battery, charge or sleep icon and measured fill for the phone header chip. */
function VehicleChipContent({ glance }: { glance: Glance }) {
  const { locale } = useI18n();
  const Icon = glanceIcon(glance);
  return <>
    <strong>{glance.level === undefined ? "—" : `${glance.level.toLocaleString(locale)}%`}</strong>
    {Icon && <Icon size={15} className={glance.charging ? "vehicle-charging-icon" : glance.connecting ? "motion-safe:animate-spin" : undefined} aria-hidden="true" />}
    <span className="vehicle-mini-meter" aria-hidden="true">{glance.level !== undefined && <i style={{ transform: `scaleX(${glance.level / 100})` }} />}</span>
  </>;
}

type Variant = "glance" | "chip" | "dialog";

function VehicleWidget({ vehicle, commandVehicle, selection, variant, open, onOpenChange, returnFocus }: {
  vehicle?: Vehicle; commandVehicle?: Vehicle; selection: Planner["vehicles"][number]; variant: Variant;
  open: boolean; onOpenChange: (open: boolean) => void; returnFocus?: () => void;
}) {
  const app = useApp();
  const { currentHome, homeOnline, connectionStarting } = app;
  const { now } = useFamily();
  const { t, message, language, locale } = useI18n();
  const name = vehicle ? deviceName(vehicle.device, language) : selection.name;
  const { imageEntity } = selection;
  const glance = vehicleGlance(vehicle, homeOnline, connectionStarting);
  const { entities, live, drive, paused, charging, connecting } = glance;
  const { battery, range, charge, charging: chargeReported, plugged, limit, power, finish } = glance.summary;
  const activity = live ? t(drive.label) : connecting ? t("Connecting…") : t(homeOnline ? "Unavailable" : "Home Assistant offline");
  // The strip has room for one word; the title and accessible name carry the full status.
  const shortActivity = !live && !homeOnline && !connecting ? t("Offline") : activity;
  const ActivityIcon = live ? activityIcons[drive.label] ?? CarFront : connecting ? LoaderCircle : WifiOff;
  const activityIconClass = connecting ? "motion-safe:animate-spin" : undefined;
  const climate = cabinClimate(entities);
  const control = commandVehicle === vehicle ? climate : commandVehicle && cabinClimate(commandVehicle.entities);
  const climateOn = live ? cabinState(climate) : undefined;
  const climateLabel = t(climateOn === undefined ? "Climate unknown" : climateOn ? "Climate on" : "Climate off");
  const [section, setSection] = useState<VehicleSystem | "Overview">("Overview");
  const groups = new Set(entities.map(vehicleGroup));
  const systems = (Object.keys(vehicleSystems) as VehicleSystem[]).filter(system => vehicleSystems[system].some(group => groups.has(group)) || system === "Vehicle & service" && vehicle?.device.sw_version);
  const view = section !== "Overview" && systems.includes(section) ? section : "Overview";
  const percent = battery ? `${Number(battery.state).toLocaleString(locale)}%` : "—";
  const distance = range ? `${Number(range.state).toLocaleString(locale, { maximumFractionDigits: 0 })} ${range.attributes.unit_of_measurement}` : "—";
  const chargeLabel = drive.label === "state.charging" ? activity : charge && (!chargeReported || charging) ? message(charge === "Charging" ? "state.charging" : charge) : undefined;
  const status = chargeLabel ?? t("Charge status unavailable");
  const StatusIcon = !live ? WifiOff : charging ? Zap : plugged === true ? Plug : plugged === false ? Unplug : CircleHelp;
  const connectionLabel = !live || charging || plugged === undefined ? status : t(plugged ? "Plugged in" : "Unplugged");
  const summary = paused ? [activity] : [...new Set([status, connectionLabel, activity, climateLabel])];
  const eta = Number.isFinite(finish) && finish >= now.getTime() ? new Date(finish) : null;
  const timeZone = currentHome.timeZone;
  const finishTime = eta?.toLocaleTimeString(locale, { timeZone, hour: "2-digit", minute: "2-digit" });
  const finishDate = eta && homeDate(eta, timeZone) !== homeDate(now, timeZone) ? eta.toLocaleDateString(locale, { timeZone, day: "numeric", month: "short" }) : "";
  const model = vehicle?.device.model;
  const source = homeOnline ? vehicleImageSource(currentHome.entities, imageEntity) : undefined;
  const cabin = <VehicleCabin climate={climate} entities={entities} control={control} linked={!!selection.commandVehicleId} />;
  const command: typeof app.command = (entityId, action, value, code) => {
    if (!commandVehicle?.entities.some(e => e.entityId === entityId)) return Promise.reject(new Error("Vehicle command source unavailable"));
    return app.command(entityId, action, value, code, home => vehicleCommandReport(home, selection.id, entityId, action, value));
  };
  const triggerLabel = t("Open status for {name}. Battery {battery}, range {range}. {status}", { name, battery: percent, range: distance, status: summary.join(". ") });
  return <AppContext.Provider value={{ ...app, command }}><Dialog open={open} onOpenChange={next => { if (!next) setSection("Overview"); onOpenChange(next); }}>
    {variant === "chip" && <DialogTrigger asChild><button type="button" className="vehicle-chip" data-charging={charging} data-paused={paused} title={[name, ...summary].join(" · ")} aria-label={triggerLabel}>
      <VehicleChipContent glance={glance} />
    </button></DialogTrigger>}
    {variant === "glance" && <DialogTrigger asChild><button type="button" className="vehicle-glance" data-charging={charging} data-paused={paused} title={[name, ...summary].join(" · ")} aria-label={triggerLabel}>
      <span className="vehicle-thumbnail" aria-hidden="true"><VehiclePhoto model={model} name={name} source={source} compact /></span>
      <span className="vehicle-glance-info">
        <strong>{percent}</strong>
        <span className="vehicle-drive" title={activity}><span>{shortActivity}</span><b>{live && drive.symbol ? drive.symbol : <ActivityIcon size={16} className={activityIconClass} aria-hidden="true" />}</b></span>
        {!paused && <span className="vehicle-glance-climate" title={climateLabel}><Fan size={15} data-running={climateOn} strokeWidth={climateOn ? 2.5 : 1.5} aria-hidden="true" /></span>}
        {!paused && <span title={connectionLabel} className="vehicle-charge-symbol"><StatusIcon className={charging ? "vehicle-charging-icon" : undefined} size={16} aria-hidden="true" /></span>}
        <span className="vehicle-mini-meter" aria-hidden="true">{battery && <i style={{ transform: `scaleX(${Number(battery.state) / 100})` }} />}</span>
      </span>
    </button></DialogTrigger>}
    <DialogContent className="vehicle-modal" onCloseAutoFocus={returnFocus && (event => { event.preventDefault(); returnFocus(); })}>
      <DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>{model || t("Vehicle status")}</DialogDescription></DialogHeader>
      {live ? <Tabs value={view} onValueChange={next => setSection(next as typeof section)} className="vehicle-tabs">
        <TabsList aria-label={t("Vehicle view")} className="vehicle-view-tabs">
          {(["Overview", ...systems] as const).map(item => {
            const { label, icon: Icon } = vehicleViews[item];
            return <TabsTrigger key={item} value={item}><Icon size={16} aria-hidden="true" />{t(label)}</TabsTrigger>;
          })}
        </TabsList>
        <div className="vehicle-pane-stack">
          <TabsContent value="Overview" forceMount aria-hidden={view !== "Overview" || undefined} className="vehicle-tab-body vehicle-sizing-pane">
            <div className="vehicle-overview" data-charging={charging}>
              <div className="vehicle-scene">
                <div className="vehicle-session">
                  <div className="vehicle-session-states">
                    <span className="vehicle-session-state"><ActivityIcon size={17} aria-hidden="true" />{activity}</span>
                    {!paused && chargeLabel && activity !== chargeLabel && <span className="vehicle-session-charge"><StatusIcon className={charging ? "vehicle-charging-icon" : undefined} size={15} aria-hidden="true" />{chargeLabel}</span>}
                  </div>
                  <dl><dt>{charging ? t("Expected finish") : t("Range")}{charging && finishDate && ` · ${finishDate}`}</dt>
                    <dd className={charging && !eta ? "vehicle-no-estimate" : ""}>{charging ? eta ? <time dateTime={eta.toISOString()}>{finishTime}</time> : t("No estimate yet") : distance}</dd></dl>
                </div>
                <VehiclePhoto model={model} name={name} source={source} />
              </div>
              <div className="vehicle-battery-status">
                <dl className="vehicle-levels"><div><dt>{t("Battery")}</dt><dd>{percent}</dd></div><div><dt>{t("Charge limit")}</dt><dd>{limit ? `${Number(limit.state).toLocaleString(locale)}%` : t("Not reported")}</dd></div></dl>
                <div className="vehicle-charge-track" aria-hidden="true">{battery && <i style={{ transform: `scaleX(${Number(battery.state) / 100})` }} />}{limit && <b style={{ left: `${Number(limit.state)}%` }} />}</div>
                {charging && <dl className="vehicle-session-facts">
                  <div><dt><Zap size={16} aria-hidden="true" />{t("Charger power")}</dt><dd>{power ? `${Number(power.state).toLocaleString(locale)} ${power.attributes.unit_of_measurement}` : t("Not reported")}</dd></div>
                  <div><dt><Gauge size={16} aria-hidden="true" />{t("Range")}</dt><dd>{distance}</dd></div>
                </dl>}
              </div>
            </div>
            <div className="vehicle-front-facts">
              {cabin}
              <VehicleJourney entities={entities} addressEntity={selection.addressEntity} active={view === "Overview"} />
              <VehicleAccess entities={entities} />
            </div>
          </TabsContent>
          {view !== "Overview" && <TabsContent value={view} key={view} className="vehicle-tab-body vehicle-detail-pane">
            <VehicleSystemPanel system={view} entities={entities} addressEntity={selection.addressEntity} model={model} version={vehicle.device.sw_version} />
          </TabsContent>}
        </div>
      </Tabs> : homeOnline && commandVehicle ? <>
        <p role="status">{t("TeslaMate readings unavailable")}</p>
        {cabin}
      </> : <div className="vehicle-unavailable">{connecting ? <LoaderCircle size={24} className="motion-safe:animate-spin" aria-hidden="true" /> : <WifiOff size={24} aria-hidden="true" />}
        <p role="status">{t(homeOnline ? "This vehicle is unavailable in Home Assistant." : connecting ? "Connecting to Home Assistant…" : "Vehicle readings resume when Home Assistant reconnects.")}</p></div>}
    </DialogContent>
  </Dialog></AppContext.Provider>;
}

// Lowest battery first; at equal charge a car that is not charging needs attention first. Unknown levels go last.
const byAttention = (a: { glance: Glance }, b: { glance: Glance }) =>
  Number(a.glance.level === undefined) - Number(b.glance.level === undefined)
  || (a.glance.level ?? 0) - (b.glance.level ?? 0) || Number(a.glance.charging) - Number(b.glance.charging);

export function VehicleWidgets() {
  const { currentHome, homeOnline, connectionStarting } = useApp();
  const { vehicles } = useFamily();
  const { t, language, locale } = useI18n();
  const phone = useIsMobile();
  const [openId, setOpenId] = useState<string>();
  const chip = useRef<HTMLButtonElement>(null);
  const opening = useRef(false);
  const cars = useMemo(() => vehicles.length ? teslaVehicles(currentHome) : [], [currentHome, vehicles.length]);
  if (!vehicles.length) return null;
  const items = vehicles.map(selection => {
    const vehicle = cars.find(item => item.id === selection.id);
    const commandVehicle = selection.id.startsWith("teslamate:")
      ? cars.find(item => item.id === selection.commandVehicleId && item.source !== "TeslaMate") : vehicle;
    const name = vehicle ? deviceName(vehicle.device, language) : selection.name;
    return { selection, vehicle, commandVehicle, name, glance: vehicleGlance(vehicle, homeOnline, connectionStarting) };
  });
  // Phones collapse the strip into one chip: one car opens directly, several pick from a menu (worst state first).
  const menu = phone && items.length > 1;
  const widgets = items.map(({ selection, vehicle, commandVehicle }, index) => <VehicleWidget key={selection.id} selection={selection} vehicle={vehicle} commandVehicle={commandVehicle}
    variant={!phone ? "glance" : menu || index ? "dialog" : "chip"} open={openId === selection.id} onOpenChange={open => setOpenId(open ? selection.id : undefined)}
    returnFocus={menu ? () => chip.current?.focus() : undefined} />);
  if (!menu) return <section className={`vehicle-strip glass-surface${phone ? " vehicle-chip-strip" : ""}`} aria-label={t("Electric vehicles")}>{widgets}</section>;
  const ranked = [...items].sort(byAttention);
  const state = ({ glance: { live, charging, paused, drive, connecting } }: typeof items[number]) =>
    charging ? t("state.charging") : !paused ? "" : live ? t(drive.label) : connecting ? t("Connecting…") : t(homeOnline ? "Unavailable" : "Home Assistant offline");
  const level = ({ glance }: typeof items[number]) => glance.level === undefined ? "—" : `${glance.level.toLocaleString(locale)}%`;
  const worst = ranked[0];
  const label = [t("Electric vehicles · lowest battery: {name}, {battery}", { name: worst.name, battery: level(worst) }), state(worst)].filter(Boolean).join(" · ");
  return <section className="vehicle-strip glass-surface vehicle-chip-strip" aria-label={t("Electric vehicles")}>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild><button ref={chip} type="button" className="vehicle-chip" data-charging={worst.glance.charging} data-paused={worst.glance.paused} aria-label={label} title={label}>
        <VehicleChipContent glance={worst.glance} />
      </button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="vehicle-menu" onCloseAutoFocus={event => { if (opening.current) event.preventDefault(); opening.current = false; }}>
        {ranked.map(item => {
          const Icon = glanceIcon(item.glance);
          return <DropdownMenuItem key={item.selection.id} onSelect={() => { opening.current = true; setOpenId(item.selection.id); }}>
            <span className="vehicle-menu-name">{item.name}</span>
            {Icon && <Icon size={16} aria-hidden="true" />}
            <strong>{level(item)}</strong>{state(item) && <span className="sr-only">{state(item)}</span>}
          </DropdownMenuItem>;
        })}
      </DropdownMenuContent>
    </DropdownMenu>
    {widgets}
  </section>;
}
