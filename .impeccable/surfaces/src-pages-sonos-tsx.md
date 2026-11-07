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

THESIS: Make the destination as obvious as the music. Now playing, rooms and library share one page; grouping never hides the current playback destination.

OWN-WORLD: Inherit Afterglow's pearl/midnight surfaces, system typography, blue actions and shared Liquid Glass controls. Artwork is real reported content. Dense library rows retain a solid reading surface.

STORY: Pick a room, see its group and music, choose a favorite or browse playlists, then adjust the group's balance or individual speakers. Secondary sound settings expand inline.

FIRST VIEWPORT: Room selector under the page title. Large square artwork and transport controls lead the wide left panel; a bounded room summary occupies the right panel at the same height. Individual volumes and grouping open scrollable shared glass dialogs. The library begins below. On phones, compact square artwork sits beside room and track metadata, with full-width seeking, transport and group volume below; rooms and library follow at readable sizes. Speaker destinations and the secondary navigation scroll horizontally.

FORM: Code-led now-playing-first composition within the user-pinned Apple Liquid Glass world. User confirmed now playing first, with rooms and music library alongside. seed:0dda1bae7db7cfa1. Signature interaction: the group level moves the room sliders together, while confirmed state remains authoritative. No new raster assets.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Built surface

Now playing and Rooms reuse the shared Liquid Glass surface and panel opacity as a local exception; the library and expandable speaker settings remain opaque. The shared palette, typography, materials and accessibility fallbacks are unchanged. A top-right header Sonos shortcut opens `/sonos` beside the camera, bell and settings controls, using the same circular glass surface, music-note icon and accessible label/title. Below 380px, the header keeps the moon home link and hides its wordmark so all four controls retain 48px targets. The compact Rooms card shares the now-playing row height, with bounded names and modal volume/group controls that return focus to their opener. At widths below 1100px the panels stack; at 699px or less, artwork becomes 96px beside metadata, favorites use two columns and room/settings rows use one. Transport retains its 64px primary action, ranges retain 44px interaction height, and group choices pair 24px checkboxes with 56px labeled rows. Shared focus and reduced-motion behavior apply; reduced transparency and contrast retain solid glass surfaces, and forced colors outline selected destinations, views, transport modes and the current queue track.

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
