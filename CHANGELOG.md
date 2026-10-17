# Changelog

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
