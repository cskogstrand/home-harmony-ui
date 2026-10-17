# Home Harmony UI for Home Assistant OS

Run the Afterglow family dashboard on your Home Assistant OS device. Supports
64-bit ARM (`aarch64`, including Home Assistant Green/Yellow and Raspberry Pi
running 64-bit HAOS) and x86-64 (`amd64`).

## Install

1. Open **Settings → Apps → Install app → ⋮ → Repositories**. Older Home Assistant
   versions call this **Settings → Add-ons → Add-on Store**.
2. Add `https://github.com/cskogstrand/home-harmony-ui`.
3. Select **Home Harmony UI**, then **Install**. The device builds the app from
   this repository; the first install needs internet access to download the
   Node image and npm packages and can take several minutes.
4. In the app's **Configuration** tab, set `home_assistant_url` to the HA Core
   address reachable from the container, and `home_assistant_token` to a
   long-lived access token from your HA profile. Set `dashboard_password` to
   at least 12 characters, or set `dashboard_auth_disabled: true` to skip login
   on a trusted local network.
5. Start the app and select **Open Web UI**, or open
   `http://homeassistant.local:8099` using your HA device's actual LAN hostname/IP.
   Unless login is disabled, enter username **dashboard** and the dashboard password.
6. Open **Smart home → Home settings** to check the connection and choose
   household preferences. Every screen uses the configured HA account.

The repository files must be pushed to GitHub, and the repository must be public
for Home Assistant to clone the plain URL above without credentials. Adding this
package does not change GitHub visibility. To test a published branch, add the
repository URL with `#branch-name`.

## Network and login

This app opens as a separate website on port **8099**; it does not use Home
Assistant's embedded ingress/sidebar. By default, the shared dashboard login
protects pages, settings, timetables and the HA proxy. Setting
`dashboard_auth_disabled: true` opens these and the configured account's home
controls to anyone who can reach the dashboard. The HA token is still required
and stays on the server. Cross-origin checks remain enabled.

If the default `http://homeassistant.local` cannot be reached from the container,
try the internal `http://homeassistant` hostname or the device's LAN IP. Use
HA Core's actual port: HAOS 2026.8+ defaults to 80; older or custom installations
may need `:8123`. See the [HTTP settings](https://www.home-assistant.io/integrations/http/).
After saving, restart the app. A generic connection error does not mean the
token was rejected: reconnect and check the app's **Log** tab for DNS, network
or WebSocket errors. Token rejection is reported separately.

The server proxies HA WebSockets and calendar requests, so HA CORS changes are
unnecessary. HTTPS certificates must be trusted by the container.

Change the host port in the app's **Configuration → Network** section if 8099 is
already in use. Open Web UI uses the configured
port. If you access HA through a cloud/remote address, open this dashboard using
the device's LAN address instead; HA's remote URL does not forward this port.

Use the HTTP web interface on a trusted LAN. For HTTPS, use a trusted reverse
proxy that preserves the Host header, SPA routes and WebSocket upgrades.

## Persistent storage and backups

The app stores app configuration in `/data/configuration.json`: HA connection
URLs, calendar/to-do assignments, people visibility/order, favorites, timetable
settings, appearance and selected alarm panel. Uploaded timetable PDFs are converted
to private PNG pages under `/data/timetables/`; the original PDF is discarded.
Calendar events, list contents,
people records and smart-home state stay in Home Assistant.
Shared persistent storage is the default; no storage mode needs enabling.
HAOS keeps this folder across container updates and restarts and includes it in
app backups. The app uses atomic writes and rejects stale writes from another
screen. Signed-in screens refresh shared settings within five seconds.

Open **App preferences → Storage and backups**:

- **Export configuration** downloads a versioned JSON backup of all settings profiles.
- **Import configuration** validates a file, then asks before replacing the
  entire shared configuration for every screen. Export your current config first
  if you want to keep it. Invalid files do not replace saved data.
- **Use settings from this browser** copies app settings from browser-only mode only
  after confirmation. Old browser data is kept. If it belongs to another dashboard
  address, export from that old address and import the file here.
- **Retry storage** retries a failed save. On a conflict, export unsaved changes
  first, then **Load shared version** to discard the local draft and start from
  the latest server configuration. Keep the tab open until changes are saved or
  exported; unsaved drafts are not automatically replayed after reconnecting.

Backups contain household information, so keep them private. They do not contain
HA login credentials, alarm codes, people records, HA entities, calendar events
or list contents. Only configuration format 2 is accepted; older formats are not
supported. JSON exports contain timetable page URLs, not uploaded image files.
Back up all of `/data/` (or use HA app backups) to preserve uploaded timetables;
external image URLs still depend on their original host. Old uploads are retained
for configuration restores, so disk use grows over time. Each new screen uses
the shared dashboard login unless it is disabled. Moving the same HA instance to a new URL
remaps reference prefixes; changing entity/registry IDs in a different HA
installation requires selecting those people, calendars, lists and favorites again.

Version 0.3.0 requires a fresh settings file or a format 2 backup. If an older
`configuration.json` exists, remove or replace it before starting the app; there
is no automatic migration or reset.

A corrupted storage file stops the server from starting, rather than overwriting
it. Restore the app's HA backup or replace `/data/configuration.json` with a valid
export before restarting. The old file is left intact for recovery.

## Timetables from iPhone

Enable a person's timetable in Home settings, then open **School board** to
upload a PDF (up to 10 MB / 20 pages) or view **Share from iPhone** for their
upload URL. The container includes PDF conversion tools. Uploads and rendered
pages use the dashboard login unless it is disabled.
See the [iOS shortcut and API setup](README.md#share-a-timetable-from-iphone).
Use your dashboard's reachable HTTPS/LAN/VPN address, not HA's cloud URL.

## Updates

Refresh the app store and use **Update** when a new app version is available.
The maintainer must bump `version` in `config.yaml` when publishing an update.
See the repository [README](https://github.com/cskogstrand/home-harmony-ui#readme)
for calendar/list setup and local server development.
