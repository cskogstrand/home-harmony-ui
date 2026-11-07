import { z } from "zod";
import type { Entity } from "@/types/api";
import { available, numberValue, stringValues } from "./ha-model";

export const mediaItemSchema = z.object({
  title: z.string(), media_content_id: z.string(), media_content_type: z.string(),
  media_class: z.string().optional(), can_play: z.boolean(), can_expand: z.boolean(), thumbnail: z.string().nullish(),
});
export const mediaBrowserSchema = mediaItemSchema.extend({ children: z.array(mediaItemSchema).optional() });
export type MediaItem = z.infer<typeof mediaItemSchema>;
export type MediaBrowser = z.infer<typeof mediaBrowserSchema>;
export const sonosQueueSchema = z.array(z.object({
  media_title: z.string().nullish(), media_artist: z.string().nullish(), media_album_name: z.string().nullish(), media_content_id: z.string().nullish(),
}));
export type SonosQueueItem = z.infer<typeof sonosQueueSchema>[number];
export const sonosPlayers = (entities: Entity[]) => entities.filter(entity => entity.domain === "media_player" && entity.integration === "sonos");
export function sonosGroup(player: Entity, players: Entity[]) {
  const ids = stringValues(player.attributes.group_members);
  const coordinator = ids[0] ? players.find(item => item.entityId === ids[0]) : player;
  return { coordinator, members: ids.length ? ids.flatMap(id => players.find(item => item.entityId === id) ?? []) : [player] };
}
export const volumePercent = (entity: Entity) => {
  const value = numberValue(entity.attributes.volume_level);
  return value === undefined ? undefined : Math.round(Math.max(0, Math.min(1, value)) * 100);
};
export function groupVolume(members: Entity[]) {
  const values = members.filter(available).map(volumePercent).filter((value): value is number => value !== undefined);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : undefined;
}
export function groupVolumeChanges(members: Entity[], target: number) {
  const current = groupVolume(members);
  if (current === undefined || !Number.isFinite(target) || target < 0 || target > 100) return [];
  // Shift each room by the same amount to preserve its balance, bounded by silence and full volume.
  return members.filter(available).flatMap(entity => {
    const value = volumePercent(entity);
    return value === undefined ? [] : [{ entityId: entity.entityId, volume: Math.max(0, Math.min(100, value + target - current)) / 100 }];
  });
}
export function playbackPosition(entity: Entity, now: number) {
  const duration = numberValue(entity.attributes.media_duration) ?? 0;
  const position = numberValue(entity.attributes.media_position);
  if (position === undefined) return undefined;
  const updated = typeof entity.attributes.media_position_updated_at === "string" ? Date.parse(entity.attributes.media_position_updated_at) : NaN;
  const elapsed = entity.state === "playing" && Number.isFinite(updated) ? Math.max(0, (now - updated) / 1000) : 0;
  return Math.max(0, Math.min(duration || Infinity, position + elapsed));
}
export const mediaTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export function mediaArtwork(item: MediaItem, entityId: string) {
  if (!item.thumbnail) return undefined;
  try {
    const url = new URL(item.thumbnail, "https://home-assistant.invalid");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
    // HA proxy thumbnails carry an access token; rebuild them locally without exposing it.
    if (/^\/api\/media_player_proxy\/media_player\.[a-z0-9_]+\//.test(url.pathname)) return `/api/media_player_proxy/${encodeURIComponent(entityId)}/browse_media/${encodeURIComponent(item.media_content_type)}/${encodeURIComponent(item.media_content_id)}`;
    if (/^https?:\/\//i.test(item.thumbnail)) return url.href;
  } catch { /* Missing or malformed artwork keeps the neutral fallback. */ }
}
