# Notifications

Open **Home settings → Notifications** to add rules using **Add notification** in the relevant group, including an empty group. Select one of the three full-width style examples under **Display as**. Choose **Display as → Banner** for a compact summary, **Section** for grouped details, or **Activity cards** for larger readings, an optional animated task icon and progress. **Show on** places it at the top of **Today only** or **All main pages**: Today, Calendar, Lists, School and Smart home. The default is a section on all main pages. Both choices are shared across screens and included in backups.

The banner shows up to three alerts, including additional readings and camera/dismiss actions; **View all** opens the complete list. Sections and activity cards show up to three notifications per group: ongoing tasks, current alerts and camera popups. The settings list and full notification page use the same separate groups. All styles hide when there is nothing to show. The header bell and automatic camera popups remain available on every page, regardless of this placement choice.

| Type | Behavior |
| --- | --- |
| Ongoing tasks | Stays visible while an entity state or attribute matches. Clears when the condition stops matching. Use this for an appliance that is running. |
| Current alerts | Shows a matching state, calendar event, or momentary event. State alerts clear when the condition stops matching; calendar alerts clear at the event's end. Dismiss hides that activation on this screen. |
| Camera popup | Opens a selected camera when a condition becomes true or a new event arrives. Closes after the configured duration or when dismissed. |

Rules, titles, messages and selected entities are saved in shared settings and included in settings backups. Each rule and the whole notification system can be switched off. No rule is enabled until you add it.

On main pages, the first notification expands the notification area and the last one collapses it over 250 ms with ease-in-out, moving the dashboard content with it. Exiting controls become inactive immediately. Reduced motion removes the height animation and keeps a short fade.

## Choose triggers

Under **When to show it** (**Når varselet skal vises**), use **Add trigger** (**Legg til utløser**) to configure up to 10 triggers for one notification. **Any** trigger can activate it. For example, one camera popup can respond to both a doorbell event and a motion sensor. Each trigger has its own source, condition or event filters, and can be removed while at least one remains. Existing single-trigger rules keep working, and extra triggers are shared across screens and included in backups.

State alerts stay visible while at least one state condition matches. Camera state triggers react independently: a second sensor becoming active can open the camera even while the first is still active. All camera and momentary-event triggers in a rule share its cooldown and duration; simultaneous matches create one timed alert. Calendar events remain separate alerts, and mixed current-alert rules keep their state, calendar and timed alerts independent.

Entity fields use the shared [entity picker](entity-picker.md). Choose a device to narrow the list, choose **All entities** or **Without a device**, or search directly by name, entity ID, room or integration. Calendar fields show supported calendar entities. Camera selection is separate and lists your configured cameras. Unavailable saved entity selections stay visible until you replace or remove them.

- **Entity state:** choose an entity, an optional attribute, and Equals, Does not equal, Above or Below. Use the raw Home Assistant value shown in the editor, such as `on`, `running`, or a numeric power threshold. Missing/unknown readings do not satisfy ordinary conditions; an explicit Equals `unavailable` or `unknown` condition can report those states.
- **Calendar event:** choose a calendar and how many minutes before its start to show the alert, from 0 to 1,440. Each overlapping event gets its own alert, including all-day events in the home's timezone. The calendar does not need to be assigned to a person in the planner.
- **Event entity:** choose a Home Assistant `event` entity. Each new timestamp triggers once; optionally match its reported `event_type`. This is commonly used for doorbells. [Home Assistant event documentation](https://www.home-assistant.io/integrations/event/).
- **Home Assistant event:** enter the event-bus type and optional exact top-level JSON filters. For example, `{"action":"single"}` only matches that action. Use filters to select the intended device if several devices emit the same event type. Empty filters match all events of that type. Nested filters and templates are not supported. [Home Assistant WebSocket events](https://developers.home-assistant.io/docs/api/websocket/#subscribe-to-events).

Momentary events and camera popups have a duration and cooldown. Repeated triggers during cooldown are ignored; later triggers replace the same rule's active alert and restart its duration. Different camera alerts queue until closed or expired. Closing a camera keeps its alert available through **Show camera** until expiry; dismissing the alert hides it entirely.

The camera popup header counts down to its expiry in minutes and seconds. While a state trigger still matches, it shows “Closes automatically when this alert expires.” instead. The configured expiry still applies; clearing the trigger does not restart the countdown.

Under **Entities and readings**, use **Add entity** to choose an additional reading, such as an appliance's remaining minutes or completion percentage. Its display name and placement are configured in the same section. Each selected reading appears in the banner and notification list with its reported value and unit. Use the remove button beside a reading to remove that additional selection. Entities also used by the trigger or progress stay available for those roles. Existing rules keep their previously selected reading; these choices are shared across screens and included in backups. Readings keep their reported values; optional progress is configured separately below.

## Entities and readings

In **Entities and readings**, set a local display name for every selected source, additional reading or progress entity. State and attribute readings can have different names and placements, even when they belong to the same entity. Leaving the name empty uses the entity name. Home Assistant names and references remain unchanged. Configured camera names are managed under **Home settings → Cameras**.

Choose **Under the title**, **Left reading**, **Right reading**, **At the bottom**, or **Hidden**. Activity cards show left and right as large readings in separate columns; other styles show them as text. **Automatic** keeps the source under the title, places the first two additional readings left and right, and places the rest at the bottom. Entities selected only for progress start hidden. Hidden readings still drive triggers and progress. Names and placements are saved with the rule and included in backups.

## Progress for ongoing tasks

Enable **Show progress bar** in an ongoing task. Choose a **Current value** entity and optional numeric attribute, then configure **Start value** and **End / total value** using either fixed numbers or entities (with optional attributes). Enabling progress preselects the numeric trigger source or the first numeric additional reading and uses a numeric trigger threshold as the end value; otherwise the end defaults to 100. Review these values before saving.

- Completion percentage: current percentage entity, start 0, end 100.
- Completed units: current count entity, start 0, end the entity reporting the total.
- Remaining time: remaining-time entity, start the total-duration entity, end 0.

All three values must use the same unit. Progress follows `(current − start) / (end − start)` and is limited to 0–100%. Both directions and decimals are supported. Missing, unavailable, nonnumeric or equal endpoint readings show an unavailable message rather than invented progress. The trigger still controls when the task appears and clears; reaching 100% does not change Home Assistant or override the trigger.

Progress appears in banners, sections and activity cards. It updates with entity readings, and its configuration is shared across screens and included in backups. Existing rules keep progress off.

## Activity cards and previews

Choose **Display as → Activity cards** for the iPhone activity-inspired layout. Under **Icon and animation**, search or filter by category to choose from every device family supported by the dashboard, including robot vacuums and robot lawnmowers. Appliance variants include dryers, ovens, refrigerators, heat pumps and EV chargers; cover variants follow [Home Assistant cover classes](https://www.home-assistant.io/integrations/cover/), with sensor choices for temperature, humidity, motion, smoke, gas, water leaks and more. Existing icon selections are preserved. Automatic keeps the generic icon for the notification kind. Ongoing tasks can animate their icon; the per-rule switch and the device's reduced-motion preference can keep it still. The chosen icon also animates in the editor’s icon picker so you can see its motion before saving. Current and camera alerts use static icons. Slow, icon-only motion indicates activity: robots travel, fans spin, covers lift or swing, and water and signal icons flow or fade. Loops pause offscreen and in background tabs. Readings and text remain stationary. Timestamp readings show the reported time in the home's timezone; no completion time is estimated.

Open **Preview notification** on the settings page to see all saved rules together, grouped by type, including inactive and disabled rules. Expand **Display as** below any preview to choose its style; this saves that rule's display choice automatically and updates the preview. With no saved rules, the modal shows a built-in example. The editor keeps its own preview alongside the fields. Both reuse the production notification component, including custom names and placements. **Sample data** is clearly labeled and stays local to each preview. Drag **Demo progress** or press **Play demo** to simulate progress independently for each notification, or turn sample data off to inspect current readings. Camera and dismiss actions are disabled in the preview; demo values never change Home Assistant or saved rules. Reduced motion also disables automatic demo playback; the slider remains available.

The editor uses collapsible sections for content, camera and image, display style, trigger, entities and readings, progress, appearance and timing. Camera rules start with **Camera and image** open. When the title is empty, content also starts open and the title field receives focus; other sections start closed. The **Use in notification** shortcut preselects the camera and opens its camera and trigger sections. Several sections can stay open at once. Sections expand smoothly and can reverse midway through a transition. Keyboard actions are immediate, reduced motion avoids moving the fields, and the editor stays the same height as sections open or close. Collapsing a section keeps its draft values, and saving opens any section with invalid settings. Save and Cancel remain outside the scrolling fields; on wide screens the preview sits beside the form, and on phones it appears above it for task and current-alert rules. Camera rules put the fields first, with the style preview below them.

## Typical setup

1. For a washing machine, add **Ongoing tasks**, choose its operating-state entity, and match the state it reports while running. A power sensor with **Above** can also work; use a Home Assistant helper if the appliance's power fluctuates during a cycle.
2. For current plans, add **Current alerts**, choose **Calendar event**, select a calendar, and set the advance notice.
3. For a doorbell, add **Camera popup**, select its event entity or a binary sensor that turns `on`, then select the camera. Person-detection sensors work the same way.

Camera rules have a **Camera and image** section. **Camera** lists only cameras explicitly added in **Home settings → Cameras**. Each camera has a name, a connection (Home Assistant or a saved go2rtc server), and a source. Configure reusable servers in **Home settings → Camera connections**. HA camera discovery alone does not add cameras to this picker.

**Show in notification** chooses that camera's live video or its configured **Person snapshot**. **Test camera output** previews the choice. **Configure camera (new tab)** opens setup without losing the notification draft. **Smart home → Cameras → Use in notification** preselects the camera in a new rule. See [camera setup](cameras.md). A snapshot may predate the alert and refreshes while visible to pick up delayed images.

Camera notification cards show the selected video or person image inline in every presentation, including banners and compact activity cards. Live video uses the camera's fast snapshot preview while connecting, including its configured Frigate latest-image source. **Show camera** opens the larger viewer; the card pauses its own feed while that popup is open and resumes when it closes. Offscreen cards and background tabs stop their live feeds. Person images reuse the shared page cache, prefetched when saved settings load and refreshed by HA entity updates even with no open viewer; direct Frigate sources poll while the tab is visible. Style previews show a camera placeholder without opening real streams; **Test camera output** remains the explicit media test.

Under **Camera and image**, enable **Show last person on card** to overlay the configured latest person image on that rule's live notification card. It defaults to off and is saved with the rule, shared across screens and included in configuration backups. Fullscreen live previews always show the inset when a person source is configured. Person-only notifications keep their full image without a duplicate inset. Tap the inset for image status or retry; it may predate the alert.

## Connection and privacy

Notifications run while the dashboard is open and connected. They do not send phone push notifications, email, or messages, and cannot catch events while the browser is closed or suspended. Active state/calendar notifications are reconstructed on load; old doorbell events and camera triggers are not replayed on initial load, reconnection or rule edits. Sensor recovery from `unavailable` does not open a camera.

Alert content, dismissals and camera views remain in this browser session. Reloading clears dismissals. Home Assistant events, event history and camera images are not written to settings storage. go2rtc cameras use authenticated signaling with an HTTP MSE fallback; Home Assistant cameras retain their video, MJPEG and labeled snapshot fallbacks. Background tabs pause live playback. Connection loss clears active alerts and stops camera playback.

Choose devices from your own Home Assistant instance in the editor. Keep real household identifiers and event filters out of repository examples and screenshots.
