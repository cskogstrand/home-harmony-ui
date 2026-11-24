# 04 · Move admin pages into Settings (P2)

[← Master plan](README.md) · Owner decision: **move Automations, Integrations and History to Settings.**

**Problem:** Automations (with a toggle and a full-width "Run actions" button each), Integrations and History are reachable from the family dock's Smart home "More controls" menu. On a shared wall screen a child is one stray tap from disabling or running an automation. Integrations and History are also dead ends (a single outbound link). Smart home navigation has 14 destinations; on phone the sub-nav clips "Sonos" mid-word.

## Decisions

- New Settings section ids under the existing **System** group in `src/pages/Settings.tsx`: `automations`, `integrations`, `activity` (activity is filled by [08](08-activity-feed.md); until then it keeps today's outbound link).
- Old routes keep working: `/automations` → `/settings/automations`, `/integrations` and `/services` → `/settings/integrations`, `/history` → `/settings/activity` (use `<Navigate replace>` like the existing `/automation` redirect in `src/App.tsx`).
- "Car & energy", "Zones" and "Alerts" stay in the Smart home "More" menu.
- Running an automation from Settings asks for confirmation (it is a physical action); toggling enable/disable shows pending and failure feedback like other commands.

## File anchors

- `src/lib/navigation.ts` — `moreItems`, `homePaths`, `isHomeSection`
- `src/App.tsx` ~62–68 — routes for `/automations`, `/integrations`, `/services`, `/history`
- `src/pages/Settings.tsx` ~34–66 — `groups` (System group), `legacySections`
- `src/pages/Automations.tsx`, `src/pages/Integrations.tsx`, `src/pages/History.tsx` — become section components (drop `PageHeading`, keep content)
- `src/components/layout/Navigation.tsx` — `SmartHomeNav` (phone overflow)
- Tests: `src/test/navigation.test.tsx`, `src/test/main-pages.test.tsx`, any Automations test

## Checklist

- [ ] Add `automations`, `integrations`, `activity` items to the System group with icons (`Workflow`, `Package`, `Clock`) and en/nb titles + descriptions.
- [ ] Convert the three pages into section components rendered inside Settings; remove their own page headings.
- [ ] Add confirmation before "Run actions" on an automation; keep pending/failed feedback; no automatic replay.
- [ ] Replace routes with redirects; keep `/automation` redirect chain working (single hop to the final URL).
- [ ] Remove the three entries from `moreItems`; make sure `isHomeSection` no longer treats them as Smart home pages and the Settings dock item highlights instead.
- [ ] Phone: confirm the Smart home sub-nav no longer clips a label mid-word at 375 px; if it still does, fade/scroll the overflow with a clear "More" affordance rather than clipping text.
- [ ] Tests: redirects land on the right section; More menu no longer lists the moved items; confirmation required before running an automation.
- [ ] Update README.md (navigation), PRODUCT.md (capabilities: admin detail in Settings), DESIGN.md if navigation counts are documented.

## Acceptance

- No route to run/disable automations from the family dock or Smart home navigation.
- Old bookmarks still land on the right Settings section.
