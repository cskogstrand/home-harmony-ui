---
version: 1
slug: "src-pages-school-tsx"
primary_target: "src/pages/School.tsx"
related_targets: ["src/components/CalendarTimetable.tsx", "src/components/TimetableSettings.tsx", "src/components/TimetableAdministration.tsx", "src/pages/HomeSettings.tsx", "src/components/FamilyPlanner.tsx"]
---

# School timetables

Mode: Operate. Extend the existing School board and dashboard previews.

## Direction contract

THESIS: Each person can use saved timetable pages or a live calendar week, with long daily notices read once beneath the week.

OWN-WORLD: Inherit Afterglow's system typography, semantic palette, opaque reading surfaces and existing form controls. No new visual identity or animation.

STORY: Choose School or Kindergarten per person, choose a timetable type, assign calendars to events, shared messages, closures or opening hours, then read the same result on School and the dashboard. The education choice changes week headings and timetable descriptions, defaulting to School. Saved image pages survive switching types.

FIRST VIEWPORT: Retain the person's heading and timetable preview. Show five weekday columns on wide panels and stacked dated sections on narrow panels. Place full-width messages below the days. School only presents; all administration, including uploads, lives in Settings → Timetables. The signature interaction assigns a calendar's display role and updates the School and dashboard presentation through shared settings.

FORM: Local extension, code-led; Monday–Friday confirmed by the user. Today’s message takes priority, otherwise the next available event within a year, with the source date shown. Preserve loading, unavailable and empty states separately.

FINISH: Verify synthetic data on desktop, phone and portrait in both themes; finish with independent review and documentation against the incumbent system. No private calendar contents in fixtures or screenshots.
