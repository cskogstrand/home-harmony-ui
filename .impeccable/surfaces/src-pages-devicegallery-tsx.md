---
version: 1
slug: "src-pages-devicegallery-tsx"
primary_target: "src/pages/DeviceGallery.tsx"
related_targets: ["src/components/devices/device-cards.css","src/components/devices/CardFrame.tsx","src/components/devices/CardLayouts.tsx","src/components/devices/CardControls.tsx","src/components/devices/SmartHomeCard.tsx","src/components/devices/SmartHomeCards.tsx","src/components/devices/CardGroup.tsx","src/components/devices/EntityMedia.tsx","src/components/devices/WeatherCard.tsx","src/components/devices/EntityHistory.tsx","src/components/devices/EntityFacts.tsx","src/components/devices/DeviceControl.tsx","src/components/devices/DomainCardContent.tsx","src/components/devices/AlarmCardControls.tsx","src/hooks/use-card-drag.ts","src/lib/smart-home-cards.ts","src/pages/SmartHome.tsx","src/components/SmartHomeSettings.tsx"]
---

# Device card gallery

Smart home editing extension: **Configure** reveals inline size/group fields and drag handles beside keyboard/touch move buttons. Cards can move within or between named groups while room filters stay available; moves preserve filtered-out cards, and previews are inert during editing. A new group is saved once a card is assigned. Shared settings retain order and composition. Height alignment is computed independently for each rendered grid row. Media transport fills its card width with spaced controls; camera/image previews open in a viewport-wide dialog with 16px side gutters, pausing the inline preview and returning focus on close. This remains an Operate extension of the existing card system, with no new visual world or assets.

Mode: Operate. Scope: /device-gallery, reached from the Add card type catalogue in Smart home settings, and its shared Smart home card components. The gallery retains fictional local state for physical devices, helpers and data entity families. Smart home renders only explicitly saved cards: users choose a card type, attach a compatible main entity and optional supporting readings, images or controls from any device, then save. Settings pair device-scoped source pickers and opt-in recommendations with a separate inert production card preview, plus name, type, group and per-card density fields; Super compact is the default. The ordered shared layout replaces automatic device grouping and visibility rules without migration. In each rendered row of a multi-column grid, cards strictly taller than half that row's tallest natural card height align to that height; shorter cards and single-column phone layouts keep natural height.

Live controls use reported Home Assistant capabilities and command confirmation. Cameras use authenticated MJPEG streams with a labeled snapshot fallback, pausing streams off-screen and in background tabs. Image entities supply reported maps or images, and media players can show reported artwork. Weather cards subscribe to supported forecast periods; main sensor and air-quality cards fetch numeric history only after expansion. Details expose allowlisted facts. Missing live data keeps its loading, offline or unavailable state, with retries where supported; gallery simulations remain isolated.

## Direction contract

THESIS: A tactile device collection where the control explains the device; avoid identical icon-and-toggle cards.

OWN-WORLD: Extend Afterglow's pearl/midnight system typography and blue actions. The gallery and Smart home cards use illuminated glass rims and restrained device-specific color. Solid text surfaces and accessibility fallbacks preserve readability.

STORY: In the gallery, enter from settings, explore by family, operate primary controls, expand secondary capabilities, and try unavailable/error states. Gallery data is fictional; reset restores the collection. On Smart home, scan named groups, operate the main entity, and expand supporting controls or history as needed.

FIRST VIEWPORT: Compact title and demo explanation, search and family filters, then three generous device cards. Light, climate and blinds lead. A brightness-filled control and changing blind aperture make state tangible. Phone cards stack without shrinking touch controls.

FORM: User-pinned Liquid Glass device-card gallery, code-led; no concept roll for this specified extension. Signature interaction: direct controls continuously update the card's functional visualization; short transitions stop under reduced motion. No invented photography or shipping raster assets.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
