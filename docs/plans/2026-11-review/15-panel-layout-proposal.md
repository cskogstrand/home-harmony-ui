# 15 · Panel widths and the wall's free space (proposal)

[← Master plan](README.md) · Answers the **Panel widths (proposal only)** box in [14](14-owner-additions.md) and the open owner question about the empty lower part of the wall · Written 2026-11-25 as an `/impeccable shape` brief

**Status: proposal for the owner to approve.** Nothing here is built. Code changes start only after the owner confirms the recommendation or corrects it (see [Open questions](#open-questions-for-the-owner)).

> Shape normally starts with a short interview. This brief was written by an agent with no way to ask, so it rests on the assumptions listed under [Assumptions](#assumptions) instead. Correct any of them and the recommendation may change.

## Summary

- **Model:** every section that can be narrow gets a **Width: Full | Half** choice in its own Customize Today card, next to the switch and arrows it already has. Consecutive half-width sections sit side by side in pairs, in section order. A small, inert **layout preview** at the top of the dialog shows the resulting rows. The order arrows keep working exactly as today.
- **Data:** two new optional fields under `dashboard`: a sparse `widths` record and a single `fill` choice. Old settings and backups load unchanged and produce today's board. Both fields travel in backups because they live in the shared settings.
- **Free space:** the owner may pick **one** list-like section to **fill the free space on the wall**. It grows down to the navigation and shows as many whole rows as fit. When Everyone's day grows or shrinks, only that panel changes height: everything above it stays at the top and everything below it stays at the bottom. Recommended filler: **Recent at home**, placed directly under Everyone's day. Off by default.

## Problem

Today is a stack of sections that the owner switches on or off and orders in **Customize Today** (`src/components/DashboardSettings.tsx`, `dashboard.order` and the per-section booleans in `shared/configuration.ts`, rendered by `src/pages/Dashboard.tsx`).

1. **Width is not a choice.** The board is a two-column grid, but almost every section forces `grid-column: 1 / -1` in CSS. The only pairing is implicit: adjacent list panels (Daily rhythm, Shopping, Homework) sit side by side because of `:has(+ .list-panel)` selectors in `src/afterglow.css`. Three adjacent lists leave a half-empty row. Recent at home always spans the full board (`activity-feed.css`), even though its rows are short.
2. **The wall's height is fixed and the content is not.** On the 1440 × 2560 portrait wall, the board has roughly 2,300 CSS px between the Today heading and the dock. Everyone's day ranges from about 450 px (a quiet day, tomorrow hidden) to about 1,000 px (busy day with tomorrow shown). The result is either an empty lower third or a board that scrolls past the dock.

A read-only check of the live wall layout on 2026-11-25 (heights only; no content recorded) shows both problems at once: with Recent at home on, the board ends about 350 px below the dock; Homework (≈330 px) and Recent at home (≈510 px) each take a full-width row. Placed side by side they would save one row of about 350 px, which is exactly the overflow.

### Constraints that shape the answer

- **Wall first, touch first.** The dialog is used standing at a mounted touchscreen. Targets stay at least 48 px; no precision drags inside a scrolling dialog.
- **Customize Today saves as you go.** There is no Save/Cancel; each change is shared across screens immediately and announced. New controls must behave the same way.
- **Some sections need the full board.** Everyone's day lays people out in columns; Everyone's week is a seven-day table with a 63 rem minimum; School already splits into two columns internally.
- **Some sections appear only sometimes.** Morning summary, Waste collection, Home status and School render nothing when they have nothing to say, even when switched on.
- **DESIGN.md rule:** "Don't shrink or hide task content to force a tall screen into one viewport." Any free-space answer must not trim tasks or plans to make things fit.
- **Phones stack.** Below 700 px the board is one column; nothing about widths may make a phone worse.

## Assumptions

Made without an interview; each is easy to reverse.

1. Two widths are enough: **Full** and **Half**. Thirds are not needed on a 1328 px wide board at the wall's 125 % reading scale (a third would be ≈430 px, too narrow for list rows with times).
2. The owner configures layout rarely and mostly for the wall; phones simply stack.
3. The owner prefers a predictable rule ("halves pair in order") over free placement.
4. Filling free space is wanted only on large screens; phones and laptops keep their natural lengths.

## Interaction models considered

### A · Width per section, automatic pairing (recommended)

Each eligible section card gets a two-option segment **Full | Half**. The board walks the section order; two half sections in a row form a pair; anything else is a full row. A small layout preview at the top of the dialog shows the rows.

| For | Against |
| --- | --- |
| One new control per card, in the place the owner already looks. Reuses the existing `calendar-segment` capsule (`aria-pressed` buttons), so it looks and behaves like Calendar settings. | Pairing is implicit: the owner must learn that two halves next to each other in the order become a row. The preview and a one-line placement hint on each card carry that. |
| Order arrows, focus return and the live announcement stay exactly as they are; moving a card changes its partner, and the announcement says so. | A section switched off between two halves does not break the pair, which can surprise; the preview shows it. |
| Large targets, no dragging; works the same with touch, keyboard and screen reader. | |
| Data model is order + width: no migration of `order`, and a future drag-and-drop editor can sit on the same data. | |
| Matches Smart home's **Arrange cards**, which already sets size per card inline. | |

### B · Explicit rows with up to two slots

The dialog shows rows. Each row holds one or two section cards; **Put beside previous** joins a section into the row above, **Own row** splits it out. Arrows move within a row or between rows.

| For | Against |
| --- | --- |
| What you see is what you get: pairs are explicit and survive reordering. | Two settings cards side by side do not fit a 580–725 px dialog: entity pickers, selects and switches would be squeezed to ≈330 px, and phones would need a different layout of the same dialog. |
| No surprise from hidden sections in between. | Arrows get two meanings (within row, across rows), harder to explain and to announce. |
| | `order` becomes nested (`(Section | [Section, Section])[]`): a real migration, and older app versions reject new backups in a less obvious way. |
| | More states to design: what a row means when one of its sections is off. |

### C · Drag-and-drop on a miniature board

The preview becomes the editor: drag a block onto the left or right half of another to pair it, drag it to an edge to make it full.

| For | Against |
| --- | --- |
| Direct and visual; fun on a big touchscreen. | Dragging inside a scrolling dialog fights scrolling on touch; needs long-press, edge auto-scroll and precise drop zones. |
| | Keyboard and screen-reader users need a complete second interface anyway (Smart home keeps arrows next to its drag handles for that reason), so C is always C + A. |
| | Most code and test surface for a setting changed a few times a year. |

### Recommendation

**A**, with the inert layout preview. It adds one familiar control per card, keeps the dialog single-column on every screen, and the arrows, switches and announcements keep their meaning. B's explicitness is real, but it costs a cramped dialog and a nested data model for a choice made rarely. C can be added later on top of A's data without migration if the owner misses it.

## How pairing works

1. Take `dashboard.order`.
2. Drop sections that are **switched off** in Customize Today. Do **not** drop sections that are switched on but have nothing to show right now (see rule 5); pairs are decided by configuration, not by today's content, so a quiet Home status cannot reshuffle every row below it.
3. Resolve each section's width: the owner's choice, else the default (Daily rhythm, Shopping and Homework default to Half so today's paired lists look the same; everything else defaults to Full). Sections that must be full (Everyone's day, Everyone's week, School) are always Full, whatever is stored.
4. Walk the list: a Half followed by a Half forms a pair; a Full is its own row; a **Half without a Half partner fills its row** (no half-empty row, no hole).
5. **Partner with nothing to show:** if one half of a pair renders nothing today (no pickups, no morning summary, nothing needs attention), the other half takes the full row. Only that row changes; rows above and below keep their pairs. If both are empty, the row disappears with its gap.
6. **Small screens:** a half is never narrower than about 22 rem. When the board is too narrow for two such halves (phones, 200 % zoom, narrow windows) every row stacks in order: left half first, then right.
7. **Row height:** both panels in a pair stretch to the taller one, so their bottom edges line up; content stays top-aligned. This matches Smart home, where Original cards fill the height of their row.

Example, for a chosen order with widths:

| Order (switched on) | Width | Row |
| --- | --- | --- |
| Next family plan | Half | 1 · left |
| Waste collection | Half | 1 · right (if no pickups today, Next family plan fills row 1) |
| Everyone's day | Full (fixed) | 2 |
| Recent at home | Half | 3 · left |
| Homework | Half | 3 · right |
| Home favorites | Half | 4 · fills the row: Shopping below is switched off, and there is no other half after it |

## Customize Today: the dialog

Additions only; everything not mentioned stays as built. Strings are shown in English with their Norwegian Bokmål translations in the [string table](#new-strings).

### Layout preview (top of the dialog)

An inert miniature of the board's rows on wide screens, under the description and above the section cards. Each block shows the section's icon and short name; half blocks sit side by side; a section that appears only sometimes has a dashed outline; the fill section (if any) shows a vertical double arrow and is drawn taller. Switched-off sections are not shown. The preview updates with every change. On dialogs taller than about 900 px (the wall) it sticks to the top of the scrolling body so the owner sees the effect of a width change further down; on phones it scrolls away with the content.

```
┌ ⚙ Customize Today ──────────────────────────────────────── ✕ ┐
│ Choose which sections appear, how wide they are and their     │
│ order. Changes are saved automatically and shared across      │
│ screens.                                                      │
│                                                               │
│ Layout on wide screens                                        │
│ ┌───────────────────────────┐ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐     │
│ │ ◷ Next family plan        │   ♻ Waste collection            │
│ └───────────────────────────┘ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘     │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ ☷ Everyone's day                                        │   │
│ └─────────────────────────────────────────────────────────┘   │
│ ┌───────────────────────────┐ ┌───────────────────────────┐   │
│ │ ⟲ Recent at home       ↕  │ │ ✎ Homework                │   │
│ │                           │ │                           │   │
│ └───────────────────────────┘ └───────────────────────────┘   │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ ⌂ Home favorites                                        │   │
│ └─────────────────────────────────────────────────────────┘   │
│ Dashed: appears only when it has something to show.           │
│ ─────────────────────────────────────────────────────────── │
│  (section cards, see below)                                   │
```

### A section card that can be half

The width segment appears on its own line below the heading row, only while the section is switched on (like the other nested options). Below it, one muted line names the result; it is also the segment's accessible description.

```
┌──────────────────────────────────────────────────────────────┐
│ ⟲ Recent at home                         (●━━)  [ ↑ ]  [ ↓ ]  │
│                                                              │
│ Width   ╭──────────────┬──────────────╮                      │
│         │ ▭  Full      │ ▯▯ Half  ✓   │                      │
│         ╰──────────────┴──────────────╯                      │
│ Beside Homework on wide screens.                             │
│                                                              │
│ Uses the sources and privacy choice from Settings → System → │
│ Activity. Choose sources                                     │
└──────────────────────────────────────────────────────────────┘
```

Placement lines, chosen by the pairing rule:

- Half with a partner: **Beside {name} on wide screens.**
- Half without a partner: **Fills its row: no half-width section next to it.**
- Full: no line (nothing to explain).
- Half, and the partner appears only sometimes: **Beside {name} on wide screens; fills the row when {name} is hidden.**

### A section that must be full

No segment, so nothing looks disabled; one muted line says why.

```
┌──────────────────────────────────────────────────────────────┐
│ ☷ Everyone's day                         (●━━)  [ ↑ ]  [ ↓ ]  │
│ Always full width: each person needs their own column.        │
│ Show summary button in Everyone's day                 (━━○)  │
│ Show tomorrow's plans                                 (●━━)  │
└──────────────────────────────────────────────────────────────┘
```

### Free space on the wall (new card after the section list)

One choice, so one control: a select, not a switch on every card (switches would have to turn each other off). Only sections that are switched on and can fill are offered.

```
┌──────────────────────────────────────────────────────────────┐
│ ↕ Free space on the wall                                     │
│                                                              │
│ Section that fills the space                                 │
│ ┌──────────────────────────────────────────────────────┐     │
│ │ Recent at home                                     ▾ │     │
│ └──────────────────────────────────────────────────────┘     │
│ On the large wall screen this section grows down to the      │
│ navigation and shows as many rows as fit. Other screens show │
│ its usual length.                                            │
└──────────────────────────────────────────────────────────────┘
        options: None (default) · Recent at home · Daily rhythm
                 · Shopping · Homework
```

If the chosen section is later switched off, the select keeps the choice and shows **Recent at home is hidden, so nothing fills the space.** rather than silently clearing it.

### Bottom of the dialog

**Reset section order** becomes **Reset order and widths**: it restores the default order and default widths, and leaves visibility, the fill choice and every section's own options alone. It stays disabled while both already match the defaults.

## The wall: 1440 × 2560 portrait

The board's width is 1328 CSS px with a 1 rem (20 px) gap at the wall's 125 % reading scale, so a half is ≈654 px. Sketches use 1 line ≈ 100 px and generic placeholders.

### Free space with a fill section

When a fill section is chosen and the screen is the large portrait wall, the board is exactly as tall as the space between the Today heading and the dock (the shell already measures the dock in `--app-dock-height`). Every row keeps its natural height except the fill row, which takes what is left, down to a minimum of its heading plus three rows. The fill panel then shows as many **whole** rows as fit and points to the rest through its existing heading link (**All activity**, **Open in Lists**).

The fill row's height comes from layout, never from its own content, so there is no measuring loop: the panel renders up to a cap (for example 20 rows), measures which rows end inside its box, and hides the rest.

**Why nothing jumps:** with the fill row directly under Everyone's day, everything above the fill row is anchored to the top and everything below it is anchored to the dock. When Everyone's day grows by one plan, the fill panel loses a row at its bottom; Home favorites, the controls the family touches most, stay exactly where hands expect them. The same absorption covers a notification appearing at the top of the board.

```
 Quiet day (Day ≈ 450 px)              Busy day, tomorrow shown (Day ≈ 1000 px)
┌──────────────────────────────────┐   ┌──────────────────────────────────┐
│ Today  ⚙         08:00   ☀ 4°    │   │ Today  ⚙         08:00   ☀ 4°    │
│ Wednesday 1 January              │   │ Wednesday 1 January              │
├────────────────┬─────────────────┤   ├────────────────┬─────────────────┤
│ Next plan      │ Waste           │   │ Next plan      │ Waste           │
│ Example plan   │ Paper · in 2 d  │   │ Example plan   │ Paper · in 2 d  │
├────────────────┴─────────────────┤   ├────────────────┴─────────────────┤
│ Everyone's day                   │   │ Everyone's day                   │
│  (A)    (B)    (C)    (D)        │   │  (A)    (B)    (C)    (D)        │
│  plan   plan   free   plan       │   │  plan   plan   plan   plan       │
├────────────────┬─────────────────┤   │  plan   plan   plan   plan       │
│ Recent at home↕│ Homework        │   │ Tomorrow                         │
│ · Door closed  │ (B) Reading     │   │  plan   plan   plan   plan       │
│ · Washer done  │ (C) Maths p. 12 │   │  plan          plan              │
│ · Lamp on      │                 │   │                                  │
│ · Door opened  │                 │   ├────────────────┬─────────────────┤
│ · Vacuum docked│                 │   │ Recent at home↕│ Homework        │
│ · Window shut  │                 │   │ · Door closed  │ (B) Reading     │
│ · Lamp off     │                 │   │ · Washer done  │ (C) Maths p. 12 │
│ · Door closed  │                 │   │ · Lamp on      │                 │
│ · Lock locked  │                 │   │      All activity ›              │
│      All activity ›              │   ├────────────────┴─────────────────┤
├────────────────┴─────────────────┤   │ Home favorites   (same position) │
│ Home favorites   (same position) │   │ [Lamp] [Heat] [Scene] [Scene]    │
│ [Lamp] [Heat] [Scene] [Scene]    │   │                                  │
╞══════════════════════════════════╡   ╞══════════════════════════════════╡
│  Today  Calendar  Lists  School  │   │  Today  Calendar  Lists  School  │
└──────────────────────────────────┘   └──────────────────────────────────┘
```

Behaviour details:

- Rows are added or removed only at the fill panel's bottom; rows above never move inside it. With motion allowed, a row that appears fades in over 160 ms; with reduced motion it simply appears.
- The newest event stays at the top of Recent at home, so the trimmed rows are always the oldest.
- If the fixed sections alone are taller than the wall (an unusually busy day), the fill panel falls back to its normal length (six rows for Recent at home, three items for lists) and the board scrolls as it does today. Nothing else is shortened.
- The fill section may be Half. Its partner stretches to the same height (rule 7), so both columns end on one line above the dock.
- Without a fill choice, the wall behaves as today: natural heights, empty space or scrolling.

### Without a fill section

Same pairing, natural heights. Free space stays empty; that is a valid, calm choice and remains the default.

### Recommended answer to the owner's question

Fill the wall's free space with **Recent at home**, at half width beside Homework (or full width if Homework is off), placed directly **under Everyone's day**. Reasons:

- It is useful at any length and newest-first, so trimming loses only old, harmless rows.
- It is not a task list. Growing or trimming it never hides something the family must do, which keeps the DESIGN.md rule intact.
- Placed under Everyone's day, it absorbs that panel's daily swings, and everything below it (favorites, close to the dock) stays put.

Other fillers considered: stretching Everyone's day (empty space inside a panel, nothing gained); larger favorites (controls should not resize with the calendar); decorative artwork (no information); leaving it empty (calm and valid, kept as the default). A future **Coming up** list of the next plans after Next family plan would be the strongest calendar-led filler, but it is a new section and outside this proposal.

### Wide landscape (≥1100 px, landscape)

The six-track board keeps working: a full row spans six tracks, a half spans three. Today's special arrangement where Everyone's week takes four tracks with lists stacked beside it relies on sibling selectors that row wrappers break. Proposal: retire it in favour of the same rows (the wall is portrait; landscape is secondary). See open question 4.

## Phone (390 × 844) and narrow screens

Widths and fill are ignored: one column, configured order, left half before right half. The dialog shows the same controls; the preview is labeled **Layout on wide screens** so a width change made on the phone is clearly for the wall.

```
┌────────────────────────┐
│ Today ⚙                │
│ 08:00  ☀ 4°            │
├────────────────────────┤
│ Next family plan       │
├────────────────────────┤
│ Waste collection       │
├────────────────────────┤
│ Everyone's day         │
│ Today                  │
│ (A) plan · plan        │
│ (B) plan               │
│ Free today: (C)        │
│ ▸ Tomorrow · 3 plans   │
├────────────────────────┤
│ Recent at home         │
│ (usual six rows)       │
├────────────────────────┤
│ Homework               │
├────────────────────────┤
│ Home favorites         │
╞════════════════════════╡
│ Dock                   │
└────────────────────────┘
```

Tablets in portrait (700–999 px) show pairs when each half is at least about 22 rem wide; otherwise they stack like phones. The fill section applies only to the large portrait wall (≥1000 px wide, ≥1400 px tall, portrait), the same query that already sets the wall's reading scale.

## Data model

Two optional fields inside the existing `dashboard` object. No change to `order`, no version bump.

```ts
// shared/configuration.ts (sketch)
export const dashboardWidths = ["full", "half"] as const;
export type DashboardWidth = typeof dashboardWidths[number];

/** Sections that always span the board: person columns, the week table, school's two columns. */
export const fullWidthSections = ["day", "week", "school"] as const satisfies readonly DashboardSection[];

/** Defaults reproduce the built board, where adjacent list panels already pair. */
export const defaultDashboardWidths: Partial<Record<DashboardSection, DashboardWidth>> = {
  daily: "half", shopping: "half", homework: "half",
};

/** List-like sections that can fill the wall's free space by showing more rows. */
export const fillSections = ["recentActivity", "daily", "shopping", "homework"] as const satisfies readonly DashboardSection[];

dashboard: z.object({
  order: /* unchanged */,
  // …existing visibility booleans and options unchanged…
  /** Only the owner's explicit choices; a missing key uses defaultDashboardWidths, then "full". */
  widths: z.partialRecord(z.enum(dashboardSections), z.enum(dashboardWidths)).default({}),
  /** One section that fills the wall's free space, or none. */
  fill: z.union([z.enum(fillSections), z.literal("")]).default(""),
}).strict().prefault({}),
```

One pure helper, shared by the board, the dialog's preview and placement lines, and tests:

```ts
export type DashboardRow = { sections: [DashboardSection] | [DashboardSection, DashboardSection]; fill: boolean };

export function dashboardWidth(dashboard: Planner["dashboard"], key: DashboardSection): DashboardWidth {
  if ((fullWidthSections as readonly string[]).includes(key)) return "full";
  return dashboard.widths[key] ?? defaultDashboardWidths[key] ?? "full";
}

/** Pairs consecutive half sections among those switched on, in order. Runtime emptiness is not considered. */
export function dashboardRows(dashboard: Planner["dashboard"]): DashboardRow[] {
  const rows: DashboardRow[] = [];
  let pending: DashboardSection | undefined;
  const push = (sections: DashboardRow["sections"]) =>
    rows.push({ sections, fill: sections.some(key => key === dashboard.fill) });
  for (const key of dashboard.order.filter(key => dashboard[key])) {
    if (dashboardWidth(dashboard, key) === "full") {
      if (pending) push([pending]);
      pending = undefined;
      push([key]);
    } else if (pending) { push([pending, key]); pending = undefined; }
    else pending = key;
  }
  if (pending) push([pending]);
  return rows;
}
```

Why a sparse record and a single `fill` value:

- **Backward compatible.** Settings and backups without `widths` or `fill` parse to `{}` and `""`, which reproduce today's board (lists half, everything else full, nothing fills). `order` and the visibility booleans keep their meaning, so the existing reorder and reset code is untouched.
- **Robust.** A stored `"half"` for a section that must be full is accepted and ignored by `dashboardWidth`, so changing `fullWidthSections` later never makes an old backup invalid. Unknown section names are rejected by the enum, as they are in `order`.
- **One fill.** A single value cannot express two competing fill panels.
- **Backups.** `dashboard` is part of `settings`, which `configurationSchema` exports and restores as a whole; nothing extra is needed. Add a round-trip test.
- **Sync.** Writes go through the existing `setDashboard` patch, so changes save automatically, show the shared-settings status and recover from conflicts like the switches do.

## Board structure (implementation intent)

- `Dashboard.tsx` renders `dashboardRows(dashboard)` as row wrappers (`<div class="board-row" data-columns="1|2" data-fill>`), each containing its section nodes in order. Sections keep their own landmarks and labels; the wrapper has no role.
- CSS: a row is a two-column grid when it has two sections and the board is wide enough (container query on the board, half ≥ 22 rem), otherwise one column. `.board-row > :only-child` spans the row (rule 5); `.board-row:empty` is not displayed (both partners empty). Panels stretch to the row height.
- On the large portrait wall with a fill choice, the board becomes a column whose minimum height is the viewport minus the header and `--app-dock-height` clearance; the fill row grows (`flex: 1 1 0`) with a minimum of heading + three rows.
- The fill panel gets a `fill` prop: it requests more items than usual (Recent at home asks the logbook for up to 20 instead of `RECENT_ACTIVITY_LIMIT`), observes its own size with `ResizeObserver`, and hides rows that end below its box.
- Remove the old implicit rules (`.portrait-board > .list-panel:has(+ .list-panel)`, `.portrait-board > .activity-panel { grid-column: 1 / -1 }`, the landscape week/list sibling rules) and the `col-span-full` classes that only existed to force full width.

## Accessibility

- **Width segment:** a labeled group (`role="group"`, name **Width for {section}**) of two `aria-pressed` buttons, the same pattern and styling as Calendar's segments, including the artwork, increased-contrast and forced-colors outlines. Each option has an icon and a word, so width is never shown by shape alone. Targets are at least 48 px on the wall.
- **Placement line** is the segment's `aria-describedby`, so a screen-reader user hears the result ("Beside Homework on wide screens") without the visual preview.
- **Announcements:** the existing polite live region also announces width changes ("Recent at home: half width, beside Homework.") and extends the move announcement when a move changes a partner ("Moved Recent at home to position 7 of 12. Now beside Homework."). Focus stays on the pressed option after a width change and on the arrow after a move, as today.
- **Preview** is `aria-hidden` and not interactive in v1; the per-card lines carry the same information in text. Dashed outlines for conditional sections use `CanvasText` in forced colors.
- **Reading order** on the board equals the configured order (left half, then right half), in the DOM and visually, on every width.
- **Zoom and large text:** at 200 % zoom the halves fall below 22 rem and stack, like a phone; nothing truncates.
- **Fill panel:** hidden rows are removed from the accessibility tree too (not just clipped), and the heading link to the full list stays reachable. Reduced motion removes the row fade.
- **Fill select** is a native labeled `<select>` with a describing paragraph, like the existing Look ahead and Homework selects.

## Migration and compatibility

- No configuration version change. Missing fields default as described; the board renders as today, with one deliberate difference: three adjacent list panels now show as a pair plus a full-width third instead of leaving a half-empty row.
- `dashboard` is `.strict()`. As with earlier additions such as `recentActivity`, a backup made after this change cannot be restored into an older app version. Note it in the release notes.
- The server validates with the same shared schema, so server and client must ship together (they already do).
- Docs to update when built: DESIGN.md (Layout: "major sections span both" becomes the pairing rule; Cards and containers: the width segment; the Recent at home paragraph that says it always spans the board), `.impeccable/surfaces/src-pages-dashboard-tsx.md` (same Recent at home line), README.md and PRODUCT.md where Customize Today is described, DOCS.md only if it describes Today's layout.

## New strings

| English | Norsk bokmål |
| --- | --- |
| Width | Bredde |
| Width for {name} | Bredde for {name} |
| Full | Full |
| Half | Halv |
| Layout on wide screens | Oppsett på store skjermer |
| Dashed: appears only when it has something to show. | Stiplet: vises bare når den har noe å vise. |
| Beside {name} on wide screens. | Ved siden av {name} på store skjermer. |
| Beside {name} on wide screens; fills the row when {name} is hidden. | Ved siden av {name} på store skjermer; fyller raden når {name} er skjult. |
| Fills its row: no half-width section next to it. | Fyller raden: ingen halv seksjon ved siden av. |
| Always full width: each person needs their own column. | Alltid full bredde: hver person trenger sin egen kolonne. |
| Always full width: the week needs room for seven days. | Alltid full bredde: uka trenger plass til sju dager. |
| Always full width: timetables sit side by side. | Alltid full bredde: timeplanene står side om side. |
| {name}: half width, beside {partner}. | {name}: halv bredde, ved siden av {partner}. |
| {name}: full width. | {name}: full bredde. |
| Now beside {name}. | Nå ved siden av {name}. |
| Free space on the wall | Ledig plass på veggen |
| Section that fills the space | Seksjon som fyller plassen |
| None | Ingen |
| On the large wall screen this section grows down to the navigation and shows as many rows as fit. Other screens show its usual length. | På den store veggskjermen vokser denne seksjonen ned til navigasjonen og viser så mange rader som får plass. Andre skjermer viser vanlig lengde. |
| {name} is hidden, so nothing fills the space. | {name} er skjult, så ingenting fyller plassen. |
| Reset order and widths | Tilbakestill rekkefølge og bredder |

Verify the Bokmål wording against the existing tone in `src/locales/nb.ts` when building.

## Implementation checklist (after the owner approves)

- [ ] Schema: add `widths` and `fill` to `dashboard` in `shared/configuration.ts` with the constants above; export `dashboardWidth` and `dashboardRows`.
- [ ] Tests (`src/test/shared-configuration.test.ts`): old settings parse to `{}` / `""`; a backup round-trip keeps `widths` and `fill`; invalid widths, unknown sections and a non-fill `fill` are rejected; a stored half for a full-only section is accepted and resolved as full.
- [ ] Tests for `dashboardRows`: defaults reproduce today's pairs; a lone half fills its row; a switched-off section between two halves does not break the pair; a full section between halves splits them; fill marks the right row.
- [ ] Board: render rows from `dashboardRows` in `Dashboard.tsx`; replace the implicit list/activity/landscape CSS and the `col-span-full` width hacks; pairs stretch; `:only-child` spans; empty rows vanish; container-query stacking below 22 rem halves.
- [ ] Fill: wall-only flex column sized from the viewport and `--app-dock-height`; fill row grows with a minimum; `fill` prop on `RecentActivity` and `ListPanel` that over-fetches, measures with `ResizeObserver` and hides overflow rows (removed from the accessibility tree); fallback to the normal length when there is no room.
- [ ] Unit-test the fit logic with mocked geometry (rows that end inside the box are shown, the rest hidden; no loop when content changes).
- [ ] Dialog: width segment and placement line on eligible cards (only while switched on); fixed-width note on Everyone's day, Everyone's week and School; **Free space on the wall** card; **Reset order and widths**; announcements for width changes and changed partners.
- [ ] Dialog preview: inert miniature of `dashboardRows`, dashed conditional sections, fill marker; sticky only on tall dialogs.
- [ ] Tests (`DashboardSettings`): segment group name and `aria-pressed`; description text for each placement case; announcement after a width change and after a move that changes a partner; reset restores order and widths only.
- [ ] i18n: every new string in `src/locales/en.ts` and `src/locales/nb.ts`.
- [ ] Browser checks with fictional fixtures only (the dev server on 8081 is a real home: read-only): 1440 × 2560 light and dark, with and without a fill section, quiet and busy Everyone's day; 390 × 844; 768 × 1024; 200 % zoom; compact mode; artwork on; reduced motion; forced colors.
- [ ] Docs: DESIGN.md, the Today surface brief, README.md and PRODUCT.md as listed under migration.
- [ ] Tick the **Panel widths** box in [14](14-owner-additions.md) and record the owner's answers below.

## Open questions for the owner

1. **Model A?** Width per section with automatic pairing and a preview, rather than explicit rows or drag-and-drop.
2. **Full-only sections:** Everyone's day, Everyone's week and School. Should Home favorites or Next family plan also be locked to full width, or is half fine for them?
3. **Fill the free space with Recent at home, under Everyone's day?** Or leave the space empty (the default), or wait for a **Coming up** list of the next plans?
4. **Landscape screens:** OK to retire the special landscape layout where the week sits beside stacked lists, in favour of the same rows?
5. **Uneven pairs:** both panels in a pair stretch to the same height (aligned bottom edges, some empty card space in the shorter one). Preferred, or should the shorter panel keep its own height with the page background showing below it?
