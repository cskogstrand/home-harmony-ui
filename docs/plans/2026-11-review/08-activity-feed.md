# 08 · Activity feed

[← Master plan](README.md) · Depends on [04](04-admin-to-settings.md) (`/settings/activity` exists)

**Goal:** replace the dead-end History page with something the family can read: "Garage door opened 14:02 · Dishwasher finished · Robot vacuum back on its dock". Curated recent events on the Smart home overview; full log in Settings → System → Activity.

**Placement** follows the master plan's open question (default: curated panel on `/home`, full log in Settings).

## Protocol notes (verify against current HA docs)

- Live + backfill: WebSocket subscription `logbook/event_stream` with `{ start_time, end_time?, entity_ids?, device_ids? }`. First message(s) carry history, then live events; each event has `entity_id`, `state` or `message`, `when` (epoch seconds), and context fields (`context_user_id`, `context_entity_id`, `context_event_type`, `context_domain`, `context_service`).
- One-off fetch alternative: `logbook/get_events`.
- Use `subscribeMessage` in `src/lib/home-assistant.ts` like the forecast and notification subscriptions (~329–351), and unsubscribe on unmount/reconnect.

## Curation rules (curated panel only)

Include by default: doors/garage doors/windows (open/close), locks, alarm state changes, appliances finishing (running → off, vacuum/lawn mower docked, dishwasher/washer programme end), doorbell/camera person events already used by notifications. Exclude by default: sensors with numeric states, diagnostics, updates, automations/scripts. Person home/away is **opt-in** (privacy on a shared screen). Settings lets the owner add/remove sources with the existing `EntityPicker` (see [docs/entity-picker.md](../../entity-picker.md)).

## File anchors

- `src/pages/History.tsx` (moved into Settings by 04)
- `src/lib/home-status.ts` — reuse the device-class grouping (`homeStatusGroup`) to classify events
- `src/components/EntityPicker.tsx`
- `src/pages/SmartHome.tsx` (overview panel placement), `src/components/HomePanels.tsx`
- Tests: new `src/test/activity-feed.test.tsx`; fixtures in `src/test/ha-fixtures.ts`

## Checklist

- [x] Client: `subscribeLogbook({ start, entityIds })` returning an unsubscribe; reconnect-safe; bounded backfill (for example last 24 h).
- [x] Pure function `curateActivity(events, entities, preferences)` → display items (icon, sentence, relative time, entity link). Unit-tested with fictional events.
- [x] Sentences come from i18n templates per class ("{name} opened", "{name} finished", "{name} docked"), not HA's raw message, so Bokmål reads naturally; fall back to HA's `message` for unknown classes in the full log only.
- [ ] Curated panel "Recent at home" (max ~6 items, newest first, collapses same-entity flapping within 2 minutes). Empty state distinguishes "nothing happened" from "activity unavailable".
- [ ] Full log in Settings → System → Activity: filter by area/type, day picker (today/yesterday), "Open in Home Assistant" link kept as secondary.
- [ ] Settings: choose curated sources, person events opt-in (default off), panel on/off.
- [ ] Offline: show cached items marked stale, like other stale readings.
- [ ] Tests: curation, flapping collapse, person opt-in, unsubscribe on unmount, stale state.
- [ ] Docs: README, PRODUCT.md (capability), DOCS.md (what the feed shows and privacy note); i18n en/nb.

## Acceptance

- The overview shows a readable, curated recent-events list that updates live.
- Settings → Activity replaces the outbound-link page; old `/history` lands there.
