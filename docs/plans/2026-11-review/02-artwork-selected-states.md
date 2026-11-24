# 02 · Artwork mode: selected states and patches (P1)

[← Master plan](README.md) · Suggested Impeccable command: `/impeccable polish`

**Problem:** With wall artwork on, `src/artwork.css` paints `.list-tabs` (and `.smart-summary`, `.smart-nav`) with `--art-surface`, the same colour as the selected tab's card fill in `src/afterglow.css` (~line 592–594). Selected vs unselected then differs only by a near-identical text colour at the same weight, breaking DESIGN.md's "meaning before colour" rule. The next rule in `artwork.css` puts opaque card-coloured patches behind section-heading links ("Your cards", "See areas") that read as stray boxes, worst on phone. Scene buttons use a ~12% tint, so artwork lines run through their labels.

**Read first:** DESIGN.md sections on artwork, glass and selected states; `.impeccable/surfaces/src-pages-dashboard-tsx.md`.

## File anchors

- `src/artwork.css` lines ~73–77 (`[data-artwork] :is(.smart-summary, .smart-nav, .list-tabs)` and the following section-heading/filter rule)
- `src/afterglow.css` `.list-tabs` and `.list-tabs button[aria-pressed="true"]` (~592–594); forced-colours rules at ~69 and ~165 already outline the pressed tab — keep them
- Scene buttons: find with `grep -rn "scene" src/components/HomePanels.tsx src/pages/Moods.tsx`
- Theme toggles: Settings → Appearance (`src/pages/UserSettings.tsx`, `src/components/CardArtworkSettings.tsx`)

## Checklist

- [ ] Reproduce with artwork on in all three places (Lists tabs, Smart home nav/summary, section-heading links) at 1440 × 2560 and 390 × 844; note which palettes make it worst.
- [ ] Give the selected tab a non-colour cue that survives artwork: primary-tinted fill distinct from `--art-surface` **and** semibold weight (or an inset indicator). Apply to `.list-tabs`, `.smart-nav` and `.calendar-segment` consistently.
- [ ] Remove per-label patches behind section-heading links; instead give the whole section heading row (or the section) one surface, or keep artwork out from behind headings via a single masked band.
- [ ] Scene buttons: add an opaque base under the tint in artwork mode so labels sit on a solid colour.
- [ ] Check contrast of selected/unselected text and the selected fill against `--art-surface` for all 12 palettes, light and dark (≥ 4.5:1 text, ≥ 3:1 for the selection indicator). Record the lowest values in a `> Contrast:` note.
- [ ] Verify forced colours and reduced transparency still show the selected state.
- [ ] Update DESIGN.md (artwork rules, selected-state rule).

## Acceptance

- With artwork on, a person can tell the selected list tab from 2 m without relying on hue.
- No isolated card-coloured boxes behind single links.
- No visual change with artwork off, apart from the shared selected-state weight if adopted everywhere.
