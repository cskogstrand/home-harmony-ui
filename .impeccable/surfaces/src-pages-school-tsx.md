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

OWN-WORLD: Inherit Afterglow's system typography, semantic palette and existing form controls. Calendar timetable frames reuse the shared panel glass around dense inset day surfaces, with a primary date capsule for today. Apply this local exception on School, dashboard previews and the expanded view; regular calendar and saved image/PDF presentation stay unchanged. The day popup alone adds a stronger illuminated glass rim, blur and outer depth when backdrop filtering is available. Keep opaque surfaces without backdrop support; reduced transparency, increased contrast and forced colors remove the popup's blur and shadow, with visible outlines for current events. No new visual identity or animation.

STORY: Choose School or Kindergarten per person and a timetable type. Calendar sources lists categories first, each with a compact picker containing calendar checkboxes. Each category accepts several calendars, and a calendar can belong to several categories. Day popup has separate multi-calendar selections for Activities, Meetings, Opening hours, Closure days and Messages (Pedagogy). Its modal places opening hours and closure status in the date header, Activities on the left, Meetings on the right and Messages (Pedagogy) across the bottom; popup closure calendars suppress popup hours independently of the week. Only configured sections appear, and messages belong to the selected date. Legacy popup selections migrate by their existing source role, with unspecified calendars placed under Activities. The education choice changes week headings and timetable descriptions, defaulting to School. Saved image pages survive switching types.

FIRST VIEWPORT: Retain the person's heading and timetable preview. Show five weekday columns on wide panels and stacked dated sections at a container width of 620px or less. Each day opens a shared Liquid Glass dialog up to 1400px wide, with a full-width date header and one scrolling body. Opening hours and closure status are compact rows in the header, with any notes behind Details; omit the opening-hours event title while preserving closure reasons. Today's popup alone shows the current time in the home's time zone, using the existing 15-second family-context tick. Timed events in progress pair primary emphasis with visible “Happening now” text and semantic current-time state; all-day events receive no active-time indication. At a content width of 48rem or more, configured Activities and Meetings share a 3:1 row; either section alone uses the full width. Sections stack at smaller widths. At a content width of 30rem or more, compact activity rows place time in a leading column beside the title and details; narrower rows place time above the title. Meetings retain time above the title. Messages (Pedagogy) spans the full bottom row, with paragraphs capped at 75ch; all-day messages omit the redundant time label. Keep sections as headings and dividers inside the shared glass shell, with full activities, times, locations and notes; omit calendar-source labels from popup items. Keep inline Details usable, keyboard focus visible and restored on dismissal, and day dialogs available inside the expanded timetable. Place full-width messages below the days. School only presents; all administration, including uploads, lives in Settings → Timetables.

FORM: Local extension, code-led; Monday–Friday confirmed by the user. Today’s message takes priority, otherwise the next available event within a year, with the source date shown. Preserve loading, unavailable and empty states separately.

FINISH: Verify synthetic data on desktop, phone and portrait in both themes; finish with independent review and documentation against the incumbent system. No private calendar contents in fixtures or screenshots.
