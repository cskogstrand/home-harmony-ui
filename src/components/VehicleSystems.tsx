import { Armchair, BatteryCharging, ChevronDown, CircleDot, Cpu, Fan, LockKeyhole, Route, Search } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, entityStateLabel, humanizeState } from "@/lib/ha-model";
import { accessStatus, cabinSetpoint, cabinState, metricKey, readingName, teslaModelVariant, tyrePressureBar, vehicleGroup, vehicleSystems, vehicleTrip, type VehicleSystem } from "@/lib/vehicles";
import type { Entity } from "@/types/api";
import { DeviceControl } from "@/components/devices/DeviceControl";
import { Input } from "@/components/ui/input";
import { homeDate, useFamily } from "@/contexts/FamilyContext";
import { lazy, Suspense, useState } from "react";

const VehicleMap = lazy(() => import("./VehicleMap"));

function VehicleReading({ entity, label = readingName(entity) }: { entity: Entity; label?: string }) {
  const { currentHome } = useApp();
  const { t, message, locale, language } = useI18n();
  const date = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: currentHome.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const reported = available(entity);
  const timestamp = entity.attributes.device_class === "timestamp" || ["button", "update", "image"].includes(entity.domain);
  const state = entity.domain === "button" && entity.state === "unknown" ? t("No recorded use") : timestamp && Number.isFinite(Date.parse(entity.state)) ? date(entity.state) : entityStateLabel(entity, language);
  const wheel = vehicleGroup(entity) === "Wheel pressures" && (entity.attributes.device_class === "pressure" || /tpms|pressure/.test(metricKey(entity)) && !/warning|alert|fault|last_seen/.test(metricKey(entity)) && entity.domain === "sensor");
  const pressure = wheel ? tyrePressureBar(entity) : undefined;
  const unit = !wheel && reported && typeof entity.attributes.unit_of_measurement === "string" ? entity.attributes.unit_of_measurement : "";
  const value = wheel ? pressure === undefined ? t("Not reported") : `${pressure.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bar` : `${message(state)}${unit ? " " + unit : ""}`;
  // Include Tesla's extra readings (such as individual doors), but omit HA metadata and media access URLs.
  const attributes = reported ? Object.entries(entity.attributes).flatMap(([key, value]) => {
    if (/^(friendly_name|icon|device_class|state_class|unit_of_measurement|attribution|supported_features|options|entity_picture.*)$/i.test(key)
      || /token|password|credential|secret|url|uri|_id$|^id$|^vin$/i.test(key)) return [];
    let text: string;
    if (typeof value === "boolean") text = t(value ? "Yes" : "No");
    else if (typeof value === "number") text = value.toLocaleString(locale);
    else if (typeof value === "string") text = value;
    else if (Array.isArray(value) && value.length && value.every(v => typeof v === "string" || typeof v === "number")) text = value.join(", ");
    else return [];
    if (/https?:\/\/|access_token=/i.test(text)) return [];
    if (/^(open|closed)$/i.test(text)) text = t(text.toLowerCase() === "open" ? "state.open" : "Closed");
    return [{ key, text }];
  }) : [];
  return <details className="vehicle-reading">
    <summary><span>{message(label)}</span><strong>{value}</strong><ChevronDown size={15} aria-hidden="true" /></summary>
    <dl className="device-readings">
      {attributes.map(({ key, text }) => <div key={key}><dt>{message(humanizeState(key))}</dt><dd>{text}</dd></div>)}
      <div><dt>{t("Last updated")}</dt><dd>{entity.lastUpdated && Number.isFinite(Date.parse(entity.lastUpdated)) ? date(entity.lastUpdated) : t("Not reported")}</dd></div>
      <div><dt>{t("Entity ID")}</dt><dd>{entity.entityId}</dd></div>
    </dl>
  </details>;
}


export function VehicleCabin({ climate, entities, control, linked }: { climate?: Entity; entities: Entity[]; control?: Entity; linked: boolean }) {
  const { t, number } = useI18n();
  const { currentHome } = useApp();
  const running = cabinState(climate);
  const target = linked && cabinSetpoint(entities, control?.attributes.temperature_unit || currentHome.temperatureUnit);
  const current = climate && available(climate) ? climate.attributes.current_temperature : undefined;
  const inside = entities.find(e => e.domain === "sensor" && /(?:^|_)inside_temp(?:erature)?$/.test(metricKey(e)) && available(e)
    && e.state.trim() && Number.isFinite(Number(e.state)));
  const temp = typeof current === "number" ? current : inside && Number(inside.state);
  const unit = typeof current === "number" ? climate.attributes.temperature_unit || currentHome.temperatureUnit : inside?.attributes.unit_of_measurement;
  return <section className="vehicle-cabin vehicle-module">
    <h3><Fan size={20} data-running={running} aria-hidden="true" />{t("Cabin")}</h3>
    <p>{t(running === undefined ? "Climate unknown" : running ? "Climate on" : "Climate off")}{typeof temp === "number" && ` · ${number(temp)}${unit || ""}`}</p>
    {control?.domain === "climate" && <DeviceControl key={control.entityId} entity={control} cabinMode={running === undefined ? "" : climate.state} cabinSetpoint={target ? target.value ?? null : undefined} />}
    {linked && (control?.domain !== "climate" || !available(control)) && <p role="status">{t("Climate control unavailable")}</p>}
  </section>;
}

export function VehicleAccess({ entities }: { entities: Entity[] }) {
  const { t, language, message } = useI18n();
  const { lock, open, closed } = accessStatus(entities);
  return <section className="vehicle-module vehicle-access"><h3><LockKeyhole size={19} aria-hidden="true" />{t("Doors & security")}</h3>
    <strong>{lock && available(lock) ? entityStateLabel(lock, language) : t("Lock status unknown")}</strong>
    {open.length ? <><p>{t("Open on the car")}</p><ul className="vehicle-openings">{open.map(({ name, position }) => <li key={name + (position || "")}>{message(name)}{position && ` · ${message(position)}`}</li>)}</ul></>
      : <p>{t(closed ? "Reported openings closed" : "Opening status unknown")}</p>}
  </section>;
}

function OpeningPositions({ entities }: { entities: Entity[] }) {
  const { t, message } = useI18n();
  const reports = entities.filter(e => available(e) && e.domain === "binary_sensor");
  const find = (kind: string) => reports.find(e => e.attributes.device_class === kind && "Driver Front" in e.attributes);
  const doors = find("door"), windows = find("window");
  if (!doors && !windows) return null;
  const status = (value: unknown) => {
    const raw = String(value).toLowerCase();
    if (["closed", "false", "0"].includes(raw)) return t("Closed");
    if (["open", "opened", "true", "1"].includes(raw)) return t("state.open");
    return typeof value === "string" ? message(humanizeState(raw)) : "—";
  };
  return <table className="vehicle-apertures"><caption className="sr-only">{t("Doors and windows")}</caption>
    <thead><tr><th scope="col">{t("Position")}</th>{doors && <th scope="col">{t("Door")}</th>}{windows && <th scope="col">{t("Window")}</th>}</tr></thead>
    <tbody>{(["Driver Front", "Passenger Front", "Driver Rear", "Passenger Rear"] as const).map(position => <tr key={position}>
      <th scope="row">{t(position)}</th>{doors && <td>{status(doors.attributes[position])}</td>}{windows && <td>{status(windows.attributes[position])}</td>}</tr>)}</tbody>
  </table>;
}

export function VehicleJourney({ entities, active = true }: { entities: Entity[]; active?: boolean }) {
  const { t, language, locale } = useI18n();
  const { now } = useFamily();
  const { currentHome } = useApp();
  const { location, coordinates, destination, eta } = vehicleTrip(entities, now);
  const zone = currentHome.timeZone;
  const day = eta && homeDate(eta, zone) !== homeDate(now, zone);
  return <section className="vehicle-module vehicle-journey"><h3><Route size={19} aria-hidden="true" />{t("Trip & position")}</h3>
    <dl><div><dt>{t("Vehicle position")}</dt><dd>{location ? entityStateLabel(location, language) : t("Not reported")}</dd>
      </div>
      {destination && <div><dt>{t("Destination")}</dt><dd>{destination}</dd></div>}
      <div><dt>{t("Arrival time")}</dt><dd>{eta ? <time dateTime={eta.toISOString()}>{eta.toLocaleString(locale, { timeZone: zone, hour: "2-digit", minute: "2-digit", ...(day ? { day: "numeric", month: "short" } : {}) })}</time> : t("No arrival estimate")}</dd></div>
    </dl>
    {coordinates && <div className="vehicle-map">
      {active && <Suspense fallback={null}><VehicleMap {...coordinates} /></Suspense>}
    </div>}
  </section>;
}

const systemIcons = { "Battery & charging": BatteryCharging, "Cabin & seats": Armchair, "Doors & security": LockKeyhole, "Trip & position": Route, "Tyre pressure": CircleDot, "Vehicle & service": Cpu };

const positions = [
  ["Front left", /front_left|left_front|(?:^|_)fl$|heated_seat_left$/],
  ["Front right", /front_right|right_front|(?:^|_)fr$|heated_seat_right$/],
  ["Rear left", /rear_left|left_rear|(?:^|_)rl$/],
  ["Rear center", /rear_(?:center|middle)|(?:center|middle)_rear/],
  ["Rear right", /rear_right|right_rear|(?:^|_)rr$/],
] as const;

const highlightedFields = {
  "Charge session": [["charger_volts", "Voltage", "V"], ["charger_amps_actual", "Actual current", "A"], ["charger_phases", "Phases", ""]],
  "Navigation": [["Energy at arrival", "Battery at arrival", "%"], ["Minutes to arrival", "Remaining time", "min"], ["Minutes traffic delay", "Traffic delay", "min"]],
  "Software": [["installed_version", "Installed version", ""], ["latest_version", "Latest version", ""], ["update_percentage", "Update progress", "%"]],
} as const;

function readingLabel(entity: Entity) {
  const key = metricKey(entity);
  if (entity.domain === "lock" && vehicleGroup(entity) === "Locks") return "Door locks";
  if (entity.domain === "binary_sensor" && entity.attributes.device_class === "plug") return "Charge cable";
  if (entity.domain === "switch" && /(?:^|_)charg(?:e|er|ing)$/.test(key)) return "Charge switch";
  return readingName(entity);
}

export function VehicleSystemPanel({ system, entities, model, version }: { system: VehicleSystem; entities: Entity[]; model?: string; version?: string }) {
  const { t, message, locale, number } = useI18n();
  const [filter, setFilter] = useState("");
  const term = filter.trim().toLocaleLowerCase(locale);
  const variant = teslaModelVariant(model);
  const systems = term ? Object.keys(vehicleSystems) as VehicleSystem[] : [system];
  const matches = entities.filter(e => !term || [readingName(e), message(readingName(e)), message(readingLabel(e)), e.entityId, message(vehicleGroup(e))]
    .some(text => text.toLocaleLowerCase(locale).includes(term)));
  return <div className="vehicle-systems">
    <label className="vehicle-search"><Search size={18} aria-hidden="true" /><Input type="search" value={filter} onChange={event => setFilter(event.target.value)} aria-label={t("Search this car")} placeholder={t("Search this car")} /></label>
    {systems.map(name => {
      const Icon = systemIcons[name];
      const groups = vehicleSystems[name].map(group => ({ group, rows: matches.filter(e => vehicleGroup(e) === group) })).filter(g => g.rows.length);
      if (!groups.length && (term || name !== "Vehicle & service" || !version)) return null;
      return <section className="vehicle-system" key={name}>
        {(term || !["Trip & position", "Doors & security"].includes(name)) && <h3><Icon size={22} aria-hidden="true" />{t(name)}</h3>}
        {!term && name === "Trip & position" && <VehicleJourney entities={entities} />}
        {!term && name === "Doors & security" && <VehicleAccess entities={entities} />}
        {!term && name === "Vehicle & service" && version && <p className="vehicle-version">{t("Software version")} <strong>{version}</strong></p>}
        {groups.map(({ group, rows }) => {
          const spatial = group === "Wheel pressures" || group === "Seat heating";
          const slots = spatial ? positions.map(([label, pattern]) => ({ label, rows: rows.filter(e => pattern.test(metricKey(e))) })) : [];
          const other = spatial ? rows.filter(e => !slots.some(slot => slot.rows.includes(e))) : rows;
          if (group === "Last commands") other.sort((a,b) => (Date.parse(b.state) || 0) - (Date.parse(a.state) || 0));
          const fields = (highlightedFields[group] ?? []).flatMap(([key, label, unit]) => {
            const value = rows.find(e => available(e) && e.attributes[key] != null)?.attributes[key];
            return typeof value === "number" || typeof value === "string" && value.length > 0
              ? [{ label, value: [typeof value === "number" ? number(value) : value, unit].filter(Boolean).join(" ") }] : [];
          });
          return <section key={group} className="vehicle-band"><h4>{t(group)}</h4>
            {group === "Doors and windows" && <OpeningPositions entities={rows} />}
            {fields.length > 0 && <dl className="vehicle-highlights">{fields.map(f => <div key={f.label}><dt>{message(f.label)}</dt><dd>{f.value}</dd></div>)}</dl>}
            {spatial && <div className={group === "Wheel pressures" ? "vehicle-wheels" : "vehicle-seats"}>
              {group === "Wheel pressures" && <img className="vehicle-tyre-plan" src={variant ? `/vehicles/model-${variant}-top.webp` : "/vehicles/tyre-plan.webp"} alt={variant ? t("{model} viewed from above", { model }) : t("Car viewed from above, front at the top")} />}
              {slots.map(({ label, rows: readings }) => readings.length ? <div key={label} data-position={label}>{readings.map(e => <VehicleReading key={e.preferenceId} entity={e} label={label} />)}</div>
                : !term && group === "Wheel pressures" && label !== "Rear center" && <div key={label} data-position={label}><span>{t(label)}</span><strong aria-label={t("Not reported")}>—</strong></div>)}</div>}
            <div className="vehicle-values">{other.map(e => <VehicleReading key={e.preferenceId} entity={e} label={readingLabel(e)} />)}</div>
          </section>;
        })}
      </section>;
    })}
    {!matches.length && term && <p role="status" className="page-note">{t("No matching readings.")}</p>}
  </div>;
}
