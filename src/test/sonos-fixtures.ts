import type { HassServices } from "home-assistant-js-websocket";
import type { Entity } from "@/types/api";
import type { MediaBrowser } from "@/lib/sonos";

export const sonosServices: HassServices = {
  media_player: Object.fromEntries(["media_play", "media_pause", "media_stop", "media_previous_track", "media_next_track", "media_seek", "volume_set", "volume_mute", "shuffle_set", "repeat_set", "join", "unjoin", "play_media", "clear_playlist", "select_source"].map(name => [name, { fields: {} }])),
  sonos: Object.fromEntries(["get_queue", "play_queue", "remove_from_queue", "set_sleep_timer", "clear_sleep_timer"].map(name => [name, { fields: {} }])),
};
export function speaker(id: string, volume = .2, attributes: Record<string, unknown> = {}): Entity {
  return { entityId: `media_player.${id}`, preferenceId: id, domain: "media_player", integration: "sonos", name: `Demo ${id}`, state: "playing", areaId: "demo", device: { id, manufacturer: "Sonos" },
    attributes: { supported_features: 4194303, volume_level: volume, media_title: "A slower afternoon", media_artist: "The Example Ensemble", media_album_name: "Open windows", media_duration: 240, media_position: 60, shuffle: false, repeat: "off", source_list: ["TV", "Line-in"], ...attributes } };
}
export const sonosEntities = () => [speaker("lounge", .2, { group_members: ["media_player.lounge", "media_player.kitchen"] }), speaker("kitchen", .4, { group_members: ["media_player.lounge", "media_player.kitchen"] }), { ...speaker("studio", .3), state: "paused" }, { ...speaker("terrace", .1), state: "unavailable" }];
export const musicFolder = (title = "Favorites"): MediaBrowser => ({ title, media_content_type: "favorites", media_content_id: "", can_play: false, can_expand: true, children: [
  { title: "Sunday selections", media_content_type: "favorite_item_id", media_content_id: "FV:2/1", media_class: "playlist", can_play: true, can_expand: false, thumbnail: "https://images.example.invalid/playlist.jpg" },
  { title: "Evening radio", media_content_type: "favorite_item_id", media_content_id: "FV:2/2", media_class: "music", can_play: true, can_expand: false },
] });
