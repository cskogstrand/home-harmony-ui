---
version: 1
slug: "src-components-smarthomesettings-tsx"
primary_target: "src/components/SmartHomeSettings.tsx"
related_targets: ["src/components/smart-home-settings.css","src/components/devices/SmartHomeCard.tsx","src/components/devices/SmartHomeCards.tsx","src/pages/SmartHome.tsx"]
---

# Smart home card editor

Mode: Operate. Explicit, shared card composition replaces device visibility trees. Choose a card family, attach a compatible main entity and optional supporting entities directly in the production card preview, then save. New discoveries never create cards. Existing order, density and group controls remain. The confirmed danger zone clears only Smart home; Today and Home Assistant remain unchanged. Retired visibility configuration is discarded, without migrating cards.

## Built behavior

**Your cards** lists saved cards with their type, group and entity count. **Add card** opens a searchable catalogue grouped by purpose, showing types with compatible entities when devices are available; **Show all types** exposes the full catalogue and starts enabled when no entities are discovered. The gallery link lives in this catalogue. Missing main entities remain identified in the collection and replaceable in the editor.

The editor reuses `SmartHomeCard`, placing the main entity picker above its controls and the supporting entity picker above its extra content. Main entities must match the chosen type; supporting entities can come from any device and appear only when explicitly attached. Device controls, media streams and history are paused in the preview. The adjacent fields edit name, type, size and group; changing type clears the main selection. New cards default to Super compact. The preview and fields stack at 1100px, and the fields become one column at 560px.

Edits stay in a local draft until **Add card** or **Save changes**. Back and Cancel confirm discarding a changed draft; removing an existing card also requires confirmation. Shared configuration loading, saving and errors stay visible. **Configure** on Smart home retains ordering, group moves and per-card size controls. The ordered `smartHome.layout` stores each card independently of discovery.

The separate **Danger zone** includes a backup link and a confirmation that clears the entire Smart home layout, including groups and scene cards, across screens. Today's favourites, other settings and Home Assistant entities are preserved. No former visibility rules or inferred device cards are migrated.

## Direction contract

THESIS: Build the card you want to see; remove the entity inventory and overlapping visibility rules from the main task.

OWN-WORLD: Preserve Afterglow's Liquid Glass card material, pearl/midnight palette, system typography and blue action controls. Use opaque fields and restrained separators for configuration.

STORY: Scan your cards, choose Add card, select its type, attach sources where their content appears, and save. Preview controls cannot operate devices. Missing sources stay visible and replaceable.

FIRST VIEWPORT: A compact Your cards heading and Add card action above a flat list. The editor centers a real card with inline source pickers beside a narrow name/group/size panel; phone layouts stack. Reset sits below the collection in a clearly separated Danger zone.

FORM: User-directed card-first composition, code-led extension of the existing visual world; no concept roll for this specified arrangement. No shipping raster assets.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
