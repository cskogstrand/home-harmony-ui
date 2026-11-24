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
- [ ] Stop mid-word breaking in week cells: replace `overflow-wrap: anywhere`/manual breaks with `hyphens: auto` plus a `lang` attribute from the active locale, and clamp long titles to two lines with ellipsis. Full title stays in the accessible name and the event dialog.
- [ ] Render waste pickups in the week grid as a compact chip (icons from `WasteTypeIcons` + short label), not a full event card. Several fractions on the same day become one chip with several icons.
- [ ] Replace the per-cell add row with one add affordance per person row (opens the editor with that person preselected, day chosen in the editor), or reveal the cell's "+" only on focus/hover/tap of the cell. Keyboard and screen-reader users must still reach "add on this day" (for example via the day header button).
- [ ] Move the permanent "View and person filter apply to this screen only" hint into the calendar cog popover or show it once per screen (persist dismissal per screen, not shared).
- [ ] Phone: verify "Today" and the selected "Day" segment are visually distinguishable (one is an action, one is a state). Give the selected segment the segment-selected style and keep "Today" as an outline/ghost button.
- [ ] Unit tests: waste chip grouping per day; add affordance presence (one per person row) and that it passes the person to the editor; title clamping does not drop the accessible name.
- [ ] Browser check at both sizes, light/dark, artwork on and off; write the `> After:` numbers next to the `> Before:` note.
- [ ] Update DESIGN.md (calendar section) and `.impeccable/surfaces/src-pages-calendar-tsx.md` with the new week-grid rules.

> Before (2026-11-24, `main` at 73ac4c7, Chrome, Norwegian, dark theme, five people in the grid; counts only):
> - **1440 × 2560** (root type 20px): person column 120px, day columns 169px, table 1302px with no sideways scroll. Event titles 20px on a 26px line, about 132px of text width in a one-day cell, clamped at four lines. 35 icon-only add buttons (5 people × 7 days), all on screen. 10 of 72 title words wrapped across lines; all at dictionary hyphenation points, but `overflow-wrap: break-word` would still split an unhyphenatable word anywhere. Each waste pickup used a full event card (3 cards).
> - **390 × 844** (root type 16px): opens on Day; `?view=week` scrolls sideways (332px viewport, 1008px table). Person column 120px with the name visible, day columns 127px, titles 15px, 35 add buttons. The permanent "apply to this screen only" note takes two lines under the filters. "Today" is a 44px outline capsule (1px border, dark fill) beside the selected "Day" segment, a 48px dark capsule with a soft shadow; in dark mode both read as dark pills.

## Acceptance

- No word in a week-cell title is broken without a real hyphenation point at 1440 × 2560.
- At most one visible add control per person row (plus header actions).
- Same-day waste pickups occupy one chip.
- Existing calendar tests pass; month, day and by-person views unchanged.
