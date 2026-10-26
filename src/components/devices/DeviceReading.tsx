import { CircleAlert, CircleHelp, WifiOff } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, entityStateLabel } from "@/lib/ha-model";
import type { Entity } from "@/types/api";
import { DeviceIcon } from "./DeviceControl";
import { EntityDetails } from "./EntityDetails";
import { EntityHistory } from "./EntityHistory";

export function DeviceReading({ entity }: { entity: Entity }) {
  const { currentHome, homeOnline } = useApp();
  const { t, language } = useI18n();
  const reported = homeOnline && available(entity);
  const numeric = reported && entity.state.trim() !== "" && Number.isFinite(Number(entity.state));
  const unit = reported && typeof entity.attributes.unit_of_measurement === "string" ? entity.attributes.unit_of_measurement : "";
  const battery = numeric && entity.domain === "sensor" && entity.attributes.device_class === "battery" && unit === "%" && Number(entity.state) >= 0 && Number(entity.state) <= 100;
  const attention = reported && entity.domain === "binary_sensor" && entity.state === "on" && ["problem", "safety", "tamper", "smoke", "gas", "moisture", "battery"].includes(String(entity.attributes.device_class));
  const area = currentHome.areas.find(area => area.id === entity.areaId && area.id !== entity.device?.area_id);
  const StatusIcon = !homeOnline ? WifiOff : !reported ? CircleHelp : attention ? CircleAlert : null;
  return <article id={entity.entityId} tabIndex={-1} aria-label={entity.name} className={`device-reading${entity.domain === "sensor" ? " device-reading-with-history" : ""}`} data-state={!reported ? "unavailable" : attention ? "attention" : "reported"}>
    <div className="device-reading-heading"><DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-4 w-4" /><div><h3>{entity.name}</h3>{area && <small>{area.id === "unassigned" ? t("Unassigned") : area.name}</small>}</div></div>
    <div className="device-reading-result">
      <p className={`device-reading-value${numeric ? " sensor-reading" : ""}`}>{StatusIcon && <StatusIcon size={20} aria-hidden="true" />}<span>{homeOnline ? entityStateLabel(entity, language) : t("Offline")}{unit && <small> {unit}</small>}</span></p>
      {battery && <span className="device-reading-battery" aria-hidden="true"><span style={{ width: `${Number(entity.state)}%` }} /></span>}
    </div>
    {entity.domain === "sensor" && <EntityHistory entity={entity} icon />}
    <EntityDetails entity={entity} icon />
  </article>;
}
