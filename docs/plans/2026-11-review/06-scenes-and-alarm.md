# 06 · Scenes and alarm consistency (P2)

[← Master plan](README.md) · Suggested Impeccable command: `/impeccable polish`

**Problem:** Scenes render three ways (Today tiles, Smart home cards, small centred pills on `/moods`). `/alarm` — a high-stakes moment — shows its state as small body text above four equal outline pills, and keeps the action for the current state enabled (for example "Disarm" while already disarmed).

## File anchors

- `src/pages/Moods.tsx` (Scenes page)
- Today/Smart home scene tiles: `src/components/HomePanels.tsx`; card variants in `src/components/devices/CardFrame.tsx`, `src/components/devices/DomainCardContent.tsx` (Super compact density)
- `src/pages/Alarm.tsx` (~26–28 action group and `PinPadModal`)
- `src/components/devices/AlarmCardControls.tsx` (reuse)
- `src/lib/ha-model.ts` `supportsAction`
- Tests: `src/test/device-card-commands.test.ts`, `src/test/smart-home-cards.test.tsx`; add `src/test/alarm-page.test.tsx` if none exists
- Previous scene layout checks: [docs/family-board-review.md](../../family-board-review.md) (0/1/3/4/5/7 scenes, centring, 44 px minimum)

## Checklist

- [x] `/moods`: render scenes with the same tile component as Today (Super compact density), same confirmation/pending/failure behaviour, same ordering source.
- [ ] Re-run the scene layout matrix from family-board-review (0, 1, 3, 4, 5, 7 scenes; long label) at 1440 × 2560 and 390 × 844.
- [ ] `/alarm`: large state headline (state + since when), using the alarm card layout; actions grouped by intent with the safest action visually primary.
- [ ] Hide or disable the action matching the current state (no "Disarm" while disarmed); disabled actions explain why via accessible description.
- [ ] Keep the PIN gate and confirmation exactly as today; no replay after reconnect.
- [ ] Tests: current-state action disabled/hidden for each alarm state; scenes page uses the shared tile component.
- [ ] Update DESIGN.md (scene tile and alarm page rules).

## Acceptance

- Scenes look and behave the same on Today, Smart home and `/moods`.
- On `/alarm` the current state is the most prominent text and the redundant action is not offered.
