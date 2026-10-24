# Setup and everyday use

[← Overview](https://github.com/cskogstrand/home-harmony-ui/blob/main/README.md) · [Morning summaries](https://github.com/cskogstrand/home-harmony-ui/blob/main/docs/morning-summary.md) · [Development](https://github.com/cskogstrand/home-harmony-ui/blob/main/docs/development.md)

Install on [Home Assistant OS](#haos-app-installation) or with [Docker](#manual-docker-deployment), then choose your people, calendars and lists in **Home settings**.

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
5. Open **Home settings** to choose visible people, calendars, lists and timetables. Use the same dashboard address on your other screens.

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

Use HTTPS through a trusted reverse proxy, or a trusted home network/VPN. HTTP Basic authentication does not encrypt the password over plain HTTP. Anyone with the dashboard password has the configured account's HA capabilities, including home controls. Changing the password and restarting invalidates future requests; browsers may remember Basic credentials until their authentication cache is cleared. **Disconnect** pauses live controls in that tab until reconnect/reload; it is not a logout or token revocation. Rotate/revoke the HA token in HA and update the server configuration when needed.

## Household preferences

In **Home settings**, choose people visibility and order, calendar assignments, one task and daily-task list per person, and a shared shopping list. Hidden people keep their assignments and timetable files. Everyone remains first. Favorites, dark mode, compact mode, calendar view/start day and alarm selection are shared too.

**Smart home visibility** keeps new devices and entities hidden until enabled. Existing selections are retained on the first complete Home Assistant sync after upgrading. Light cards offer brightness from 1–100%, plus color, color temperature, white mode and effects when supported; use the toggle to turn a light off.

Selected entities from the same device share a card. In **Smart home visibility**, choose its **Main entity**, **Card size** and **Card group**, or explicitly link an image/map, maintenance sensor or other entity from another device. Choosing a main entity enables it; other entities appear only when enabled or explicitly linked.

On **Smart home**, select **Configure** to change card sizes, reorder cards, or move them between named groups. Drag a card by its handle, or use the move buttons and **Card group** menu. Room filters stay available, and moving cards preserves those outside the active filter. Use **Add group**, then assign a card to save the group. Card controls are inactive while configuring; select **Done** to use them again. Card order, groups, sizes and composition save automatically, are shared across screens and are included in settings backups.

Select a camera or image preview to open a full-width viewer. Cameras use an authenticated HA stream with a labeled snapshot fallback; maps and media artwork require HA-provided images, and weather forecasts require a supported forecast period. Main sensor and air-quality cards load numeric history only when **History** is expanded, for **24 h** or **7 d**, subject to HA's recorded data. Missing data stays unavailable; `/device-gallery` remains a fictional demonstration.

Settings use stable registry/entity references within this deployment, so changing the same HA instance's address does not create a new household. A different HA installation may require resetting or reassigning references. People use their `person.<name>` entity IDs; renaming that entity ID requires reassigning its timetable and preferences.

Calendar integrations and to-do lists stay in HA. The app uses reported capabilities to enable creation, editing, deletion and controls. Recurring event edits/deletions require an occurrence ID. Failed writes keep the draft; physical commands are never automatically replayed. Daily task resets belong in an HA automation, which can run while the dashboard is closed.

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

**Breaking change from 0.4:** old `configuration.json`, `.data` contents, browser planners, theme preferences and browser HA credentials are ignored. There is no migration or browser-only build. Old data is not deleted. Configure the server and set up household preferences again. Only version 3 settings exports can be imported. Use **App preferences → Storage and backups** to export or import settings. Keep exports private: they contain household preferences and references.

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

External image URLs remain supported, one per line in page order. Swipe or use arrows between pages; tap to enlarge. Disabling a timetable hides it without removing its files or URLs.

## Share a PDF from iPhone

1. On your iPhone, open **Settings → Timetables → Share from iPhone** for the person receiving the timetable and copy their **Upload URL**.
2. Tap **Download iOS shortcut**. Open the downloaded file in Shortcuts if Safari saves it to Downloads, then tap **Set Up Shortcut / Add Shortcut**. Apple requires this confirmation; a website cannot silently install a shortcut.
3. Answer the setup questions with the Upload URL and your **dashboard password**, not the HA token. Rename it to identify the person, for example **Upload school timetable**. Install another copy with the other person's URL when needed.
4. Open one PDF in Files or another app, tap **Share → Upload school timetable**, and confirm replacement. The template already accepts PDFs and has **Show in Share Sheet** enabled. Share the actual PDF file, not a webpage link. The shortcut finishes silently as soon as the server saves the PDF and only displays upload errors. The server converts it in the background. Conversion or saving errors appear in a dismissible notification at the top of the app on its next refresh; connection failures are shown by Shortcuts.

The downloadable file is a signed, blank template. Your URL and password are entered on your device after signing. Keep the configured shortcut private: its saved password grants access to the dashboard and home controls. The phone must reach the dashboard through home Wi-Fi, VPN or your trusted HTTPS proxy. After a timeout, check the dashboard before retrying; the upload may have completed. If you change the dashboard password or address, update the first two Text actions in your installed shortcut.

To rebuild the distributable after editing `scripts/build-timetable-shortcut.mjs`, run `node scripts/build-timetable-shortcut.mjs` on a Mac with Shortcuts installed and network access. This uses Apple's `shortcuts sign --mode anyone` and sends the blank template to Apple for validation. Commit the generated `public/shortcuts/Upload timetable.shortcut` alongside its source; Linux/Docker builds serve that file without needing a signing service. See Apple's guides to [sharing shortcuts](https://support.apple.com/guide/shortcuts/share-shortcuts-apdf01f8c054/ios) and [signing from the command line](https://support.apple.com/guide/shortcuts-mac/run-shortcuts-from-the-command-line-apd455c82f02/mac).

`POST /api/timetables?member=home%7Cperson.example_child` accepts raw PDF bytes. Once the whole PDF is saved, it returns **202 Accepted** with `{ "message": "Timetable received. Conversion is running; the dashboard will refresh when ready and show any errors." }`. This acknowledges receipt, not completed conversion. Invalid content types, missing PDF headers, oversized uploads, disabled people and concurrent uploads are rejected immediately. Conversion failures (including protected or excessive-page PDFs) and settings conflicts are reported through `timetableError` on `/api/config`, keeping the previous timetable. The latest error is available until a successful retry for that person or a server restart. Background conversion does not resume after a restart; check the timetable and re-upload if needed. Images are served through password-protected `/api/timetables/<person>/<upload_id>/<page>.png` and `<page>-dark.svg` routes with `Cache-Control: no-store`.

## Read timetables from an automation

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
      "member": "home|person.example_child",
      "enabled": true,
      "pages": ["/api/timetables/YOUR_API_KEY/example_child/UPLOAD_ID/1.png"]
    }
  ]
}
```

Prefix relative page URLs with your dashboard's origin to download the images without headers. A saved PNG also has a dark variant at the same path ending in `-dark.svg` instead of `.png`. External image URLs are returned unchanged; never send your API key to those hosts. Read the listing on each automation run to get the latest upload's pages. Entries without saved URLs are omitted; saved empty entries have an empty `pages` array. Disabled timetables remain listed with `enabled: false`, so automations can skip them. Saved pages also report `enabled: false` while the person uses Calendars, preventing image-based automations from reading an inactive timetable. Calendar events remain available through Home Assistant’s calendar APIs.

The key permits only listing timetables and downloading stored PNG/SVG pages, including older retained uploads. It cannot upload PDFs, read/change dashboard settings, or access HA controls. Responses use `Cache-Control: no-store`. Dashboard credentials still work on the original routes, including `GET /api/timetables` (which returns page URLs without a key).

Treat the entire URL as a secret: anyone with it can read timetables, and URLs may appear in automation traces, proxy logs or AI-provider requests. Use HTTPS or a trusted LAN/VPN. Rotate the key and restart to invalidate old URLs. For AI image analysis, attach the PNG through the AI integration's supported image input; a URL in a text prompt alone does not guarantee that the model will fetch it.
