# 14 · Owner additions after the re-critique

[← Master plan](README.md) · Requested by the owner on 2026-11-25

## Checklist

- [x] **Header clock and weather:** outside Today, the clock and current weather sit in the header so the time is always visible. Today keeps its large ambient clock.
  > Done 2026-11-25: outside Today the clock (with a short date on wide screens) replaces the wordmark as the home link; weather set to "Beside the clock" follows it. Checked live on /calendar.
- [x] **Sticky header:** the header (clock, weather, quick buttons) stays visible while the page scrolls, on the wall and on phones, without covering content or focus.
  > Done 2026-11-25: sticky under the safe area; a reading surface fades in once the page scrolls; scroll padding keeps focus and anchors clear. Checked live at 390 × 844 (no overflow, surface covers content) and 1440 × 2560 (100px header).
- [x] **Weekend shading:** Saturday and Sunday get a faint background in Everyone's day and in the calendar views (week, month, day where it applies). Not colour-only meaning; today's marker keeps priority.
  > Done 2026-11-25 (Quiet Weekend Rule): `data-weekend` from the home calendar day in Everyone's day (board and phone agenda), week grid, month and week ribbons; today keeps priority in all 12 palettes. Checked live in the week grid.
- [x] **List tab icons:** list tabs show an icon per list type (shopping, tasks, homework), the same icons the list headings use.
  > Done 2026-11-25: each tab shows its list type's glyph (or the card illustration when artwork is on for that list); unknown types fall back to a neutral list icon.
- [x] **Panel widths (proposal only):** how Customize Today could let the owner place two panels side by side (for example Recent at home at half width). Written as a shape brief for the owner to approve before any build.
  > Proposal: [15](15-panel-layout-proposal.md), approved 2026-11-25. Implementation tracked by the box below.
- [ ] **Panel widths and wall fill (build):** implement [15](15-panel-layout-proposal.md) as approved.
- [ ] **Border radius across the app:** nested surfaces follow one concentric rule (inner radius = outer radius − inset, never larger than the container's), selected pills inside containers included. Example from the owner: the selected list tab capsule inside its container on Lists.
