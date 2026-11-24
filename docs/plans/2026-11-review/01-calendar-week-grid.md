# 01 · Calendar week grid readability (P1)

[← Master plan](README.md) · Suggested Impeccable commands: `/impeccable layout`, then `/impeccable typeset`

**Problem:** On the 1440 × 2560 wall the week view (7 days × people) gives each day about 158 px. 20 px titles break mid-word ("Restav-fall"), each waste pickup takes a full event card, and the add row renders an icon-only "+" in every empty cell (dozens on screen). The calendar is the primary reading surface of the shared board.

**Read first:** `.impeccable/surfaces/src-pages-calendar-tsx.md`, DESIGN.md calendar sections, [docs/family-board-review.md](../../family-board-review.md) (previous measurements).

## File anchors

- `src/components/FamilyCalendar.tsx` — `family-week-table`, `week-member-column` (col), `week-person` (row header), `week-event-row`, `week-add-row` (around lines 48–75)
- `src/pages/calendar.css` — week table layout; `.calendar-month-count` uses `overflow-wrap: anywhere` (line ~50), check the week cells for the same
- `src/components/CalendarViews.tsx` — month/day views (keep consistent)
- `src/components/WasteCollection.tsx` — `WasteTypeIcons` (reuse for chips)
- Tests: `src/test/family-calendar.test.ts`, `src/test/calendar-plans.test.tsx`

## Checklist

- [x] Measure the current state at 1440 × 2560 and 390 × 844 (column widths, title font size, number of add buttons) and write the numbers in a `> Before:` note below this list.
- [x] Narrow the person column on wide/portrait layouts to the avatar (≈ 4rem) with the name as accessible label and tooltip; give the freed width to the day columns. Keep the full name on phone if it fits.
- [x] Stop mid-word breaking in week cells: replace `overflow-wrap: anywhere`/manual breaks with `hyphens: auto` plus a `lang` attribute from the active locale, and clamp long titles to two lines with ellipsis. Full title stays in the accessible name and the event dialog.
- [x] Render waste pickups in the week grid as a compact chip (icons from `WasteTypeIcons` + short label), not a full event card. Several fractions on the same day become one chip with several icons.
- [x] Replace the per-cell add row with one add affordance per person row (opens the editor with that person preselected, day chosen in the editor), or reveal the cell's "+" only on focus/hover/tap of the cell. Keyboard and screen-reader users must still reach "add on this day" (for example via the day header button).
- [x] Move the permanent "View and person filter apply to this screen only" hint into the calendar cog popover or show it once per screen (persist dismissal per screen, not shared).
- [x] Phone: verify "Today" and the selected "Day" segment are visually distinguishable (one is an action, one is a state). Give the selected segment the segment-selected style and keep "Today" as an outline/ghost button.

  > Done in code: "Today" is now a borderless ghost button in primary ink with a calendar-check icon and no pressed state; the selected segment keeps the shared filled segment style (its stronger non-colour cue belongs to [02](02-artwork-selected-states.md), which restyles `.calendar-segment` for every view switch). The on-screen look at 390 × 844 is part of the browser check below.
- [x] Unit tests: waste chip grouping per day; add affordance presence (one per person row) and that it passes the person to the editor; title clamping does not drop the accessible name.

  > Landed with each feature commit: `src/test/family-calendar.test.ts` (grouping per person and day), `src/test/family-week-grid.test.tsx` (chip rendering and collected state, one add per person row with person and default day, compact grid without add controls, full title as accessible name, table `lang`, row header names, popover note) and updated expectations in `src/test/ha-session.test.tsx` and `src/test/navigation.test.tsx`.
- [x] Browser check at both sizes, light/dark, artwork on and off; write the `> After:` numbers next to the `> Before:` note.

  > After (2026-11-24, merged `main`, Chrome, Norwegian, dark theme, five people; counts only, read-only on port 8081):
  > - **1440 × 2560**: person column 80px, day columns 175px, table 1302px with no sideways scroll. 5 add buttons, one per person row, none in day cells. Week titles use `hyphens: auto`, `overflow-wrap: normal`, table `lang="nb"`; no title exceeds two lines. One waste chip in the week, no cell with more than one.
  > - **390 × 844**: Today is a borderless, transparent button in primary ink with an icon; the selected Day segment is a filled primary capsule. The filter note is no longer on screen.
  >
  > Resolved in [13](13-final-verification.md): light/dark and artwork on/off were toggled in the page only (no settings saved) at both sizes; no overflow or sub-11px text. The 13 pass also found and fixed a phone week-grid overflow: screen-reader time labels escaped the scroller and widened the layout to 547px (`fix: keep the phone week grid inside its scroller`).
- [x] Update DESIGN.md (calendar section) and `.impeccable/surfaces/src-pages-calendar-tsx.md` with the new week-grid rules.

> Before (2026-11-24, `main` at 73ac4c7, Chrome, Norwegian, dark theme, five people in the grid; counts only):
> - **1440 × 2560** (root type 20px): person column 120px, day columns 169px, table 1302px with no sideways scroll. Event titles 20px on a 26px line, about 132px of text width in a one-day cell, clamped at four lines. 35 icon-only add buttons (5 people × 7 days), all on screen. 10 of 72 title words wrapped across lines; all at dictionary hyphenation points, but `overflow-wrap: break-word` would still split an unhyphenatable word anywhere. Each waste pickup used a full event card (3 cards).
> - **390 × 844** (root type 16px): opens on Day; `?view=week` scrolls sideways (332px viewport, 1008px table). Person column 120px with the name visible, day columns 127px, titles 15px, 35 add buttons. The permanent "apply to this screen only" note takes two lines under the filters. "Today" is a 44px outline capsule (1px border, dark fill) beside the selected "Day" segment, a 48px dark capsule with a soft shadow; in dark mode both read as dark pills.

## Acceptance

- No word in a week-cell title is broken without a real hyphenation point at 1440 × 2560.
- At most one visible add control per person row (plus header actions).
- Same-day waste pickups occupy one chip.
- Existing calendar tests pass; month, day and by-person views unchanged.
