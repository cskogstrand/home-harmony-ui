# Notifications

Open **Home settings → Notifications** to add rules. Choose **Display as → Banner** for a compact summary or **Section** for grouped details. **Show on** places it at the top of **Today only** or **All main pages**: Today, Our week, Lists, School and Smart home. The default is a section on all main pages. Both choices are shared across screens and included in backups.

The banner shows up to three alerts, including additional readings and camera/dismiss actions; **View all** opens the complete list. The section shows up to three ongoing tasks and three current alerts. Both hide when there is nothing to show. The header bell and automatic camera popups remain available on every page, regardless of this placement choice.

| Type | Behavior |
| --- | --- |
| Ongoing tasks | Stays visible while an entity state or attribute matches. Clears when the condition stops matching. Use this for an appliance that is running. |
| Current alerts | Shows a matching state, calendar event, or momentary event. State alerts clear when the condition stops matching; calendar alerts clear at the event's end. Dismiss hides that activation on this screen. |
| Camera popup | Opens a selected camera when a condition becomes true or a new event arrives. Closes after the configured duration or when dismissed. |

Rules, titles, messages and selected entities are saved in shared settings and included in settings backups. Each rule and the whole notification system can be switched off. No rule is enabled until you add it.

## Choose a trigger

Entity fields use the shared [entity picker](entity-picker.md). Choose a device to narrow the list, choose **All entities** or **Without a device**, or search directly by name, entity ID, room or integration. Camera and calendar fields show the entities supported by that field. Unavailable saved selections stay visible until you replace or remove them.

- **Entity state:** choose an entity, an optional attribute, and Equals, Does not equal, Above or Below. Use the raw Home Assistant value shown in the editor, such as `on`, `running`, or a numeric power threshold. Missing/unknown readings do not satisfy ordinary conditions; an explicit Equals `unavailable` or `unknown` condition can report those states.
- **Calendar event:** choose a calendar and how many minutes before its start to show the alert, from 0 to 1,440. Each overlapping event gets its own alert, including all-day events in the home's timezone. The calendar does not need to be assigned to a person in the planner.
- **Event entity:** choose a Home Assistant `event` entity. Each new timestamp triggers once; optionally match its reported `event_type`. This is commonly used for doorbells. [Home Assistant event documentation](https://www.home-assistant.io/integrations/event/).
- **Home Assistant event:** enter the event-bus type and optional exact top-level JSON filters. For example, `{"action":"single"}` only matches that action. Use filters to select the intended device if several devices emit the same event type. Empty filters match all events of that type. Nested filters and templates are not supported. [Home Assistant WebSocket events](https://developers.home-assistant.io/docs/api/websocket/#subscribe-to-events).

Momentary events and camera popups have a duration and cooldown. Repeated triggers during cooldown are ignored; later triggers replace the same rule's active alert and restart its duration. Different camera alerts queue until closed or expired. Closing a camera keeps its alert available through **Show camera** until expiry; dismissing the alert hides it entirely.

The camera popup header counts down to its expiry in minutes and seconds. While a state trigger still matches, it shows “Closes automatically when this alert expires.” instead. The configured expiry still applies; clearing the trigger does not restart the countdown.

Use **Additional readings (optional)** to select multiple entities, such as an appliance's remaining minutes and completion percentage. Each selected reading appears in the banner and notification list with its reported value and unit. Uncheck a selection to remove it. Existing rules keep their previously selected reading; these choices are shared across screens and included in backups. Readings do not estimate progress.

## Typical setup

1. For a washing machine, add **Ongoing tasks**, choose its operating-state entity, and match the state it reports while running. A power sensor with **Above** can also work; use a Home Assistant helper if the appliance's power fluctuates during a cycle.
2. For current plans, add **Current alerts**, choose **Calendar event**, select a calendar, and set the advance notice.
3. For a doorbell, add **Camera popup**, select its event entity or a binary sensor that turns `on`, then select the camera. Person-detection sensors work the same way.

## Connection and privacy

Notifications run while the dashboard is open and connected. They do not send phone push notifications, email, or messages, and cannot catch events while the browser is closed or suspended. Active state/calendar notifications are reconstructed on load; old doorbell events and camera triggers are not replayed on initial load, reconnection or rule edits. Sensor recovery from `unavailable` does not open a camera.

Alert content, dismissals and camera views remain in this browser session. Reloading clears dismissals. Home Assistant events, event history and camera images are not written to settings storage. Cameras use the existing authenticated server media path, with video, MJPEG and labeled snapshot fallbacks; background tabs pause live playback. Connection loss clears active alerts and stops camera playback.

Choose devices from your own Home Assistant instance in the editor. Keep real household identifiers and event filters out of repository examples and screenshots.
