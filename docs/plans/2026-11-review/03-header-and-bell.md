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
- [x] Phone (< 768 px): collapse the vehicle strip into one compact chip (worst battery/charging state first; tap opens the existing vehicle detail) so the next family plan is visible on the first screen at 390 × 844.
- [x] Waste on Today: merge pickups that share a date into one row with several fraction icons (`WasteTypeIcons`) and one date.
- [x] Measure first-screen content at 390 × 844 and 1440 × 2560 before/after (y-position of "Next family plan" title) and note both in `> Before/After:` lines; compare with docs/family-board-review.md numbers so nothing regresses.
  > Method: read-only measurements on the running dev server (main, connected household with two cars, waste panel ordered before the next plan, three pickups on one date, no header weather). This branch has no dev server of its own, so "after" applies the branch's chip CSS and markup and hides the merged waste rows in the live DOM; re-measure on the merged build in workstream 13.
  > Before (390 × 844): header 136 px (vehicle strip on its own 56 px row); "Next family plan" heading at y = 696, first activity title at y = 817, below the dock top at y = 755.
  > After (390 × 844): header 74 px; heading at y = 424, activity title at y = 545, above the dock. The chip alone moves the heading to y = 634; merging the three same-date pickups saves the rest.
  > Before/After (1440 × 2560): header 100 px both ways (the strip grows from 56 to 60 px inside it); heading at y = 523 and activity title at y = 599 both ways. The wall waste panel lays pickups out in columns, so merging does not change its 209 px height.
  > Comparison: family-board-review.md measured a fictional quiet household (phone title 393 px, wall 707 px). These changes only remove height above the next plan, so neither number regresses.
- [x] Tests: bell badge absent for waiting-only state and present for active notifications; accessible name; waste merge grouping; vehicle chip on narrow viewport.
- [x] Update docs/notifications.md (bell behaviour) and DESIGN.md (header).

## Acceptance

- A waiting rule never produces a filled badge.
- At 390 × 844 the next family plan title is above the fold with default settings.
- No duplicated waste date rows on Today.
