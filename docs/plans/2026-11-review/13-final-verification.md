# 13 · Final verification and re-critique

[← Master plan](README.md) · Run when every other workstream is ✅

## Checklist

- [x] Full suite: `npm run --silent test:silent`, `npm run --silent test:server:silent`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm run build`.

  > 2026-11-24 on `main`: UI 74 files / 1318 tests, server tests, tsc, lint and build all pass. During wave 2, parallel agent test runs pushed the load average past 200 and caused varying timeouts; quiet reruns were green.
- [x] Browser pass on fictional data where possible (device gallery, tests) and read-only on the live server: Today, Calendar (week), Lists, Smart home overview, Scenes, Security, Energy, Settings (System group: Automations, Integrations, Activity, Home Assistant health, Assist) at 1440 × 2560 and 390 × 844, light/dark, artwork on/off, Bokmål and English.

  > Read-only on port 8081, Bokmål only. All listed pages at 1440 × 2560 and 390 × 844, light/dark (`dark` class) and artwork on/off (`data-artwork`) toggled in the page only, checked for horizontal overflow, off-screen text outside scrollers and text under 11px. Found and fixed one issue: on phones the week grid's screen-reader time labels escaped `.weekly-scroll` and widened the layout to 547px (`fix: keep the phone week grid inside its scroller`). Not covered: English (the language is a saved setting; covered by i18n tests).
- [x] Accessibility spot checks: keyboard through header, Ask-the-house dialog, Settings sections; forced colours; reduced motion; 150 % root size on Today and Settings.

  > 150% root size at 390 × 844 on Today, Calendar week, Lists and eight Settings sections: Home Assistant health (446px) and Automations (415px) overflowed because settings links inherited `nowrap`; fixed (`fix: wrap long settings links at large text sizes`). Header keyboard order is logical with 48px targets; the phone home link was 28px wide and is now 44px (`fix: keep the phone home link a 44px touch target`). Forced colours and reduced motion: static check only; every new stylesheet with colour-only state has a `forced-colors` block and the global reduced-motion rule covers new transitions. Ask-the-house keyboard and focus are covered by `assist-ui.test.tsx`; the live dialog was not opened because Assist is off and enabling it means saving a setting.
- [x] Re-run `/impeccable critique` on the app; record the new score here (baseline 26/40) and list any new P0/P1 as follow-ups below.

  > New score **28/40** (baseline 26/40), dual-agent run; detector and browser overlay found no anti-patterns. Snapshot: `.impeccable/critique/2026-11-24T21-46-00Z__src-app-tsx.md`. New P1 follow-ups below.
- [x] Docs consistency: README, PRODUCT.md, DESIGN.md, DOCS.md, docs/notifications.md mention every changed behaviour; no real household data anywhere (`git grep` for names/places you saw in the live app).

  > README, PRODUCT.md, DESIGN.md, DOCS.md and docs/notifications.md cover the changed behaviour; PRODUCT.md gained the energy, price and printer line. `git grep` and the commit messages since the plan started contain none of the names, places or price area seen in the live app.
- [x] Set every workstream to ✅ in the master table, answer or carry over open questions, and commit `docs: close 2026-11 review plan`.

  > 00–06 and 08–12 are ✅. 07 stays 🚧: phase B (voice) waits for the HTTPS question. Open questions are carried over in the master plan.

> Result: the plan is closed except 07 phase B. Final score 28/40.

## Follow-ups from the re-critique

- [x] **P1** Thermostat dial text collides with its ring on Original and Compact climate cards at the wall size (`/impeccable polish`, then `harden`).
  > Done 2026-11-25 (`fix: keep thermostat dial text inside its ring`): only the numeral and a short state sit inside the ring; labels and room temperature sit below; dial text scales with the dial.
- [ ] **P1** Raw Home Assistant language and data on family surfaces: English suffixes and device-prefixed names in Recent at home and Energy, two power sensors on one charger summed, mixed precision, ISO timestamps and enum values in the Activity log (`/impeccable clarify`).
  > Partly done 2026-11-25: consumers named by device, power counted once per consumer, one W/kW format, readable dates and "changed status" in the log. Still visible live: English suffixes in Recent at home names ("Door", "Charger door", "Climate … finished") and English entity names in device fact lists ("Child lock", "Relative humidity", "Mode"). Follow-up running in wave B.
- [ ] **P2** Portrait wall leaves its lower third empty while week titles and the waste chip truncate (`/impeccable layout`).
- [x] **P2** Cold start shows "Laster…" and a stale/paused warning before the first connection (`/impeccable harden`).
  > Done 2026-11-25: neutral "Connecting to Home Assistant…" during a 10 s first-connection grace period, page-shaped skeletons, the stale/paused warning only after a real break, no "HA" in family copy. Commands stay blocked until connected.
- [ ] **P2** Phone Today "Dagen vår" is about 2.5 screens tall (`/impeccable distill`).
- [x] **Owner request** Climate cards show the target as °C when a thermostat runs in regulator mode with a % display unit; show it as a percentage in that mode (with the dial fix).
  > Done 2026-11-25 (`feat: show regulator-mode thermostats as heating power in percent`): detected from the device's display-unit or mode entities; checked read-only on the live thermostat (shows 50%, "Varmeeffekt").
- [x] **Owner request** "Recent at home" can be added to Today through Today's view options (Customize Today), in addition to Smart home.
  > Done 2026-11-25 (`feat: add Recent at home as an optional Today section`): off by default under Customize Today; same sources and privacy choice as Smart home.
