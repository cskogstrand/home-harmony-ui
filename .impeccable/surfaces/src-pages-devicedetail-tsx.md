---
version: 1
slug: "src-pages-devicedetail-tsx"
primary_target: "src/pages/DeviceDetail.tsx"
related_targets: ["src/pages/device-detail.css", "src/lib/device-model.ts", "src/components/devices/SmartHomeCard.tsx", "src/components/devices/CardFrame.tsx", "src/components/devices/DeviceReading.tsx"]
---

# Device detail

Mode: Operate. Scope: `/devices/:deviceId`.

Preserve Afterglow's Liquid Glass device controls, semantic colors and system typography. Lead with the actual device's functions using the shared original-size cards. Readings use compact, divided rows beside the controls on wide screens and below on phones. Sensor-only devices lead with their readings. Put configuration, diagnostics and device metadata in the header gear menu, with Settings, Diagnostics and About tabs. Use compact named setting controls, timestamped diagnostic readings, separate maintenance actions and reported device metadata. Per-entity info buttons reveal technical attributes. Show useful battery and fault readings on the main page.

Preserve all visible Home Assistant entities, technical attributes, room overrides, list navigation state and legacy links. A link to a maintenance entity opens the gear menu on its matching tab and focuses the control. Commands retain capability checks and confirmations. Offline state must never present stale readings as current. Media uses the existing authenticated viewer and lifecycle; numeric history loads on demand.

Reading rows give localized values and units priority, with quieter names and type icons. Reported battery percentages have a small level indicator; voltage and missing values do not. Explicit fault, safety, tamper, smoke, gas, leak and low-battery states carry an alert icon and semantic color. Ordinary open/closed states remain neutral. Named history and info icons reveal content inline with keyboard focus and 44px touch targets.

Verification uses fictional fixtures across thermostat, light, blinds, vacuum, media, lock, camera and sensor pages, including mobile, tablet, portrait, dark mode and Norwegian. Local checks do not establish physical-device behavior.
