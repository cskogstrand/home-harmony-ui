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
- [x] **Panel widths and wall fill (build):** implement [15](15-panel-layout-proposal.md) as approved.
  > Done 2026-11-25: Full | Half per section with automatic pairing and equal-height pairs, a row preview, "Free space on the wall" (off by default) and no separate landscape layout. Unit-tested with mocked geometry; not yet seen on the live wall.
- [x] **Border radius across the app:** nested surfaces follow one concentric rule (inner radius = outer radius − inset, never larger than the container's), selected pills inside containers included. Example from the owner: the selected list tab capsule inside its container on Lists.
  > Done 2026-11-25 (The Concentric Radius Rule, `--radius-nested` per container, contract test `concentric-radius.test.ts`): list tabs and Smart home navigation are capsule tracks again, plus settings rows, timetable days, menus, vehicle tabs, tab triggers, switch thumb and calendar chips. Left: shared icon buttons are 44 × 48 ovals on phones; the Sonos mini player was not measured (nothing was playing).
- [x] **Card artwork and icon for every Today section:** Recent at home gets an icon and card illustration in Settings → Appearance → Card artwork; audit every other Today section for the same gap. Keeping this complete is a standing rule (AGENTS.md and DESIGN.md) and is enforced by a test, so new or changed Today sections cannot ship without it.
  > Done 2026-11-25: Recent at home and Home status were missing artwork; both now have an icon, illustration, scene and switch. `src/test/today-section-artwork.test.tsx` fails for any Today section without them; the rule is in DESIGN.md (Every Section Illustrated Rule) and AGENTS.md (Standing rules). Not yet seen live with artwork on.
- [x] **Rename Recent at home:** call the panel "Siste hendelser" in Bokmål (English "Latest events") everywhere: panel, Customize Today, Settings → System → Activity, docs.
  > Done 2026-11-25: "Latest events" / "Siste hendelser" everywhere; the section id `recentActivity` and stored fields are unchanged.
- [x] **Only real changes in the activity feed:** a row appears only when a sensor's value actually changed (no repeats of the same state, no unavailable/unknown round trips), and repeats of the same entity fold into one line. Different sensors stay apart: the owner decided (2026-11-25) that the door's position is named whenever it is available (for example "Dør (fører foran)", "Ladeluke"), never collapsed to a bare "Dør".
  > Done 2026-11-25: a row needs a stable state that differs from the entity's previous stable state (transitions and unavailable round trips are skipped); only one entity's flapping folds. Door positions are named ("Dør (fører foran)", "Ladeluke", "Dører"). Checked live on the wall.
- [x] **Event filter:** the owner chooses which events appear in Latest events (Today and Smart home) and in the All activity log; the log can temporarily show everything without changing the saved filter. People stay opt-in.
  > Done 2026-11-25: Settings → System → Activity → Event types hides types in both the panel and the log; the log offers "Show all events" as a local, per-visit view switch. People stay opt-in. The settings card was not opened live.
- [x] **Activity sources at a glance:** in Settings → System → Activity → Latest events, the chosen sources are easy to see (which are selected, how many, and what each is) without opening the picker.
  > Done 2026-11-25: chosen sources are listed under the picker, grouped by event type with counts, icon, name, area and a remove button; hidden types and unavailable sources are marked; the shared picker gains a "Selected" view and per-device counts.
- [x] **Phone icon buttons:** shared icon buttons are 48 × 48 on phones so focus and hover shapes are circles, not 44 × 48 ovals.
  > Done 2026-11-25 (Round Icon Rule, `icon-button-size.test.ts`): shared icon buttons are 48 × 48 on phones and desktop; no row overflowed on 21 routes at 390 × 844 and 11 at 375 × 812.
- [x] **Sonos mini player radius:** the artwork and controls sit concentrically in the mini player capsule (measured with fictional playback, not the live system).
  > Done 2026-11-25: artwork, expand button, next-track button and room picker sit within 1px of their capsule-end centres at every width, measured with fictional playback. Not seen with real music.
- [x] **Remaining English names:** names Home Assistant leaves untranslated (for example a charge port, "Mode", "Relative humidity threshold min", "Electricity consumption summary") read in Bokmål where a sensible translation exists.
  > Done 2026-11-25: names built from generic Bokmål words when every word is known ("Luftfuktighet (nedre grense)", "Modus", "Ladeportlås"); Home Assistant's own translations still win and owner-named helpers, templates and scripts are never changed. Still English by design: vendor terms, internal codes, settings/diagnostic entities and names with unknown words.
