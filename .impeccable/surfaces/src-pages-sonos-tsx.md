---
target: src/pages/Sonos.tsx
related:
  - src/components/sonos/SonosLibrary.tsx
  - src/pages/sonos.css
  - src/components/layout/AppLayout.tsx
---

# Sonos

Mode: Operate. Dedicated controller for native Home Assistant Sonos players, including IKEA Symfonisk. Existing Afterglow shell, palettes, language and accessibility preferences apply. Device metadata determines inclusion and capabilities; no name-based guesses or demo content in the live page.

## Direction contract

THESIS: The player is the main surface. Choose a destination, open the common library to find music, then return to playback.

OWN-WORLD: Inherit Afterglow's pearl/midnight surfaces, system typography, blue actions and shared Liquid Glass controls. Artwork is real reported content. Library rows retain an opaque reading surface inside the modal.

STORY: Pick a room or group, choose music in **Your music**, and return to the player when playback succeeds. The library remembers its place. Group controls and speaker settings appear only when opened.

FIRST VIEWPORT: Group-aware destinations precede a single centered player. Cover, track, transport and group volume lead. Three actions open **Your music**, **Group settings** and **Speaker settings**. Short desktop windows constrain cover size; phones put the cover beside the track with full-width controls below. The music modal fills the available height minus a small outer margin.

FORM: Code-led player composition within the user-pinned Apple Liquid Glass world. The November 12 follow-up explicitly prioritizes the player, a modal library and modal settings. seed:0dda1bae7db7cfa1. Signature interaction: group volume shifts room levels together, while confirmed state remains authoritative. No new raster assets.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Built surface

Now playing reuses the shared Liquid Glass surface and panel opacity. One destination represents each reported group, with a checkmark and state/track preview. The library modal preserves its view, folder, filter and item limit across dismissal and room changes, but rereads content for the current coordinator. Queue tracks, queue filters and confirmations reset on coordinator changes, and stale reads/actions are guarded. Successful replacement playback dismisses the modal; errors remain visible there. Browsing and queue polling pause while it is closed.

Group settings shows per-room volume, group mute and room selection directly in one scrolling body, with no internal pages or tabs. Volume commands are immediate; grouping remains a draft until Apply. The source picker is inside speaker settings with the physical speaker selector, sound controls and sleep timer. All three dialogs reuse shared focus handling and glass presentation. Their bodies scroll within viewport bounds.

Favorites use two columns of rows with 64px square thumbnails, reducing to one on phones. Breadcrumbs offer direct ancestor navigation, and **Change room** dismisses the modal and focuses the destination selector. The header Sonos shortcut, shared shell and main dock remain unchanged.

## Finish evidence — 2026-11-07

- Fresh review identified a queue-confirmation race, transport icon sizing and group-checkbox proportions. All three fixes passed the bounded verdict; disposition was ship at the reviewed fix-list scope, not a broader second audit.
- The full suite passed 909 tests before the final fix batch. After the fixes and header shortcut, 30 focused Sonos and app-layout tests, TypeScript, lint and build passed; 52 server tests also passed. These are recorded run results, not proof of live speaker behavior.
- Fictional-fixture browser captures in `.impeccable/review/sonos/` cover desktop (1440 × 1000), the target portrait viewport (1440 × 2560), phones (390 × 844 and 320 × 844), dark mode and Norwegian. They include group and queue views. The isolated preview renders the real Sonos components with a representative shell; its updated header contains all four controls. Browser assertions checked header fit, target sizes and no horizontal page overflow.
- DESIGN.md records the finished layout and component behavior. No global tokens or sidecar were changed, and no shipping raster assets were added.
- Follow-up slider fix: loading device-card CSS exposed missing card-only color variables on Sonos ranges. Shared rules now fall back to primary/card palette tokens. Browser assertions verified opaque thumbs, borders and filled tracks in light/dark Dusk, preserved explicit card colors, and keyboard group-volume changes; all 10 Sonos UI tests passed.
- Follow-up artwork fix: favorites use the supplied HTTP(S) provider thumbnails, while protected HA thumbnail routes are rebuilt locally without their query tokens. Invalid URLs and failed images keep the existing fallback. Fixture browser checks loaded four covers at desktop/phone widths without referrer or Authorization headers; 17 Sonos tests, TypeScript, lint and build passed.
- Covers now use a square 1:1 ratio. The source picker retains a reported streaming source outside the selectable input list, preventing the browser from displaying its first input instead. A regression test reproduced Spotify displaying as TV before the fix. Browser checks confirmed square covers on desktop/phone, the Spotify display and coordinator-targeted TV selection; 18 Sonos tests, TypeScript, lint and build passed afterward.
- Real Sonos speakers, physical touchscreen behavior and deployment were not validated.

## Compact rooms follow-up — 2026-11-07

The room card summarizes membership instead of repeating each volume slider. Individual volume/mute controls and group editing use the shared dialog, with fixed header/footer and a scrolling body. Browser checks cover two and sixteen speakers, equal card heights, phone/desktop scrolling, speaker targeting, focus return and page overflow. 134 focused Sonos/session tests, TypeScript, lint and build passed. The command wait now accommodates Sonos topology updates, and grouping errors retain HA’s reason. The exact household failure could not be confirmed: the read-only HA log request failed with EHOSTUNREACH. No live grouping or speaker changes were issued.

## Player and modal navigation — 2026-11-12

The earlier library-first layout was superseded by the user's player-first direction. Two bounded visual batches covered the player and modal layouts; the final batch included the combined group controls and taller library.

- Fictional-fixture checks covered 1440 × 1000 desktop, 1440 × 2560 portrait, 900px tablet, 390px and 320px phones, English/Norwegian, light/dark themes, missing artwork, offline speakers, sixteen destinations and a large group. No page overflow or browser runtime errors were observed. Short-window and phone covers were reduced after the first pass to keep playback controls higher on the page.
- The music modal fills the viewport minus a small outer margin. Browser assertions checked its bounds, dismissal focus, preserved filter, Change room focus, successful playback and coordinator targeting. Group checks confirmed that volume and selection are in the same dialog, large groups scroll inside the modal, room volumes target their own speaker, and source changes still target the coordinator.
- Final local captures are in `.impeccable/review/sonos-player/`. Their speakers, music and geometric test cover are fictional; they are review artifacts, not runtime assets. Older captures in `sonos-navigation` describe the superseded layout.
- 33 focused Sonos/UI/localization tests, TypeScript, lint and production build passed after the modal changes. The existing bundle-size advisory remains. The design detector reported no anti-patterns in the three source files and eight token advisories: existing checkbox/calc-derived radii and the documented local text sizes. This source-only scan is not a contrast audit.
- Final disposition: ship for this local change. The shared shell still requires page scrolling on short viewports; the portrait layout keeps the complete player and its actions visible. No dependency, server API, shared design token or shipping raster was added.
- Real Sonos hardware, household Home Assistant, physical touchscreen, deployment and non-Chrome browsers were not exercised.
