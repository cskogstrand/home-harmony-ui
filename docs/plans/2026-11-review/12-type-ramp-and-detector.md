# 12 · Type ramp and detector cleanup (P3)

[← Master plan](README.md) · Run after 01–06 · Suggested Impeccable commands: `/impeccable typeset`, then `/impeccable document`

**Problem:** `impeccable detect --json src` reported 230 advisory findings: 163 font sizes outside the DESIGN.md ramp (≈ 40 distinct values, long tail of one-offs such as 1.0625, 1.1875, 1.3125, 1.4375, 1.55, 1.65, 3.8125rem), 48 off-scale radii, 17 colours. Most colour/radius hits are false positives (person palette, test fixtures, illustration miniatures). One real accessibility issue: the robot/lawn map caption is 10.4 px (`.dg-robot-map > span`, `font-size: .65rem`, `device-cards.css` ~164).

Known false positives (do not "fix"): `device-cards.css:160` side-tab/border-accent (robot map wall), `src/lib/member-colors.ts` and `src/hooks/use-calendar-plans.ts` person colours, colours in `src/test/*`, illustration radii in `camera-settings.css`, `device-cards.css`, `notifications.css` miniatures. Consider adding them to `.impeccable/critique/ignore.md`.

## Checklist

- [ ] Re-run the detector with the Impeccable launcher (`~/.claude/skills/impeccable/scripts/impeccable detect --json src`, from the project root) and save counts in a `> Before:` note.
- [ ] Fix the robot/lawn map caption to ≥ 0.75rem (≥ 12 px at the 16 px root).
- [ ] Decide the type ramp: add the sizes DESIGN.md already uses in prose (for example .75rem phone metadata, 1.375/1.75rem next-plan title/time, 2/1.8rem Sonos titles) to the typography token block, and define CSS custom properties for each step if not present.
- [ ] Replace one-off sizes in `src/afterglow.css`, `src/components/devices/device-cards.css`, `src/components/notifications.css`, `src/pages/sonos.css` with the nearest ramp step; check visually at 1440 × 2560 and 390 × 844 that nothing reflows badly.
- [ ] Normalise `0.75rem`/`.75rem` style duplicates.
- [ ] Radii: map real-surface radii to the documented scale; leave illustration radii and list them as intentional in DESIGN.md.
- [ ] Token-ise the deliberate light backing `hsl(0 0% 96%)` in `device-cards.css` (~442) or document it.
- [ ] Add the confirmed false positives to `.impeccable/critique/ignore.md`.
- [ ] Refresh `.impeccable/design.json` with `/impeccable document` (preserve DESIGN.md).
- [ ] Re-run detect; `> After:` counts. Target: no font-size findings outside documented exceptions.

## Acceptance

- Detector font-size findings reduced to documented exceptions; no visible text under 11 px.
