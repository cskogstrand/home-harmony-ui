---
version: 1
slug: "src-components-smarthomesettings-tsx"
primary_target: "src/components/SmartHomeSettings.tsx"
related_targets: ["src/components/smart-home-settings.css","src/components/devices/SmartHomeCard.tsx","src/components/devices/SmartHomeCards.tsx","src/pages/SmartHome.tsx"]
---

# Smart home card editor

Mode: Operate. Explicit, shared card composition replaces device visibility trees. Choose a card family, attach a compatible main entity and optional supporting entities beside a clean production card preview, then save. New discoveries never create cards. Existing order, density and group controls remain. The confirmed danger zone clears only Smart home; Today and Home Assistant remain unchanged. Retired visibility configuration is discarded, without migrating cards.

## Built behavior

**Your cards** lists saved cards with their type, group and entity count. **Add card** opens a searchable catalogue grouped by purpose, showing types with compatible entities when devices are available; **Show all types** exposes the full catalogue and starts enabled when no entities are discovered. The gallery link lives in this catalogue. Missing main entities remain identified in the collection and replaceable in the editor.

The editor places a device selector above the main entity picker, followed by supporting sources and appearance fields. The main picker lists compatible entities from the selected device; the supporting picker lists that device's remaining entities directly. **Without a device** keeps standalone sources available. **Add entities from other devices** reveals a separate picker for additional sources. Existing attachments remain selected when changing device, with cross-device and missing sources shown in that extra section. The device is derived from the saved main entity, so no separate device setting is stored. A separate **Card preview** uses the production `SmartHomeCard` with the draft name, size and selected entities, with no configuration fields inside it. Device controls, media streams and history remain paused. The preview stays beside the editor on wide screens and stacks above it at 1100px; appearance fields become one column at 560px. Changing type clears the device and main selection. New cards default to Super compact.

Recommendations are explicit add actions, never automatic configuration. A single available primary candidate can be suggested as the main entity. Supporting suggestions use the selected card type and same-device entity classes, such as power readings for switches, humidity for climate, door status for locks and images for robots. Battery readings apply across types. Unavailable sources, configuration entities, unrelated diagnostics and already represented readings are excluded; missing metadata produces no guess. Existing selections and reported values already shown in the card suppress duplicates. At most four suggestions appear, each with a reason; manual source selection remains available.

Edits stay in a local draft until **Add card** or **Save changes**. Back and Cancel confirm discarding a changed draft; removing an existing card also requires confirmation. Shared configuration loading, saving and errors stay visible. **Configure** on Smart home retains ordering, group moves and per-card size controls. The ordered `smartHome.layout` stores each card independently of discovery.

The separate **Danger zone** includes a backup link and a confirmation that clears the entire Smart home layout, including groups and scene cards, across screens. Today's favourites, other settings and Home Assistant entities are preserved. No former visibility rules or inferred device cards are migrated.

## Direction contract

THESIS: Build the card you want to see; remove the entity inventory and overlapping visibility rules from the main task.

OWN-WORLD: Preserve Afterglow's Liquid Glass card material, pearl/midnight palette, system typography and blue action controls. Use opaque fields and restrained separators for configuration.

STORY: Scan your cards, choose Add card, select its type and device, attach sources manually or accept relevant suggestions, inspect the resulting card, and save. Preview controls cannot operate devices. Missing sources stay visible and replaceable.

FIRST VIEWPORT: A compact Your cards heading and Add card action above a flat list. The editor pairs device/source and appearance fields with a separate real card preview; phone layouts stack the preview above the fields. Reset sits below the collection in a clearly separated Danger zone.

FORM: User-directed card-first composition, code-led extension of the existing visual world; no concept roll for this specified arrangement. No shipping raster assets.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
