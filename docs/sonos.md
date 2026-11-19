# Sonos

[← Overview](../README.md) · [Connection help](../DOCS.md#access-and-the-home-assistant-connection)

Open the **Sonos music-note shortcut** in the top-right header, beside the camera button, or **Smart home → Sonos** (`/sonos`). The page discovers `media_player` entities registered by Home Assistant's native Sonos integration, including IKEA Symfonisk. Speaker names alone do not identify a Sonos player. Enable the integration and its entities in Home Assistant first; no extra Sonos login or card installation is needed.

## Playback across the dashboard

When a native Sonos group plays a source other than TV, one mini player appears above bottom navigation on every screen except settings, user settings, onboarding and the dedicated Sonos page. It offers previous/next, play/pause and balanced group volume. When the last music group pauses or stops, **Hides in 10 s** counts down beside the room selector before the mini player disappears. Playback in any eligible group cancels the countdown. Opening the full player keeps it available; closing it starts a fresh ten seconds if nothing is playing. Old paused or idle sessions alone do not summon it. TV, an unavailable speaker and an offline Home Assistant connection hide it immediately.

Open the mini player's room dropdown to choose a destination. Each option names its rooms, track and playback state; the selected stopped group remains available during the countdown. A visible **playing separately** count identifies multiple independent groups; the menu repeats that count. Choosing a destination only changes which group the controls target; it does not join groups or move music. The mini player follows the navigation dock's rounded shape, with circular artwork, a prominent play/pause button and inline volume.

On phones, tap the circular artwork with the expand icon to open the full player. The transport buttons sit beside the track, with room selection and volume underneath.

**Open full player** opens the same player used on the Sonos page in a dialog, including **Your music**, **Group settings** and **Speaker settings**. Closing it returns focus to the expand button. The dock animates the mini player's arrival and departure, respects reduced motion, and reserves enough page space to keep the bottom content reachable.

## Listen

Choose a room or group at the top of the page. Rooms playing together appear as one destination, with their reported track and playback state. Selecting a destination only changes what you control; it does not move or start music. The selected speaker stays in the page URL. For grouped speakers, playback, music selection, the queue and sleep timers target the reported group coordinator.

The player is the main surface: artwork, track details, transport and group volume stay visible. **Your music**, **Group settings** and **Speaker settings** open separate dialogs. The music dialog uses almost the full available screen height and names its playback destination; **Change room** closes it and focuses the room selector without losing your place in the library.

Use play/pause, previous/next, shuffle, repeat and seeking when the speaker reports support. Repeat cycles through off, all and one. Radio and other sources without a known duration omit the seek control. Now-playing and protected Home Assistant artwork travel through the authenticated dashboard server. Library favorites use the provider thumbnail supplied by Home Assistant without sending the dashboard referrer; a missing or failed image has a neutral music fallback.

## Rooms and volume

**Group settings** shows room volumes, mute controls and group selection together in one scrollable dialog, without tabs or separate pages. Volume and mute commands take effect immediately. Room selections are drafts until **Apply group** is pressed; **Cancel** discards those selections without undoing volume changes. **Done** closes the dialog when membership is unchanged.

Added rooms switch to the coordinator's music. The coordinator remains selected; remove the other rooms to split a group. **Select all available rooms** prepares a whole-home group before applying it. Unavailable speakers cannot be added or changed. If another controller changes membership while the dialog is open, reopen it before applying. Failed edits remain open with the Home Assistant error reason when supplied. Grouping waits up to 45 seconds per added speaker (45 seconds for ungrouping) to accommodate Sonos topology updates; it does not replay timed-out commands.

**Group volume** shows the average of available, controllable speakers with a reported volume. Moving it shifts those rooms by the same number of percentage points, preserving their relative levels until a room reaches 0% or 100%. The resulting average can therefore differ from the requested level at either boundary. Individual controls are available in **Group settings**. **Mute group** affects available speakers that support mute. Sliders submit on release or keyboard adjustment, rather than sending a request for every drag event.

Reported state remains authoritative. Grouping and multi-speaker volume changes are separate Home Assistant operations and cannot be atomic. A failure can leave some rooms changed; the page reports the failure and does not automatically retry or undo successful commands.

## Find music

Open **Your music** to browse the shared library. Closing the dialog preserves its view, folder and filter. Successful **Play now**, **Play all** or queue-track playback returns to the player; a failed command leaves the dialog open with its error. Adding music to the queue keeps the dialog open.

| View | Contents |
| --- | --- |
| Favorites | Favorites saved in Sonos, including favorited playlists, albums and radio. Native favorite folders are combined into one view. |
| Browse music | The media sources and nested collections exposed by the selected speaker through Home Assistant. |
| Playlists | Playlists in the Sonos music library (`playlist`, `A:PLAYLISTS`). Playlists from music services may instead appear in Favorites or Browse music. |
| Queue | The native Sonos queue, with the current track marked, direct track playback, removal and clearing. |

The filter names its scope: **Filter favorites**, **Filter playlists**, **Filter this folder** or **Filter queue**. It searches only the currently loaded collection or queue, not a streaming service's whole catalogue. **Clear filter** returns focus to the input. Favorites use compact rows with square thumbnails and adjacent titles. Folder breadcrumbs let you return directly to a parent or the library root.

Changing rooms preserves the selected music view, folder, filter and visible-item limit. The collection is reread through the new coordinator before playback is enabled. The queue belongs to the selected room: changing coordinators discards its old tracks, queue filter and pending confirmations. Late responses from the previous room cannot replace the new queue or issue a pending queue action.

Playable collections offer **Play all** after opening them. Supported media also offers **Play next** and **Add to queue**. Sonos favorites expose **Play now** only because the native favorite action replaces playback and ignores queue insertion options.

Removing a track or clearing the queue requires confirmation. Before these actions and direct queue playback, the page rereads the queue and rejects the action if its tracks changed. Saved favorites and playlists are not deleted. Queue reads refresh every 15 seconds while the music dialog and page are visible and idle, and after local commands or relevant state updates. Large collections reveal 60 rows at a time.

Use **Refresh music** after changing favorites or the library elsewhere. Failed reads offer **Retry** and disable actions on the failed view.

## Sound and sources

Open **Speaker settings** to change an input using **Source**. The source picker is absent from the main player. It shows the group coordinator's reported source, including streaming services started elsewhere. A current source such as Spotify remains visible even when it is not a selectable input; only reported inputs and sources, including TV and line-in where supported, can be selected. The same dialog contains enabled Sonos number, switch and select entities belonging to the selected physical speaker: for example bass, treble, loudness, crossfade, night sound, speech enhancement, subwoofer and hardware controls. For a grouped destination, use the **Speaker** selector inside these settings to choose the physical speaker without changing the music destination. The dashboard reuses its existing capability-aware device controls. Enable missing entities in Home Assistant if needed.

The speaker settings dialog also contains sleep timer choices of 15, 30, 60 or 90 minutes, plus cancellation. Sonos manages the remaining time; the page does not invent a countdown. The timer affects the playing group.

## Compatibility and verification

Controls depend on Home Assistant's reported feature flags and registered services. Queue access requires `sonos.get_queue` with response support; queue playback and removal require their corresponding services. Missing capabilities are disabled or explained. Offline controls remain disabled until fresh state returns. Credentials stay on the server, and physical commands are never replayed after a connection loss.

This controller uses the native Sonos integration. Music Assistant-specific search/queues, creating or editing saved playlists, and persistent named group presets are outside this page. Those remain in the Sonos app or their owning integration.

Automated tests cover validation, coordinator targeting, grouping, partial volume failures, queue indexing and stale responses. Browser checks use fictional speakers across desktop, phone, portrait, dark mode and Norwegian Bokmål. Real Sonos hardware and streaming-service playback still need validation in the household's Home Assistant installation.

Feature inspiration: [custom-sonos-card](https://github.com/punxaphil/custom-sonos-card). Integration contracts: [Home Assistant Sonos](https://www.home-assistant.io/integrations/sonos/) and [native media-player services](https://www.home-assistant.io/integrations/media_player/).
