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

- [x] Add `automations`, `integrations`, `activity` items to the System group with icons (`Workflow`, `Package`, `Clock`) and en/nb titles + descriptions.
- [x] Convert the three pages into section components rendered inside Settings; remove their own page headings.
- [x] Add confirmation before "Run actions" on an automation; keep pending/failed feedback; no automatic replay.

  > Note: `DeviceControl` already confirmed `automation.trigger` ("Confirm action for …"); no code change was needed. A Settings test now proves the confirmation, the busy dialog, the error and that a reconnect does not replay the run.
- [x] Replace routes with redirects; keep `/automation` redirect chain working (single hop to the final URL).
- [x] Remove the three entries from `moreItems`; make sure `isHomeSection` no longer treats them as Smart home pages and the Settings dock item highlights instead.

  > Note: the family dock has no Settings item; Settings opens from the header gear. The moved routes redirect to `/settings/*`, where Smart home is no longer marked current and the Smart home sub-nav is hidden. The header gear gets no `aria-current` here to avoid colliding with workstream 03's header work.
- [x] Phone: confirm the Smart home sub-nav no longer clips a label mid-word at 375 px; if it still does, fade/scroll the overflow with a clear "More" affordance rather than clipping text.

  > Note: at 375 px the primary row still overflowed (253 px visible of 652 px; the third label was cut at the edge), because the seven primary destinations did not change. The row now fades hidden destinations at its edges (a 1.5rem mask; the start fade follows a scroll timeline where supported), reserves end padding so the last destination scrolls clear, and the reveal hook honours `scroll-padding` so the selected destination never sits under a fade. The **More** button stays at the right edge. Checked read-only in the browser at 375 × 812 by injecting the same CSS; no settings or devices were touched.
- [ ] Tests: redirects land on the right section; More menu no longer lists the moved items; confirmation required before running an automation.
- [ ] Update README.md (navigation), PRODUCT.md (capabilities: admin detail in Settings), DESIGN.md if navigation counts are documented.

## Acceptance

- No route to run/disable automations from the family dock or Smart home navigation.
- Old bookmarks still land on the right Settings section.
