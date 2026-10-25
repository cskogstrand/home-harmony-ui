import type { CardDensity } from "../../../shared/configuration";
import { Link } from "react-router-dom";
import { Radio } from "lucide-react";
import type { Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { available, entityStateLabel } from "@/lib/ha-model";
import { useI18n } from "@/hooks/use-i18n";
import { entityDetailPath } from "@/lib/device-model";
import { cardDesignFor, type CardDesign } from "./card-designs";
import { EntityMedia } from "./EntityMedia";
import { WeatherCard } from "./WeatherCard";
import { EntityFacts } from "./EntityFacts";
import { EntityHistory } from "./EntityHistory";
import { CardPresentation, cardVariants } from "./card-presentation";
import { CardFrame } from "./CardFrame";
import { DeviceControl } from "./DeviceControl";

export function SmartHomeCard({ entity, entities = entity ? [entity] : [], design: chosenDesign, title, density = "supercompact", preview = false, editTo }: {
  entity?: Entity; entities?: Entity[]; design?: CardDesign; title?: string; density?: CardDensity; preview?: boolean; editTo?: string;
}) {
  const { currentHome, homeOnline } = useApp();
  const { message: t, language } = useI18n();
  const design = chosenDesign ?? cardDesignFor(entity?.domain ?? "") ?? { id: entity?.domain ?? "unknown", title: "", subtitle: entity?.domain ?? "Entity", group: "", domains: [], icon: Radio, tint: "blue" };
  const area = currentHome.areas.find(area => area.id === entity?.areaId && area.id !== "unassigned");
  const supporting = entities.filter(item => item.preferenceId !== entity?.preferenceId);
  const media = supporting.filter(item => ["image", "camera"].includes(item.domain));
  const readings = supporting.filter(item => !["image", "camera"].includes(item.domain));
  return <CardFrame design={design} title={title || entity?.name || t(design.subtitle)} subtitle={area?.name} to={!preview && entity ? entityDetailPath(entity) : undefined} variant={cardVariants[density]} disabled={preview}>
    {!entity ? <div className="smart-card-unassigned"><design.icon size={32} aria-hidden="true" /><p>{t(preview ? "Choose a main entity to preview this card." : "The main entity is unavailable.")}</p>{editTo && <Link className="text-link" to={editTo}>{t("Edit card")}</Link>}</div> : <>
    {entity.domain === "weather" ? <WeatherCard entity={entity} /> : ["camera", "image"].includes(entity.domain) ? <EntityMedia key={entity.entityId} entity={entity} /> : <>
      {entity.domain === "media_player" && typeof entity.attributes.entity_picture === "string" && <EntityMedia entity={entity} />}
      <DeviceControl entity={entity} card />
    </>}
    </>}
    {media.map(item => <div className="smart-supporting-media" key={item.preferenceId}><h3>{item.name}</h3><EntityMedia entity={item} /></div>)}
    {!!readings.length && <div className="smart-card-readings" aria-label={t("Supporting entities")}>
      {readings.map(item => ["sensor", "binary_sensor", "device_tracker", "event"].includes(item.domain) ? <div className="smart-reading" key={item.preferenceId}><span>{item.name}</span><strong>{homeOnline ? entityStateLabel(item, language) : t("Offline")}{homeOnline && available(item) && typeof item.attributes.unit_of_measurement === "string" ? ` ${item.attributes.unit_of_measurement}` : ""}</strong></div>
        : <details className="smart-reading-details" key={item.preferenceId}><summary>{item.name}</summary><CardPresentation.Provider value={{ variant: "Compact", title: item.name, tint: design.tint, visible: true }}><DeviceControl entity={item} /><EntityFacts entity={item} /></CardPresentation.Provider></details>)}
    </div>}
    {entity && <EntityFacts entity={entity} />}
    {entity && !preview && ["sensor", "air_quality"].includes(entity.domain) && <EntityHistory entity={entity} />}
  </CardFrame>;
}
