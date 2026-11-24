# 10 · Home Assistant health in Settings and HomeStatus

[← Master plan](README.md) · Depends on [04](04-admin-to-settings.md)

**Goal:** surface the Home Assistant housekeeping the owner otherwise only sees inside HA — repairs, persistent notifications and backup status — without putting admin noise on the family surface.

## Protocol notes (verify against current HA docs; most need an admin token)

- Repairs: `repairs/list_issues` → `issues[]` with `domain`, `issue_id`, `severity` (`warning`/`error`/`critical`), `ignored`, `translation_key`, `translation_placeholders`, `learn_more_url`. Titles come from `frontend/get_translations` category `issues` (reuse the loader from [05](05-ha-language-and-numbers.md)).
- Persistent notifications: subscribe with `persistent_notification/subscribe` (initial `added` with the full map, then `added`/`removed`/`current`). Dismiss with service `persistent_notification.dismiss` (`notification_id`).
- Backups: `backup/info` → `last_completed_automatic_backup`, `last_attempted_automatic_backup`, `next_automatic_backup`, `agent_errors`, `state`, `backups[]`.
- Non-admin token: these return `unauthorized`; hide the section, do not show errors.

## File anchors

- `src/lib/home-assistant.ts` (add read methods + subscription)
- `src/pages/Settings.tsx` System group (new item `ha-health`, title "Home Assistant health")
- `src/lib/home-status.ts` `maintenance` group; `src/components/HomeStatus.tsx`
- Existing update handling: `src/lib/ha-model.ts` (~46), `src/components/devices/card-designs.ts` `update`
- Tests: `src/test/home-status.test.ts`, new `src/test/ha-health.test.tsx`

## Checklist

- [x] Client methods: `listRepairs()`, `backupInfo()`, `subscribePersistentNotifications(cb)`; all tolerate `unauthorized` by returning `undefined`.
- [x] Settings → System → Home Assistant health: three blocks — Repairs (non-ignored issues, severity, translated title, "Learn more"/"Open in Home Assistant" links), Notifications from Home Assistant (title, message rendered as plain text or sanitised markdown, Dismiss with pending/failure feedback), Backups (last successful automatic backup with relative time, next scheduled, agent errors). Updates available list may join here (link to HA for installing).
- [x] HomeStatus `maintenance`: count only actionable items — repair issues with severity `error`/`critical`, last automatic backup failed or older than 48 h, `agent_errors` present. Warnings and persistent notifications stay in Settings only (no family-surface noise).
- [x] Refresh: repairs and backup info on connect and every 15 min while visible; notifications live.
- [ ] Settings group card shows a small count badge when actionable items exist (so the owner finds it).
- [ ] Tests with fictional payloads: severity filtering, stale backup rule, unauthorized hides section, dismiss call shape.
- [ ] Docs: DOCS.md (admin token needed for health; what is shown), README; i18n en/nb.

## Acceptance

- An owner can see and dismiss HA notifications and see backup health without opening HA.
- The family surface only signals maintenance when something actually needs action.
