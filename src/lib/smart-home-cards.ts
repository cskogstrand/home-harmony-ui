import type { Entity } from "@/types/api";
import type { Planner } from "../../shared/configuration";
import { smartHomeEntities } from "./device-model";

export const cardId = (entity: Entity) => entity.device ? `device:${entity.device.id}` : entity.preferenceId;
const primaryDomains = ["vacuum", "lawn_mower", "climate", "water_heater", "alarm_control_panel", "lock", "cover", "light", "fan", "humidifier", "media_player", "camera", "weather", "valve", "switch", "image"];
export function defaultMainEntity(entities: Entity[]) {
  const rank = (entity: Entity) => (entity.category ? 100 : 0) + (primaryDomains.includes(entity.domain) ? primaryDomains.indexOf(entity.domain) : primaryDomains.length);
  return [...entities].sort((a, b) => rank(a) - rank(b) || a.preferenceId.localeCompare(b.preferenceId))[0];
}

export function smartHomeCards(entities: Entity[], settings: Planner["smartHome"]) {
  const selected = smartHomeEntities(entities, settings).filter(entity => entity.domain !== "scene");
  const groups = new Map<string, Entity[]>();
  for (const entity of selected) {
    const id = cardId(entity);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(entity);
  }
  const byId = new Map(smartHomeEntities(entities).map(entity => [entity.preferenceId, entity]));
  return [...groups].map(([id, members]) => {
    const config = settings.cards[id];
    const main = members.find(entity => entity.preferenceId === config?.mainEntity) ?? defaultMainEntity(members);
    const linked = (config?.linkedEntities ?? []).map(id => byId.get(id)).filter((entity): entity is Entity => !!entity);
    return { id, main, group: config?.group ?? "", entities: [...new Map([...members, ...linked].map(entity => [entity.preferenceId, entity])).values()] };
  }).sort((a, b) => (settings.cards[a.id]?.order ?? Infinity) - (settings.cards[b.id]?.order ?? Infinity));
}

export function moveSmartHomeCard(settings: Planner["smartHome"], entities: Entity[], id: string, group: string, beforeId?: string) {
  const cards = smartHomeCards(entities, settings);
  if (!cards.some(card => card.id === id) || beforeId === id) return settings;
  const destination = cards.filter(card => card.group === group && card.id !== id).map(card => card.id);
  const index = beforeId === undefined ? destination.length : destination.indexOf(beforeId);
  if (index < 0) return settings;
  destination.splice(index, 0, id);
  const next = { ...settings.cards };
  destination.forEach((cardId, order) => { next[cardId] = { linkedEntities: [], ...next[cardId], group, order }; });
  return { ...settings, cards: next };
}

// Compare natural heights within actual grid rows, never previously stretched heights.
export function rowCardHeights(cards: { top: number; height: number }[]) {
  const tallest = new Map<number, number>();
  cards.forEach(({ top, height }) => tallest.set(top, Math.max(tallest.get(top) ?? 0, height)));
  return cards.map(({ top, height }) => height > tallest.get(top)! / 2 ? tallest.get(top)! : height);
}
