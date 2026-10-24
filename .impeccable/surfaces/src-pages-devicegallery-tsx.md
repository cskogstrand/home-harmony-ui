---
version: 1
slug: "src-pages-devicegallery-tsx"
primary_target: "src/pages/DeviceGallery.tsx"
related_targets: ["src/components/devices/device-cards.css","src/components/devices/CardFrame.tsx","src/components/devices/CardLayouts.tsx","src/components/devices/CardControls.tsx","src/components/devices/SmartHomeCard.tsx","src/components/devices/CardGroup.tsx","src/components/devices/EntityMedia.tsx","src/components/devices/WeatherCard.tsx","src/components/devices/EntityHistory.tsx","src/components/devices/EntityFacts.tsx","src/components/devices/DeviceControl.tsx","src/components/devices/DomainCardContent.tsx","src/components/devices/AlarmCardControls.tsx","src/pages/SmartHome.tsx","src/components/SmartHomeSettings.tsx"]
---

# Device card gallery

Mode: Operate. Scope: /device-gallery, reached from Smart home visibility settings, and its shared Smart home card components. The gallery retains fictional local state for physical devices, helpers and data entity families. Smart home combines selected entities from one device into a card, choosing the layout from its main entity and showing supporting readings, images and disclosed controls. Settings provide main-entity selection, explicit links from other devices, named groups and a shared card density, defaulting to Super compact. Choosing a main entity enables it; other entities remain opt-in through visibility or explicit linking. In multi-column groups, cards strictly taller than half the tallest natural card height align to that height; shorter cards and single-column phone layouts keep natural height.

Live controls use reported Home Assistant capabilities and command confirmation. Cameras use authenticated MJPEG streams with a labeled snapshot fallback, pausing streams off-screen and in background tabs. Image entities supply reported maps or images, and media players can show reported artwork. Weather cards subscribe to supported forecast periods; main sensor and air-quality cards fetch numeric history only after expansion. Details expose allowlisted facts. Missing live data keeps its loading, offline or unavailable state, with retries where supported; gallery simulations remain isolated.

## Direction contract

THESIS: A tactile device collection where the control explains the device; avoid identical icon-and-toggle cards.

OWN-WORLD: Extend Afterglow's pearl/midnight system typography and blue actions. The gallery and Smart home cards use illuminated glass rims and restrained device-specific color. Solid text surfaces and accessibility fallbacks preserve readability.

STORY: In the gallery, enter from settings, explore by family, operate primary controls, expand secondary capabilities, and try unavailable/error states. Gallery data is fictional; reset restores the collection. On Smart home, scan named groups, operate the main entity, and expand supporting controls or history as needed.

FIRST VIEWPORT: Compact title and demo explanation, search and family filters, then three generous device cards. Light, climate and blinds lead. A brightness-filled control and changing blind aperture make state tangible. Phone cards stack without shrinking touch controls.

FORM: User-pinned Liquid Glass device-card gallery, code-led; no concept roll for this specified extension. Signature interaction: direct controls continuously update the card's functional visualization; short transitions stop under reduced motion. No invented photography or shipping raster assets.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
