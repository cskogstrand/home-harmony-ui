import { Radio } from "lucide-react";
import type { Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { available, entityStateLabel } from "@/lib/ha-model";
import { useI18n } from "@/hooks/use-i18n";
import { cardId } from "@/lib/smart-home-cards";
import { entityDetailPath } from "@/lib/device-model";
import { cardDesignFor } from "./card-designs";
import { EntityMedia } from "./EntityMedia";
import { WeatherCard } from "./WeatherCard";
import { EntityFacts } from "./EntityFacts";
import { EntityHistory } from "./EntityHistory";
import { CardPresentation, cardVariants } from "./card-presentation";
import { CardFrame } from "./CardFrame";
import { DeviceControl } from "./DeviceControl";

export function SmartHomeCard({ entity, entities = [entity], id = cardId(entity) }: { entity: Entity; entities?: Entity[]; id?: string }) {
  const { currentHome, homeOnline } = useApp();
  const { message: t, language } = useI18n();
  const { smartHome } = useFamily();
  const design = cardDesignFor(entity.domain) ?? { id: entity.domain, title: entity.name, subtitle: entity.domain, group: "", domains: [entity.domain], icon: Radio, tint: "blue" };
  const area = currentHome.areas.find(area => area.id === entity.areaId && area.id !== "unassigned");
  const supporting = entities.filter(item => item.preferenceId !== entity.preferenceId);
  const media = supporting.filter(item => ["image", "camera"].includes(item.domain));
  const readings = supporting.filter(item => !["image", "camera"].includes(item.domain));
  return <CardFrame design={design} title={entity.name} subtitle={area?.name} to={entityDetailPath(entity)} variant={cardVariants[smartHome.cardDensities[id] ?? smartHome.cardDensities[entity.preferenceId] ?? "supercompact"]}>
    {entity.domain === "weather" ? <WeatherCard entity={entity} /> : ["camera", "image"].includes(entity.domain) ? <EntityMedia key={entity.entityId} entity={entity} /> : <>
      {entity.domain === "media_player" && typeof entity.attributes.entity_picture === "string" && <EntityMedia entity={entity} />}
      <DeviceControl entity={entity} card />
    </>}
    {media.map(item => <div className="smart-supporting-media" key={item.preferenceId}><h3>{item.name}</h3><EntityMedia entity={item} /></div>)}
    {!!readings.length && <div className="smart-card-readings" aria-label={t("Supporting entities")}>
      {readings.map(item => ["sensor", "binary_sensor", "device_tracker", "event"].includes(item.domain) ? <div className="smart-reading" key={item.preferenceId}><span>{item.name}</span><strong>{homeOnline ? entityStateLabel(item, language) : t("Offline")}{homeOnline && available(item) && typeof item.attributes.unit_of_measurement === "string" ? ` ${item.attributes.unit_of_measurement}` : ""}</strong></div>
        : <details className="smart-reading-details" key={item.preferenceId}><summary>{item.name}</summary><CardPresentation.Provider value={{ variant: "Compact", title: item.name, tint: design.tint, visible: true }}><DeviceControl entity={item} /><EntityFacts entity={item} /></CardPresentation.Provider></details>)}
    </div>}
    <EntityFacts entity={entity} />
    {["sensor", "air_quality"].includes(entity.domain) && <EntityHistory entity={entity} />}
  </CardFrame>;
}
