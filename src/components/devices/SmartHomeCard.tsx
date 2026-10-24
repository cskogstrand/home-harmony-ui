import { Radio } from "lucide-react";
import type { Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { entityDetailPath } from "@/lib/device-model";
import { cardDesignFor } from "./card-designs";
import { cardVariants } from "./card-presentation";
import { CardFrame } from "./CardFrame";
import { DeviceControl } from "./DeviceControl";

export function SmartHomeCard({ entity }: { entity: Entity }) {
  const { currentHome } = useApp();
  const { smartHome } = useFamily();
  const design = cardDesignFor(entity.domain) ?? { id: entity.domain, title: entity.name, subtitle: entity.domain, group: "", domains: [entity.domain], icon: Radio, tint: "blue" };
  const area = currentHome.areas.find(area => area.id === entity.areaId && area.id !== "unassigned");
  return <CardFrame design={design} title={entity.name} subtitle={area?.name} to={entityDetailPath(entity)} variant={cardVariants[smartHome.cardDensities[entity.preferenceId] ?? "supercompact"]}>
    <DeviceControl entity={entity} card />
  </CardFrame>;
}
