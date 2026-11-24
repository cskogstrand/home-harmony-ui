# 11 · 3D printer card

[← Master plan](README.md) · Depends on [05](05-ha-language-and-numbers.md) · Read `.impeccable/surfaces/src-pages-devicegallery-tsx.md` and `src-pages-devicedetail-tsx.md`

**Goal:** a first-class Smart home card for a 3D printer device: live camera or cover image, progress, remaining time, stage, nozzle/bed temperature and filament trays. Today the printer only appears as an ongoing notification (live media in `NotificationCenter.tsx` ~295, icon `printer_3d`).

**Design constraint:** card designs are domain-based (`src/components/devices/card-designs.ts`). A printer is a *device* made of many sensors, so detect it at device level and keep detection generic with integration-specific key maps as adapters.

## Detection

A device is a printer when it has a sensor whose `translation_key` (or entity id suffix) is one of `print_progress`, `print_status`, `current_stage`, plus at least one of `remaining_time`/`end_time`. Start with the key map of the Bambu Lab integration (`print_progress`, `remaining_time`, `current_stage`, `nozzle_temp`, `target_nozzle_temp`, `bed_temp`, `target_bed_temp`, `tray`, `active_ams`, `cover_image`, camera); verify keys against the integration source before relying on them. Keep the map in one place so another printer integration can be added as a second entry.

## File anchors

- `src/components/devices/card-designs.ts`, `src/lib/smart-home-cards.ts`, `src/lib/device-model.ts`
- `src/components/devices/CardLayouts.tsx`, `CardFrame.tsx`, `DomainCardContent.tsx`, `EntityMedia.tsx` (camera/image)
- `src/pages/DeviceGallery.tsx` + `src/components/devices/device-cards.css` (gallery illustration)
- `src/components/NotificationCenter.tsx` ~295 (reuse live-media logic)
- Tests: `src/test/smart-home-cards.test.tsx`, `src/test/device-gallery.test.tsx`; fictional printer in `src/test/device-card-fixtures.ts`

## Checklist

- [ ] `printerModel(device, entities)` pure helper returning progress, remaining, stage, temps (current/target), trays (colour, type, active), media entity; unit-tested with a fictional device.
- [ ] Card in Original, Compact and Super compact densities: progress ring/bar + remaining time as the hero; stage label translated (via 05); media (camera when printing, cover image otherwise) only in Original; trays as colour swatches with accessible names.
- [ ] Idle/finished/error states distinct (finished shows "Done at 14:20"; error shows the HMS/print error text if present). Unavailable vs idle distinguished.
- [ ] Device detail page: same model, plus chamber light and other controls already handled generically.
- [ ] Gallery: add a printer card family with a fictional illustration to `/device-gallery`.
- [ ] No controls that start/stop prints in this workstream (read-only card + existing light/switch controls).
- [ ] Tests: detection positive/negative, densities render, unavailable vs idle.
- [ ] Docs: DESIGN.md card family list; README supported devices.

## Acceptance

- A printer device shows one coherent card with progress and time remaining readable from 2 m.
