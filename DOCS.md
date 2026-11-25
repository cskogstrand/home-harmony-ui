# Setup and everyday use

[← Overview](https://github.com/cskogstrand/home-harmony-ui/blob/main/README.md) · [Morning summaries](https://github.com/cskogstrand/home-harmony-ui/blob/main/docs/morning-summary.md) · [Development](https://github.com/cskogstrand/home-harmony-ui/blob/main/docs/development.md)

Install on [Home Assistant OS](#haos-app-installation) or with [Docker](#manual-docker-deployment), then choose **Get started** on Today to set up the board.

Jump to: [Connection help](#access-and-the-home-assistant-connection) · [Storage and backups](#configuration-and-storage) · [Timetables](#school-timetables) · [iPhone uploads](#share-a-pdf-from-iphone) · [Timetable API](#read-timetables-from-an-automation)

## HAOS app installation

1. Add `https://github.com/cskogstrand/home-harmony-ui` to the Home Assistant app/add-on repositories and install **Home Harmony UI**.
2. Create a [long-lived access token](https://developers.home-assistant.io/docs/auth_api/#long-lived-access-tokens) in the HA profile for the account the dashboard should use. Prefer a dedicated account with only the permissions you need.
3. In the app's **Configuration** tab, set:

   ```yaml
   home_assistant_url: http://homeassistant
   home_assistant_token: YOUR_LONG_LIVED_ACCESS_TOKEN
   dashboard_password: YOUR_UNIQUE_PASSWORD_AT_LEAST_12_CHARACTERS
   dashboard_auth_disabled: false
   timetable_api_key: "" # Optional read-only timetable access; see below.
   ```

4. Start/restart the app and open its web interface on port **8099**. Enter username **dashboard** and the configured dashboard password in the browser's authentication prompt. To skip login on a trusted local network, set `dashboard_auth_disabled: true`; the dashboard password can then be empty.
5. Open **Get started** on Today to choose people, calendars and lists. Optional timetables are under **Settings → Household**. Use the same dashboard address on your other screens.

HAOS supplies these options through `/data/options.json`; explicit environment variables take precedence. The app supports 64-bit ARM (`aarch64`) and x86-64 (`amd64`). The Supervisor manages `/data` as persistent app data and includes it in app backups. The app uses its own web port, not HA ingress. The port can be changed under the app's Network settings.

Use the HA Core address and port reachable **from the app container**. If `homeassistant.local` fails, try the internal hostname `homeassistant` or the device's LAN IP. Include HA Core’s configured port in the URL; for example, `http://homeassistant:8123` when it uses port 8123. Check the actual port under **Settings → System → Network → HTTP server** ([HA HTTP settings](https://www.home-assistant.io/integrations/http/)).

If startup reports a token configuration error, paste only the complete token created under **Profile → Security → Long-lived access tokens**, without surrounding quotes or a `Bearer ` prefix, then save and restart the app. Surrounding whitespace is trimmed; whitespace inside the token and other invalid characters are rejected. A startup format error happens before contacting Home Assistant and does not mean HA rejected the token. For manual deployments, check for an environment variable overriding the saved option.

## Manual Docker deployment

Copy `.env.example` to `.env` and replace the URL, token and dashboard password:

```sh
cp .env.example .env
# Edit .env before starting.
docker compose up --build -d
```

Compose reads `.env`, publishes `${PORT:-8099}`, and mounts `./data` at `/data`. The container always uses `/data`; the example `DATA_DIR=./data` is for native Node/Vite. To restart after changing configuration, run `docker compose up -d` again.

For plain Docker:

```sh
docker build -t home-harmony-ui .
docker run -d --name home-harmony-ui --restart unless-stopped \
  --env-file .env -e DATA_DIR=/data -e PORT=8099 \
  -p 8099:8099 -v "$PWD/data:/data" home-harmony-ui
```

Protect `.env` and its backups. It is ignored by Git and excluded from the image. Changing Docker environment configuration requires recreating the container; keep the data mount.

## Access and the Home Assistant connection

By default, the dashboard password protects HTML, assets, settings, timetable images and the WebSocket proxy. Disabling login opens all of these to anyone who can reach the dashboard, including the configured HA account's home controls. Use the bypass only on a trusted local network. Cross-origin checks remain enabled, and a Home Assistant token is still required. The token is sent to HA only by the server; it is absent from browser storage, public runtime configuration, settings backups and image URLs. The browser receives the configured URL for links to HA.

The server forwards the [HA WebSocket protocol](https://developers.home-assistant.io/docs/api/websocket/), calendar REST reads and uploaded person photos to the configured HA origin. Browsers connect only to the dashboard; HA CORS changes are unnecessary. Cross-origin browser requests are rejected. A reverse proxy must preserve the browser's Host header and support WebSocket upgrades. Avatars use photos uploaded to people in Home Assistant, with initials when a photo is missing or cannot load; custom external picture URLs are not supported.

**Connection failures:** “Cannot connect” does not establish that the token is invalid. Reconnect and check the dashboard app's **Log** tab: `ENOTFOUND` / `EAI_AGAIN` indicates hostname resolution, `ECONNREFUSED` indicates the address/port refused the connection, `EHOSTUNREACH` / `ENETUNREACH` indicates network reachability, and an unexpected HTTP status indicates a failed WebSocket upgrade (for example, a redirect or reverse proxy response). A rejected HA token is logged separately and shown as “Home Assistant rejected the server token”. Logs never include the token. Save configuration changes and restart the app before reconnecting.

**Slow scenes and scripts:** The dashboard waits up to two minutes for scenes, scripts and commands to entities identified as Eva by Home Assistant. Eva moods appear as scenes; the integration can wait up to 30 seconds for its API call, then another 60 seconds for mood confirmation. Other commands keep their 15-second limit, except Sonos grouping. A timeout, including Eva's “accepted but not confirmed” response, means the outcome is unconfirmed: the action may still be running or already complete. Check its reported state or the script trace in Home Assistant before trying again. Commands are never retried automatically. Scripts use [`script.turn_on`](https://www.home-assistant.io/integrations/script/#waiting-for-a-script-to-finish-in-yaml), so acceptance confirms the start request, not successful completion of every step.

Use HTTPS through a trusted reverse proxy, or a trusted home network/VPN. HTTP Basic authentication does not encrypt the password over plain HTTP. Anyone with the dashboard password has the configured account's HA capabilities, including home controls. Changing the password and restarting invalidates future requests; browsers may remember Basic credentials until their authentication cache is cleared. **Disconnect** pauses live controls in that tab until reconnect/reload; it is not a logout or token revocation. Rotate/revoke the HA token in HA and update the server configuration when needed.

## Household preferences

After a reload the dashboard shows **Connecting to Home Assistant…** for up to ten seconds while it connects; controls stay unavailable until it is connected. If connecting takes longer or fails, the banner becomes a warning that controls are paused. When Home Assistant disconnects later, the banner says readings are stale and links to **Settings → System → Connection & account** for recovery. Calendars identify previously loaded plans while live list controls pause until reconnection.

Open the house button for **Home status** in the header. A house without a badge means every selected source has reported and none requires attention. The warning count includes active exceptions and selected sources with missing readings; from ten issues the badge shows the number alone, and the button's name always gives the full count. Loading, offline and unconfigured households have distinct indicators. The overview pairs the current result with an illustrated house. When several sources need attention, the illustration matches the first listed issue. **View readings** lists the selected sources by category with their rooms and reported values. **Manage sources** opens all ten categories and their source pickers. The initial selection uses the configured alarm, area-assigned smoke detectors and their low-battery signals. Selecting sources in one category preserves the others. Settings sync across screens and are included in backups.

Home status also counts Home Assistant maintenance that needs action: repair issues with severity *error* or *critical* that are not ignored, an automatic backup whose last attempt failed, a last successful automatic backup older than 48 hours (or, for a less frequent schedule, older than the spacing between the two latest automatic backups plus a day), and backup locations that report an error. These rows link to **Settings → System → Home Assistant health**. Repair warnings and Home Assistant's own notifications never appear on the family surface.

Under **Customize Today → Home status**, enable and position the optional card. It appears only while a selected source needs attention or lacks a reading on a connected dashboard. Both the card and the header open the same overview.

The Dreame room selector uses the robot’s active map and requires the integration’s segment-cleaning service. Selecting rooms prepares a request. **Clean selected rooms** sends it once.

**Ask the house** sends a typed sentence to [Home Assistant Assist](https://www.home-assistant.io/voice_control/), for example “Which lights are on?” or “Turn off the kitchen light”. It is off until you turn on **Settings → Screen and alerts → Assist → Show Ask the house**; the header then shows a speech-bubble button on every screen. Choose the **Conversation agent** there: **Home Assistant (built-in)** is the default, and agents from other integrations appear when they understand the dashboard language. Questions use the dashboard language (English or Norwegian Bokmål), so the built-in agent needs that language's sentences. Both choices sync across screens and are included in backups. The dialog keeps this session's questions and answers so follow-ups continue the same conversation; **Clear conversation** starts a new one, and reloading clears it. Completed actions show a check. When Home Assistant does not understand or the request fails, the answer explains it in plain words, the sentence returns to the field and **Try again** sends it once more; nothing is resent automatically. A timeout or lost connection means the outcome is unknown, so check the device before asking again. While Home Assistant is offline the button is disabled.

Assist can see and control only the entities you expose to it in Home Assistant (**Settings → Voice assistants → Expose**). Exposure is managed there; the dashboard never widens it. Anyone with dashboard access can use Ask the house with the configured account's permissions, so expose only what the household should control by voice or text. Voice input is not available yet; it needs a secure context (HTTPS or localhost) for the microphone.

**Settings → Screen and alerts → Appearance → Advanced appearance → Modal glass** controls dialog transparency (0–85%), frost (8–48px), color saturation (100–200%) and background dimming (0–60%). Defaults are 70%, 20px, 150% and 20%. The preview updates while dragging; releasing a slider saves the setting across screens. **Reset glass appearance** restores only these four values. Older settings and backups receive the defaults, and new backups include the choices. Reduced transparency, increased contrast, forced colors and browsers without backdrop filtering retain solid dialog surfaces. Menus, navigation and normal reading panels retain their existing material.

In **Settings → Household**, choose who appears on the board and in what order. Link each person’s calendars, tasks, daily tasks and homework, and choose which shopping lists the household shares. Hidden people keep their assignments and timetable files. All people come from Home Assistant; add a person there for shared plans and tasks, then assign its calendars and lists in **Settings → Household**. Favorites, dark mode, compact mode, calendar view/start day and alarm selection are shared too.

Enable **Customize Today → Homework** to see each visible person’s unfinished homework. **Through today** (the default) includes overdue work and everything due today. **Through tomorrow** includes tomorrow as well. Choose **Due today only** or **Due tomorrow only** for a single day, or **All homework** for the full date range. Deadlines use the home’s time zone. **Include homework without a due date** is on by default and applies to every date choice.

Turn on **Show completed homework** to include finished items in the selected period. **Homework action** lets you check items off on Today or show a single link to the full homework view in Lists or School. The School link also works for people without a timetable. These preferences sync across screens and travel with configuration backups.

**Settings → Household → To-do lists → Shopping lists** lets you connect another Home Assistant list with **Add shopping list**. Tap **Choose list icon** beside a linked list. Browse the categories or search for an icon, such as **Christmas tree**, then tap it to save. Closing the dialog keeps the current icon. Each list’s **Display settings** control sort order and completed-item visibility. Existing shopping lists use a basket until you choose another icon. To unlink a list, open its picker, choose **No list selected** and confirm **Unlink list**. Its items stay in Home Assistant.

In **Settings → Household → To-do lists → Shopping lists**, open **Display settings** for a list and add or remove **Frequent items**. Each item becomes a one-tap shortcut on that shopping list. A checkmark means the item is already there. A completed item reopens when supported.

With multiple shopping lists, Today shows up to three named lists and their reported outstanding counts. Tap a name to open the list or its plus button to start adding there. With a single list, Today shows up to three items in total. **Lists → Shopping** gives access to every linked list. Tap a list’s icon and name in the horizontal filter to switch lists. Item suggestions, edits and drafts stay with that list. **Lists → Family tasks** uses the same row with person avatars. Tap **All lists** to see everyone’s tasks.

Reassign calendars and task lists previously linked to the built-in Everyone person in **Settings → Household**. Their events and items stay in Home Assistant.

**Settings → Household → Calendars → Waste collection** lets you choose an active person for the waste calendar already selected in **Customize Today → Waste collection**. Pickups appear in that person's calendar and **Everyone’s day**, even when the separate Waste collection panel is hidden. This uses the normal calendar assignment, so existing assignments are reflected here, changing the person moves the calendar, and **No person selected** unlinks it. Hidden people keep their assignment but their pickups stay hidden. The assignment syncs across screens and is included in configuration backups.

Waste pickups use only the event's start date in the home's time zone, ignoring its start time and end. Each appears once as a date-only entry, including in month, week and day views. At 09:00, today's entries say **Picked up today**, based on time only, and remain visible for that day. The same waste-type icons as the Today panel appear in calendar entries and their details, including multiple icons for combined pickups. Titles and descriptions stay as supplied by the calendar; open an entry for details and edit it in its source calendar. The Today panel shows pickups that share a date as one row with one date, every fraction's icon and their titles. Calendar views follow the visible date range; the separate panel's days-ahead and three-date limit do not restrict them.

In **Settings → Devices → Electric vehicles**, select **Add electric vehicle** and choose a source from Home Assistant. Each saved car has a card with its name, image and source. Open **Edit** to choose a photo or address sensor, or to remove the car from the header. To use **TeslaMate**, connect TeslaMate and Home Assistant to the same MQTT broker and enable `MQTT_HOME_ASSISTANT_DISCOVERY=true` in TeslaMate. An existing manual TeslaMate MQTT configuration with a registered device per car also works. For a single widget with TeslaMate readings and Tesla climate controls, add the TeslaMate source, open **Edit** on its card and select the matching Tesla vehicle under **Send commands for … through**. One card supplies readings and controls in the header. On phones the header shows one compact button with the lowest battery; with several cars it opens a list to choose from. Each car has its own pairing, which syncs across screens and is included in backups. Choose **Readings only** to remove the pairing. [TeslaMate setup guide](https://docs.teslamate.org/docs/integrations/home_assistant/)

TeslaMate supplies read-only telemetry, including cabin and lock status. The compact widget shows the picture, battery, gear, climate fan and charge or connection icon. The fan turns while climate is on. The widget and the overview beside the photo show the same driving or vehicle status. An explicit sleep, offline or paused-polling report takes precedence over retained gear and speed. The widget keeps the reported battery level and hides the fan and charging indicators during these states. A connectivity sensor that only reports disconnection shows Offline. Narrow screens use gear letters or a status icon such as the sleep moon. Open a widget to see its charge limit, and, during charging, the expected finish and power if reported. Finish times use the home’s time zone. The dialog includes a local model illustration for Model S and Model 3. To show your own photo, select a Home Assistant image entity for that car in settings. The overview shows the cabin climate controls supported by the car, lock state, open doors or windows, vehicle position and current arrival estimate. In a paired widget, TeslaMate supplies the measured temperature and cabin status. The selected Tesla vehicle receives the commands and supplies the supported modes. The temperature control uses a reported setpoint from the readings source when available, otherwise it shows the Tesla climate entity’s target. If the command vehicle becomes unavailable, the widget keeps showing TeslaMate readings.

Sending a vehicle command disables controls for that command entity and shows a spinner. For climate on/off it waits for the selected car to report the requested state. For target temperature it waits for a matching setpoint if the readings source exposes one. Standard TeslaMate MQTT reports measured cabin temperature and climate on/off. Without a corresponding sensor, the next fresh reading from that car clears the spinner. This shows that telemetry resumed. If Home Assistant rejects the command, the control shows the error and allows a manual retry.

When the dialog opens, its overview and trip tab display OpenStreetMap at the car’s reported coordinates. The map follows the dashboard theme and pans to each new position at your chosen zoom. Speed, gear and heading appear over the map when reported, including in fullscreen. Vehicle position shows the Home Assistant zone first, then an address, then the tracker state. The dashboard detects an address sensor on the car. If a separate integration supplies the address, choose its sensor under **Settings → Devices → Electric vehicles → Address sensor for …**. Scroll a long address sideways to read it in full. Choose **Show map fullscreen** for a larger view. Close it or press Escape to return to the same tab and zoom. While the map is open, the browser requests map tiles from OpenStreetMap and sends the dashboard origin with those requests. Touch the tabs to inspect a charging session, cabin and seats, security, trip, tyres or service data. The tyre diagram shows each wheel in its physical position with pressure in bar to one decimal place. Search inside any of these views to find a reading across the whole car, then expand it for its attributes and update time. Available fields depend on the car and its enabled entities. Viewing the car reads the existing subscription without waking it. Vehicle selections sync across screens and are included in settings backups.

**Car & energy** opens with up to three pinned meters, then **Using power now**: the five power sensors drawing the most, with further consumers and readings below 5 W behind disclosures. Each consumer is listed once under its device name: when a device has several power sensors, or the same device is connected through two integrations (same name and room), only its largest reading counts. Their sum covers only the listed circuits. Two different devices that measure the same flow, such as a wall charger and the car it charges, cannot be recognised and are both listed. Energy counters and costs sit under **Meters**. If Home Assistant has no Energy dashboard configuration, the Energy link opens its setup page instead.

To show electricity prices, add a price integration in Home Assistant first, for example [Nord Pool](https://www.home-assistant.io/integrations/nordpool/). The dashboard never adds integrations or changes Home Assistant for you, and the Energy dashboard does not need to be set up. Then open **Settings → Devices → Electricity price** and choose the price sensor; sensors priced per kWh or with the monetary device class are offered, such as Nord Pool's current price. The choice is shared by every screen and included in backups. With a Nord Pool sensor, **Car & energy** reads today's and, once published, tomorrow's prices through the read-only `nordpool.get_prices_for_date` action. It shows the current price, the cheapest three hours within the next day and a strip for each day, with a table view. Times use the home's time zone, including on daylight-saving days. The cheapest time is a suggestion only; nothing is scheduled or switched. Other price sensors show their current price only.

**Smart home visibility** keeps new devices and entities hidden until enabled. Existing selections are retained on the first complete Home Assistant sync after upgrading. Light cards offer brightness from 1–100%, plus color, color temperature, white mode and effects when supported; use the toggle to turn a light off.

Selected entities from the same device share a card. In **Smart home visibility**, choose its **Main entity**, **Card size** and **Card group**, or explicitly link an image/map, maintenance sensor or other entity from another device. Choosing a main entity enables it; other entities appear only when enabled or explicitly linked.

On **Smart home**, select **Arrange cards** to change card sizes, reorder cards, or move them between named groups. Drag a card by its handle, or use the move buttons and **Card group** menu. Room filters stay available, and moving cards preserves those outside the active filter. Use **Add group**, then assign a card to save the group. Card controls are inactive while configuring; select **Done** to use them again. Card order, groups, sizes and composition save automatically, are shared across screens and are included in settings backups.

Select a camera or image preview to open a full-width viewer. Cameras use an authenticated HA stream with a labeled snapshot fallback; maps and media artwork require HA-provided images, and weather forecasts require a supported forecast period. Main sensor and air-quality cards load numeric history only when **History** is expanded, for **24 h** or **7 d**, subject to HA's recorded data. Missing data stays unavailable; `/device-gallery` remains a fictional demonstration.

**Latest events** on Smart home lists up to six things that happened in the last 24 hours, newest first, from the Home Assistant logbook: doors, garage doors and windows opening or closing, locks, alarm changes, appliances finishing (an appliance's running sensor turning off or a programme sensor reporting finished; running sensors for a mode, climate, heating, a compressor or charging, such as a car's climate or sentry mode, are not appliances and read "turned on" or "turned off" when you add them), robot vacuums and lawn mowers docking or reporting an error, doorbells ringing and camera person detections. It updates live. Readings, diagnostics, updates, automations and scripts stay out, and starts and transitions are skipped. A line appears only for a real change: a state the source already had (including a return to it after a moment as unavailable or unknown) is not shown, and the panel reads up to two days of the logbook so it can compare even the oldest shown change with the state before it. Repeated changes of the same entity within two minutes fold into one line with a change count. Different sensors keep their own lines, so a car that reports each door and all doors together shows which door it was ("Example car Dør (fører foran) ble lukket" beside "Example car Dører ble lukket"). Each line links to its device and is written by the dashboard in its language rather than copied from Home Assistant. The panel says whether nothing has happened, the logbook is unavailable or no sources are selected. While Home Assistant is offline, the last items stay visible and are marked stale. **Settings → System → Activity** holds the full log for today or yesterday, filtered by area and type, with a link to the Home Assistant logbook. Times and dates in the log are written in the home's time zone and readings carry their unit. A value the dashboard cannot write in its language, such as an untranslated integration state or an internal code, is logged as "changed status"; Home Assistant's logbook keeps the raw value. Its **Latest events** panel hides or shows the panel and lets you choose its sources. **Activity sources** is a table of every entity that can report activity, chosen or not, with its device, integration, area and event type. Search it, filter by chosen or not chosen, type, area or integration (**Clear filters** resets them), sort by any column, and group it by device, integration, area or type; each group shows how many of its entities are chosen and has a checkbox that chooses or removes the whole group. **Choose all shown** and **Remove all shown** act on everything the filters show, and **Use suggested sources** returns to the defaults. Your ticks stay on this screen until **Save sources**, so dozens of changes are saved together; **Cancel** discards them, and a failed save keeps them so you can try again. A type you have hidden under **Event types** is marked, and sources no longer found in Home Assistant stay listed as unavailable until you untick them and save. **Event types** chooses what both the panel and the activity log show: doors and windows, locks, the alarm, appliances, robot vacuums and mowers, doorbells, camera person detection and other changes (lights, switches and everything else). All are shown by default and in settings files from older versions. When a type is hidden, the log offers **Show all events**, which shows the hidden types in that view only, until you leave the page; it does not change the saved choice and never adds people. Sources still decide which entities the panel follows; the log covers every entity. People coming and going are off by default so a shared screen does not show where household members are; **Include people coming and going** adds them to both the panel and the log. The logbook needs Home Assistant's Logbook integration (part of `default_config`); history reaches back two days at most. To show the panel on Today as well, turn on **Customize Today → Latest events** and move it like the other sections; choose **Half** to place it beside another half section, such as Homework, and choose it under **Free space on the wall** to let it fill the large portrait screen down to the navigation with older rows. A backup that includes section widths or the fill choice cannot be restored into an older Afterglow version. It is off by default, uses the same sources, event types and people choice, and stays on Today even when **Show on Smart home** is off. These preferences sync across screens and are included in backups.

Settings use stable registry/entity references within this deployment, so changing the same HA instance's address does not create a new household. A different HA installation may require resetting or reassigning references. People use their `person.<name>` entity IDs; renaming that entity ID requires reassigning its timetable and preferences.

Calendar integrations and to-do lists stay in HA. The app uses reported capabilities to enable creation, editing, deletion and controls. Recurring event edits/deletions require an occurrence ID. Failed writes keep the draft; physical commands are never automatically replayed. Daily task resets belong in an HA automation, which can run while the dashboard is closed.

### Home Assistant health

**Settings → System → Home Assistant health** collects the housekeeping that otherwise only shows inside Home Assistant:

- **Repairs**: open repair issues, critical first, with Home Assistant's title in the dashboard language, a **Learn more** link when the issue has one and a link to Repairs in Home Assistant. Ignored issues are counted but not listed.
- **Notifications from Home Assistant**: persistent notifications, updated live, shown as plain text (Markdown links to Home Assistant pages or `https` addresses stay clickable). **Dismiss** removes a notification in Home Assistant for everyone; the button shows progress and an error when Home Assistant does not confirm.
- **Backups**: when the last automatic backup completed, when the next one is scheduled, and whether the last attempt failed, the last backup is overdue or a backup location reported an error. Backups are started and restored in Home Assistant.
- **Updates**: update entities with a new version waiting, with a link to install them in Home Assistant.

Repairs and backup status are read when the dashboard connects, when the section opens and every 15 minutes while the screen is visible; notifications arrive live. The System group and the Home Assistant health entry show a count when something needs action. Repairs and backup status need the server token to belong to a Home Assistant **administrator**. With another account, Home Assistant refuses these reads: the blocks and the menu entry stay hidden, without an error. Nothing in this section changes Home Assistant except **Dismiss**.

## Configuration and storage

| Data | Location |
| --- | --- |
| Home Assistant URL/token, dashboard password, server port and data directory | Server environment; `.env` for manual deployment; HAOS Configuration tab for the app |
| People visibility/order, timetable toggles and references, calendar/list assignments, favorites and their groups, appearance, language and selected alarm | `DATA_DIR/settings.yaml` |
| Uploaded timetable PDFs and rendered pages | `DATA_DIR/timetables/<person_name>/<upload_id>/` |
| Calendar events, to-do items, people and device state | Home Assistant |

`DATA_DIR` defaults to `./data` for Node/Vite and `/data` in the container. One server owns one household and one data directory. Phones, tablets and hallway screens must connect to that server. Active screens check for shared settings every five seconds. An unchanged poll skips the settings redraw, and timetable upload errors can appear or clear independently. Browser background throttling can delay the next check until the screen wakes. Settings and saved timetable pages remain available when HA is offline. HA controls, calendar events and list contents require HA to be online.

Settings saves validate the complete document, check its revision, write a temporary file, sync it and rename it atomically. Simultaneous stale writes are rejected. The unsaved draft stays in memory: keep that screen open, export it if needed, then use **Settings → System → Storage and backups → Load shared version**. Failed writes are not automatically replayed. **Retry storage** appears when storage reports an error. **Export unsaved configuration** lets you keep a copy of a pending draft before recovery.

Favorite group names are stored in `settings.homeGroups`, including groups with no assigned cards. Assignments are stored in `settings.homeEntityGroups`, keyed by the same stable preference IDs as the selected favorites. Older settings and backups default to an empty name list and assignment map; the editor also includes names from existing assignments. Saving favorites updates the selection, names and assignments together, removing assignments for deselected cards. Removing a group leaves its cards ungrouped. Exports and imports preserve all three fields.

**Language:** choose English or Norsk bokmål under **App preferences → Language**. The choice is stored as `settings.language` (`en` or `nb`) and applies to every screen connected to this server, including dates, numbers and app messages. Existing settings and backups without this field default to English. Integration entity names and states use Home Assistant's own translations for the chosen language when Home Assistant provides them (entities you renamed keep your name). Home Assistant fills a name it has no translation for with English; the app then uses the same name's translation from another integration, if one has it, then its own Bokmål for common whole names ("Doors" becomes "Dører", "Charger door" "Ladeluke", "Charge port lock" "Ladeportlås", "Low battery" "Lavt batteri"), then the translated device class when the name is that class or ends with it. The part that tells a device's entities apart is kept and translated when the app knows every word (front, rear, left, right, inside, outside, driver, passenger and a few more), in Bokmål word order: "Door (Driver Front)" becomes "Dør (fører foran)", "Rear window" "Vindu (bak)" and "Inside temperature" "Temperatur (inne)". Last, the app builds a name from its own common words, naming the thing first and the rest in brackets: "Mode" becomes "Modus", "Relative humidity threshold min" "Luftfuktighet (nedre grense)", "Electricity consumption summary" "Strømforbruk (sammendrag)" and "Tire Pressure (Front Left)" "Dekktrykk (venstre foran)". When it does not know a word, the name stays as reported unless no other entity of the device shares the class ("Relative humidity guard" stays as reported; a lone "Cabin temperature" becomes "Temperatur", while two such temperature sensors on one device keep their names). Names you wrote yourself, including helpers, scripts, scenes, templates and groups, never change, and English shows Home Assistant's names. A lock has no device class, so a lock named only "Door" or "Lock" uses the translated door class or Home Assistant's translated name for locks. These names are used everywhere the entity is named, including device pages, fact lists, **Latest events** and the activity log. Other Home Assistant names, calendar/list content and generated summaries keep their original text. If the translations cannot be loaded, the app falls back to its own labels and the reported text. Speech language is configured in Home Assistant. Language is included in settings backups. Each screen also remembers the last language in its browser storage, so the app starts in that language before shared settings load. Older app releases reject the new field, so keep a pre-upgrade backup if you need to downgrade.

The server reads `settings.yaml` at startup. Stop it before editing the file manually, then restart it. A corrupt file stops startup without overwriting it. Back up the entire data directory, including timetable folders. Settings exports contain references to images, not the files themselves.

**Breaking change from 0.4:** old `configuration.json`, `.data` contents, browser planners, theme preferences and browser HA credentials are ignored. There is no migration or browser-only build. Old data is not deleted. Configure the server and set up household preferences again. Only version 3 settings exports can be imported. Use **App preferences → Storage and backups** to export or import settings. Keep exports private: they contain household preferences and references.

## School timetables

Choose **Enable timetables** on an empty School board to open **Settings → Household → People**. Enable the timetable for the relevant person, then choose **School or kindergarten** and **Timetable type** under **Settings → Household → Timetables**. School is the default; Kindergarten changes that person's week heading and timetable descriptions in both languages. **PDF / images** keeps the existing uploaded pages; **Calendars** reads selected Home Assistant calendars. Switching types preserves both saved pages and calendar choices, and the dashboard shows the same type.

**School day view** contains a live preview of the actual School timetable. Choose calendars where their content should appear: opening hours and closures in the heading, Activities and Meetings in their sections, and Messages underneath. Short hints explain each picker. Changes update the preview immediately and save automatically. All sections stay visible before calendars are selected or while Home Assistant is offline; live events require a connection.

One set of five calendar selections supplies School, the weekly timetable on **Today** and its day dialogs. Each category accepts multiple calendars, and a calendar can belong to several categories. There is no separate dashboard mapping.

| Category | School and settings preview | Today dashboard |
| --- | --- | --- |
| Activities | Main activity section for the selected day. | Events in each weekday. |
| Meetings | Meeting section and positive counts on weekday tabs. | Combined with Activities in each weekday. |
| Opening hours | Hours in the heading and weekday tabs. | Hours beneath each day heading. |
| Closure days | Closed status replaces opening hours. | Marks the day closed and hides opening hours. |
| Messages | Full-width messages for the selected day below its schedule. | Messages beneath the week. |

Existing School day selections become the shared mapping and take precedence over old separate dashboard assignments. Configurations with only weekly assignments migrate into the matching categories; **Daily events** becomes **Activities**. Saved timetable pages are unaffected.

School and the settings preview show messages for the selected date only. The Today dashboard keeps today's entries or the next available day's entries within a year, showing their date when using a future entry. Its weekday grid advances to the coming Monday on weekends; School still includes the actual current day. Matching title, times and location across event calendars appear once. Dashboard messages with duplicate title/text on a day appear once per source. Opening hours stay hidden while any selected closure calendar cannot be read.

These assignments are separate from the family calendar, work with read-only calendars, and never edit the source events. Settings and backups contain source references only; event contents stay in memory. Missing calendars remain listed so they can be removed or restored.

With Norwegian selected, timetable source categories and view labels translate too. Standard event titles such as “Daily focus” display in Norwegian as well. Names, custom titles and descriptions stay as written; the original Home Assistant data is unchanged.

For saved pages, use **Settings → Household → Timetables → PDF / images → Upload PDF timetable**. PDFs may be up to **10 MB / 20 pages**, without password protection. Confirming an upload replaces that person's visible pages on every screen. Invalid uploads keep the previous timetable.

Each page gets its original PNG and a self-contained dark SVG for older clients. Turn on **App preferences → Appearance → Dark timetables** for dark backgrounds and light text throughout the dashboard, School board and enlarged views, independently of the app theme. The app applies these colors directly to the original PNG, avoiding the filtered SVG rendering that can blur text. This shared preference defaults to off and works with existing uploads without uploading again; external image URLs keep their original colors.

PDF pages render at 6,000 pixels on their longest edge (about 500 DPI for A4), with the same detail in both normal and dark images. Upload an existing PDF again to replace older, lower-resolution images. Higher-resolution conversion can take longer and uses more storage.

For `person.example_child`, an upload is stored as:

```text
data/
  settings.yaml
  timetables/
    example_child/
      <upload_id>/
        source.pdf
        1.png
        1-dark.svg
        2.png
        2-dark.svg
```

The folder name is the person's HA entity-name slug, not their display name; duplicate display names therefore cannot collide. Upload IDs allow atomic replacement and keep earlier files available for settings-backup restores. Old uploads are retained; disk usage grows until unused upload folders are removed manually. Stop the server and verify references/backups before removing files.

External image URLs remain supported, one per line in page order. Swipe or use the arrows to change pages. Tap a page to enlarge it. Closing the viewer returns keyboard focus to the control that opened that child’s timetable. Disabling a timetable hides it without removing its files or URLs.

## Share a PDF from iPhone

1. On your iPhone, open **Settings → Household → Timetables → Share from iPhone** for the person receiving the timetable and copy their **Upload URL**.
2. Tap **Download iOS shortcut**. Open the downloaded file in Shortcuts if Safari saves it to Downloads, then tap **Set Up Shortcut / Add Shortcut**. Apple requires this confirmation; a website cannot silently install a shortcut.
3. Answer the setup questions with the Upload URL and your **dashboard password**, not the HA token. Rename it to identify the person, for example **Upload school timetable**. Install another copy with the other person's URL when needed.
4. Open one PDF in Files or another app, tap **Share → Upload school timetable**, and confirm replacement. The template already accepts PDFs and has **Show in Share Sheet** enabled. Share the actual PDF file, not a webpage link. The shortcut finishes silently as soon as the server saves the PDF and only displays upload errors. The server converts it in the background. Conversion or saving errors appear in a dismissible notification at the top of the app on its next refresh; connection failures are shown by Shortcuts.

The downloadable file is a signed, blank template. Your URL and password are entered on your device after signing. Keep the configured shortcut private: its saved password grants access to the dashboard and home controls. The phone must reach the dashboard through home Wi-Fi, VPN or your trusted HTTPS proxy. After a timeout, check the dashboard before retrying; the upload may have completed. If you change the dashboard password or address, update the first two Text actions in your installed shortcut.

To rebuild the distributable after editing `scripts/build-timetable-shortcut.mjs`, run `node scripts/build-timetable-shortcut.mjs` on a Mac with Shortcuts installed and network access. This uses Apple's `shortcuts sign --mode anyone` and sends the blank template to Apple for validation. Commit the generated `public/shortcuts/Upload timetable.shortcut` alongside its source; Linux/Docker builds serve that file without needing a signing service. See Apple's guides to [sharing shortcuts](https://support.apple.com/guide/shortcuts/share-shortcuts-apdf01f8c054/ios) and [signing from the command line](https://support.apple.com/guide/shortcuts-mac/run-shortcuts-from-the-command-line-apd455c82f02/mac).

`POST /api/timetables?member=home%7Cperson.example_child` accepts raw PDF bytes. Once the whole PDF is saved, it returns **202 Accepted** with `{ "message": "Timetable received. Conversion is running; the dashboard will refresh when ready and show any errors." }`. This acknowledges receipt, not completed conversion. Invalid content types, missing PDF headers, oversized uploads, disabled people and concurrent uploads are rejected immediately. Conversion failures (including protected or excessive-page PDFs) and settings conflicts are reported through `timetableError` on `/api/config`, keeping the previous timetable. The latest error is available until a successful retry for that person or a server restart. Background conversion does not resume after a restart; check the timetable and re-upload if needed. Images are served through password-protected `/api/timetables/<person>/<upload_id>/<page>.png` and `<page>-dark.svg` routes with `Cache-Control: no-store`.

## Read timetables from an automation

Set `timetable_api_key` in the HAOS app configuration, or `TIMETABLE_API_KEY` in `.env` for Node, Vite and Docker Compose. Use a separate random key of 32–4096 URL-safe characters (letters, digits, `.`, `_`, `~`, `-`); `openssl rand -hex 32` generates one. Restart the app after changing it. An empty value disables key access. The key stays out of dashboard settings, exports and `/api/runtime`.

Fetch `GET /api/timetables` with the dedicated `X-Home-Harmony-Key` header:

```sh
curl -H 'X-Home-Harmony-Key: YOUR_TIMETABLE_API_KEY' http://YOUR_DASHBOARD:8099/api/timetables
```

The header-authenticated response contains all saved timetable entries, their enabled flag, ordered page URLs and a parallel `downloads` array:

```json
{
  "timetables": [
    {
      "member": "home|person.example_child",
      "enabled": true,
      "pages": ["/api/timetables/example_child/UPLOAD_ID/1.png"],
      "downloads": ["/api/timetables/example_child/UPLOAD_ID/1.png?expires=UNIX_SECONDS&sig=HEX_SIGNATURE"]
    }
  ]
}
```

Prefix relative URLs with your dashboard's origin. Stored `pages` require the same header (or dashboard credentials). A saved PNG also has a dark variant at the same path ending in `-dark.svg` instead of `.png`. `downloads` has the same order and length as `pages`; uploaded pages get a signed PNG URL, including when the saved reference is a dark SVG. These URLs work with a plain GET and expire **10 minutes after the listing is generated**. Each signature permits only its exact image path and GET method. Expired, malformed or changed signatures return 401. Fetch a new listing for fresh links; changing the URL's expiry does not extend it. External page URLs appear unchanged in both arrays; never send your API key to those hosts. Their access rules and expiry are controlled by the external host.

Read the listing on each automation run to get the latest upload's pages. Entries without saved URLs are omitted; saved empty entries have empty arrays. Disabled timetables remain listed with `enabled: false`, so automations can skip them. Saved pages also report `enabled: false` while the person uses Calendars, preventing image-based automations from reading an inactive timetable. Calendar events remain available through Home Assistant’s calendar APIs.

The key permits only listing timetables and downloading stored PNG/SVG pages, including older retained uploads. It cannot upload PDFs, delete files, read/change dashboard settings, access `/api/runtime`, calendars or HA controls. `Authorization` remains reserved for dashboard authentication; a Bearer timetable key is rejected. A missing or incorrect timetable header requires valid dashboard credentials. Responses use `Cache-Control: no-store`; key and signed-download requests also keep the origin checks and `Referrer-Policy: no-referrer`. Dashboard credentials still work on the original routes; dashboard-only listings retain their existing `pages` response without `downloads`.

Signed downloads use HMAC-SHA256 over `GET\n<path>\n<expires>`, with a key derived by HMAC-SHA256 from the timetable API key and `home-harmony-timetable-download-v1`. The long-lived key never appears in these URLs. Anyone holding a signed URL can read that one page until it expires, so use HTTPS or a trusted LAN/VPN. Rotating the key and restarting invalidates old signed downloads.

### Use with Home Assistant

1. Configure the file-loaded [morning summary configuration](examples/home-assistant/morning-summary-config.yaml) and [secrets](examples/home-assistant/morning-summary-secrets.example.yaml): set `home_harmony_timetables_url` to the dashboard origin plus `/api/timetables`, and put `home_harmony_timetable_api_key` only in the REST command's `X-Home-Harmony-Key` header. [REST commands support custom headers](https://www.home-assistant.io/integrations/rest_command/). Restart Home Assistant or reload the changed YAML integrations.
2. Use the [automation](examples/home-assistant/morning-summary.yaml) to read `downloads` by page index. Downloader receives just a signed URL, saves the image locally, and supplies a `media-source://media_source/local/...` attachment to AI Task. The long-lived key is absent from the script variables, action data and response; traced download URLs expire after 10 minutes. The listing must include `downloads`.

A possible HAOS-only alternative is an add-on `map: media:rw` mount with pages written under `/media/home-harmony/` and returned as media-source IDs. That mode is not implemented; adding the mount alone does not export pages. Signed downloads work across HAOS, Docker and Node without that extra storage path.

Settings pages and calendar layout controls show both their shared scope and current save status beside the controls. Calendar date, Month/Week/Day navigation and person filters are local to the screen; the layout and preview-start choices inside Calendar settings remain shared. Appearance lets you choose the theme, color palette and background artwork independently. Choose **No artwork** to restore the default background. Under **Card artwork** (**Kortillustrasjoner** in Utseende), turn on a lower-right corner illustration and heading icon for each planner card type, such as Everyone’s day, Homework, Calendar or Timetables. Every Today section has its own switch, including Latest events (on Today and Smart home) and the Home status card. A backup with the Latest events or Home status switch cannot be restored into an older Afterglow version. Expand **Smart home cards** to toggle each saved card separately. These switches default off and also work with **No artwork**. Renaming or reordering a Smart home card keeps its choice. Deleting the card removes its choice with it.

New calendar plans can be All day. The shown end date is inclusive; the app sends the following day as Home Assistant’s exclusive `end_date`, following the [calendar create action](https://www.home-assistant.io/actions/calendar.create_event/). Timed plans default to the next half hour today or 09:00 on another selected date, for one hour. Changing the start preserves the wall-clock duration, including overnight plans. Times use the home timezone; nonexistent daylight-saving times are rejected before sending. Existing unsupported calendar edits remain read-only.

To remove a list item, open its three-dot action menu, choose Remove and confirm. Empty list and calendar views link to their setup pages.

The header gear opens Settings. **Continue setup** starts at the first missing household step. **Guided setup** lets you revisit all four steps. You can choose people, assign calendars and select lists directly in the guide. Each choice saves across screens. **Back** returns to the previous step and **All settings** leaves the guide.

For a specific change, open **Household**, **Screen and alerts**, **Devices** or **System**. **All settings** returns to the same category. Weather shows the source above its placement options. Connection & account shows connection status and controls above the instance and account details. On longer pages, use the side menu or the selector above the controls on phones. Choose a group to show its settings. The browser Back button returns to the previous group. In **To-do lists**, choose shopping lists or a person. In **Appearance**, choose a palette or artwork to see its previews. To clear the shared Smart home layout, open **System → Danger zone → Clear Smart home**.
