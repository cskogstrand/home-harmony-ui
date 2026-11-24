import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { EntityPicker } from "@/components/EntityPicker";
import { EntityHistory } from "@/components/devices/EntityHistory";
import { available, entityReading, entityStateLabel } from "@/lib/ha-model";
import { powerNow, splitIdle, wattsReading, type PowerReading } from "@/lib/energy";
import { Gauge, Zap } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { VehicleCard } from "@/components/HomePanels";
import { DeviceReading } from "@/components/devices/DeviceReading";
import { deviceName } from "@/lib/device-model";
import "./device-detail.css";

/** How many consumers lead the page; the rest wait behind a disclosure. */
const topConsumers = 5;

export default function EnergySaver() {
  const { t, language, locale, reading } = useI18n();
  const { currentHome, haUrl, homeOnline } = useApp();
  const { energyMeters = [], setEnergyMeters } = useFamily();
  const shared = useSharedConfiguration();
  const meters = currentHome.entities.filter(entity => entity.domain === "sensor" && ["energy", "power", "monetary"].includes(String(entity.attributes.device_class)));
  const pinnable = meters.filter(entity => entity.attributes.device_class !== "monetary");
  const power = powerNow(meters);
  const { active, idle } = splitIdle(power);
  const top = active.slice(0, topConsumers);
  const listed = wattsReading(top.reduce((sum, item) => sum + item.watts, 0));
  // Counters, costs and power sensors without a current reading stay available, collapsed under Meters.
  const live = new Set(power.map(item => item.entity.entityId));
  const groups = new Map<string, typeof meters>();
  for (const entity of meters.filter(entity => !live.has(entity.entityId))) {
    const key = entity.device ? `device:${entity.device.id}` : `integration:${entity.integration ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), entity]);
  }
  const counters = meters.length - live.size;
  const areaName = (areaId: string) => areaId === "unassigned" ? "" : currentHome.areas.find(area => area.id === areaId)?.name ?? "";
  const peak = top[0]?.watts ?? 0;
  const consumer = ({ entity, watts }: PowerReading) => {
    const area = areaName(entity.areaId);
    return <li key={entity.entityId} className="energy-now-row">
      <span className="energy-now-name"><strong>{entity.name}</strong>{area && <small>{area}</small>}</span>
      <span className="energy-now-value">{entityReading(entity, language)}</span>
      {peak > 0 && watts > 0 && <span className="energy-now-bar" aria-hidden="true"><span style={{ inlineSize: `${Math.min(100, watts / peak * 100)}%` }} /></span>}
    </li>;
  };
  return <div className="planner-page energy-page"><PageHeading title={t("Car & energy")} />
    {(pinnable.length > 0 || energyMeters.length > 0) && <section className="glow-panel" aria-label={t("Pinned meters")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PanelHeading icon={Zap} title={t("Pinned meters")} />
        <EntityPicker multiple hideLabel groupByDevice={false} label={t("Choose up to three meters")} emptyActionLabel={t("Pin meters")} className="max-w-full sm:max-w-72"
          entities={pinnable} value={energyMeters} onChange={setEnergyMeters} disabled={!shared?.state.loaded || !!shared.state.error}
          disabledReason={entity => energyMeters.length >= 3 && !energyMeters.includes(entity.preferenceId) ? t("Unpin a meter first.") : ""} />
      </div>
      {!!energyMeters.length && <div className="device-reading-grid">{energyMeters.map(id => {
        const entity = pinnable.find(meter => meter.preferenceId === id);
        if (!entity) return <p className="empty-note" key={id}>{t("Meter unavailable")}</p>;
        const reported = homeOnline && available(entity);
        return <article key={id} aria-label={entity.name} className="pinned-meter">
          <h3>{entity.name}</h3>
          <p className="sensor-reading">{homeOnline ? entityStateLabel(entity, language) : t("Offline")}{reported && <small> {String(entity.attributes.unit_of_measurement ?? "")}</small>}</p>
          <p className="page-note">{t("Last 24 hours")}</p>
          <EntityHistory entity={entity} trend />
        </article>;
      })}</div>}
    </section>}
    {(power.length > 0 || !homeOnline && meters.some(entity => entity.attributes.device_class === "power")) && <section className="glow-panel energy-now" aria-label={t("Using power now")}>
      <PanelHeading icon={Gauge} title={t("Using power now")} />
      {!homeOnline ? <p className="empty-note">{t("Home Assistant is offline.")}</p> : <>
        {top.length ? <ol className="energy-now-list">{top.map(consumer)}</ol> : <p className="empty-note">{t("Nothing is drawing more than {watts} right now.", { watts: reading(5, { unit: "W" }) })}</p>}
        {top.length > 1 && <p className="energy-now-total"><span>{t("Total of listed circuits")}</span><strong>{reading(listed.value, listed)}</strong></p>}
        {active.length > topConsumers && <details className="energy-more"><summary>{t("More in use ({count})", { count: active.length - topConsumers })}</summary><ol className="energy-now-list">{active.slice(topConsumers).map(consumer)}</ol></details>}
        {!!idle.length && <details className="energy-more"><summary>{t("Show idle ({count})", { count: idle.length })}</summary><ol className="energy-now-list">{idle.map(consumer)}</ol></details>}
      </>}
    </section>}
    <div className="energy-layout"><VehicleCard /><section className="glow-panel"><PanelHeading icon={Zap} title={t("Energy in Home Assistant")} />{haUrl && <a className="text-link" href={`${haUrl}/energy`} target="_blank" rel="noreferrer">{t("Open Home Assistant Energy")}</a>}</section></div>
    {!!groups.size && <details className="glow-panel energy-meters"><summary>{t("Meters")} <span>({counters})</span></summary>
      {[...groups].map(([key, entities]) => {
        const title = entities[0].device ? deviceName(entities[0].device, language) : entities[0].integration || t("Other readings");
        return <section key={key} aria-label={title}><PanelHeading icon={Zap} title={title} /><div className="device-reading-grid">{entities.map(entity => {
          const kind = entity.attributes.device_class;
          const reset = typeof entity.attributes.last_reset === "string" && Number.isFinite(Date.parse(entity.attributes.last_reset)) ? entity.attributes.last_reset : undefined;
          return <div key={entity.entityId} className="energy-reading"><p className="page-note mb-2">{t(kind === "power" ? "Power now" : kind === "energy" ? "Energy reading" : "Cost reading")}</p><DeviceReading entity={entity} />
            {kind === "energy" && <p className="page-note mt-2">{reset ? t("Last reset: {date}", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: currentHome.timeZone }).format(new Date(reset)) }) : t("Reporting period not provided by Home Assistant.")}</p>}
          </div>;
        })}</div></section>;
      })}
    </details>}
    {!meters.length && <p className="glow-panel empty-note">{t("No energy readings available.")}</p>}
  </div>;
}
