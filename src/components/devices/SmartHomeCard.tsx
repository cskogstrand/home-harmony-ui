import { memo } from "react";
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
import { EntityDetails } from "./EntityDetails";
import { EntityHistory } from "./EntityHistory";
import { CardPresentation, cardVariants } from "./card-presentation";
import { CardFrame } from "./CardFrame";
import { DeviceControl } from "./DeviceControl";
import { PrinterCardContent } from "./PrinterCardContent";

type CardProps = {
  entity?: Entity; entities?: Entity[]; design?: CardDesign; title?: string; density?: CardDensity; illustrated?: boolean; preview?: boolean; detail?: boolean; editTo?: string;
};

export const SmartHomeCard = memo(function SmartHomeCard({ entity, entities = entity ? [entity] : [], design: chosenDesign, title, density = "supercompact", illustrated, preview = false, detail = false, editTo }: CardProps) {
  const homeOnline = useApp(app => app.homeOnline);
  const { message: t, language } = useI18n();
  const design = chosenDesign ?? cardDesignFor(entity?.domain ?? "") ?? { id: entity?.domain ?? "unknown", title: "", subtitle: entity?.domain ?? "Entity", group: "", domains: [], icon: Radio };
  const areaName = useApp(app => app.currentHome.areas.find(area => area.id === entity?.areaId && area.id !== "unassigned")?.name);
  const supporting = entities.filter(item => item.preferenceId !== entity?.preferenceId);
  const media = supporting.filter(item => ["image", "camera"].includes(item.domain));
  const readings = supporting.filter(item => !["image", "camera"].includes(item.domain));
  return <CardFrame illustrated={illustrated} design={design} title={title || entity?.name || t(design.subtitle)} subtitle={areaName} to={!preview && !detail && entity && entity.domain !== "scene" ? entityDetailPath(entity) : undefined} id={detail ? entity?.entityId : undefined} tabIndex={detail ? -1 : undefined} variant={cardVariants[density]} disabled={preview} footer={detail && entity ? <EntityDetails entity={entity} /> : undefined}>
    {!entity ? <div className="smart-card-unassigned"><design.icon size={32} aria-hidden="true" /><p>{t(preview ? "Choose a main entity to preview this card." : "The main entity is unavailable.")}</p>{editTo && <Link className="text-link" to={editTo}>{t("Edit card")}</Link>}</div> : <>
    {design.id === "printer_3d" ? <PrinterCardContent entity={entity} /> : entity.domain === "weather" ? <WeatherCard entity={entity} /> : ["camera", "image"].includes(entity.domain) ? <EntityMedia key={entity.entityId} entity={entity} /> : <>
      {entity.domain === "media_player" ? <div className="smart-player">
        {typeof entity.attributes.entity_picture === "string" && <EntityMedia entity={entity} />}
        <DeviceControl entity={entity} card />
      </div> : <DeviceControl entity={entity} card />}
    </>}
    </>}
    {media.map(item => <div className="smart-supporting-media" key={item.preferenceId}><h3>{item.name}</h3><EntityMedia entity={item} /></div>)}
    {!!readings.length && <div className="smart-card-readings" aria-label={t("Supporting entities")}>
      {readings.map(item => ["sensor", "binary_sensor", "device_tracker", "event"].includes(item.domain) ? <div className="smart-reading" key={item.preferenceId}><span>{item.name}</span><strong>{homeOnline ? entityStateLabel(item, language) : t("Offline")}{homeOnline && available(item) && typeof item.attributes.unit_of_measurement === "string" ? ` ${item.attributes.unit_of_measurement}` : ""}</strong></div>
        : <details className="smart-reading-details" key={item.preferenceId}><summary>{item.name}</summary><CardPresentation.Provider value={{ variant: "Compact", title: item.name, visible: true }}><DeviceControl entity={item} /><EntityFacts entity={item} /></CardPresentation.Provider></details>)}
    </div>}
    {entity && !detail && !(entity.domain === "scene" && density === "supercompact") && <EntityFacts entity={entity} />}
    {entity && !preview && design.id !== "printer_3d" && ["sensor", "air_quality"].includes(entity.domain) && <EntityHistory entity={entity} />}
  </CardFrame>;
}, (prev, next) => prev.entity === next.entity && prev.design === next.design && prev.title === next.title &&
  prev.density === next.density && prev.illustrated === next.illustrated && prev.preview === next.preview &&
  prev.detail === next.detail && prev.editTo === next.editTo && (prev.entities === next.entities ||
    (prev.entities?.length === next.entities?.length && prev.entities.every((entity, index) => entity === next.entities[index]))));
