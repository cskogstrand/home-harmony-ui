# Home Harmony UI

Afterglow is a shared family dashboard for Home Assistant. Home Assistant owns people, calendars, to-do items, devices and their permissions. Every screen connected to the same dashboard server shares its preferences and timetable files.

## Configuration and storage

| Data | Location |
| --- | --- |
| Home Assistant URL/token, dashboard password, server port and data directory | Server environment; `.env` for manual deployment; HAOS Configuration tab for the app |
| People visibility/order, timetable toggles and references, calendar/list assignments, favorites, appearance, language and selected alarm | `DATA_DIR/settings.yaml` |
| Uploaded timetable PDFs and rendered pages | `DATA_DIR/timetables/<person_name>/<upload_id>/` |
| Calendar events, to-do items, people and device state | Home Assistant |

`DATA_DIR` defaults to `./data` for Node/Vite and `/data` in the container. One server owns one household and one data directory. Phones, tablets and hallway screens must connect to that server. Settings refresh within five seconds while a screen is active; browser background throttling can delay refresh until it wakes. Settings and saved timetable pages remain available when HA is offline. HA controls, calendar events and list contents require HA to be online.

Settings saves validate the complete document, check its revision, write a temporary file, sync it and rename it atomically. Simultaneous stale writes are rejected. The unsaved draft stays in memory: keep that screen open, export it if needed, then use **App preferences → Load shared version**. Failed writes are not automatically replayed. **Retry storage** retries a failed save.

**Language:** choose English or Norsk bokmål under **App preferences → Language**. The choice is stored as `settings.language` (`en` or `nb`) and applies to every screen connected to this server, including dates, numbers and app messages. Existing settings and backups without this field default to English. Home Assistant names, calendar/list content and generated summaries retain their original text; speech language is configured in Home Assistant. Language is included in settings backups. Older app releases reject the new field, so keep a pre-upgrade backup if you need to downgrade.

The server reads `settings.yaml` at startup. Stop it before editing the file manually, then restart it. A corrupt file stops startup without overwriting it. Back up the entire data directory, including timetable folders. Settings exports contain references to images, not the files themselves.

**Breaking change from 0.4:** old `configuration.json`, `.data` contents, browser planners, theme preferences and browser HA credentials are ignored. There is no migration or browser-only build. Old data is not deleted. Configure the server and set up household preferences again. Only version 3 settings exports can be imported.

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
5. Open **Home settings** to choose visible people, calendars, lists and timetables. Use the same dashboard address on your other screens.

HAOS supplies these options through `/data/options.json`; explicit environment variables take precedence. The Supervisor manages `/data` as persistent app data and includes it in app backups. The app uses its own web port, not HA ingress. The port can be changed under the app's Network settings.

Use the HA Core address and port reachable **from the app container**. If `homeassistant.local` fails, try the internal hostname `homeassistant` or the device's LAN IP. HAOS 2026.8+ defaults to port 80; installations using port 8123 need `http://homeassistant:8123`. Check the actual port under **Settings → System → Network → HTTP server** ([HA HTTP settings](https://www.home-assistant.io/integrations/http/)).

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

## Local development and Node deployment

Use **Node 24+**. Copy and configure `.env` as above, then:

```sh
npm ci
npm run dev
```

Vite serves the dashboard and the same authenticated API/WebSocket proxy on port 8080. Development and preview use the same data directory unless `DATA_DIR` is changed. Never run two servers against one data directory.

For the production Node server:

```sh
npm run build
npm start
```

Node and Vite read `.env` automatically; already-set environment variables win. Required values are `HOME_ASSISTANT_URL`, `HOME_ASSISTANT_TOKEN` and `DASHBOARD_PASSWORD` (at least 12 characters). For a trusted local network, set `DASHBOARD_AUTH_DISABLED=true` to skip login and make `DASHBOARD_PASSWORD` optional; it defaults to `false` and accepts only `true` or `false`. This also works in Docker Compose. `HOME_ASSISTANT_URL` is an HTTP(S) origin without credentials, path, or trailing slash. `PORT` defaults to 8099 for the Node server; Vite uses its own `--port` option. `DATA_DIR` selects the persistent directory.

PDF conversion requires Poppler (`pdfinfo` and `pdftoppm`): `brew install poppler` on macOS or `apt install poppler-utils` on Debian/Ubuntu. The Docker image includes Poppler and fonts.

## Access and the Home Assistant connection

By default, the dashboard password protects HTML, assets, settings, timetable images and the WebSocket proxy. Disabling login opens all of these to anyone who can reach the dashboard, including the configured HA account's home controls. Use the bypass only on a trusted local network. Cross-origin checks remain enabled, and a Home Assistant token is still required. The token is sent to HA only by the server; it is absent from browser storage, public runtime configuration, settings backups and image URLs. The browser receives the configured URL for links to HA.

The server forwards the [HA WebSocket protocol](https://developers.home-assistant.io/docs/api/websocket/), calendar REST reads and uploaded person photos to the configured HA origin. Browsers connect only to the dashboard; HA CORS changes are unnecessary. Cross-origin browser requests are rejected. A reverse proxy must preserve the browser's Host header and support WebSocket upgrades. Avatars use photos uploaded to people in Home Assistant, with initials when a photo is missing or cannot load; custom external picture URLs are not supported.

**Connection failures:** “Cannot connect” does not establish that the token is invalid. Reconnect and check the dashboard app's **Log** tab: `ENOTFOUND` / `EAI_AGAIN` indicates hostname resolution, `ECONNREFUSED` indicates the address/port refused the connection, `EHOSTUNREACH` / `ENETUNREACH` indicates network reachability, and an unexpected HTTP status indicates a failed WebSocket upgrade (for example, a redirect or reverse proxy response). A rejected HA token is logged separately and shown as “Home Assistant rejected the server token”. Logs never include the token. Save configuration changes and restart the app before reconnecting.

Use HTTPS through a trusted reverse proxy, or a trusted home network/VPN. HTTP Basic authentication does not encrypt the password over plain HTTP. Anyone with the dashboard password has the configured account's HA capabilities, including home controls. Changing the password and restarting invalidates future requests; browsers may remember Basic credentials until their authentication cache is cleared. **Disconnect** pauses live controls in that tab until reconnect/reload; it is not a logout or token revocation. Rotate/revoke the HA token in HA and update the server configuration when needed.

## Household preferences

In **Home settings**, choose people visibility and order, calendar assignments, one task and daily-task list per person, and a shared shopping list. Hidden people keep their assignments and timetable files. Everyone remains first. Favorites, dark mode, compact mode, calendar view/start day and alarm selection are shared too.

Settings use stable registry/entity references within this deployment, so changing the same HA instance's address does not create a new household. A different HA installation may require resetting or reassigning references. People use their `person.<name>` entity IDs; renaming that entity ID requires reassigning its timetable and preferences.

Calendar integrations and to-do lists stay in HA. The app uses reported capabilities to enable creation, editing, deletion and controls. Recurring event edits/deletions require an occurrence ID. Failed writes keep the draft; physical commands are never automatically replayed. Daily task resets belong in an HA automation, which can run while the dashboard is closed.

## School timetables

Enable a person's timetable in **Home settings**, then choose **School or kindergarten** and **Timetable type** under **Settings → Timetables**. School is the default; Kindergarten changes that person's week heading and timetable descriptions in both languages. **PDF / images** keeps the existing uploaded pages; **Calendars** reads selected Home Assistant calendars. Switching types preserves both saved pages and calendar choices, and the dashboard shows the same type.

**School day view** contains a live preview of the actual School timetable. Choose calendars where their content should appear: opening hours and closures in the heading, Activities and Meetings in their sections, and Messages (Pedagogy) underneath. Short hints explain each picker. Changes update the preview immediately and save automatically. All sections stay visible before calendars are selected or while Home Assistant is offline; live events require a connection.

One set of five calendar selections supplies School, the weekly timetable on **Today** and its day dialogs. Each category accepts multiple calendars, and a calendar can belong to several categories. There is no separate dashboard mapping.

| Category | School and settings preview | Today dashboard |
| --- | --- | --- |
| Activities | Main activity section for the selected day. | Events in each weekday. |
| Meetings | Meeting section and positive counts on weekday tabs. | Combined with Activities in each weekday. |
| Opening hours | Hours in the heading and weekday tabs. | Hours beneath each day heading. |
| Closure days | Closed status replaces opening hours. | Marks the day closed and hides opening hours. |
| Messages (Pedagogy) | Full-width messages for the selected day below its schedule. | Messages beneath the week. |

Existing School day selections become the shared mapping and take precedence over old separate dashboard assignments. Configurations with only weekly assignments migrate into the matching categories; **Daily events** becomes **Activities**. Saved timetable pages are unaffected.

School and the settings preview show messages for the selected date only. The Today dashboard keeps today's entries or the next available day's entries within a year, showing their date when using a future entry. Its weekday grid advances to the coming Monday on weekends; School still includes the actual current day. Matching title, times and location across event calendars appear once. Dashboard messages with duplicate title/text on a day appear once per source. Opening hours stay hidden while any selected closure calendar cannot be read.

These assignments are separate from the family calendar, work with read-only calendars, and never edit the source events. Settings and backups contain source references only; event contents stay in memory. Missing calendars remain listed so they can be removed or restored.

With Norwegian selected, timetable source categories and view labels translate too. Standard event titles such as “Daily focus” display in Norwegian as well. Names, custom titles and descriptions stay as written; the original Home Assistant data is unchanged.

For saved pages, use **Settings → Timetables → PDF / images → Upload PDF timetable**. PDFs may be up to **10 MB / 20 pages**, without password protection. Confirming an upload replaces that person's visible pages on every screen. Invalid uploads keep the previous timetable.

Each page gets its original PNG and a self-contained dark SVG for older clients. Turn on **App preferences → Appearance → Dark timetables** for dark backgrounds and light text throughout the dashboard, School board and enlarged views, independently of the app theme. The app applies these colors directly to the original PNG, avoiding the filtered SVG rendering that can blur text. This shared preference defaults to off and works with existing uploads without uploading again; external image URLs keep their original colors.

PDF pages render at 6,000 pixels on their longest edge (about 500 DPI for A4), with the same detail in both normal and dark images. Upload an existing PDF again to replace older, lower-resolution images. Higher-resolution conversion can take longer and uses more storage.

For `person.emma`, an upload is stored as:

```text
data/
  settings.yaml
  timetables/
    emma/
      <upload_id>/
        source.pdf
        1.png
        1-dark.svg
        2.png
        2-dark.svg
```

The folder name is the person's HA entity-name slug, not their display name; duplicate display names therefore cannot collide. Upload IDs allow atomic replacement and keep earlier files available for settings-backup restores. Old uploads are retained; disk usage grows until unused upload folders are removed manually. Stop the server and verify references/backups before removing files.

External image URLs remain supported, one per line in page order. Swipe or use arrows between pages; tap to enlarge. Disabling a timetable hides it without removing its files or URLs.

### Read timetables from an automation

Set `timetable_api_key` in the HAOS app configuration, or `TIMETABLE_API_KEY` in `.env` for Node, Vite and Docker Compose. Use a separate random key of 32–4096 URL-safe characters (letters, digits, `.`, `_`, `~`, `-`); `openssl rand -hex 32` generates one. Restart the app after changing it. An empty value disables key access. The key stays out of dashboard settings, exports and `/api/runtime`.

Fetch `GET /api/timetables/<api-key>` without authentication headers:

```sh
curl 'http://YOUR_DASHBOARD:8099/api/timetables/YOUR_API_KEY'
```

The response contains all saved timetable entries, their enabled flag and ordered page URLs:

```json
{
  "timetables": [
    {
      "member": "home|person.emma",
      "enabled": true,
      "pages": ["/api/timetables/YOUR_API_KEY/emma/UPLOAD_ID/1.png"]
    }
  ]
}
```

Prefix relative page URLs with your dashboard's origin to download the images without headers. A saved PNG also has a dark variant at the same path ending in `-dark.svg` instead of `.png`. External image URLs are returned unchanged; never send your API key to those hosts. Read the listing on each automation run to get the latest upload's pages. Entries without saved URLs are omitted; saved empty entries have an empty `pages` array. Disabled timetables remain listed with `enabled: false`, so automations can skip them. Saved pages also report `enabled: false` while the person uses Calendars, preventing image-based automations from reading an inactive timetable. Calendar events remain available through Home Assistant’s calendar APIs.

The key permits only listing timetables and downloading stored PNG/SVG pages, including older retained uploads. It cannot upload PDFs, read/change dashboard settings, or access HA controls. Responses use `Cache-Control: no-store`. Dashboard credentials still work on the original routes, including `GET /api/timetables` (which returns page URLs without a key).

Treat the entire URL as a secret: anyone with it can read timetables, and URLs may appear in automation traces, proxy logs or AI-provider requests. Use HTTPS or a trusted LAN/VPN. Rotate the key and restart to invalidate old URLs. For AI image analysis, attach the PNG through the AI integration's supported image input; a URL in a text prompt alone does not guarantee that the model will fetch it.

### Morning summary in Home Assistant

The disabled [morning-summary automation draft](examples/home-assistant/morning-summary.yaml) runs when the scene configured in `secrets.yaml` changes its activation timestamp. It reads today's events from calendars matching the configured prefix with [`calendar.get_events`](https://www.home-assistant.io/actions/calendar.get_events/), fetches the timetable API, and summarizes both with [`ai_task.generate_data`](https://www.home-assistant.io/actions/ai_task.generate_data/) before sending a phone notification.

1. Merge [morning-summary-config.yaml](examples/home-assistant/morning-summary-config.yaml) into Home Assistant's `configuration.yaml`, preserving existing automation, script, `template`, `rest_command`, `homeassistant` and `media_dirs` entries. Replace any earlier `script morning_summary: !include ...` entry with the inline `script morning_summary` block from the example. This defines `script.family_timetables`, which reads the secrets, fetches the API and returns the timetable response and summary settings. The config also defines `rest_command.family_timetables`, exposes `/media` as local media, and forwards the configured scene activation as a `home_harmony_morning_summary` event. Keep the new `automation morning_summary_trigger` block when upgrading: the UI automation now listens for this event. Keep this configuration in a file: [the automation/script UI editor does not support `!secret`](https://www.home-assistant.io/docs/configuration/secrets/#secrets-in-automations-and-scripts).
2. Copy [morning-summary-secrets.example.yaml](examples/home-assistant/morning-summary-secrets.example.yaml) into Home Assistant's `secrets.yaml`, merging with any existing entries. Set the dashboard address, API key, AI Task entity, notification action, scene and calendar prefix there. The ordered `home_harmony_summary_groups` list contains each group's name and emoji; its first entry is the shared group. Keep names unique, without colons or line breaks. The remaining entries are people. For each person with an enabled timetable, add `timetable_member` to their group with the exact `member` value from `timetable_response.content.timetables` in an automation trace (or the timetable API). Do not derive this ID from their display name or assign it to the shared group. Every enabled timetable with pages must match exactly one personal group; missing or duplicate matches stop the run before downloads and AI generation. When upgrading, add these mappings in `secrets.yaml`, reload scripts, and update the automation YAML together. `home_harmony_weekly_reminders` maps quoted weekday numbers (`"0"` = Monday through `"6"` = Sunday) to shared reminders; use `{}` for none. All household-specific settings stay in this secrets file.
3. Ensure `/media` exists and is writable, then restart Home Assistant. Add the [Downloader integration](https://www.home-assistant.io/integrations/downloader/) under **Settings → Devices & services**, with `/media` as its download directory.
4. Set the `main_ai_task_entity` secret to your actual Home Assistant AI Task entity ID, with image attachment support. When upgrading, rename the existing AI Task secret key to `main_ai_task_entity` in `secrets.yaml` and update the file-loaded script configuration before reloading scripts. Choose its model in your integration; the secret takes the `ai_task.*` entity ID, not an OpenRouter model slug. For a stronger model to try for timetable reading and interpreting responsibilities, use [`google/gemini-3.8-flash`](https://openrouter.ai/google/gemini-3.8-flash). It accepts images; OpenRouter lists promotional rates of $0.75/M input and $3.75/M output tokens as of October 19, 2026. This recommendation has not been evaluated against your household data. If you change the model on the existing AI Task entity, the secret can stay the same; if you create a new entity, update the secret and reload scripts.
5. Paste [morning-summary.yaml](examples/home-assistant/morning-summary.yaml) into a new automation's YAML editor. Set the `main_notify_device` secret to the full notification action for your phone (not a device ID). Approve notification delivery before enabling it, then remove `initial_state: false` so later restarts preserve the enabled state. If you installed the earlier file-based example, remove its `automation morning_summary` include before restarting to avoid duplicate runs.

The example loops over enabled timetables and every entry in their `pages` arrays, preserving page order and member IDs. Relative URLs get the dashboard origin; external URLs keep their existing host and receive no dashboard key. Uploaded dark SVG references use their original PNGs. External images must have a `.png`, `.jpg`, `.jpeg`, `.webp` or `.gif` extension matching their actual format. Each image is downloaded before the AI action and attached through a `media-source://media_source/local/...` reference: [HA AI Task requires local files rather than HTTP attachment URLs](https://raw.githubusercontent.com/home-assistant/core/2026.10.2/homeassistant/components/ai_task/task.py).

No enabled pages produces a calendar summary with a brief "Timeplan mangler" note. Listing errors, unsupported image extensions and missing downloads stop the run before notification. Each run uses a new folder under `/media/morning-summary/` so a failed download cannot silently reuse an older image; periodically remove old run folders to limit disk use. It runs each time the configured scene is activated, with overlapping runs suppressed. Edit the `instructions` block to expand the summary. URLs can appear in HA traces and logs, so keep the key private.

The notification uses one short Norwegian line per group, prefixed with its configured emoji and name. The AI action uses [structured output](https://www.home-assistant.io/integrations/ai_task/#structured-output-example), with one required text field per group from secrets and empty text for groups with no relevant information. Each timetable image is labelled with its owner's exact response field using the `timetable_member` mapping; the model does not need to infer a person's name from a technical member ID. School-wide notices and reflector competitions in those images belong to that child, even when the school calls them shared notices. They must not move to the family's shared field. The formatter joins line breaks inside each field, applies the configured order and separates nonempty groups with a blank line. Missing or unknown fields and non-text values stop the run with an error in the trace. Update the entire automation when upgrading: both the AI action and the formatter use the structured response.

School and kindergarten contribute only practical notices relevant today: trips, reflector activities, rainwear, spare clothes, equipment, special food, deadlines and changed arrangements. Ordinary subjects, lesson intervals and routine school dismissal times are omitted, and a timetable with only normal lessons contributes no text. Routine untimed school/kindergarten calendar entries without a practical notice or exception are also omitted. Image-to-member links identify the notice's owner; calendar names never override an explicitly named actor. Drop-off or pickup responsibility stays with the named adult, including entries such as `[name] - levere` in a shared calendar. Unclear ownership goes under the shared group with "ukjent hvem" instead of guessing. An explicit field-day instruction to bring grill food instead of a packed lunch becomes a reminder; a field-day label alone does not imply grilling. Unreadable or ambiguous image content must be marked as uncertain, not reconstructed from adjacent rows or columns.

The summary prompt requires every timed calendar event, including routine events, with its start and end times and any explicit arrival times or deadlines in the title or description. Times use `HH:MM` in Home Assistant's local time zone, with a date when outside today. Relative arrival instructions must accompany the calendar's clock times. All-day dates do not become midnight appointments; explicit times in their text are still retained. Ongoing all-day responsibilities describe what applies today without repeating the calendar's technical start/end date range. Explicit dates for actionable deadlines or exceptions remain relevant. Use short venue names; full addresses are only needed for new or changed locations.

For ice practice with the note "Oppmøte 30 minutter før is" or "Oppmøte senest 30 minutter før is", the calendar interval already includes arrival: 17:00–18:20 means arrival at 17:00 and ice time 17:30–18:20. The summary prompt keeps the arrival time (including "senest" when present), adds 30 minutes only to find the ice start, and never subtracts another 30 minutes from the calendar start. This rule applies only to that practice note; conflicting explicit times require clarification. The spoken-summary script preserves these times from the generated summary.

Both summary prompts preserve explicit timing and travel direction in reflector notices. A notice covering travel both to and from school must retain both journeys in the notification and speech. The morning journey is only the fallback when neither timing nor direction is specified. They do not infer a journey from nearby school dismissal text or add a reflector reminder unless the source mentions one. Learning goals, contact details and routine homework are omitted from the morning summary; only special deadlines or preparations requiring action today are relevant.

The image-reading prompt checks weekly notices on every attached page, including headings, info boxes, margins and text outside the day's timetable column. Ongoing notices in the current week's plan also apply today unless limited to other dates or cancelled. A current `reflekskonkurranse`, `refleks-konkurranse` or `refleksaksjon` must produce a reminder to wear a reflector under the correct child, even when it is only a heading without an explicit “remember” instruction. Finished, cancelled or future campaigns must not produce today's reminder.

The send action adds the configured weekday reminder to the shared group, creating it when absent, without relying on the AI to remember it. Reminder selection uses Home Assistant's local time zone. The reminder text is not included in the AI prompt. After normalizing whitespace, the formatter skips adding it if that exact text already occurs anywhere in the shared group's response, including alongside other sentences. This does not detect paraphrases. The prompt reserves space for the reminder, group label and emojis within a soft 350-character target. Calendar times and practical notices take priority over this target; the final notification is not truncated. Update the existing automation with the revised YAML to apply these rules. Phone previews may display less than the full message.

The automation also publishes the same `notification_message` before phone delivery to `sensor.afterglow_morning_summary`. The sensor's state is the summary date in Home Assistant's time zone; its `message` attribute contains the complete text, emojis and line breaks. Attributes avoid the 255-character entity-state limit. Read the reusable notification value in other Home Assistant templates with:

```jinja
{{ state_attr('sensor.afterglow_morning_summary', 'message') }}
```

Afterglow automatically shows today's message in a **Morning summary** panel below the front-page greeting, using its existing Home Assistant connection. It hides missing, empty, unavailable and other-day summaries, and labels a cached summary when disconnected. Updating the sensor refreshes the panel without reloading the page. [Trigger-based template sensors restore their state and attributes after a Home Assistant restart](https://www.home-assistant.io/integrations/template/#trigger-based-template-entities).

When upgrading, merge the new `template` block from `morning-summary-config.yaml` into your existing template list, update the UI automation, and reload Template entities (or restart Home Assistant). Keep the entity ID `sensor.afterglow_morning_summary`; if HA adds a numeric suffix because that ID is already taken, resolve the conflict in entity settings. The panel appears after the updated automation next generates a summary; it does not generate one itself.

Validate the example YAML offline with `node scripts/test-morning-summary.mjs`. Run `python3 scripts/test-morning-summary-templates.py` with Jinja2 and PyYAML installed to exercise the actual structure, validation and formatting templates with fictional data. Neither check connects to Home Assistant.

### Spoken morning summary in Norwegian

The [spoken-summary script](examples/home-assistant/morning-summary-voice.yaml) reads the sensor's `message` attribute, chooses one of five delivery styles, asks an AI Task to rewrite it in natural Norwegian Bokmål, and plays the result through Home Assistant Cloud with [`tts.speak`](https://www.home-assistant.io/actions/tts.speak/). The prompt preserves names, times, responsibilities and reminders while varying the wording. It prioritizes all time details over brevity, uses explicit 24-hour spoken times (16:30 becomes "klokken seksten tretti"), and keeps relative instructions such as "møt tretti minutter før" without calculating new arrival or departure times. Conflicting times must be flagged for clarification. Each invocation generates fresh text; random styles and wording can still repeat. The selected voice stays the same.

1. Sign in under **Settings → Home Assistant Cloud** with an active subscription or trial. [Cloud TTS is enabled automatically when signed in](https://support.nabucasa.com/hc/en-us/articles/25619386304541-Text-to-speech-TTS). In its text-to-speech settings, choose **Norwegian Bokmål (Norway)** and your preferred voice. The script sets `language: "nb-NO"` and uses that configured voice when the Cloud language matches; otherwise HA uses its default Norwegian voice. Preview your household's names and a sentence with times before choosing a voice.
2. Merge the complete example into Home Assistant's `scripts.yaml`, keeping existing scripts. The file starts with `morning_summary_voice:`; all of its settings, including `variables:` and `sequence:`, must be indented beneath that key. Keep the normal `script: !include scripts.yaml` entry in `configuration.yaml`. It reads `!secret main_ai_task_entity`, shared with the morning-summary automation, and `!secret main_announcement_speaker`. Set `main_announcement_speaker` in `secrets.yaml` to the compatible `media_player.*` that should speak, and replace `tts_entity` in the script if your actual Cloud entity differs from `tts.home_assistant_cloud`. Edit the YAML file directly: the script UI editor cannot resolve `!secret`. Replace any earlier copy of this voice script to avoid duplicates.
3. Reload scripts (or restart Home Assistant). After today's morning-summary sensor has been populated, select **Play summary** at the top right of the Morning summary panel on Afterglow's front page to run `script.morning_summary_voice`. On small screens, the button shows a speaker icon. The button is disabled while the script is running, when it is unavailable, or while Home Assistant is offline. The script is separate from the notification automation and has no automatic trigger. Missing, unavailable, empty or other-day summaries stop before the AI call. AI errors or empty/non-text results stop before TTS; inspect the script trace for the reason.

If you pasted the earlier unwrapped example into `scripts.yaml` and see `script.variables` or a missing-script error, replace that pasted block with the complete named example and reload scripts. Home Assistant treats top-level keys in `scripts.yaml` as script IDs; `variables:` belongs inside a named script. See [Home Assistant's script YAML format](https://www.home-assistant.io/integrations/script/).

For a separate file instead, save the complete named example as `morning-summary-voice.yaml` beside `configuration.yaml` and add this top-level entry there:

```yaml
script morning_summary_voice: !include morning-summary-voice.yaml
```

Use one loading method. When upgrading from the previous nested include, remove `morning_summary_voice: !include morning-summary-voice.yaml` from inside `script morning_summary:`; the updated file already contains that script ID. Keep `family_timetables` and the normal `script: !include scripts.yaml` entry.

The AI provider receives the source summary and the TTS provider receives the spoken text. Rewriting can introduce mistakes despite the prompt, so check a few outputs against the source. This draft has not been installed or played on a live speaker. `mode: single` prevents concurrent script runs while generation/playback submission is in progress; it does not wait for the speaker to finish the audio.

### Share a PDF from iPhone

1. On your iPhone, open **Settings → Timetables → Share from iPhone** for the person receiving the timetable and copy their **Upload URL**.
2. Tap **Download iOS shortcut**. Open the downloaded file in Shortcuts if Safari saves it to Downloads, then tap **Set Up Shortcut / Add Shortcut**. Apple requires this confirmation; a website cannot silently install a shortcut.
3. Answer the setup questions with the Upload URL and your **dashboard password**, not the HA token. Rename it to identify the person, for example **Upload Emma’s timetable**. Install another copy with the other person's URL when needed.
4. Open one PDF in Files or another app, tap **Share → Upload Emma’s timetable**, and confirm replacement. The template already accepts PDFs and has **Show in Share Sheet** enabled. Share the actual PDF file, not a webpage link. The shortcut finishes silently as soon as the server saves the PDF and only displays upload errors. The server converts it in the background. Conversion or saving errors appear in a dismissible notification at the top of the app on its next refresh; connection failures are shown by Shortcuts.

The downloadable file is a signed, blank template. Your URL and password are entered on your device after signing. Keep the configured shortcut private: its saved password grants access to the dashboard and home controls. The phone must reach the dashboard through home Wi-Fi, VPN or your trusted HTTPS proxy. After a timeout, check the dashboard before retrying; the upload may have completed. If you change the dashboard password or address, update the first two Text actions in your installed shortcut.

To rebuild the distributable after editing `scripts/build-timetable-shortcut.mjs`, run `node scripts/build-timetable-shortcut.mjs` on a Mac with Shortcuts installed and network access. This uses Apple's `shortcuts sign --mode anyone` and sends the blank template to Apple for validation. Commit the generated `public/shortcuts/Upload timetable.shortcut` alongside its source; Linux/Docker builds serve that file without needing a signing service. See Apple's guides to [sharing shortcuts](https://support.apple.com/guide/shortcuts/share-shortcuts-apdf01f8c054/ios) and [signing from the command line](https://support.apple.com/guide/shortcuts-mac/run-shortcuts-from-the-command-line-apd455c82f02/mac).

`POST /api/timetables?member=home%7Cperson.emma` accepts raw PDF bytes. Once the whole PDF is saved, it returns **202 Accepted** with `{ "message": "Timetable received. Conversion is running; the dashboard will refresh when ready and show any errors." }`. This acknowledges receipt, not completed conversion. Invalid content types, missing PDF headers, oversized uploads, disabled people and concurrent uploads are rejected immediately. Conversion failures (including protected or excessive-page PDFs) and settings conflicts are reported through `timetableError` on `/api/config`, keeping the previous timetable. The latest error is available until a successful retry for that person or a server restart. Background conversion does not resume after a restart; check the timetable and re-upload if needed. Images are served through password-protected `/api/timetables/<person>/<upload_id>/<page>.png` and `<page>-dark.svg` routes with `Cache-Control: no-store`.

## Verification

```sh
npm test
npm run test:server
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npm run build
npm run test:ha-app
```

Server tests require Poppler and permission to open local test ports. The container smoke test requires Docker. Tests use temporary data and fake credentials; they do not connect to your household or control devices.
