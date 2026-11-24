# 03 · Header, bell badge and Today first screen (P1)

[← Master plan](README.md) · Suggested Impeccable commands: `/impeccable distill`, then `/impeccable clarify`

**Problem:** The product goal is "see what matters next". Today:

- The bell (`NotificationBell`) shows a filled primary "…" badge while a rule is only waiting for a reading. It looks identical to a real alert count, and its accessible name becomes a status sentence instead of "Notifications".
- On phone, header + vehicle strip take ≈ 180 px; the next family plan falls below the fold.
- Same-date waste pickups render as repeated rows.
- Vehicle header buttons are 48 px tall next to 60 px siblings on the portrait wall.
- Home status (house badge) shows a green check that competes with the bell even when nothing needs attention.

**Read first:** [docs/notifications.md](../../notifications.md), `.impeccable/surfaces/src-pages-dashboard-tsx.md`, DESIGN.md shell/header sections.

## File anchors

- `src/components/NotificationCenter.tsx` ~36–39 (`NotificationBell`: `label`, badge span, sr-only status)
- `src/contexts/NotificationProvider.tsx` ~91 (where the waiting status is derived)
- `src/components/layout/AppLayout.tsx` ~71–78 (header order: `VehicleWidgets`, `WeatherWidget`, `HomeStatus`, `NotificationBell`)
- `src/components/VehicleWidgets.tsx`, `src/components/vehicle-widgets.css`
- `src/components/WasteCollection.tsx` (Today waste list)
- `src/components/HomeStatus.tsx`, `src/components/home-status.css`
- Tests: `src/test/notification-ui.test.tsx`, `src/test/app-layout.test.tsx`, `src/test/home-status.test.ts`

## Checklist

- [x] Bell: show a filled badge only for real active notifications. "Waiting for a reading" shows nothing on the bell (or at most a hollow neutral dot) and is explained on `/notifications`.
- [x] Bell accessible name is always "Notifications" (+ count when > 0); the waiting/status sentence stays in the existing sr-only live region only when it changes.
- [x] Home status badge: neutral/no icon when all is well; colour and icon only when something needs attention. Keep the accessible summary.
- [x] Vehicle buttons match neighbour height (60 px) on the portrait wall media query.
  > Verified at 1440 × 2560 by injecting the rule into the running page: strip 56 → 60 px (top 20, same as the 60 px icon buttons); each vehicle button stretches to 52 px inside the 3 px padding and 1 px border.
- [ ] Phone (< 768 px): collapse the vehicle strip into one compact chip (worst battery/charging state first; tap opens the existing vehicle detail) so the next family plan is visible on the first screen at 390 × 844.
- [x] Waste on Today: merge pickups that share a date into one row with several fraction icons (`WasteTypeIcons`) and one date.
- [ ] Measure first-screen content at 390 × 844 and 1440 × 2560 before/after (y-position of "Next family plan" title) and note both in `> Before/After:` lines; compare with docs/family-board-review.md numbers so nothing regresses.
- [ ] Tests: bell badge absent for waiting-only state and present for active notifications; accessible name; waste merge grouping; vehicle chip on narrow viewport.
- [ ] Update docs/notifications.md (bell behaviour) and DESIGN.md (header).

## Acceptance

- A waiting rule never produces a filled badge.
- At 390 × 844 the next family plan title is above the fold with default settings.
- No duplicated waste date rows on Today.
