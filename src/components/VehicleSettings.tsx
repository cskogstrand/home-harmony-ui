import { useApp } from "@/contexts/AppContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { deviceChoiceLabel } from "@/lib/device-model";
import { teslaVehicles } from "@/lib/vehicles";
import { EntityPicker } from "@/components/EntityPicker";
import { Switch } from "@/components/ui/switch";

export function VehicleSettings() {
  const { currentHome, homeOnline, metadataWarnings } = useApp();
  const { vehicles, setVehicleVisible, setVehicleImage } = useFamily();
  const { state } = useSharedConfiguration();
  const { t, language } = useI18n();
  const discovered = teslaVehicles(currentHome).map(({ device }) => ({
    id: device.id, name: deviceChoiceLabel(device, currentHome, language), model: device.model,
  })).sort((a, b) => a.name.localeCompare(b.name, language));
  const selected = new Map(vehicles.map(car => [car.id, car]));
  const images = currentHome.entities.filter(entity => entity.domain === "image");
  const missing = vehicles.filter(car => !discovered.some(device => device.id === car.id));
  const choices = [...discovered, ...missing.map(car => ({ ...car, model: t(homeOnline ? "Unavailable" : "Offline") }))];
  return <section className="settings-card" aria-label={t("Electric vehicles")}>
    {!homeOnline && <p role="status" className="page-note">{t("Connect to Home Assistant to discover vehicles.")}</p>}
    {homeOnline && !discovered.length && <p role="status" className="page-note">{t(metadataWarnings?.length
      ? "Vehicle discovery is incomplete. Check the Home Assistant connection."
      : "No Tesla vehicles found in Home Assistant.")}</p>}
    {choices.map(({ id, name, model }) => <div key={id}><label className="settings-control-row">
      <span className="min-w-0 break-words"><strong>{name}</strong>{model && <small className="block text-muted-foreground">{model}</small>}</span>
      <Switch disabled={!state.loaded || !!state.error} aria-label={t("Show {name} in the header", { name })} checked={selected.has(id)} onCheckedChange={visible => setVehicleVisible({ id, name }, visible)} />
    </label>
    {selected.has(id) && <EntityPicker label={t("Photo for {name}", { name })} entities={images} value={selected.get(id)?.imageEntity ?? ""}
      onChange={image => setVehicleImage(id, image)} groupByDevice={false} disabled={!state.loaded || !!state.error}
      placeholder={t("Use default vehicle image")} clearLabel={t("Use default vehicle image")} />}
    </div>)}
  </section>;
}
