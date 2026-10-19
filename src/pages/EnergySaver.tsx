import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { VehicleCard } from "@/components/HomePanels";
import { EntityCard } from "@/components/devices/EntityCard";
export default function EnergySaver() {
  const { t } = useI18n();
  const { currentHome, haUrl } = useApp();
  const meters = currentHome.entities.filter(e => e.domain === "sensor" && ["energy", "power", "monetary"].includes(String(e.attributes.device_class)));
  return <div className="planner-page energy-page"><PageHeading eyebrow={t("TAKE CARE OF TOMORROW")} title={t("Home, charged & ready.")} /><div className="energy-layout"><VehicleCard /><section className="glow-panel"><PanelHeading title={t("Energy in Home Assistant")} />{haUrl && <a className="text-link" href={`${haUrl}/energy`} target="_blank" rel="noreferrer">{t("Open Home Assistant Energy")}</a>}</section></div><div className="home-device-grid">{meters.map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>{!meters.length && <p className="glow-panel empty-note">{t("No energy readings available.")}</p>}</div>;
}
