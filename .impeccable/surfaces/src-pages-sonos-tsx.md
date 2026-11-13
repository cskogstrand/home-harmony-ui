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

The player reuses the shared Liquid Glass surface and panel opacity. The visible Listen in / Now playing headings and duplicate playback-state badge are removed; named regions remain available to assistive technology, and the track title is the player heading. One destination represents each reported group, with a checkmark and state/track preview. The library modal preserves its view, folder, filter and item limit across dismissal and room changes, but rereads content for the current coordinator. Queue tracks, queue filters and confirmations reset on coordinator changes, and stale reads/actions are guarded. Successful replacement playback dismisses the modal; errors remain visible there. Browsing and queue polling pause while it is closed.

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

## Heading cleanup — 2026-11-12

Removed the visible room-selector heading, now-playing heading and repeated player-state badge. Accessible region names remain; the track is an h2 without a visual type change. A single fixture-browser batch at 1440 × 1000, 1440 × 2560 and 390 × 844 confirmed the removals, the named player region, playback control and no horizontal overflow or runtime errors. The player starts higher on all three layouts. Captures are in `.impeccable/review/sonos-player/no-headings-*.png`. The 33 focused Sonos/UI/localization tests, TypeScript and lint passed. No real speaker commands were issued.

## Mini player — 2026-11-13

THESIS: Keep immediate Sonos playback controls within reach above the shared dock.

OWN-WORLD: Extend the existing pearl/midnight Liquid Glass control layer, shared buttons, ranges and dialog. No new palette, font, dependency or artwork.

STORY: Music starts the mini player. When no music group is playing, a ten-second countdown keeps pause/stop resumable before hiding it. Opening the full player suspends dismissal. TV, unavailable playback, offline state, settings and the dedicated Sonos page hide it immediately. One room selector names each group's track; an explicit count calls out multiple groups playing separately.

FIRST VIEWPORT: A dock-width surface above navigation contains room selection and expand, then artwork, track, previous/pause/next and balanced group volume. Phones place transport and volume beneath the track. Expand opens the same session and player used by the dedicated Sonos page, with its library and settings.

FORM: User-specified local extension; 240ms ease-out translation/fade enters and exits toward the dock. Reduced motion uses a 160ms fade; keyboard transitions are immediate. The shell measures total dock height to reserve scrolling clearance.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

### Initial mini player finish evidence

- The mini and dedicated page share the full player, command handling, library, group controls and speaker settings through `SonosSession`. Native Sonos coordinators determine playback and TV eligibility. The selected paused session remains resumable; initially paused, idle, TV, missing-coordinator and offline sessions do not summon the mini. Settings, user settings and onboarding hide it. Multiple playing groups remain distinct and explicitly counted.
- The actual `AppLayout` fixture was captured at 1440 × 1000 desktop, 1440 × 2560 portrait and 390 × 844 / 320 × 844 phone sizes, including expanded player and dark mode, in `.impeccable/review/sonos-mini/`. All speakers and music are fictional; captures are review evidence, not runtime assets. Dock measurement reserves both content and keyboard scrolling clearance.
- The implementation pass reported 974 tests across 54 files, TypeScript, lint and production build passing. The existing bundle-size advisory remains. Tests cover route visibility, coordinator-based TV exclusion, paused-session retention, separate groups, targeting, group-volume errors, modal focus and offline behavior.
- The initial finish review requested fixes for the volume label overflowing at 320px and documentation. Wrapping the label and using 1rem phone select text resolved that version; both treatments were superseded by the capsule redesign below. Replacement `narrow.png` and `narrow-modal.png` captures confirmed containment; the reviewer found all replacement captures valid and no visual regressions in this fix batch. Final disposition: ship, bounded to these two fixes rather than a broader second audit. The final production build after the CSS fixes passed with the existing bundle-size advisory.
- The design detector reported 118 advisories across the inspected source, mostly inherited values in shared CSS, and no anti-pattern failures. DESIGN.md records the local component and measured dock clearance; PRODUCT.md and `docs/sonos.md` record the behavior. No global design tokens or sidecar were regenerated; pre-existing sidecar drift remains outside this extension. No dependency, server API, saved setting or shipping raster was added.
- Real Sonos hardware, household Home Assistant playback, physical touchscreens, deployment and Safari were not exercised.

## Capsule redesign — 2026-11-13

The user rejected the first mini player as bland and requested the bottom navigation's shape. This local redesign inherits the existing control-layer world. The composition is a single desktop capsule: circular cover, track, compact room menu, prominent playback control, inline volume and expand. Phones use the dock's 34px corners and retain every direct action in a compact stack. Play/pause is 56px on desktop and 48px on phones. A visible independent-playback count accompanies room selection; the menu shows each group's rooms, track and state. The existing shared player, pause retention, TV exclusion, route visibility and arrival/exit motion remain unchanged.

- Fictional-fixture captures in `.impeccable/review/sonos-capsule/` cover 1440px desktop and portrait, 900px tablet, 390px and 320px phones, light/dark themes and Norwegian. The independent reviewer validated `desktop.png`, `mobile.png`, `mobile-rooms.png`, `mobile-modal.png`, `narrow-dark.png`, `portrait-dark.png` and `tablet-dark.png`. These remain review evidence, not runtime assets.
- Browser checks exercised room selection through to the full player, confirmed no horizontal overflow at 900px and observed buttons of at least 44px, with no console errors. The implementation pass reported 62 tests across four files, TypeScript, lint and production build passing. The existing bundle-size advisory remains.
- Fresh independent review disposition: ship, with no material fixes requested for this local redesign. The reviewer inspected the supplied captures and source; they did not independently run the browser, hardware or motion checks.
- DESIGN.md and `docs/sonos.md` now describe the capsule, room dropdown and inline volume. The three-source design scan reported 13 token advisories and no failures. Existing global tokens and sidecar drift remain preserved. No shipping raster, dependency, server API or saved setting was added.
- Real Sonos hardware, household playback, Safari, physical touchscreens and deployment remain untested.

## Auto-hide countdown — 2026-11-13

When the last eligible music group pauses or stops, the mini retains the selected session for ten seconds and shows a timer icon with **Hides in {seconds} s** beside the room selector. Resuming any eligible group cancels the deadline. The full player suspends dismissal; closing it starts a fresh countdown if no music is playing. Idle sessions are retained only when already selected, and expired sessions stay hidden until playback resumes. TV, unavailable speakers, offline state and settings still hide the mini immediately. The existing exit motion is unchanged; timer numerals use tabular spacing without per-second live announcements.

72 focused tests across five files, TypeScript, lint and production build passed. Tests cover pause/stop expiry, fresh deadlines after resume, other playing groups and an open full player. Fictional-fixture browser checks confirmed the countdown and eventual dismissal at 320px, plus desktop placement; captures are `sonos-capsule/countdown-mobile.png` and `sonos-capsule/countdown-dock.png` under the local review directory. No real speaker, Safari or deployment check was performed; the existing build-size advisory remains.

## Artwork spacing — 2026-11-13

Symmetric side padding now matches the artwork's vertical clearance: 1rem on desktop, 2rem on compact tablets and 1.5rem on the large portrait layout. Phones retain uniform .75rem padding. Fictional-fixture browser measurements found less than 1px difference between left and vertical clearance in all three capsule layouts, with no horizontal overflow at 1440 × 2560, 1440 × 1000, 900 × 1000 or 320 × 844. Local `sonos-capsule/spacing-*.png` captures record this CSS-only correction. No playback behavior changed or additional automated tests were run.
