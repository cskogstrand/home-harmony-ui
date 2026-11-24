# 05 · Home Assistant language, numbers and noise (P2)

[← Master plan](README.md) · Suggested Impeccable commands: `/impeccable clarify`, then `/impeccable distill`

**Problem:** Raw English HA states and entity names leak into the Norwegian UI ("No error", "Charging completed", "AC total power", "Energy Added"). Numbers are inconsistent (an area card shows "20.37 °C" with a dot and two decimals; the header shows "−2,4°C"). Areas show "0 lights on" as if it were information.

**Approach (ponytail):** do not hand-translate integration strings. Home Assistant already ships translations for entity names and states keyed by `translation_key`; fetch them with the WebSocket command `frontend/get_translations` (`{ language: "nb", category: "entity" }`, and `category: "state"` for core domains) and apply them where the registry entry has a `translation_key`. Fall back to today's `entityStateLabel` for core domains.

## File anchors

- `src/lib/home-assistant.ts` — connection setup (~111), registry loading (~178–180), `sendMessagePromise` pattern
- `src/lib/ha-model.ts` — `entityStateLabel` (~44), `humanizeState`, `numberValue`
- `src/lib/i18n.ts` — `number` formatter (~24, currently `maximumFractionDigits: 20`), `locales`
- `src/components/devices/DeviceReading.tsx`, `src/components/devices/EntityFacts.tsx`, `src/components/VehicleSystems.tsx` (vehicle "Energy Added"-style labels)
- `src/pages/Areas.tsx` (zero counts)
- Tests: `src/test/ha-model.test.ts`, `src/test/i18n.test.ts`, `src/test/areas.test.tsx`

## Checklist

- [ ] Load HA translations for the active language after connect and on language change (`frontend/get_translations`, categories `entity` and `state`); cache per language in memory; failure must fall back silently to current labels.
- [ ] Use translated entity names when the registry entry has `translation_key` and no user-set `name`; user-set names always win.
- [ ] Use translated states for enum/sensor states with `translation_key`; keep app-owned labels for core domains.
- [ ] Number formatting: format readings with `Intl.NumberFormat(locale)` and a precision rule: use the entity's `display_precision` (entity registry `options.sensor.display_precision` / `suggested_display_precision`) when present, else temperatures 1 decimal, power/energy by magnitude (W 0 decimals, kW/kWh 1–2). One helper used by `DeviceReading`, area cards and the header weather.
- [ ] Unit spacing consistent with locale (`−2,4 °C` in nb); pick one rule and apply everywhere.
- [ ] Areas: hide zero counts ("0 lights on") — show the count only when > 0, otherwise nothing or a neutral "All off" only if it adds meaning.
- [ ] Tests with fictional entities: translation_key mapping, user name precedence, number precision per device class and locale.
- [ ] Update DESIGN.md (number formatting rule) and DOCS.md if it mentions language behaviour.

## Acceptance

- In Bokmål, integration entities with HA translations show Norwegian names/states.
- All numeric readings in one view use the same decimal separator and sensible precision.
