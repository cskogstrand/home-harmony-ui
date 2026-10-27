---
version: 1
slug: "src-pages-calendar-tsx"
primary_target: "src/pages/Calendar.tsx"
related_targets: ["src/pages/calendar.css","src/components/FamilyCalendar.tsx","src/components/CalendarViews.tsx"]
---

# Calendar

Mode: Operate. Extend the existing calendar in Afterglow's visual system.

## Direction contract

THESIS: A family calendar with month, week and day views, keeping daily planning and people easy to scan.

OWN-WORLD: Inherit Afterglow's pearl and midnight palette, system type, capsule controls and glass popovers over opaque calendar content. Person colors retain their meaning.

STORY: Switch the visible period, move backward or forward, jump to a date or return to today. Open a date for its agenda, filter people and open existing events with the shared editor. Keep the family week grid and its optional person layout.

FIRST VIEWPORT: Calendar heading and Add a plan action above a compact toolbar. Date navigation leads, month/week/day segments follow, then person filters. A seven-column month grid shows short event previews on wide screens and readable day counts on phones. Tapping a day opens a chronological agenda with all-day events separated from timed plans.

FORM: Local extension, code-led; no concept roll required. Week is the default. URL state preserves view and date; shared dashboard layout preferences keep their existing purpose. Include loading, unavailable and empty states, keyboard focus, English/Norwegian, both themes and portrait/phone sizing.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
