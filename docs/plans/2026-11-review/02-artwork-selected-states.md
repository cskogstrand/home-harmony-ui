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

- [x] Reproduce with artwork on in all three places (Lists tabs, Smart home nav/summary, section-heading links) at 1440 × 2560 and 390 × 844; note which palettes make it worst.

  > Findings (2026-11-24, read-only dev page plus a static harness built from `vite build` with fictional markup, all 12 palettes × light/dark): with artwork on, the selected list tab's fill equals the container (`--art-surface`), a 1.00:1 difference in every palette, at the same 400 weight. Only the label hue differs: selected vs unselected label luminance is 1.00:1 in Slate light and Sage dark, 1.01:1 in Rose light and Mist/Rose/Seafoam dark, at most 1.20:1 (Olive light). Slate light and the dark Sage/Seafoam/Mist/Rose palettes are worst. Calendar segments (translucent container, no artwork rule) separate by 1.12–1.21:1 at equal weight; Smart home nav already uses 600 weight but its fill separates by only 1.19–1.38:1. `.smart-summary` has no markup anymore. On Smart home the "Your cards" title, "View areas" link and unselected area filters each get their own card-coloured patch with a 4 px spread, which reads as stray boxes on phone. Scene tiles (`.scene-buttons button` at 60 % secondary, `.dg-scene-action` at 12 % primary over the translucent card) let artwork lines through behind the labels.
- [x] Give the selected tab a non-colour cue that survives artwork: primary-tinted fill distinct from `--art-surface` **and** semibold weight (or an inset indicator). Apply to `.list-tabs`, `.smart-nav` and `.calendar-segment` consistently.

  > Done: selected list tabs and calendar segments now use semibold labels everywhere (Smart home nav already did). With artwork on, all three use the solid primary fill with primary-foreground text, the same treatment as selected filters, and calendar segments get the opaque `--art-surface` container like the other two. The dead `.smart-summary` selector is gone.
- [x] Remove per-label patches behind section-heading links; instead give the whole section heading row (or the section) one surface, or keep artwork out from behind headings via a single masked band.

  > Done: the Smart home section heading row (title, View areas, Add card) shares one `--art-surface` band with field corners. Unselected filter pills keep an opaque fill of their own, without the 4 px spread that made them look like boxes.
- [x] Scene buttons: add an opaque base under the tint in artwork mode so labels sit on a solid colour.

  > Done: with artwork on, the super compact scene action (Today favorites, Smart home) mixes its 12 % / 22 % hover primary tint into the opaque card colour instead of the translucent glass card. The `/moods` pills already sit inside an opaque `glow-panel`, so they are unchanged (workstream 06 replaces them with the same tile).
- [x] Check contrast of selected/unselected text and the selected fill against `--art-surface` for all 12 palettes, light and dark (≥ 4.5:1 text, ≥ 3:1 for the selection indicator). Record the lowest values in a `> Contrast:` note.

  > Contrast (WCAG ratios measured from computed colours in the built CSS, artwork on, all 12 palettes × light/dark; list tabs, calendar segments and Smart home nav give identical values): selected label on primary fill ≥ 6.30:1 (Honey light; dark ≥ 8.09:1, Pearl). Unselected label on `--art-surface` ≥ 5.53:1 (Olive light; dark ≥ 7.93:1, Lavender). Selected fill against `--art-surface` ≥ 6.19:1 (Honey light; dark ≥ 8.11:1, Rose). Section-heading links ≥ 6.19:1, unselected filter pills ≥ 5.53:1, scene action labels on the new opaque base ≥ 10.21:1 (Olive dark). Before the change the selected fill was 1.00:1 everywhere.
- [x] Verify forced colours and reduced transparency still show the selected state.

  > Verified in the built CSS by applying each media block's rules (light and dark): forced colours and increased contrast outline the selected list tab, calendar segment and Smart home link (the nav link was missing from both outline rules and is now included) and keep the 600 weight; reduced transparency hides the artwork and keeps the primary fill plus 600 weight. Unselected items get no outline.
- [x] Update DESIGN.md (artwork rules, selected-state rule).

## Acceptance

- With artwork on, a person can tell the selected list tab from 2 m without relying on hue.
- No isolated card-coloured boxes behind single links.
- No visual change with artwork off, apart from the shared selected-state weight if adopted everywhere.
