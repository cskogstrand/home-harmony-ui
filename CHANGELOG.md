# Changelog

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
