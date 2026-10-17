# Home Harmony UI

Afterglow is a shared family dashboard for Home Assistant. Home Assistant owns people, calendars, to-do items, devices and their permissions. Every screen connected to the same dashboard server shares its preferences and timetable files.

## Configuration and storage

| Data | Location |
| --- | --- |
| Home Assistant URL/token, dashboard password, server port and data directory | Server environment; `.env` for manual deployment; HAOS Configuration tab for the app |
| People visibility/order, timetable toggles and references, calendar/list assignments, favorites, appearance and selected alarm | `DATA_DIR/settings.yaml` |
| Uploaded timetable PDFs and rendered pages | `DATA_DIR/timetables/<person_name>/<upload_id>/` |
| Calendar events, to-do items, people and device state | Home Assistant |

`DATA_DIR` defaults to `./data` for Node/Vite and `/data` in the container. One server owns one household and one data directory. Phones, tablets and hallway screens must connect to that server. Settings refresh within five seconds while a screen is active; browser background throttling can delay refresh until it wakes. Settings and saved timetable pages remain available when HA is offline. HA controls, calendar events and list contents require HA to be online.

Settings saves validate the complete document, check its revision, write a temporary file, sync it and rename it atomically. Simultaneous stale writes are rejected. The unsaved draft stays in memory: keep that screen open, export it if needed, then use **App preferences → Load shared version**. Failed writes are not automatically replayed. **Retry storage** retries a failed save.

The server reads `settings.yaml` at startup. Stop it before editing the file manually, then restart it. A corrupt file stops startup without overwriting it. Back up the entire data directory, including timetable folders. Settings exports contain references to images, not the files themselves.

**Breaking change from 0.4:** old `configuration.json`, `.data` contents, browser planners, theme preferences and browser HA credentials are ignored. There is no migration or browser-only build. Old data is not deleted. Configure the server and set up household preferences again. Only version 3 settings exports can be imported.

## HAOS app installation

1. Add `https://github.com/cskogstrand/home-harmony-ui` to the Home Assistant app/add-on repositories and install **Home Harmony UI**.
2. Create a [long-lived access token](https://developers.home-assistant.io/docs/auth_api/#long-lived-access-tokens) in the HA profile for the account the dashboard should use. Prefer a dedicated account with only the permissions you need.
3. In the app's **Configuration** tab, set:

   ```yaml
   home_assistant_url: http://homeassistant:8123
   home_assistant_token: YOUR_LONG_LIVED_ACCESS_TOKEN
   dashboard_password: YOUR_UNIQUE_PASSWORD_AT_LEAST_12_CHARACTERS
   ```

4. Start/restart the app and open its web interface on port **8099**. Enter username **dashboard** and the configured dashboard password in the browser's authentication prompt.
5. Open **Home settings** to choose visible people, calendars, lists and timetables. Use the same dashboard address on your other screens.

HAOS supplies these options through `/data/options.json`; explicit environment variables take precedence. The Supervisor manages `/data` as persistent app data and includes it in app backups. The app uses its own web port, not HA ingress. The port can be changed under the app's Network settings.

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

Node and Vite read `.env` automatically; already-set environment variables win. Required values are `HOME_ASSISTANT_URL`, `HOME_ASSISTANT_TOKEN` and `DASHBOARD_PASSWORD` (at least 12 characters). `HOME_ASSISTANT_URL` is an HTTP(S) origin without credentials, path, or trailing slash. `PORT` defaults to 8099 for the Node server; Vite uses its own `--port` option. `DATA_DIR` selects the persistent directory.

PDF conversion requires Poppler (`pdfinfo` and `pdftoppm`): `brew install poppler` on macOS or `apt install poppler-utils` on Debian/Ubuntu. The Docker image includes Poppler and fonts.

## Access and the Home Assistant connection

The dashboard password protects HTML, assets, settings, timetable images and the WebSocket proxy. All screens act as the configured HA account. The token is sent to HA only by the server; it is absent from browser storage, public runtime configuration, settings backups and image URLs. The browser receives the configured URL for links to HA.

The server forwards the [HA WebSocket protocol](https://developers.home-assistant.io/docs/api/websocket/) and calendar REST reads to the configured HA origin. Browsers connect only to the dashboard; HA CORS changes are unnecessary. Cross-origin browser requests are rejected. A reverse proxy must preserve the browser's Host header and support WebSocket upgrades.

Use HTTPS through a trusted reverse proxy, or a trusted home network/VPN. HTTP Basic authentication does not encrypt the password over plain HTTP. Anyone with the dashboard password has the configured account's HA capabilities, including home controls. Changing the password and restarting invalidates future requests; browsers may remember Basic credentials until their authentication cache is cleared. **Disconnect** pauses live controls in that tab until reconnect/reload; it is not a logout or token revocation. Rotate/revoke the HA token in HA and update the server configuration when needed.

## Household preferences

In **Home settings**, choose people visibility and order, calendar assignments, one task and daily-task list per person, and a shared shopping list. Hidden people keep their assignments and timetable files. Everyone remains first. Favorites, dark mode, compact mode, calendar view/start day and alarm selection are shared too.

Settings use stable registry/entity references within this deployment, so changing the same HA instance's address does not create a new household. A different HA installation may require resetting or reassigning references. People use their `person.<name>` entity IDs; renaming that entity ID requires reassigning its timetable and preferences.

Calendar integrations and to-do lists stay in HA. The app uses reported capabilities to enable creation, editing, deletion and controls. Recurring event edits/deletions require an occurrence ID. Failed writes keep the draft; physical commands are never automatically replayed. Daily task resets belong in an HA automation, which can run while the dashboard is closed.

## School timetables

Enable a person's timetable in **Home settings**, then use **School → Upload PDF timetable**. PDFs may be up to **10 MB / 20 pages**, without password protection. Confirming an upload replaces that person's visible pages on every screen. Invalid uploads keep the previous timetable.

Each page gets its original PNG and a self-contained dark SVG with a dark background and light text. Turn on **App preferences → Appearance → Dark timetables** to use the dark images throughout the dashboard, School board and enlarged views, independently of the app theme. This shared preference defaults to off. Older PDF uploads get dark images on request without needing another upload; external image URLs keep their original colors.

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

### Share a PDF from iPhone

1. On your iPhone, open **School → Share from iPhone** for the person receiving the timetable and copy their **Upload URL**.
2. Tap **Download iOS shortcut**. Open the downloaded file in Shortcuts if Safari saves it to Downloads, then tap **Set Up Shortcut / Add Shortcut**. Apple requires this confirmation; a website cannot silently install a shortcut.
3. Answer the setup questions with the Upload URL and your **dashboard password**, not the HA token. Rename it to identify the person, for example **Upload Emma’s timetable**. Install another copy with the other person's URL when needed.
4. Open one PDF in Files or another app, tap **Share → Upload Emma’s timetable**, and confirm replacement. The template already accepts PDFs and has **Show in Share Sheet** enabled. Share the actual PDF file, not a webpage link. The server response appears after uploading; connection failures are shown by Shortcuts.

The downloadable file is a signed, blank template. Your URL and password are entered on your device after signing. Keep the configured shortcut private: its saved password grants access to the dashboard and home controls. The phone must reach the dashboard through home Wi-Fi, VPN or your trusted HTTPS proxy. After a timeout, check the dashboard before retrying; the upload may have completed. If you change the dashboard password or address, update the first two Text actions in your installed shortcut.

To rebuild the distributable after editing `scripts/build-timetable-shortcut.mjs`, run `node scripts/build-timetable-shortcut.mjs` on a Mac with Shortcuts installed and network access. This uses Apple's `shortcuts sign --mode anyone` and sends the blank template to Apple for validation. Commit the generated `public/shortcuts/Upload timetable.shortcut` alongside its source; Linux/Docker builds serve that file without needing a signing service. See Apple's guides to [sharing shortcuts](https://support.apple.com/guide/shortcuts/share-shortcuts-apdf01f8c054/ios) and [signing from the command line](https://support.apple.com/guide/shortcuts-mac/run-shortcuts-from-the-command-line-apd455c82f02/mac).

`POST /api/timetables?member=home%7Cperson.emma` accepts raw PDF bytes. Success returns `{ "message": "Timetable uploaded. The dashboard will refresh shortly.", "pages": 2 }`. Invalid/oversized PDFs, disabled people, concurrent uploads and settings conflicts return errors without discarding the previous timetable. Images are served through password-protected `/api/timetables/<person>/<upload_id>/<page>.png` and `<page>-dark.svg` routes with `Cache-Control: no-store`.

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
