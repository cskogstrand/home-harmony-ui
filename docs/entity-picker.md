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
