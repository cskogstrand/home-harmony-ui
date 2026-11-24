# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Household members sharing a smart-home touchscreen. The primary design target is a 27-inch, 1440 × 2560 portrait display. Phone use remains supported.

## Product Purpose

Afterglow brings family calendars, lists, school timetables and Home Assistant controls together. Success means seeing what matters next and completing everyday actions with little effort.

## Operating Context

Home Assistant owns people, calendars, to-do items, device state and permissions. One dashboard server shares preferences and timetable files across screens. English and Norwegian Bokmål are supported.

## Capabilities and Constraints

- Preserve existing routes, calendar views, people assignments, list editing, timetable upload and paging, favorites, scenes and device controls.
- Preserve light/dark themes, compact mode, offline feedback, save-conflict recovery and capability-aware controls.
- Sonos puts now-playing and room selection first, with a shared music library, group controls and speaker settings in separate dialogs. One mini player keeps non-TV playback available above navigation outside settings and the dedicated Sonos page, and expands into the full player; it explicitly distinguishes groups playing separately and counts down for ten seconds before hiding when no music group is playing. Sonos supports automatic native-integration discovery, grouping, balanced group volume, favorites, playlists and queues. Changing rooms preserves library navigation; queues remain specific to their playback group. Home Assistant remains the source of truth.
- Never insert private household information or credentials into source, examples or screenshots. Preview data must be explicitly fictional.
- Physical commands are never replayed automatically. Failed writes retain drafts and destructive actions retain confirmation.
- Home Assistant administration (automations, integrations and activity) lives in Settings → System, not in the family dock or Smart home navigation. Running or disabling an automation asks for confirmation.
- **Ask the house** (off by default) sends typed sentences to Home Assistant Assist from the header and shows the answers for the session. Assist acts only on what the owner exposed to it in Home Assistant; the app never widens that and never resends a request on its own. Voice input waits for a secure context.
- Home Assistant health (repairs, persistent notifications, backup status and waiting updates) lives in Settings → System. Only actionable maintenance (error or critical repairs and failed, overdue or erroring backups) reaches Home status; warnings and notifications stay in Settings.
- **Car & energy** leads with the circuits using power now. With a price sensor the owner chooses in Settings, it shows today's (and tomorrow's) electricity prices and the cheapest three hours as information only; nothing is scheduled or started. A **3D printer** card shows progress, time left, temperatures and filament without print controls.
- Smart home shows a curated, live **Recent at home** list from the Home Assistant logbook, written in the dashboard's language; Settings → System → Activity holds the full log and the panel's sources. People's comings and goings are opt-in for privacy on a shared screen.

## Brand Commitments

Keep the Afterglow name. Use clear, calm language with concise action labels.

## Evidence on Hand

The existing application and README document the actual capabilities. Preview fixtures are synthetic and prove no real household state.

## Product Principles

- Prioritize a readable shared portrait board.
- Keep frequent actions visible and touch targets generous.
- Distinguish unavailable information from an empty schedule or an inactive device.
- Keep administrative detail accessible without letting it dominate daily use.
