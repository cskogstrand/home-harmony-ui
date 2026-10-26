import { useEffect, useState } from "react";
import { Activity, CheckCircle2, CircleAlert, ExternalLink, Info, SlidersHorizontal } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, entityStateLabel } from "@/lib/ha-model";
import { deviceName, deviceReadingsLabel } from "@/lib/device-model";
import type { Entity, PhysicalDevice } from "@/types/api";
import { SettingsPopover } from "@/components/common/SettingsPopover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceControl, DeviceIcon } from "./DeviceControl";
import { EntityDetails } from "./EntityDetails";
import { cardDesignFor } from "./card-designs";

export function DeviceTools({ device, entities, configuration, diagnostics, target }: {
  device: PhysicalDevice; entities: Entity[]; configuration: Entity[]; diagnostics: Entity[]; target?: string;
}) {
  const { t, message, language, locale } = useI18n();
  const { currentHome, homeOnline, haUrl } = useApp();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(configuration.length ? "settings" : "about");
  const targetTab = configuration.some(entity => entity.entityId === target) ? "settings" : diagnostics.some(entity => entity.entityId === target) ? "diagnostics" : undefined;
  useEffect(() => {
    if (targetTab) { setTab(targetTab); setOpen(true); }
  }, [target, targetTab]);
  useEffect(() => {
    if (!open || !targetTab || tab !== targetTab) return;
    const frame = requestAnimationFrame(() => {
      const control = document.getElementById(target);
      control?.scrollIntoView?.({ block: "nearest" });
      control?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, tab, target, targetTab]);
  const area = currentHome.areas.find(area => area.id === device.area_id);
  const integrations = [...new Set(entities.flatMap(entity => entity.integration ? [entity.integration] : []))].join(", ");
  const status = deviceReadingsLabel(entities, homeOnline);
  const StatusIcon = status === "Readings available" ? CheckCircle2 : CircleAlert;
  const updated = (entity: Entity) => entity.lastUpdated && Number.isFinite(Date.parse(entity.lastUpdated))
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: currentHome.timeZone }).format(new Date(entity.lastUpdated)) : t("Not reported");
  const settings = (items: Entity[]) => items.map(entity => {
    const Icon = cardDesignFor(entity.domain)?.icon ?? SlidersHorizontal;
    return <article id={entity.entityId} tabIndex={-1} key={entity.entityId} aria-label={entity.name} className="device-tool-setting">
    <div className="device-tool-name"><Icon size={16} aria-hidden="true" /><h3>{entity.name}</h3></div>
    <DeviceControl entity={entity} setting />
    <EntityDetails entity={entity} icon />
  </article>;
  });
  const diagnosticReadings = diagnostics.filter(entity => ["sensor", "binary_sensor", "event", "device_tracker"].includes(entity.domain));
  const diagnosticActions = diagnostics.filter(entity => !diagnosticReadings.includes(entity));
  return <SettingsPopover label={t("Device settings")} open={open} onOpenChange={setOpen} className="device-tools device-card-designs">
    <p className="device-tools-name">{deviceName(device, language)}</p>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="device-tools-tabs" aria-label={t("Device settings")}>
        <TabsTrigger value="settings"><SlidersHorizontal size={16} aria-hidden="true" />{t("Settings")}</TabsTrigger>
        <TabsTrigger value="diagnostics"><Activity size={16} aria-hidden="true" />{t("Diagnostics")}</TabsTrigger>
        <TabsTrigger value="about"><Info size={16} aria-hidden="true" />{t("About")}</TabsTrigger>
      </TabsList>
      <TabsContent value="settings">
        <p className="device-tools-description">{t("Adjust how this device behaves.")}</p>
        {configuration.length ? settings(configuration) : <p className="device-tools-empty">{t("This device has no settings exposed by Home Assistant.")}</p>}
      </TabsContent>
      <TabsContent value="diagnostics">
        <div className="device-tools-status"><StatusIcon size={18} aria-hidden="true" /><div><strong>{message(status)}</strong><p>{t("Reported by Home Assistant")}</p></div></div>
        {diagnosticReadings.map(entity => <article id={entity.entityId} tabIndex={-1} key={entity.entityId} aria-label={entity.name} className="device-tool-reading">
          <div className="device-tool-name"><DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-4 w-4" /><h3>{entity.name}</h3></div>
          <strong>{homeOnline ? entityStateLabel(entity, language) : t("Offline")}{homeOnline && available(entity) && typeof entity.attributes.unit_of_measurement === "string" ? ` ${entity.attributes.unit_of_measurement}` : ""}</strong>
          <p className="device-tool-updated">{t("Last updated")}: {updated(entity)}</p><EntityDetails entity={entity} icon />
        </article>)}
        {!!diagnosticActions.length && <section className="device-tools-actions" aria-label={t("Maintenance")}><h3>{t("Maintenance")}</h3>{settings(diagnosticActions)}</section>}
        {!diagnostics.length && <p className="device-tools-empty">{t("No diagnostic readings or maintenance actions are exposed for this device.")}</p>}
      </TabsContent>
      <TabsContent value="about">
        <dl className="device-tools-facts">
          {[["Manufacturer", device.manufacturer], ["Model", device.model], ["Software", device.sw_version], ["Room", area && area.id !== "unassigned" ? area.name : t("Unassigned")], ["Integration", integrations]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{message(label)}</dt><dd>{value}</dd></div>)}
          <div><dt>{t("Device ID")}</dt><dd className="device-tools-id">{device.id}</dd></div>
        </dl>
      </TabsContent>
    </Tabs>
    {haUrl && <a className="text-link device-tools-ha" href={`${haUrl}/config/devices/device/${encodeURIComponent(device.id)}`} target="_blank" rel="noreferrer">{t("Manage device in Home Assistant")}<ExternalLink size={16} aria-hidden="true" /></a>}
  </SettingsPopover>;
}
