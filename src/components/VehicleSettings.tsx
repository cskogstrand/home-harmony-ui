import { useApp } from "@/contexts/AppContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { deviceChoiceLabel } from "@/lib/device-model";
import { cabinClimate, teslaVehicles } from "@/lib/vehicles";
import { EntityPicker } from "@/components/EntityPicker";
import { Switch } from "@/components/ui/switch";

export function VehicleSettings() {
  const { currentHome, homeOnline, metadataWarnings } = useApp();
  const { vehicles, setVehicleVisible, updateVehicle } = useFamily();
  const { state } = useSharedConfiguration();
  const { t, language } = useI18n();
  const discovered = teslaVehicles(currentHome).map(({ id, source, device, entities }) => ({
    id, name: deviceChoiceLabel(device, currentHome, language), detail: [source, device.model].filter(Boolean).join(" · "),
    canControl: source !== "TeslaMate" && cabinClimate(entities)?.domain === "climate",
  })).sort((a, b) => a.name.localeCompare(b.name, language));
  const commandCars = discovered.filter(car => car.canControl);
  const disabled = !state.loaded || !!state.error;
  const selected = new Map(vehicles.map(car => [car.id, car]));
  const images = currentHome.entities.filter(entity => entity.domain === "image");
  const sensors = currentHome.entities.filter(entity => entity.domain === "sensor");
  const missing = vehicles.filter(car => !discovered.some(device => device.id === car.id));
  const choices = [...discovered, ...missing.map(car => ({ ...car, detail: t(homeOnline ? "Unavailable" : "Offline") }))];
  return <section className="settings-card" aria-label={t("Electric vehicles")}>
    {!homeOnline && <p role="status" className="page-note">{t("Connect to Home Assistant to discover vehicles.")}</p>}
    {homeOnline && !discovered.length && <p role="status" className="page-note">{t(metadataWarnings?.length
      ? "Vehicle discovery is incomplete. Check the Home Assistant connection."
      : "No Tesla vehicles found. Connect a Tesla integration in Home Assistant or enable MQTT discovery in TeslaMate.")}</p>}
    {choices.map(({ id, name, detail }) => {
      const car = selected.get(id);
      return <div key={id}>
        <label className="settings-control-row">
          <span className="min-w-0 break-words"><strong>{name}</strong><small id={`vehicle-source-${id}`} className="block text-muted-foreground">{detail}</small></span>
          <Switch disabled={disabled} aria-label={t("Show {name} in the header", { name })} aria-describedby={`vehicle-source-${id}`} checked={!!car} onCheckedChange={visible => setVehicleVisible({ id, name }, visible)} />
        </label>
        {car && <div className="planner-form">
          {id.startsWith("teslamate:") && <label>{t("Send commands for {name} through", { name })}
            <select disabled={disabled} value={car.commandVehicleId ?? ""} onChange={event => updateVehicle(id, { commandVehicleId: event.target.value || undefined })}>
              <option value="">{t("Readings only")}</option>
              {car.commandVehicleId && !commandCars.some(item => item.id === car.commandVehicleId) && <option value={car.commandVehicleId}>{t("Selected command vehicle unavailable")}</option>}
              {commandCars.map(item => <option key={item.id} value={item.id}>{item.name} · {item.detail}</option>)}
            </select>
          </label>}
          <EntityPicker label={t("Photo for {name}", { name })} entities={images} value={car.imageEntity ?? ""}
            onChange={image => updateVehicle(id, { imageEntity: image || undefined })} groupByDevice={false} disabled={disabled}
            placeholder={t("Use default vehicle image")} clearLabel={t("Use default vehicle image")} />
          <EntityPicker label={t("Address sensor for {name}", { name })} entities={sensors} value={car.addressEntity ?? ""}
            onChange={address => updateVehicle(id, { addressEntity: address || undefined })} disabled={disabled}
            placeholder={t("Use vehicle address sensor")} clearLabel={t("Use vehicle address sensor")} />
        </div>}
      </div>;
    })}
  </section>;
}
