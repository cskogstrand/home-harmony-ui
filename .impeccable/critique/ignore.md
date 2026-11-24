# Critique ignore list

Confirmed false positives for `/impeccable critique` and `impeccable detect`. Drop matching findings. The detector also skips them through the file-scoped `detector.ignoreValues` in `.impeccable/config.json`; keep both lists in step.

## Colours

- **Person colours** in `src/lib/member-colors.ts` and the unavailable-person fallback in `src/hooks/use-calendar-plans.ts`. People keep their configured colour; DESIGN.md (Status and assignment) says person colours are runtime values, not palette tokens.
- **Test fixture colours** in `src/test/**`.
- **`#000` in `mask-image`** gradients in `src/afterglow.css` (Smart home navigation fade). Masks use only the alpha channel.

## Shapes

- **Robot map wall** in `src/components/devices/device-cards.css` (`.dg-robot-map::after`): the `side-tab` and `border-accent-on-rounded` findings describe an illustrated room wall, not a card accent.
- **Illustration radii** listed under The Illustration Radius Rule in DESIGN.md:
  - list celebration confetti in `src/afterglow.css` (2px, 9px);
  - camera settings person-size and layout miniatures in `src/components/camera-settings.css` (2–4px);
  - device gallery floor plan, robot map walls, history bars and camera reticle in `src/components/devices/device-cards.css` (3px, 4px, 5px, 10px);
  - notification style and size sketches in `src/components/notifications.css` (2px);
  - electricity price bar tops in `src/pages/device-detail.css` (2px).
