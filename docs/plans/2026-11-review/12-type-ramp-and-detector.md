# 12 · Type ramp and detector cleanup (P3)

[← Master plan](README.md) · Run after 01–06 · Suggested Impeccable commands: `/impeccable typeset`, then `/impeccable document`

**Problem:** `impeccable detect --json src` reported 230 advisory findings: 163 font sizes outside the DESIGN.md ramp (≈ 40 distinct values, long tail of one-offs such as 1.0625, 1.1875, 1.3125, 1.4375, 1.55, 1.65, 3.8125rem), 48 off-scale radii, 17 colours. Most colour/radius hits are false positives (person palette, test fixtures, illustration miniatures). One real accessibility issue: the robot/lawn map caption is 10.4 px (`.dg-robot-map > span`, `font-size: .65rem`, `device-cards.css` ~164).

Known false positives (do not "fix"): `device-cards.css:160` side-tab/border-accent (robot map wall), `src/lib/member-colors.ts` and `src/hooks/use-calendar-plans.ts` person colours, colours in `src/test/*`, illustration radii in `camera-settings.css`, `device-cards.css`, `notifications.css` miniatures. Consider adding them to `.impeccable/critique/ignore.md`.

## Checklist

- [x] Re-run the detector with the Impeccable launcher (`~/.claude/skills/impeccable/scripts/impeccable detect --json src`, from the project root) and save counts in a `> Before:` note.

  > Before (2026-11-24, after workstreams 00–11 merged): 241 advisory findings. 170 `design-system-font-size` across 41 distinct values (`afterglow.css` 89, `device-cards.css` 34, `notifications.css` 21, `sonos.css` 8, `home-status.css` 4, 2 each in `ha-health.css`, `waste-collection.css`, `alarm.css`, `calendar.css`, `settings.css`, 1 each in `favorite-picker.css`, `smart-home-settings.css`, `device-detail.css`, `ui/calendar.tsx`). Most frequent: `1rem` 33, `.8125rem` 32 (both spellings), `.75rem` 30 (both spellings), `1.125rem` 8, `1.8rem` 7, `2rem` 6, `1.1rem` 6. 49 `design-system-radius` (2–18px one-offs: `afterglow.css` 13, `device-cards.css` 10, `notifications.css` 8, `camera-settings.css` 6, `sonos.css` 5, `smart-home-settings.css` 3, others 1 each). 20 `design-system-color` (12 person colours in `member-colors.ts`, 1 in `use-calendar-plans.ts`, 5 in `src/test/*`, `#000` in `afterglow.css`, `hsl(0 0% 96%)` in `device-cards.css`). 1 `side-tab` and 1 `border-accent-on-rounded` (robot map wall, `device-cards.css`).
- [x] Fix the robot/lawn map caption to ≥ 0.75rem (≥ 12 px at the 16 px root).
- [x] Decide the type ramp: add the sizes DESIGN.md already uses in prose (for example .75rem phone metadata, 1.375/1.75rem next-plan title/time, 2/1.8rem Sonos titles) to the typography token block, and define CSS custom properties for each step if not present.
- [x] Replace one-off sizes in `src/afterglow.css`, `src/components/devices/device-cards.css`, `src/components/notifications.css`, `src/pages/sonos.css` with the nearest ramp step; check visually at 1440 × 2560 and 390 × 844 that nothing reflows badly.
  > Every `rem` font size in `src/**/*.css` (all 20 stylesheets, including the ones workstreams 01–11 added) now uses a `--type-*` token; off-ramp values snapped to the nearest step. Notification widget zoom uses `calc(var(--type-body-large) * 1.1/1.2)`. 58 dead `afterglow.css` rules (old vehicle, energy, eyebrow, calendar pagination, device range) and 6 dead `device-cards.css` rules were removed instead of retuned. The unused `text-2xs` (10px) Tailwind step is gone. Visual check: the branch cannot be served, so the changed declarations were injected as overrides into the main dev server (read-only). At 1440 × 2560 dock, list rows and Today heading kept their heights, the clock shrank 100 → 90px, no horizontal overflow. At 390 × 844 `/device-gallery` had no horizontal overflow and no new overflowing text; the phone week number (10 → 11px) could not be shown with the current calendar view and was checked by reading the CSS (`min-height: 2.2em` grows by 2px).
- [x] Normalise `0.75rem`/`.75rem` style duplicates.
  > Done by the token conversion above: no literal `rem` font sizes remain in the stylesheets.
- [x] Radii: map real-surface radii to the documented scale; leave illustration radii and list them as intentional in DESIGN.md.
  > New tokens `--radius-checkbox` (6px) and `--radius-row` (12px, replacing `calc(var(--radius) - 4px)`); real surfaces in `afterglow.css`, `device-cards.css`, `notifications.css`, `entity-picker.css`, `calendar.css`, `sonos.css`, `smart-home-settings.css` and `waste-collection.css` now use `--radius-*` tokens. The remaining 13 detector radius findings are illustration geometry listed under **The Illustration Radius Exception** in DESIGN.md.
- [x] Token-ise the deliberate light backing `hsl(0 0% 96%)` in `device-cards.css` (~442) or document it.
- [ ] Add the confirmed false positives to `.impeccable/critique/ignore.md`.
- [ ] Refresh `.impeccable/design.json` with `/impeccable document` (preserve DESIGN.md).
- [ ] Re-run detect; `> After:` counts. Target: no font-size findings outside documented exceptions.

## Acceptance

- Detector font-size findings reduced to documented exceptions; no visible text under 11 px.
