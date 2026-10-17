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
4. Start the app and select **Open Web UI**, or open
   `http://homeassistant.local:8099` using your HA device's actual LAN hostname/IP.
5. In the dashboard, open **Smart home → Home settings**, enter the Home Assistant
   URL your browser can reach (usually `http://homeassistant.local:8123`), and
   select **Connect** to sign in with your own Home Assistant account.

The repository files must be pushed to GitHub, and the repository must be public
for Home Assistant to clone the plain URL above without credentials. Adding this
package does not change GitHub visibility. To test a published branch, add the
repository URL with `#branch-name`.

## Network and login

This app opens as a separate website on port **8099**; it does not use Home
Assistant's embedded ingress/sidebar. The existing browser OAuth login and HA
permissions apply. Each storage request is authenticated against the instance in
the app's **Configuration → home_assistant_url** option (default:
`http://homeassistant:8123`). Change it if HA Core uses a different port or HTTPS;
certificates must be trusted by the container. Never disable certificate checks.
All users signed into that instance can read and edit shared planner settings.
The storage server checks each request's HA user token without storing it and
does not use Supervisor tokens.

For calendar REST access, allow the dashboard's exact origin, such as
`http://homeassistant.local:8099`, in Home Assistant's **Settings → System →
Network → HTTP server → CORS allowed origins**. Older versions use
`http.cors_allowed_origins` in `configuration.yaml`. Use the hostname/IP and port
shown in the dashboard's address bar. See the [HTTP documentation](https://www.home-assistant.io/integrations/http/).

Change the host port in the app's **Configuration → Network** section if 8099 is
already in use, and update the allowed origin. Open Web UI uses the configured
port. If you access HA through a cloud/remote address, open this dashboard using
the device's LAN address instead; HA's remote URL does not forward this port.

The web interface is HTTP and serves public static files; access to HA data
and shared configuration requires your HA login. Use it on a trusted LAN. For HTTPS, put it behind your
existing trusted reverse proxy with SPA routes preserved. An HTTPS dashboard
also requires an HTTPS HA URL.

## Persistent storage and backups

The app stores all planners, local plans/list entries, calendar/to-do assignments,
people order, favorites and timetable settings in `/data/configuration.json`.
HAOS keeps this folder across container updates and restarts and includes it in
app backups. The app uses atomic writes and rejects stale writes from another
screen. Signed-in screens refresh shared settings within five seconds.

Open **App preferences → Storage and backups**:

- **Export configuration** downloads a versioned JSON backup of all planners.
- **Import configuration** validates a file, then asks before replacing the
  entire shared configuration for every screen. Export your current config first
  if you want to keep it. Invalid files do not replace saved data.
- **Use settings from this browser** migrates existing browser planners only
  after confirmation. Old browser data is kept. If it belongs to another dashboard
  address, export from that old address and import the file here.
- **Retry storage** retries a failed save. On a conflict, export unsaved changes
  first, then **Load shared version** to discard the local draft and start from
  the latest server configuration. Keep the tab open until changes are saved or
  exported; unsaved drafts are not automatically replayed after reconnecting.

Backups contain household information, so keep them private. They do not contain
HA login credentials, alarm codes, per-screen preferences (appearance and selected
alarm panel), HA entities, HA events
or remote to-do contents. Timetable images remain external; only their URLs are
saved. Each new screen must sign into HA. Moving the same HA instance to a new URL
remaps reference prefixes; changing entity/registry IDs in a different HA
installation requires selecting those people, calendars, lists and favorites again.

A corrupted storage file stops the server from starting, rather than overwriting
it. Restore the app's HA backup or replace `/data/configuration.json` with a valid
export before restarting. The old file is left intact for recovery.

## Updates

Refresh the app store and use **Update** when a new app version is available.
The maintainer must bump `version` in `config.yaml` when publishing an update.
See the repository [README](https://github.com/cskogstrand/home-harmony-ui#readme)
for calendar/list setup and local server development.
