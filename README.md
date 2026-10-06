# Home Harmony UI

A React 18 / TypeScript / Vite family dashboard with a direct local Home Assistant connection. Home Assistant is the sole smart-home backend; the family planner remains local to this browser.

## Run and connect locally

Requires Node.js 20, 22, or 24+, npm, and Home Assistant **2023.9 or newer**. Browser baseline: Safari 16.4+, Chrome 111+, Firefox 128+.

```sh
npm install
npm run dev
```

Open the URL printed by Vite (configured port: `8080`). In **Smart home → Home settings**, enter your HA origin, for example `http://homeassistant.local:8123`, and choose **Connect**. Use your instance’s actual port. Sign in on Home Assistant’s page; its callback returns to `/settings`.

For another screen on your LAN, bind Vite to your LAN interface with `npm run dev -- --host 0.0.0.0` and open the computer’s LAN address. No public hosting, router port forwarding, cloud relay, webhook, or application backend is required. Keep the dashboard at the same origin to retain its browser-local planner storage. Production output is `dist/`; a local static server must provide SPA fallback to `index.html`, including `/settings`.

### Authentication and connection

- `home-assistant-js-websocket` owns the browser `getAuth()` flow, token refresh and WS reconnects. Only the selected HA URL is saved. Access/refresh tokens stay in memory, never in source, environment variables, localStorage, query strings or logs. The one-time OAuth authorization code is removed from the callback URL immediately.
- **Disconnect** closes subscriptions/socket and keeps credentials in memory for reconnecting in the same tab. **Log out** clears the cached home/user and attempts to revoke this HA session. A failed revocation is reported; it is not presented as successful server logout. Reloading requires Connect again.
- One connection is shared by the app in each browser tab. State comes from `subscribeEntities()`, with area/device/entity registries used for metadata. A physical device may expose several entities. Area priority is entity, then physical device, then Unassigned.
- Cached values are marked stale on connection loss. Controls stay disabled until a new entity snapshot and service metadata arrive. Commands are never queued or retried; a lost acknowledgement has an unknown outcome. Inspect the reported state before repeating it.
- HTTP HA uses WS; HTTPS HA uses WSS. An HTTPS dashboard cannot access HTTP HA. Use local HTTP for both, or trusted local HTTPS for both. A self-signed/untrusted or mismatched certificate must be fixed/trusted in your browser/OS; the dashboard cannot bypass certificate checks.
- HA enforces access permissions. Registry/service load failures are shown in settings, without inventing device metadata or granting frontend roles. A non-admin account may have less metadata available.

### Calendar access

Calendar integrations remain in Home Assistant. This app reads `GET /api/calendars/{entity_id}?start=…&end=…` with an in-memory bearer header. It requests the displayed day/week using HA’s timezone (including DST), handles all-day exclusive end dates, and shows entries in a separate **read-only** HA section. Change the range or use **Refresh calendars** to fetch again. There are no calendar writes or invitations.

Allow the dashboard’s **exact origin**, including scheme and port, in HA’s CORS allowed origins. For current HA versions, use **Settings → System → Network → HTTP server → CORS allowed origins**. For versions configured through YAML, merge the following into the existing `http:` block and restart HA as required:

```yaml
http:
  cors_allowed_origins:
    - http://localhost:8080
    # Replace/add the exact LAN origin used by your tablet, if different.
```

Use the actual origin from the dashboard address bar, including `127.0.0.1` versus `localhost`. Do not use a wildcard. HA’s current HTTP settings UI may restart HA and require confirmation after saving; follow its prompts. See the [official HTTP settings documentation](https://www.home-assistant.io/integrations/http/).

REST was chosen because it is supported across the declared HA range and still used by the official frontend. Newer HA versions also expose calendar subscriptions; this app does not depend on that newer API. See the [REST API](https://developers.home-assistant.io/docs/api/rest/) and [official frontend calendar API usage](https://github.com/home-assistant/frontend/blob/dev/src/data/calendar.ts).

## Local family data

Existing `afterglow-planner-v1:*` datasets keep their original keys and contents. The default remains `home-1`. **App preferences → Local family planner** can select other existing datasets. Changing HA instances, connecting, disconnecting or logging out does not migrate, upload or delete plans, lists, school timetables or calendar preferences. HA entries never enter the local planner store. Keep the same dashboard origin/browser to access existing data; the app does not copy storage across origins. New local planners retain the existing starter household content, which is editable locally.

## Controls and limits

- Lights: power and brightness when advertised. Switches: power. Climate: advertised HVAC modes and a single temperature target when its limits/current target are reported. Covers: advertised open/close/stop/position actions. Locks: explicit confirmation, with a transient code when HA requires one.
- Sensors and binary sensors display reported states and units, including unknown, unavailable and missing. Other HA domains remain readable; advanced controls are available in HA.
- Scenes are activation actions, never persistently active moods. Automations use HA enable/disable services; edit their definitions in HA.
- Alarm panels support selection (using instance + registry ID), advertised modes, transitional/triggered states and HA code requirements. Codes are sent only with the requested service call, are cleared on submit/cancel, and are not locally validated against a demo PIN. Eva entities will work through a future separate HA integration; no Eva logic is implemented here.
- Energy/power/monetary sensors show their reported values. Charger controls depend on the integration exposing supported entities, such as switches. There is no inferred battery percentage, charging schedule, optimizer, tariff or subscription.
- Recorded history, advanced energy views, device pairing, area editing and integration setup open HA’s own UI. This app does not load recorder history or manage subscriptions, alarm monitoring, push or email delivery.
- A service acknowledgement is not proof of physical completion. UI state changes only on HA reports. Errors deliberately avoid echoing raw server messages that might contain codes.

## Validation

```sh
npm test
npx tsc -p tsconfig.app.json --noEmit
npm run build
npm run lint
```

Focused Vitest/Testing Library fixtures cover mapping, capabilities, units/missing values, payload conversions, authentication callback cleanup, connection teardown/reconnect, stale controls, rejected/in-flight commands without replay, transient alarm codes, calendar ranges, and preservation of local family data/navigation. These are controlled tests, not live HA validation. Before relying on a household connection, verify browser login, permissions, registry access, calendar CORS and your integration-specific behavior. No real lock, alarm or other physical device was operated during implementation.

API references: [WebSocket client](https://github.com/home-assistant/home-assistant-js-websocket), [WebSocket API](https://developers.home-assistant.io/docs/api/websocket/), [authentication](https://developers.home-assistant.io/docs/auth_api/), [alarm panels](https://developers.home-assistant.io/docs/core/entity/alarm-control-panel/), [calendar entities](https://developers.home-assistant.io/docs/core/entity/calendar/).
