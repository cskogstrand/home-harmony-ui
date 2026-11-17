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
  const { currentHome, haUrl } = useApp();
  const meters = currentHome.entities.filter(entity => entity.domain === "sensor" && ["energy", "power", "monetary"].includes(String(entity.attributes.device_class)));
  const groups = new Map<string, typeof meters>();
  for (const entity of meters) {
    const key = entity.device ? `device:${entity.device.id}` : `integration:${entity.integration ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), entity]);
  }
  return <div className="planner-page energy-page"><PageHeading title={t("Car & energy")} />
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
