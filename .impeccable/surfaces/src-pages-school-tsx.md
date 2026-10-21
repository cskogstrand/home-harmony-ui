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

OWN-WORLD: Inherit Afterglow's system typography, semantic palette and existing form controls. Calendar timetable frames reuse the shared panel glass around dense inset day surfaces, with a primary date capsule for today. Apply this local exception on School, dashboard previews and the expanded view; regular calendar and saved image/PDF presentation stay unchanged. No new visual identity or animation.

STORY: Choose School or Kindergarten per person, choose a timetable type, assign calendars to events, shared messages, closures or opening hours, then read the same result on School and the dashboard. The education choice changes week headings and timetable descriptions, defaulting to School. Saved image pages survive switching types.

FIRST VIEWPORT: Retain the person's heading and timetable preview. Show five weekday columns on wide panels and stacked dated sections at a container width of 620px or less. Each day opens a shared, scrollable dialog with that day's activities, times, locations, full notes and source calendars. Keep inline Details usable, keyboard focus visible and restored on dismissal, and day dialogs available inside the expanded timetable. Place full-width messages below the days. School only presents; all administration, including uploads, lives in Settings → Timetables.

FORM: Local extension, code-led; Monday–Friday confirmed by the user. Today’s message takes priority, otherwise the next available event within a year, with the source date shown. Preserve loading, unavailable and empty states separately.

FINISH: Verify synthetic data on desktop, phone and portrait in both themes; finish with independent review and documentation against the incumbent system. No private calendar contents in fixtures or screenshots.
