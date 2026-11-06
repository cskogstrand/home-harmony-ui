# Entity picker

Entity selection uses one searchable dropdown throughout notifications, Smart home card settings, alarm selection, calendar and to-do assignments, timetable sources, event editing and dashboard favorites.

Choose a device first to see its entities. **All entities** includes the full eligible list; **Without a device** includes helpers, calendars and other standalone entities. Searching also finds entities directly by name, ID, device, room or integration. Device selection narrows search to that device. **Back to devices** clears that filter.

Arrow keys move through results; Tab reaches the other controls. Enter activates buttons, Space toggles checkboxes, and Escape closes the dropdown and returns focus to its field. Multi-selection stays open until **Done**. Existing removal and reassignment confirmations still apply.

## Reuse

`src/components/EntityPicker.tsx` accepts the eligible `entities`, a translated `label`, stable `Entity.preferenceId` values, and an `onChange` callback. Supply `multiple` with an array for multi-selection. The caller keeps ownership of eligibility, saving and confirmations.

- `placeholder`, `ariaLabel`, `hideLabel` and `describedBy` adapt the field to its surrounding form.
- `clearLabel` offers an explicit empty choice for optional single selections.
- `getLabel` and `getDescription` add contextual names or assignment information.
- `disabled` blocks the whole field; `disabledReason` explains individual ineligible choices.
- `missingLabel` describes saved selections no longer in the eligible list. They remain selected until explicitly replaced or removed.

The picker does not change Home Assistant visibility, fetch additional state or send device commands. Its candidate list comes from the existing Home Assistant model and each caller's eligibility rules. It shows identifiers to distinguish similarly named entities, but never renders entity state values.

Dashboard favorites first offers a vertically scrollable, three-column card-type catalogue with inert, super compact previews from the shared Smart home library. The selected type filters the entity picker, including helper aliases such as switches and `input_boolean`. The catalogue and filtered picker sit in a distinct shared glass inset. A separate selected-favorites grid shows actual inert Smart home card previews, with named unavailable placeholders when an entity is missing. Group fields and removal actions sit beneath each preview; preview controls never send commands. A separate **Card groups** section creates and removes reusable groups; names are trimmed, limited to 80 characters and checked for case-insensitive duplicates. Each card chooses its group through a searchable Popover/Command dropdown, including **Ungrouped**. Search ignores case; arrow keys and Enter select an option, and Escape returns focus to the field. Removing a group leaves its cards ungrouped. Empty groups remain available after saving. Switching types preserves selection order; selection and group changes apply together only with **Save favorites**. Cancel discards both; groups use stable `Entity.preferenceId` values, survive renames and missing entities, and lose their card assignments when favorites are removed. The group list itself remains until groups are explicitly removed. Removing an individual favorite or clearing the selection still requires confirmation. Unknown domains remain selectable under **Other entities**.
