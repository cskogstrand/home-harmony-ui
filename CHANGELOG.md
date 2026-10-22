# Changelog

## 0.9.12

<!-- release-source: b492af22784b691e40e5f65b1341afb1dbce8351 -->

- feat: add light colors and opt-in visibility
- docs: fix links in Home Assistant app pages

## 0.9.11

<!-- release-source: 39bafab5ff408562ac4c06da42dcc820ad359a79 -->

- fix: remove redundant border class in FamilyDay component
- fix: detect updates and contain page load failures
- ci: generate changelogs on release
- style: simplify daily calendar empty states

## 0.9.10

<!-- release-source: 6c323cfdfd7e7885c25ba1b905532b91c18d7b34 -->

- feat: add bulk smart home visibility controls
- feat: add smart home visibility filters and groups

## 0.9.9

<!-- release-source: 31c786744c2e5cf0ea54c387a242d40b7a10fc51 -->

- fix: restore deploy checks and quiet test output
- feat: add deploy script
- feat: add tested deploy
- ci: release from VERSION bumps on main
- feat: configure smart home visibility
- feat: add tomorrow plans and cleaner controls
- docs: simplify readme and add screenshots

## 0.9.8

- Download prebuilt app images on Home Assistant updates instead of installing build dependencies and compiling on the device.

## 0.9.7

- Choose which sections appear on Today, with preferences saved automatically and shared across screens.
- Add Everyone’s day (Dagen vår), grouping today's events by person from their selected calendars, including all-day and overnight plans and a separate group for shared events.
- Keep a pre-upgrade settings backup before downgrading: older releases reject the new dashboard settings.

## 0.9.6

- Show the selected day's school activities with weekday tabs, opening or closed status, and highlighted meeting counts.
- Group activities, meetings and messages in a clearer timetable layout, highlight current activities, and make saved PDF/image timetables full width on School.
- Configure calendars directly in a live timetable preview, with multiple sources per category and explanations beside each picker.
- Use the same calendar selections on School and Today. Existing School selections take precedence over separate dashboard assignments; older weekly-only assignments migrate into matching day categories.

## 0.9.5

- Add calendar timetables for school and kindergarten, with events, shared messages, closures and opening hours configured in Settings → Timetables.
- Give calendar timetables a Liquid Glass frame and clearer current-day marker, preserving saved PDF/image timetables.
- Translate known timetable calendar labels between English and Norwegian Bokmål.
- Animate confirmed list additions, edits, completion and deletion for pointer and keyboard input, and show pending checkbox updates.

## 0.9.4

- Refresh the app with Liquid Glass surfaces, clearer calendar cards and consistent modal styling and footers.
- Add twelve global color palettes for light and dark mode, shared across connected screens.
- Add preset and custom person colors, larger calendar avatars and Home Assistant person photos with initials as a fallback.
- Keep a pre-upgrade settings backup before downgrading: older releases reject the new person-color and palette settings.

## 0.9.3

- Add subtle feedback to buttons, switches, menus and dialogs, with instant keyboard actions and gentler reduced-motion transitions.
- Animate task and shopping-list entry, confirmed additions and completion, and show pending feedback when selecting a suggestion.
- Reopen completed items directly from suggestions and disable suggestions already on the list.

## 0.9.2

- Load pages on demand and split the React runtime into a shared bundle, keeping every JavaScript chunk below the build warning limit.
- Keep navigation visible while pages load and scroll to linked sections after their content is ready.
- Separate shared helpers from React components to restore Fast Refresh compatibility and clear lint warnings.

## 0.9.1

- Make list creation easier to find with prominent, labeled plus buttons and inline forms that stay visible while scrolling each list.
- Preserve item drafts after cancellation or failed saves, and show unavailable add actions consistently.
- Open Shopping by default on the Lists page and clarify the Norwegian daily-task label.
- Increase bottom-navigation contrast with a deeper evergreen fill, a sage outline in dark mode and a softer selected tab.

## 0.9.0

- Rebuild the dashboard for a shared portrait touchscreen with clearer calendar, list, school and home-control layouts.
- Improve light and dark contrast, bundle Public Sans locally and enlarge touch targets.
- Simplify smart-home navigation, activate compact mode and distinguish offline information from empty results.
- Keep event actions visible on phones and group optional location and notes fields.
- Add the UX audit and reusable design-system documentation.

## 0.8.8

- Preserve calendar start, end and arrival times without truncating the morning summary.
- Use structured per-group AI output and avoid repeating an already included weekday reminder.
- Keep school and kindergarten summaries focused on practical notices; read weekly notices across all timetable pages and preserve explicit reflector travel directions in notifications and speech.
- Map timetable images to their owner's response field and stop before AI generation if an enabled timetable has no unique personal group.
- When updating the HA examples, add each timetable's exact API `member` as `timetable_member` in its personal group in local `secrets.yaml`, update the summary automation and voice script, and reload scripts.

## 0.8.7

- Keep personal and household-specific values in local Home Assistant secrets; use generic placeholders in repository examples and ignore real `secrets.yaml` files.
- Add repository instructions prohibiting personal information and credentials in committed files.
- Clarify arrival and ice start times in morning summaries when the calendar interval already includes arrival.

## 0.8.6

- Add English and Norwegian Bokmål under App preferences → Language, saved per server and shared across screens.
- Translate app text, dialogs, accessibility labels and known device states, and format dates and numbers in the selected language.
- Include language in settings backups; existing settings without a language default to English. Home Assistant names, calendar/list content and generated summaries retain their original text.
- Keep a pre-upgrade settings backup before downgrading: older app releases reject the new language field.

## 0.8.5

- Add Norwegian morning-summary speech through Home Assistant Cloud, with varied wording on each run.
- Play the summary from a compact button at the top right of its dashboard card, with pending/error feedback and guards for unavailable or running scripts.
- Preserve explicit activity and arrival times, avoid calculating new times, and clarify that school reflector reminders apply on the morning journey unless another time is specified.
- When updating the HA examples, rename the AI Task secret to `main_ai_task_entity`, add `main_announcement_speaker`, install the named voice script in `scripts.yaml`, update the summary automation, and reload scripts.

## 0.8.4

- Show today's morning summary on the Afterglow front page, updating from Home Assistant and preserving group emojis and line breaks.
- Include timetable images in compact AI summaries, with group order, household settings and weekly reminders configured through secrets.
- Store the formatted notification in a reusable template sensor and hide summaries from other days on the dashboard.
- Upgrade the example by merging the new config and secrets entries, updating the automation, and reloading the changed Home Assistant YAML integrations.

## 0.8.3

- Add optional read-only timetable access with an API key in the URL, configured through HAOS options or the environment.
- Include a disabled morning-summary automation draft for family calendars, with editable AI instructions and notification delivery.
- Show ISO week numbers on Today and calendar views.

## 0.8.2

- Return 202 Accepted once a timetable PDF is saved, then convert it in the background and show failures at the top of the app.
- Keep successful iOS shortcut uploads silent. Download and replace installed shortcuts to get the updated behavior.
- Fix Upload URL copying when clipboard access is unavailable or denied, including local HTTP dashboards.

## 0.8.1

- Add a Copy button beside each person's Upload URL on the School page, with success feedback and guidance when clipboard access is unavailable.

## 0.8.0

- Move household setup guidance into a Get started page for connections, people, calendars, lists and school timetables.
- Offer onboarding from Today for unconfigured households and keep it available in the settings menu.
- Remove repeated setup links, helper paragraphs and redundant subtitles across the app while preserving errors and confirmation dialogs.

## 0.7.4

- Apply dark timetable colors directly to the original PNG instead of displaying a filtered SVG that can blur text.
- Use the same original image in previews and enlarged views, including existing uploads and saved dark-image URLs. No re-upload is needed.

## 0.7.3

- Render timetable PDFs at 6,000 pixels on the longest edge for sharper normal and dark images.
- Allow more time for high-resolution conversion of PDFs up to 20 pages.
- Upload existing PDFs again to replace older, lower-resolution images.

## 0.7.2

- Add an opt-in dashboard login bypass for trusted local networks in HAOS, Docker, Node and Vite.
- Keep cross-origin checks and the server-side Home Assistant token when login is disabled.
- Log Home Assistant WebSocket connection failures separately from rejected tokens, without logging credentials.

## 0.7.1

- Ignore surrounding whitespace when loading the Home Assistant token from app options or the environment.
- Distinguish missing tokens from malformed tokens in startup errors without exposing credentials.

## 0.7.0

- Download a signed iOS shortcut from the School board to upload PDFs directly from the Share Sheet.
- Configure the person's upload URL and dashboard password during import, with no credentials embedded in the download.
- Confirm timetable replacement before uploading and show the server response afterward.

## 0.6.0

- Create normal and dark images for every uploaded PDF timetable page.
- Add a shared Dark timetables preference for the dashboard, School board and enlarged views.
- Support dark images for existing PDF uploads without uploading them again.

## 0.4.0

- Upload PDF timetables from the School board or an authenticated API.
- Convert PDFs into private timetable pages shared across dashboard screens.
- Add per-person upload URLs and iOS share-sheet shortcut instructions.
- Include PDF conversion tools in the HAOS container and preserve existing timetables when uploads fail.

## 0.3.0

- Store and export app settings only; calendar events, lists, people and device state stay in Home Assistant.
- Include appearance and selected alarm panel in saved settings.
- Require settings backup format 2; previous formats are not supported.
- Use shared persistent storage by default in development and production builds.
- Run the storage API with Vite development and preview; browser-only storage requires explicit browser mode.

## 0.2.0

- Persist shared household configuration in the HAOS app data folder.
- Authenticate configuration access using each screen’s Home Assistant login.
- Add JSON export/import, explicit browser migration and restore confirmation.
- Detect stale writes and retain unsaved drafts for export or manual retry.
- Replace the static-only nginx container with a Node web and storage server.

## 0.1.0

- Install Home Harmony UI directly from this repository as a Home Assistant OS app.
- Build locally for aarch64 and amd64 and serve the dashboard on configurable port 8099.
- Preserve browser login callbacks and deep links with nginx SPA fallback.
