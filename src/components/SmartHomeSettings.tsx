import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { deviceGroups, deviceName, smartHomeEntities } from "@/lib/device-model";
import type { Entity } from "@/types/api";
import { PanelHeading } from "@/components/FamilyPlanner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function SmartHomeSettings() {
  const { t, message, language } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const { smartHome, setSmartHomeDeviceVisible, setSmartHomeEntityVisible } = useFamily();
  const shared = useSharedConfiguration();
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase(language);
  const entities = smartHomeEntities(currentHome.entities);
  const disabled = !shared?.state.loaded || !!shared.state.error;
  const matches = (value: string) => value.toLocaleLowerCase(language).includes(query);
  const matchesEntity = (entity: Entity) => matches(`${entity.name} ${entity.entityId} ${currentHome.areas.find(area => area.id === entity.areaId)?.name ?? ""}`);
  const groups = deviceGroups({ ...currentHome, entities }, language).map(group => ({ ...group,
    entities: matches(deviceName(group.device, language)) ? group.entities : group.entities.filter(matchesEntity),
  })).filter(group => group.entities.length);
  const standalone = entities.filter(entity => !entity.device && matchesEntity(entity));
  const entityRow = (entity: Entity, deviceHidden = false) => <label key={entity.preferenceId} className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-3">
    <span className="min-w-0"><span className="block break-words text-sm font-medium">{entity.name}</span><span className="block break-all text-xs text-muted-foreground">{entity.entityId}</span></span>
    <Switch aria-label={t("Show entity {name} on Smart home", { name: entity.name })} checked={!deviceHidden && !smartHome.hiddenEntities.includes(entity.preferenceId)} disabled={disabled || deviceHidden}
      onCheckedChange={visible => setSmartHomeEntityVisible(entity.preferenceId, visible)} />
  </label>;

  return <section className="glow-panel" id="smart-home-visibility" aria-label={t("Smart home visibility")}>
    <PanelHeading title={t("Smart home visibility")} to="/home" label={t("Smart home")} />
    <p className="page-note">{t("Choose which devices, entities and scenes appear on Smart home. Changes are saved automatically and shared across screens.")}</p>
    <p className="page-note">{t("New devices and entities are shown by default. Hiding a device also hides its future entities. Other pages and Home Assistant are unchanged.")}</p>
    <label className="mt-4 block text-sm font-medium">{t("Search devices and entities")}
      <Input type="search" className="mt-2" value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Search devices, rooms or scenes…")} />
    </label>
    {!homeOnline && <p role="status" className="page-note">{t("Home Assistant is offline. Showing the last available devices and entities.")}</p>}
    <div className="mt-3 max-h-96 overflow-y-auto pr-2">
      {groups.map(({ device, entities }) => {
        const hidden = smartHome.hiddenDevices.includes(device.id);
        const name = deviceName(device, language);
        return <div key={device.id} className="flex items-start gap-4 border-b last:border-0">
          <details className="min-w-0 flex-1" open={query ? true : undefined}>
            <summary className="min-h-12 cursor-pointer break-words py-3 font-medium">{name}</summary>
            <div className="pl-3">{hidden && <p className="page-note">{t("Show this device to choose its individual entities.")}</p>}{entities.map(entity => entityRow(entity, hidden))}</div>
          </details>
          <Switch className="my-3" aria-label={t("Show device {name} on Smart home", { name })} checked={!hidden} disabled={disabled}
            onCheckedChange={visible => setSmartHomeDeviceVisible(device.id, visible)} />
        </div>;
      })}
      {!!standalone.length && <div className="mt-3"><h3 className="font-medium">{t("Entities without a device")}</h3>{standalone.map(entity => entityRow(entity))}</div>}
      {!groups.length && !standalone.length && <p className="empty-note">{entities.length ? t("No matches. Try another name or room.") : t("No devices available.")}</p>}
    </div>
    <p role="status" className="page-note">{shared?.state.saving ? t("Saving shared configuration…") : shared?.state.dirty ? t("Unsaved changes on this screen.") : shared?.state.loaded ? t("Shared configuration saved.") : t("Loading shared configuration…")}</p>
    {shared?.state.error && <div role="alert"><p className="text-destructive">{message(shared.state.error)}</p><Link to="/user-settings" className="text-link">{t("App preferences")}</Link></div>}
  </section>;
}
