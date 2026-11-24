# 13 · Final verification and re-critique

[← Master plan](README.md) · Run when every other workstream is ✅

## Checklist

- [ ] Full suite: `npm run --silent test:silent`, `npm run --silent test:server:silent`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm run build`.
- [ ] Browser pass on fictional data where possible (device gallery, tests) and read-only on the live server: Today, Calendar (week), Lists, Smart home overview, Scenes, Security, Energy, Settings (System group: Automations, Integrations, Activity, Home Assistant health, Assist) at 1440 × 2560 and 390 × 844, light/dark, artwork on/off, Bokmål and English.
- [ ] Accessibility spot checks: keyboard through header, Ask-the-house dialog, Settings sections; forced colours; reduced motion; 150 % root size on Today and Settings.
- [ ] Re-run `/impeccable critique` on the app; record the new score here (baseline 26/40) and list any new P0/P1 as follow-ups below.
- [ ] Docs consistency: README, PRODUCT.md, DESIGN.md, DOCS.md, docs/notifications.md mention every changed behaviour; no real household data anywhere (`git grep` for names/places you saw in the live app).
- [ ] Set every workstream to ✅ in the master table, answer or carry over open questions, and commit `docs: close 2026-11 review plan`.

> Result:
