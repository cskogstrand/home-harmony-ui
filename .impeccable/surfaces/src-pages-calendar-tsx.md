---
version: 1
slug: "src-pages-calendar-tsx"
primary_target: "src/pages/Calendar.tsx"
related_targets: ["src/pages/calendar.css","src/components/FamilyCalendar.tsx","src/components/CalendarViews.tsx"]
---

# Calendar

Mode: Operate. Extend the existing calendar in Afterglow's visual system. Shared event buttons and month event entries use 12px corners; outer panels remain 24px.

## Direction contract

THESIS: A family calendar with month, week and day views, keeping daily planning and people easy to scan.

OWN-WORLD: Inherit Afterglow's pearl and midnight palette, system type, capsule controls and glass popovers over opaque calendar content. Person colors retain their meaning.

STORY: Switch the visible period, move backward or forward, jump to a date or return to today. Open a date for its agenda, filter people and open existing events with the shared editor. Keep the family week grid and its optional person layout.

FIRST VIEWPORT: Calendar heading and Add a plan action above a compact toolbar. Date navigation leads, month/week/day segments follow, then person filters. A seven-column month grid shows short event previews on wide screens and readable day counts on phones. Tapping a day opens a chronological agenda with all-day events separated from timed plans.

WEEK GRID: Days get the width. From 700px the person column is a 4rem avatar column; the name stays as the row header's accessible name and a tooltip, and phones keep it visible. Titles break only between words or at hyphenation points in the table's `lang` (the active app language), never anywhere, and clamp at two lines (three on the portrait wall) with an ellipsis; the full title stays in the accessible name and the dialog. A person's same-day waste pickups share one compact, person-tinted capsule chip with every fraction's icon and a short label; on the portrait wall the label wraps below the icons instead of being cut. Each person row has one add button beneath the avatar (person preselected, day chosen in the editor); adding on a specific day goes through the day header and that day's Add a plan. The "filters apply to this screen only" note lives in the week settings popover. Today is a borderless primary-ink action with an icon, never styled like the selected view segment. Weekend columns in week and month take DESIGN.md’s Quiet Weekend wash, keyed on `data-weekend`; today’s tint replaces it.

FORM: Local extension, code-led; no concept roll required. Week is the default; phones up to 699px wide open on Day unless the URL names a view or week. URL state preserves view and date; shared dashboard layout preferences keep their existing purpose. Include loading, unavailable and empty states, keyboard focus, English/Norwegian, both themes and portrait/phone sizing.

Event descriptions in Next family plan and the shared calendar dialog support paragraphs, line breaks, lists, basic emphasis and absolute HTTP(S), email and phone links. Only known formatting elements and validated link destinations are rebuilt; source styles, event handlers, scripts, images and embedded content never enter the page. Plain text retains its line breaks. Descriptions sit beneath the next-plan button so links remain separate keyboard and touch targets. Long dialog content scrolls. Editable Home Assistant events show a formatted preview while retaining the original description in the notes field and save payload.

Next family plan has a 44px chevron button at the heading's right edge, only when its event has a description. The shared Collapsible exposes expanded state and the controlled region to assistive technology; the chevron points up while expanded. Customize Today sets whether descriptions start hidden (off by default), shared across screens and backups. A local toggle stays with the current event and resets when the event or default changes. The event button continues to open the calendar dialog independently.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
