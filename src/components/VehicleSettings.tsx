import { useRef, useState } from "react";
import { CarFront, Pencil, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { deviceChoiceLabel } from "@/lib/device-model";
import { msg } from "@/lib/i18n";
import { cabinClimate, teslaVehicles, vehicleImageSource } from "@/lib/vehicles";
import { EntityPicker } from "./EntityPicker";
import { VehiclePhoto } from "./VehiclePhoto";
import { ConfirmDialog } from "./common/ConfirmDialog";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

export function VehicleSettings() {
  const { currentHome, homeOnline, metadataWarnings } = useApp();
  const { vehicles, setVehicleVisible, updateVehicle } = useFamily();
  const { state } = useSharedConfiguration();
  const { t, language } = useI18n();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState<string>();
  const addButton = useRef<HTMLButtonElement>(null);
  const discovered = teslaVehicles(currentHome).map(({ id, source, device, entities }) => ({
    id, deviceId: device.id, source, model: device.model, name: deviceChoiceLabel(device, currentHome, language),
    canControl: source !== "TeslaMate" && cabinClimate(entities)?.domain === "climate",
  })).sort((a, b) => a.name.localeCompare(b.name, language) || a.source.localeCompare(b.source));
  const commandCars = discovered.filter(car => car.canControl);
  // TeslaMate and the Tesla integration can share one Home Assistant device.
  const addedDeviceIds = new Set(vehicles.flatMap(car => [car.id.replace(/^teslamate:/, ""), car.commandVehicleId]));
  const available = discovered.filter(car => !addedDeviceIds.has(car.deviceId));
  const disabled = !state.loaded || !!state.error;
  const images = currentHome.entities.filter(entity => entity.domain === "image");
  const sensors = currentHome.entities.filter(entity => entity.domain === "sensor");
  const discoveryNote = !homeOnline ? t("Connect to Home Assistant to discover vehicles.")
    : discovered.length ? undefined : t(metadataWarnings?.length
      ? "Vehicle discovery is incomplete. Check the Home Assistant connection."
      : "No Tesla vehicles found. Connect a Tesla integration in Home Assistant or enable MQTT discovery in TeslaMate.");
  return <section className="vehicle-settings" aria-label={t("Electric vehicles")}>
    <Dialog open={adding} onOpenChange={setAdding}>
      <DialogTrigger asChild><Button ref={addButton} disabled={disabled || vehicles.length >= 100} className="vehicle-add"><Plus aria-hidden="true" />{t("Add electric vehicle")}</Button></DialogTrigger>
      <DialogContent className="vehicle-settings-dialog">
        <DialogHeader><DialogTitle>{t("Add electric vehicle")}</DialogTitle>
          <DialogDescription>{discoveryNote ?? (available.length ? t("Choose a vehicle source from Home Assistant.") : t("All discovered vehicle sources have been added."))}</DialogDescription>
        </DialogHeader>
        {homeOnline && available.map(car => <button type="button" key={car.id} className="vehicle-source-choice" disabled={disabled}
          onClick={() => { if (setVehicleVisible({ id: car.id, name: car.name }, true)) setAdding(false); }}>
          <span className="vehicle-choice-photo"><VehiclePhoto model={car.model} name={car.name} compact /></span>
          <span><strong>{car.name}</strong><small>{[car.model, car.source].filter(Boolean).join(" · ")}</small></span><Plus size={18} aria-hidden="true" />
        </button>)}
      </DialogContent>
    </Dialog>
    {state.loaded && !vehicles.length && <div className="vehicle-settings-empty settings-card">
      <CarFront size={40} strokeWidth={1.5} aria-hidden="true" /><h2>{t("No electric vehicles added")}</h2>
      <p className="page-note">{discoveryNote ?? t("Add a vehicle to see its status in the header.")}</p>
    </div>}
    {vehicles.length > 0 && <div className="vehicle-settings-grid">
      {vehicles.map(car => {
        const found = discovered.find(device => device.id === car.id);
        const name = found?.name ?? car.name;
        const description = [found?.model, found?.source, !homeOnline ? t("Offline") : !found ? t("Unavailable") : undefined].filter(Boolean).join(" · ");
        return <article className="vehicle-settings-card" key={car.id} aria-label={name}>
          <div className="vehicle-settings-photo"><VehiclePhoto model={found?.model} name={name}
            source={homeOnline ? vehicleImageSource(images, car.imageEntity) : undefined} compact /></div>
          <div className="vehicle-settings-caption"><div><h2>{name}</h2><p>{description}</p></div>
            <Dialog open={editing === car.id} onOpenChange={open => { setEditing(open ? car.id : undefined); setRemoving(false); }}>
              <DialogTrigger asChild><Button variant="outline" aria-label={t("Edit {name}", { name })}><Pencil aria-hidden="true" />{t("Edit")}</Button></DialogTrigger>
              <DialogContent className="vehicle-settings-dialog">
                <DialogHeader><DialogTitle>{t("Edit {name}", { name })}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
                <div className="planner-form">
                  {car.id.startsWith("teslamate:") && <label>{t("Send commands for {name} through", { name })}
                    <select disabled={disabled} value={car.commandVehicleId ?? ""} onChange={event => updateVehicle(car.id, { commandVehicleId: event.target.value || undefined })}>
                      <option value="">{t("Readings only")}</option>
                      {car.commandVehicleId && !commandCars.some(item => item.id === car.commandVehicleId) && <option value={car.commandVehicleId}>{t("Selected command vehicle unavailable")}</option>}
                      {commandCars.map(item => <option key={item.id} value={item.id}>{[item.name, item.model, item.source].filter(Boolean).join(" · ")}</option>)}
                    </select>
                  </label>}
                  <EntityPicker label={t("Photo for {name}", { name })} entities={images} value={car.imageEntity ?? ""}
                    onChange={image => updateVehicle(car.id, { imageEntity: image || undefined })} groupByDevice={false} disabled={disabled}
                    placeholder={t("Use default vehicle image")} clearLabel={t("Use default vehicle image")} />
                  <EntityPicker label={t("Address sensor for {name}", { name })} entities={sensors} value={car.addressEntity ?? ""}
                    onChange={address => updateVehicle(car.id, { addressEntity: address || undefined })} disabled={disabled}
                    placeholder={t("Use vehicle address sensor")} clearLabel={t("Use vehicle address sensor")} />
                </div>
                <Button className="vehicle-remove" variant="ghost" disabled={disabled} onClick={() => setRemoving(true)}>
                  <Trash2 aria-hidden="true" />{t("Remove vehicle")}
                </Button>
                <ConfirmDialog open={removing} onOpenChange={setRemoving} title={msg("Remove {name}?", { name })}
                  description="The header widget and its saved settings will be removed." confirmLabel="Remove vehicle" destructive disabled={disabled}
                  onConfirm={() => {
                    if (!setVehicleVisible(car, false)) return false;
                    setRemoving(false); setEditing(undefined);
                    requestAnimationFrame(() => addButton.current?.focus());
                  }} />
              </DialogContent>
            </Dialog>
          </div>
        </article>;
      })}
    </div>}
  </section>;
}
