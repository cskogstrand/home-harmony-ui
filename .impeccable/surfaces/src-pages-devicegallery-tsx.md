---
version: 1
slug: "src-pages-devicegallery-tsx"
primary_target: "src/pages/DeviceGallery.tsx"
related_targets: ["src/components/devices/device-cards.css","src/components/devices/CardFrame.tsx","src/components/devices/CardLayouts.tsx","src/components/devices/CardControls.tsx","src/components/devices/SmartHomeCard.tsx","src/components/devices/DeviceControl.tsx","src/components/devices/DomainCardContent.tsx","src/components/devices/AlarmCardControls.tsx","src/pages/SmartHome.tsx","src/components/SmartHomeSettings.tsx"]
---

# Device card gallery

Mode: Operate. Scope: /device-gallery, reached from Smart home visibility settings. The gallery retains fictional local state for physical devices, helpers and data entity families. Shared card components also serve Smart home, selecting layouts by entity domain. Live controls use existing Home Assistant capabilities and command confirmation. Each card has a shared density preference, defaulting to Super compact.

## Direction contract

THESIS: A tactile device collection where the control explains the device; avoid identical icon-and-toggle cards.

OWN-WORLD: Extend Afterglow's pearl/midnight system typography and blue actions. The gallery and Smart home cards use illuminated glass rims and restrained device-specific color. Solid text surfaces and accessibility fallbacks preserve readability.

STORY: Enter from settings, explore by family, operate primary controls, expand secondary capabilities, and try unavailable/error states. All data is fictional; reset restores the collection.

FIRST VIEWPORT: Compact title and demo explanation, search and family filters, then three generous device cards. Light, climate and blinds lead. A brightness-filled control and changing blind aperture make state tangible. Phone cards stack without shrinking touch controls.

FORM: User-pinned Liquid Glass device-card gallery, code-led; no concept roll for this specified extension. Signature interaction: direct controls continuously update the card's functional visualization; short transitions stop under reduced motion. No invented photography or shipping raster assets.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
