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
   Node/nginx images and npm packages and can take several minutes.
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
permissions apply. No Supervisor token or Home Assistant configuration files are
given to the container.

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
requires your HA login. Use it on a trusted LAN. For HTTPS, put it behind your
existing trusted reverse proxy with SPA routes preserved. An HTTPS dashboard
also requires an HTTPS HA URL.

## Storage and updates

Logins, local plans, timetable URLs and assignments stay in each browser's
storage. They are **not included in Home Assistant app backups**. Moving from a
development URL to the HAOS URL starts a separate browser dataset; the old data
is not deleted or migrated. Changing the dashboard's scheme, hostname or port
also changes its storage origin.

For updates, refresh the app store and use **Update** when a new app version is
available. The maintainer must bump `version` in `config.yaml` when publishing an
update. See the repository [README](https://github.com/cskogstrand/home-harmony-ui#readme)
for calendar/list setup and other dashboard features.
