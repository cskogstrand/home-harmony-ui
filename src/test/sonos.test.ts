import { describe, expect, it } from "vitest";
import { entityCommand, supportsAction } from "@/lib/ha-model";
import { groupVolume, groupVolumeChanges, mediaArtwork, mediaBrowserSchema, mediaTime, playbackPosition, sonosGroup, sonosPlayers } from "@/lib/sonos";
import { musicFolder, sonosEntities, sonosServices, speaker } from "./sonos-fixtures";

describe("Sonos model", () => {
  it("uses integration metadata and the reported coordinator, including missing coordinators", () => {
    const players = sonosEntities();
    expect(sonosPlayers([...players, { ...speaker("not_sonos"), integration: "cast", name: "Sonos cast" }])).toEqual(players);
    expect(sonosGroup(players[1], players)).toEqual({ coordinator: players[0], members: players.slice(0, 2) });
    expect(sonosGroup(players[1], players.slice(1)).coordinator).toBeUndefined();
    expect(sonosGroup(players[2], players).members).toEqual([players[2]]);
  });
  it("preserves room offsets and clamps volume without inventing unavailable readings", () => {
    const members = [speaker("a", .1), speaker("b", .5), { ...speaker("missing"), attributes: {} }, { ...speaker("offline", 1), state: "unavailable" }];
    expect(groupVolume(members)).toBe(30);
    expect(groupVolumeChanges(members, 50)).toEqual([{ entityId: "media_player.a", volume: .3 }, { entityId: "media_player.b", volume: .7 }]);
    expect(groupVolumeChanges(members, 100).map(value => value.volume)).toEqual([.8, 1]);
    expect(groupVolumeChanges(members, 0).map(value => value.volume)).toEqual([0, .2]);
    expect(groupVolumeChanges(members, NaN)).toEqual([]);
    expect(groupVolume([])).toBeUndefined();
  });
  it("bounds playback position, freezes paused tracks and handles missing timestamps", () => {
    const player = speaker("a", .2, { media_position_updated_at: "2026-01-01T00:00:00Z" });
    expect(playbackPosition(player, Date.parse("2026-01-01T00:00:10Z"))).toBe(70);
    expect(playbackPosition({ ...player, state: "paused" }, Date.parse("2026-01-01T01:00:00Z"))).toBe(60);
    expect(playbackPosition(player, Date.parse("2026-01-01T01:00:00Z"))).toBe(240);
    expect(playbackPosition(speaker("a"), Date.now())).toBe(60);
    expect(mediaTime(65)).toBe("1:05");
  });
  it("validates media payloads and playback capabilities", () => {
    expect(mediaBrowserSchema.safeParse({ ...musicFolder(), children: [{ title: 3 }] }).success).toBe(false);
    expect(entityCommand(speaker("a"), "play_media", sonosServices, { media_content_type: "track", media_content_id: "example", enqueue: "next" }).data.enqueue).toBe("next");
    expect(() => entityCommand(speaker("a"), "play_media", sonosServices, { media_content_type: "track", media_content_id: "" })).toThrow();
    expect(() => entityCommand(speaker("a", .2, { supported_features: 512 }), "play_media", sonosServices, { media_content_type: "track", media_content_id: "example", enqueue: "add" })).toThrow("queue");
  });
  it("uses supplied playlist artwork and keeps HA thumbnail tokens behind the local proxy", () => {
    const item = musicFolder().children[0];
    expect(mediaArtwork(item, "media_player.demo")).toBe(item.thumbnail);
    expect(mediaArtwork({ ...item, can_play: false, can_expand: true }, "media_player.demo")).toBe(item.thumbnail);
    const album = { ...item, media_content_type: "album", media_content_id: "A:ALBUM/example" };
    for (const origin of ["", "http://home-assistant.example.invalid:8123"]) expect(mediaArtwork({ ...album, thumbnail: `${origin}/api/media_player_proxy/media_player.demo/browse_media/album/A%3AALBUM%2Fexample?token=fixture-image-token` }, "media_player.demo")).toBe("/api/media_player_proxy/media_player.demo/browse_media/album/A%3AALBUM%2Fexample");
    for (const thumbnail of [undefined, "", "/missing-cover", "javascript:alert(1)", "data:image/svg+xml,<svg/>", "https://user:secret@example.invalid/cover", "http://["]) expect(mediaArtwork({ ...item, thumbnail }, "media_player.demo")).toBeUndefined();
  });
  it("validates group members, gates features and routes Sonos-only actions", () => {
    expect(entityCommand(speaker("a"), "join", sonosServices, ["media_player.b"]).data).toEqual({ group_members: ["media_player.b"] });
    for (const ids of [[], ["light.a"], ["media_player.a"], ["media_player.b", "media_player.b"]]) expect(() => entityCommand(speaker("a"), "join", sonosServices, ids)).toThrow();
    expect(supportsAction(speaker("a", .2, { supported_features: 0 }), "join", sonosServices)).toBe(false);
    expect(supportsAction({ ...speaker("a"), integration: "cast" }, "play_queue", sonosServices)).toBe(false);
    expect(supportsAction(speaker("a"), "play_queue", {})).toBe(false);
    expect(entityCommand(speaker("a"), "play_queue", sonosServices, 0)).toEqual({ domain: "sonos", service: "play_queue", data: { queue_position: 0 }, target: { entity_id: "media_player.a" } });
    expect(entityCommand(speaker("a"), "set_sleep_timer", sonosServices, 900).data).toEqual({ sleep_time: 900 });
    for (const value of [-1, .5, Infinity, "0"]) expect(() => entityCommand(speaker("a"), "remove_from_queue", sonosServices, value)).toThrow();
    expect(() => entityCommand(speaker("a"), "set_sleep_timer", sonosServices, 86400)).toThrow();
  });
});
