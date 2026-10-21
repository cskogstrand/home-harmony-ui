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

OWN-WORLD: Inherit Afterglow's system typography, semantic palette and existing form controls. Calendar timetable frames and day popups share the stronger illuminated glass rim, blur and outer depth when backdrop filtering is available. Muted inset day surfaces keep the current activity's emphasis prominent, with a primary date capsule for today. Apply this local exception on School, dashboard previews and the expanded view; regular calendar and saved image/PDF materials stay unchanged. Keep opaque surfaces without backdrop support; reduced transparency, increased contrast and forced colors remove the frames' blur and shadow, with visible outlines for current events. No new visual identity or animation.

STORY: Choose School or Kindergarten per person and a timetable type. Calendar sources lists categories first, each with a compact picker containing calendar checkboxes. Each category accepts several calendars, and a calendar can belong to several categories. Week sources remain independent of Day popup's multi-calendar selections for Activities, Meetings, Opening hours, Closure days and Messages (Pedagogy). Its modal places opening hours and closure status in the date header, Activities on the left, Meetings on the right and Messages (Pedagogy) across the bottom; popup closure calendars suppress popup hours independently of the week. Only configured sections appear, and messages belong to the selected date. Legacy popup selections migrate by their existing source role, with unspecified calendars placed under Activities. The education choice changes week headings and timetable descriptions, defaulting to School. Saved image pages survive switching types.

FIRST VIEWPORT: School shows one full-width card per person for every timetable type. Retain each person's heading and five weekdays. Show five weekday columns on wide calendar panels; at a calendar-container width of 48rem or less, stack dated sections with each day heading above its events. Place one live clock beside the week label when the displayed week includes today, using the home's time zone and existing 15-second family-context tick. Opening hours and closure status sit under each day heading; omit the opening-hours event title while preserving closure reasons. The week and popup share compact agenda rows and current-event emphasis. At a day-container width of 18rem or more, weekly rows place time beside the title; narrower rows place time above it. Weekly activity notes expand through the title disclosure, without a repeated Details line. Timed events in progress pair primary emphasis with visible “Happening now” text and semantic current-time state; all-day events receive no active-time indication. Place full-width messages below the days.

Each day opens a shared Liquid Glass dialog up to 1400px wide, with a full-width date header and one scrolling body. Opening hours and closure status are compact rows in the header, with any notes behind Details; omit the opening-hours event title while preserving closure reasons. The popup header shows the same live clock only for today. At a content width of 48rem or more, configured Activities and Meetings share a 3:1 row; either section alone uses the full width. Sections stack at smaller widths. At a content width of 30rem or more, compact activity rows place time in a leading column beside the title and details; narrower rows place time above the title. Meetings retain time above the title. Messages (Pedagogy) spans the full bottom row, with paragraphs capped at 75ch; all-day messages omit the redundant time label. Keep sections as headings and dividers inside the shared glass shell, with full activities, times, locations and notes; omit calendar-source labels from popup items. Keep title disclosures and status Details usable, keyboard focus visible and restored on dismissal, and day dialogs available inside the expanded timetable.

On School, saved images and converted PDF pages retain their aspect ratio and fill the card width without a height cap. Inactive carousel pages occupy zero height so mixed portrait and landscape pages leave no blank space beneath the active page. Dashboard thumbnail sizing and the expanded saved-page viewer retain their existing behavior. School only presents; all administration, including uploads, lives in Settings → Timetables.

FORM: Local extension, code-led; Monday–Friday confirmed by the user. Today’s message takes priority, otherwise the next available event within a year, with the source date shown. Preserve loading, unavailable and empty states separately.

FINISH: Verify synthetic data on desktop, phone and portrait in both themes; finish with independent review and documentation against the incumbent system. No private calendar contents in fixtures or screenshots.
