# UX and UI audit

The rebuild prioritizes a shared 27-inch touchscreen at 1440 × 2560 in portrait orientation. The approved direction is Library wayfinding: evergreen navigation, pale surfaces, clear reading order and comfortable controls. Phone and landscape layouts remain supported.

## Findings addressed

| Finding | Change |
| --- | --- |
| Calendar text was approximately 10–11px and controls were too small for the primary display. | Portrait event text is 18–20px, task text is 22px, and primary touch controls are at least 48px tall. |
| Decorative headings and repeated controls competed with household information. | Simplified page headings; retained one dashboard add-plan action and date-specific actions in the full calendar. |
| Twelve smart-home navigation destinations competed for attention. | Five frequent destinations stay visible; secondary destinations use a labeled menu that reflects the current page. |
| Light warning text and dark destructive buttons failed contrast requirements. | Replaced both theme palettes with explicit semantic foreground/background pairs. |
| Typography depended on fonts installed on the display. | Bundled Public Sans with Latin and Latin Extended characters, including its open font license. |
| Compact mode saved a preference without changing the interface. | Connected the preference to shared spacing, calendar rows and list density. |
| An offline calendar or alarm could appear empty or absent. | Offline status takes precedence over empty-state claims. Calendar failures remain distinct from an empty schedule. |
| Optional event fields lengthened the form on small screens. | Grouped location and notes in an expandable section; kept save/cancel actions visible. |
| Nested list containers and unrelated entity cards increased scanning effort. | Flattened list sections and removed people, calendars, lists and zones from the smart-home device overview. Their dedicated routes remain available. |

## Verification

- 182 automated tests pass, including calendar editing, failed-draft preservation, offline behavior, navigation, compact-mode persistence and device filtering.
- Production build and TypeScript validation pass. ESLint has no errors; 24 existing Fast Refresh warnings remain.
- Impeccable's final static scan reports no findings.
- A fresh finish reviewer cleared the requested touch-size and typography corrections. The review used a general subagent following Impeccable's reviewer contract because the custom agent type was unavailable.
- Browser review covers 1440 × 2560 portrait in light English and dark Norwegian, 1440 × 900 landscape, and 390 × 844 mobile, including the event editor and smart-home page.
- Browser previews use an isolated local Home Assistant mock and explicitly fictional household content.

## Remaining limits

- The existing approximately 841KB JavaScript bundle remains eagerly loaded. Route splitting and timetable request scheduling need a separate measured performance change.
- Actual viewing distance, touch calibration and browser scaling on the physical 27-inch panel still need an on-device check.
- Real Home Assistant integrations and physical commands were not exercised during this UI rebuild. Existing capability checks, confirmations and command handling are preserved.
- Long schedules and larger households remain scrollable; no calendar events are discarded to force a fixed-height dashboard.
