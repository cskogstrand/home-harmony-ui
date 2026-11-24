import { Zap } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { isPriceSensor } from "@/lib/electricity-price";
import { PanelHeading } from "./FamilyPlanner";
import { EntityPicker } from "./EntityPicker";

/** The owner chooses the electricity price sensor; nothing is detected or changed in Home Assistant. */
export function EnergySettings() {
  const { currentHome, homeOnline } = useApp();
  const { electricityPriceEntity, setElectricityPriceEntity } = useFamily();
  const shared = useSharedConfiguration();
  const { t } = useI18n();
  const sensors = currentHome.entities.filter(isPriceSensor);
  return <section className="settings-stack">
    <section className="settings-card">
      <PanelHeading icon={Zap} title={t("Electricity price")} />
      <p className="page-note" id="electricity-price-help">{t("Choose the Home Assistant sensor with your current electricity price, for example from Nord Pool. Car & energy then shows today’s prices and the cheapest time.")}</p>
      <EntityPicker label={t("Price sensor")} entities={sensors} value={electricityPriceEntity} onChange={setElectricityPriceEntity} groupByDevice={false} placeholder={t("No price sensor selected")} clearLabel={t("Hide electricity price")}
        describedBy="electricity-price-help" disabled={!shared?.state.loaded || !!shared.state.error} />
      {homeOnline && !sensors.length && <p role="status" className="page-note">{t("No price sensors found. Add a price integration such as Nord Pool in Home Assistant; sensors priced per kWh appear here.")}</p>}
    </section>
  </section>;
}
