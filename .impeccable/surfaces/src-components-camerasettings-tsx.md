---
version: 1
slug: "src-components-camerasettings-tsx"
primary_target: "src/components/CameraSettings.tsx"
related_targets: ["src/components/CameraConnections.tsx","src/components/Go2rtcSourcePicker.tsx","src/components/NotificationCameraSettings.tsx","src/pages/Cameras.tsx"]
---

# Camera setup and connections

Mode: Operate. Extend the incumbent Afterglow system.
Audience: household administrator adding camera sources for viewing and notifications.
Scope: camera connections, explicit named cameras, camera overview, notification source selection. Popup redesign remains deferred.

## Direction contract

THESIS: A camera is explicitly created with its own name and chosen connection. Discovering HA entities never populates the camera list automatically.

OWN-WORLD: Preserve Afterglow's dark surfaces, existing glow panels, rounded controls, typography and responsive settings navigation.

STORY: Set up a server once; add a camera; choose Home Assistant or a saved go2rtc connection and its source; view that same named camera in Smart home or select it in a notification.

FIRST VIEWPORT: Camera overview offers Add camera and Manage cameras. The empty state explains creation and links connections. The camera editor requires name and connection, then reveals the appropriate source picker. Person snapshots are optional and collapsed until configured.

FORM: User-directed, code-led workflow. Signature interaction is choosing a connection to reveal its stream list or HA camera picker. Preserve existing motion and reduced-motion behavior. seed: none (user pinned the workflow; existing visual world retained).

FINISH: A standalone go2rtc camera works without an HA camera entity. Only created cameras appear in overview and notification choices. Existing explicit overrides and camera notification references migrate. Used cameras/connections cannot be deleted accidentally. Verify desktop/mobile, saving, selection, migration and media routing; fictional fixtures do not establish live stream quality.

## Delivery evidence

The finished flow reuses the settings shell, glow panels, planner fields, shared buttons, confirmation dialogs and media viewer. No new design tokens or visual-system rules were introduced; PRODUCT.md and DESIGN.md remain authoritative.

Player links can supply a connection address or a camera stream, with mismatched servers rejected. go2rtc playback falls back from WebRTC to the authenticated HTTP MSE relay and offers a specific error, Retry and the upstream player when playback fails. Setup and notification guidance lives in docs/cameras.md and docs/notifications.md.

Desktop and phone captures under `.impeccable/review/{connectors,add-camera,configured-camera,camera-source}-{desktop,mobile}.png` use fictional fixtures. A separate local frontend check verified live go2rtc video at 2560 × 1440, ready state 4 and advancing playback time. Home Assistant live playback and HA/Frigate person snapshots remain unverified on hardware. No private names, identifiers, addresses or live camera captures are included in this handoff.
