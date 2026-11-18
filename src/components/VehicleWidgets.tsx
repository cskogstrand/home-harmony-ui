import { useMemo, useState } from "react";
import { CarFront, CircleHelp, Fan, Gauge, Plug, Unplug, WifiOff, Zap } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { homeDate, useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { deviceName } from "@/lib/device-model";
import { available } from "@/lib/ha-model";
import { cabinClimate, cabinState, driveStatus, teslaModelVariant, teslaVehicles, vehicleGroup, vehicleSystems, vehicleSummary, type Vehicle, type VehicleSystem } from "@/lib/vehicles";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VehicleAccess, VehicleCabin, VehicleJourney, VehicleSystemPanel } from "./VehicleSystems";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "./vehicle-widgets.css";

const tabNames = { Overview: "Overview", "Battery & charging": "Charging", "Cabin & seats": "Cabin", "Doors & security": "Access", "Trip & position": "Trip", "Tyre pressure": "Tyres", "Vehicle & service": "Service" } as const;

function VehiclePhoto({ model, name, source, compact = false }: { model?: string; name: string; source?: string; compact?: boolean }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState<string>();
  const [failedModel, setFailedModel] = useState<string>();
  const variant = teslaModelVariant(model);
  const photo = source && source !== failed;
  const src = photo ? source : variant && `/vehicles/model-${variant}.webp`;
  if (!src || src === failedModel) return compact ? <CarFront size={22} aria-hidden="true" /> : null;
  return <img key={src} className={`vehicle-photo${photo ? " is-photo" : ""}`} src={src} alt={compact ? "" : photo ? t("Photo of {name}", { name }) : t("Model illustration of {model}", { model })}
    onError={() => { if (photo) setFailed(src); else setFailedModel(src); }} decoding="async" />;
}

function VehicleWidget({ vehicle, savedName, imageEntity }: { vehicle?: Vehicle; savedName: string; imageEntity?: string }) {
  const { currentHome, homeOnline } = useApp();
  const { now } = useFamily();
  const { t, message, language, locale } = useI18n();
  const name = vehicle ? deviceName(vehicle.device, language) : savedName;
  const entities = vehicle?.entities ?? [];
  const { battery, range, charge, charging, plugged, limit, power, finish } = vehicleSummary(homeOnline ? entities : []);
  const live = homeOnline && !!vehicle;
  const climate = cabinClimate(entities);
  const climateOn = live ? cabinState(climate) : undefined;
  const climateLabel = t(climateOn === undefined ? "Climate unknown" : climateOn ? "Climate on" : "Climate off");
  const drive = driveStatus(live ? entities : []);
  const [section, setSection] = useState<VehicleSystem | "Overview">("Overview");
  const groups = new Set(entities.map(vehicleGroup));
  const systems = (Object.keys(vehicleSystems) as VehicleSystem[]).filter(system => vehicleSystems[system].some(group => groups.has(group)) || system === "Vehicle & service" && vehicle?.device.sw_version);
  const view = section !== "Overview" && systems.includes(section) ? section : "Overview";
  const percent = battery ? `${Number(battery.state).toLocaleString(locale)}%` : "—";
  const distance = range ? `${Number(range.state).toLocaleString(locale, { maximumFractionDigits: 0 })} ${range.attributes.unit_of_measurement}` : "—";
  const status = !live ? t(homeOnline ? "Unavailable" : "HA offline") : charge ? message(charge === "Charging" ? "state.charging" : charge) : t("Charge status unavailable");
  const StatusIcon = !live ? WifiOff : charging ? Zap : plugged === true ? Plug : plugged === false ? Unplug : CircleHelp;
  const connectionLabel = !live || charging || plugged === undefined ? status : t(plugged ? "Plugged in" : "Unplugged");
  const eta = Number.isFinite(finish) && finish >= now.getTime() ? new Date(finish) : null;
  const timeZone = currentHome.timeZone;
  const finishTime = eta?.toLocaleTimeString(locale, { timeZone, hour: "2-digit", minute: "2-digit" });
  const finishDate = eta && homeDate(eta, timeZone) !== homeDate(now, timeZone) ? eta.toLocaleDateString(locale, { timeZone, day: "numeric", month: "short" }) : "";
  const model = vehicle?.device.model;
  const image = imageEntity && homeOnline ? currentHome.entities.find(e => e.preferenceId === imageEntity && e.domain === "image" && available(e)) : undefined;
  const source = image ? `/api/image_proxy/${encodeURIComponent(image.entityId)}?v=${encodeURIComponent(image.lastUpdated ?? image.state)}` : undefined;
  return <Dialog onOpenChange={open => { if (open) setSection("Overview"); }}>
    <DialogTrigger asChild><button type="button" className="vehicle-glance" data-charging={charging} title={[name, t(drive.label), status, climateLabel].join(" · ")} aria-label={t("Open status for {name}. Battery {battery}, range {range}. {status}", { name, battery: percent, range: distance, status: [status, connectionLabel !== status && connectionLabel, t(drive.label), climateLabel].filter(Boolean).join(". ") })}>
      <span className="vehicle-thumbnail" aria-hidden="true"><VehiclePhoto model={model} name={name} source={source} compact /></span>
      <span className="vehicle-glance-info">
        <strong>{percent}</strong>
        <span className="vehicle-drive" title={t(drive.label)}><span>{t(drive.label)}</span><b>{drive.symbol}</b></span>
        <span className="vehicle-glance-climate" title={climateLabel}><Fan size={15} data-running={climateOn} strokeWidth={climateOn ? 2.5 : 1.5} aria-hidden="true" /></span>
        <span title={connectionLabel} className="vehicle-charge-symbol"><StatusIcon className={charging ? "vehicle-charging-icon" : undefined} size={16} aria-hidden="true" /></span>
        <span className="vehicle-mini-meter" aria-hidden="true">{battery && <i style={{ transform: `scaleX(${Number(battery.state) / 100})` }} />}</span>
      </span>
    </button></DialogTrigger>
    <DialogContent className="vehicle-modal">
      <DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>{model || t("Vehicle status")}</DialogDescription></DialogHeader>
      {live ? <Tabs value={view} onValueChange={next => setSection(next as typeof section)} className="vehicle-tabs">
        <TabsList aria-label={t("Vehicle view")} className="vehicle-view-tabs">
          {(["Overview", ...systems] as const).map(item => <TabsTrigger key={item} value={item}>{t(tabNames[item])}</TabsTrigger>)}
        </TabsList>
        <div className="vehicle-pane-stack">
          <TabsContent value="Overview" forceMount aria-hidden={view !== "Overview" || undefined} className="vehicle-tab-body vehicle-sizing-pane">
            <div className="vehicle-overview" data-charging={charging}>
              <div className="vehicle-scene">
                <div className="vehicle-session">
                  <span className="vehicle-session-state"><StatusIcon className={charging ? "vehicle-charging-icon" : undefined} size={16} aria-hidden="true" />{status}</span>
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
              <VehicleCabin climate={climate} />
              <VehicleJourney entities={entities} active={view === "Overview"} />
              <VehicleAccess entities={entities} />
            </div>
          </TabsContent>
          {view !== "Overview" && <TabsContent value={view} key={view} className="vehicle-tab-body vehicle-detail-pane">
            <VehicleSystemPanel system={view} entities={entities} model={model} version={vehicle.device.sw_version} />
          </TabsContent>}
        </div>
      </Tabs> : <div className="vehicle-unavailable"><WifiOff size={24} aria-hidden="true" /><p role="status">{t(homeOnline ? "This vehicle is unavailable in Home Assistant." : "Vehicle readings resume when Home Assistant reconnects.")}</p></div>}
    </DialogContent>
  </Dialog>;
}

export function VehicleWidgets() {
  const { currentHome } = useApp();
  const { vehicles } = useFamily();
  const { t } = useI18n();
  const cars = useMemo(() => vehicles.length ? teslaVehicles(currentHome) : [], [currentHome, vehicles.length]);
  if (!vehicles.length) return null;
  return <section className="vehicle-strip glass-surface" aria-label={t("Electric vehicles")}>
    {vehicles.map(car => <VehicleWidget key={car.id} vehicle={cars.find(item => item.device.id === car.id)} savedName={car.name} imageEntity={car.imageEntity} />)}
  </section>;
}
