# Sonos

[← Overview](../README.md) · [Connection help](../DOCS.md#access-and-the-home-assistant-connection)

Open the **Sonos music-note shortcut** in the top-right header, beside the camera button, or **Smart home → Sonos** (`/sonos`). The page discovers `media_player` entities registered by Home Assistant's native Sonos integration, including IKEA Symfonisk. Speaker names alone do not identify a Sonos player. Enable the integration and its entities in Home Assistant first; no extra Sonos login or card installation is needed.

## Listen

Choose a speaker at the top. The selected speaker stays in the page URL. For grouped speakers, playback, music selection, the queue and sleep timers target the reported group coordinator. The now-playing panel names the rooms that share its music.

Use play/pause, previous/next, shuffle, repeat and seeking when the speaker reports support. Repeat cycles through off, all and one. Radio and other sources without a known duration omit the seek control. Now-playing and protected Home Assistant artwork travel through the authenticated dashboard server. Library favorites use the provider thumbnail supplied by Home Assistant without sending the dashboard referrer; a missing or failed image has a neutral music fallback.

## Rooms and volume

The compact **Rooms** card summarizes the group and matches the now-playing panel's height on wide screens. **Room volumes** opens a scrollable dialog with every room's volume and mute controls. The page remains compact as more speakers join; narrower screens stack the cards at their natural heights.

**Edit group** opens a dialog to add or remove rooms, then **Apply group** submits the changes. Added rooms switch to the coordinator's music. The coordinator remains selected; remove the other rooms to split a group. **Select all available rooms** prepares a whole-home group before applying it. Unavailable speakers cannot be added or changed. If another controller changes membership while the editor is open, reopen the editor before applying. Failed edits remain open with the Home Assistant error reason when supplied. Grouping waits up to 45 seconds per added speaker (45 seconds for ungrouping) to accommodate Sonos topology updates; it does not replay timed-out commands.

**Group volume** shows the average of available, controllable speakers with a reported volume. Moving it shifts those rooms by the same number of percentage points, preserving their relative levels until a room reaches 0% or 100%. The resulting average can therefore differ from the requested level at either boundary. Individual controls are available in **Room volumes**. **Mute group** affects available speakers that support mute. Sliders submit on release or keyboard adjustment, rather than sending a request for every drag event.

Reported state remains authoritative. Grouping and multi-speaker volume changes are separate Home Assistant operations and cannot be atomic. A failure can leave some rooms changed; the page reports the failure and does not automatically retry or undo successful commands.

## Find music

| View | Contents |
| --- | --- |
| Favorites | Favorites saved in Sonos, including favorited playlists, albums and radio. Native favorite folders are combined into one view. |
| Browse music | The media sources and nested collections exposed by the selected speaker through Home Assistant. |
| Playlists | Playlists in the Sonos music library (`playlist`, `A:PLAYLISTS`). Playlists from music services may instead appear in Favorites or Browse music. |
| Queue | The native Sonos queue, with the current track marked, direct track playback, removal and clearing. |

**Filter this list** searches the currently loaded collection or queue. It does not search a streaming service's whole catalogue. Playable collections offer **Play all** after opening them. Supported media also offers **Play next** and **Add to queue**. Sonos favorites expose **Play now** only because the native favorite action replaces playback and ignores queue insertion options.

Removing a track or clearing the queue requires confirmation. Before these actions and direct queue playback, the page rereads the queue and rejects the action if its tracks changed. Saved favorites and playlists are not deleted. Queue reads refresh every 15 seconds while the page is visible and idle, and after local commands or relevant state updates. Large collections reveal 60 rows at a time.

Use **Refresh music** after changing favorites or the library elsewhere. Failed reads offer **Retry** and disable actions on the failed view.

## Sound and sources

The **Source** picker shows the group coordinator's reported source, including streaming services started elsewhere. A current source such as Spotify remains visible even when it is not a selectable input; only reported inputs and sources, including TV and line-in where supported, can be selected. Expand **Speaker settings** for enabled Sonos number, switch and select entities belonging to the selected physical speaker: for example bass, treble, loudness, crossfade, night sound, speech enhancement, subwoofer and hardware controls. The dashboard reuses its existing capability-aware device controls. Enable missing entities in Home Assistant if needed.

Sleep timer choices are 15, 30, 60 or 90 minutes, plus cancellation. Sonos manages the remaining time; the page does not invent a countdown. The timer affects the playing group.

## Compatibility and verification

Controls depend on Home Assistant's reported feature flags and registered services. Queue access requires `sonos.get_queue` with response support; queue playback and removal require their corresponding services. Missing capabilities are disabled or explained. Offline controls remain disabled until fresh state returns. Credentials stay on the server, and physical commands are never replayed after a connection loss.

This controller uses the native Sonos integration. Music Assistant-specific search/queues, creating or editing saved playlists, and persistent named group presets are outside this page. Those remain in the Sonos app or their owning integration.

Automated tests cover validation, coordinator targeting, grouping, partial volume failures, queue indexing and stale responses. Browser checks use fictional speakers across desktop, phone, portrait, dark mode and Norwegian Bokmål. Real Sonos hardware and streaming-service playback still need validation in the household's Home Assistant installation.

Feature inspiration: [custom-sonos-card](https://github.com/punxaphil/custom-sonos-card). Integration contracts: [Home Assistant Sonos](https://www.home-assistant.io/integrations/sonos/) and [native media-player services](https://www.home-assistant.io/integrations/media_player/).
