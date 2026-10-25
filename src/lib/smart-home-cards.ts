import type { Entity } from "@/types/api";
import type { Planner } from "../../shared/configuration";
import { cardDesigns } from "@/components/devices/card-designs";
import { smartHomeEntities } from "./device-model";

export function smartHomeCards(entities: Entity[], settings: Planner["smartHome"]) {
  const byId = new Map(smartHomeEntities(entities).map(entity => [entity.preferenceId, entity]));
  return settings.layout.map(config => {
    const design = cardDesigns.find(design => design.id === config.type)!;
    const source = byId.get(config.mainEntity);
    const main = source && design.domains.includes(source.domain) ? source : undefined;
    const linked = config.linkedEntities.map(id => byId.get(id)).filter((entity): entity is Entity => !!entity);
    return { ...config, main, design, name: config.title || main?.name || design.subtitle, entities: [...(main ? [main] : []), ...linked] };
  });
}

export function moveSmartHomeCard(settings: Planner["smartHome"], id: string, group: string, beforeId?: string) {
  const card = settings.layout.find(card => card.id === id);
  if (!card || beforeId === id) return settings;
  const layout = settings.layout.filter(card => card.id !== id);
  const before = beforeId === undefined ? layout.length : layout.findIndex(card => card.id === beforeId && card.group === group);
  if (before < 0) return settings;
  layout.splice(before, 0, { ...card, group });
  return { layout };
}

// Compare natural heights within actual grid rows, never previously stretched heights.
export function rowCardHeights(cards: { top: number; height: number }[]) {
  const tallest = new Map<number, number>();
  cards.forEach(({ top, height }) => tallest.set(top, Math.max(tallest.get(top) ?? 0, height)));
  return cards.map(({ top, height }) => height > tallest.get(top)! / 2 ? tallest.get(top)! : height);
}
