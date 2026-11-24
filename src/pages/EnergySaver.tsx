import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { EntityPicker } from "@/components/EntityPicker";
import { EntityHistory } from "@/components/devices/EntityHistory";
import { available, entityStateLabel } from "@/lib/ha-model";
import { Zap } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { VehicleCard } from "@/components/HomePanels";
import { DeviceReading } from "@/components/devices/DeviceReading";
import { deviceName } from "@/lib/device-model";
import "./device-detail.css";

export default function EnergySaver() {
  const { t, language, locale } = useI18n();
  const { currentHome, haUrl, homeOnline } = useApp();
  const { energyMeters = [], setEnergyMeters } = useFamily();
  const shared = useSharedConfiguration();
  const meters = currentHome.entities.filter(entity => entity.domain === "sensor" && ["energy", "power", "monetary"].includes(String(entity.attributes.device_class)));
  const pinnable = meters.filter(entity => entity.attributes.device_class !== "monetary");
  const groups = new Map<string, typeof meters>();
  for (const entity of meters) {
    const key = entity.device ? `device:${entity.device.id}` : `integration:${entity.integration ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), entity]);
  }
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
    <div className="energy-layout"><VehicleCard /><section className="glow-panel"><PanelHeading icon={Zap} title={t("Energy in Home Assistant")} />{haUrl && <a className="text-link" href={`${haUrl}/energy`} target="_blank" rel="noreferrer">{t("Open Home Assistant Energy")}</a>}</section></div>
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
    {!meters.length && <p className="glow-panel empty-note">{t("No energy readings available.")}</p>}
  </div>;
}
