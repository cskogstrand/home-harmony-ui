# 09 · Energy now and electricity price

[← Master plan](README.md) · Depends on [05](05-ha-language-and-numbers.md) (number formatting) · Suggested Impeccable command: `/impeccable distill`

**Problem:** `/energy` lists every power/energy sensor grouped by device: a ~7,700 px wall at portrait, many rows reading 0 W. The question a family actually asks is "what is using power right now?" and "when is it cheap?". Home Assistant has per-circuit power sensors but no electricity price source and no Energy dashboard preferences configured yet (`energy/get_prefs` returns `not_found`).

## File anchors

- `src/pages/EnergySaver.tsx` (pinned meters, groups, "Open Home Assistant Energy" link)
- `src/components/devices/DeviceReading.tsx`, `src/components/devices/EntityHistory.tsx`
- `src/components/HomePanels.tsx` (`VehicleCard`, used on the page)
- Tests: `src/test/energy-page.test.tsx`

## Phase A — "Using power now" (no HA changes needed)

- [x] Pure helper `powerNow(entities)`: sensors with `device_class: power`, normalised to W (W/kW), available only, sorted descending; excludes entities the owner hid.
- [x] Top section "Using power now": top 5 consumers with name, area and live value; total of the listed sensors labelled as "of listed circuits" (not as house total) unless the owner pins a total meter.
- [x] Hide idle meters (< 5 W, configurable later only if asked) behind a "Show idle (n)" disclosure; energy (kWh) counters move to a collapsed "Meters" section.
- [x] Keep pinned meters (max three) above everything; keep vehicle cards.
- [x] If `energy/get_prefs` returns preferences, link "Open Home Assistant Energy"; if `not_found`, change the link text to "Set up Energy in Home Assistant" pointing to `/config/energy`.
- [x] Tests: unit normalisation, sorting, idle threshold, total labelling, prefs not_found copy.

> Handoff: Phase A is implemented and covered by `src/test/energy-now.test.ts`, `src/test/energy-page.test.tsx` and the `energySetup` case in `src/test/ha-session.test.tsx`. The browser check (1440 × 2560 portrait, 390 × 844 phone, light/dark, artwork on) is still open: it was built on a branch the running dev server does not serve. Check that "Using power now" sits on the first portrait screen below the pinned meters. The sum of the five listed consumers is always labelled "Total of listed circuits"; the app has no way to mark a pinned meter as the house total, so no house total is shown.

## Phase B — price

- [x] Owner action: add the Nord Pool integration (or another price source) in Home Assistant and configure Energy. Record the date here. *Do not do this for them.* — 2026-11-24: the owner added Nord Pool price sensors. Energy dashboard setup is not required for the price features.
- [x] ~~Detect a price source generically: sensor with `device_class: monetary` and unit ending in `/kWh`, or the Nord Pool service `nordpool.get_prices_for_date` (call with `return_response`; verify current service name and fields in HA docs).~~ — skipped: owner chooses the price sensor in Settings
- [x] Settings: choose the price sensor with the shared entity picker (sensors with a unit ending in `/kWh` or `device_class: monetary` are offered); stored in shared settings, so backups include it. A Nord Pool sensor supplies today and tomorrow through `nordpool.get_prices_for_date` (read-only, `return_response`); other sensors show their current price only.
- [x] Price strip: today (and tomorrow when published) hourly/quarter-hourly bars with "now" marker; current price in large type; cheapest window highlighted. Follow the colour rules in [DESIGN.md](../../../DESIGN.md); accessible table fallback.
- [x] "Best time" hint: cheapest contiguous 3-hour window in the next 24 h, shown as text ("Cheapest from 02:00 to 05:00"). Display only — never schedule or start devices automatically.
- [x] Tests with a fictional price series (including DST change day and missing tomorrow).
- [x] Docs: DOCS.md (how to add a price source), README feature line.

> Handoff: Phase B is implemented with fictional fixtures (`src/test/electricity-price.test.tsx`, `src/test/energy-settings.test.tsx`, the `priceSeries` case in `src/test/ha-session.test.tsx`). Still open: the browser check of Settings → Devices → Electricity price and the price panel on `/energy` at 1440 × 2560 and 390 × 844, light/dark and artwork on; on a phone, check that 96 quarter-hour bars stay legible. The price area is taken from the sensor's unique ID; if the owner's Nord Pool entry covers several areas, confirm the right one is shown.

## Acceptance

- `/energy` fits the key answer on the first portrait screen: top consumers now.
- With a price source configured, today's prices and the cheapest window are visible; without it, the page explains how to add one.
