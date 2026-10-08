# Home Harmony UI

A React 18 / TypeScript / Vite family dashboard with a direct local Home Assistant connection. Home Assistant supplies smart-home state, calendars and to-do lists; local plans and dashboard assignments stay in this browser.

## Run and connect locally

Requires Node.js 20, 22, or 24+, npm, and Home Assistant **2023.9 or newer**. Browser baseline: Safari 16.4+, Chrome 111+, Firefox 128+.

```sh
npm install
npm run dev
```

Open the URL printed by Vite (configured port: `8080`). In **Smart home → Home settings**, enter your HA origin, for example `http://homeassistant.local:8123`, and choose **Connect**. Use your instance’s actual port. Sign in on Home Assistant’s page; its callback returns to `/settings`.

For another screen on your LAN, bind Vite to your LAN interface with `npm run dev -- --host 0.0.0.0` and open the computer’s LAN address. No public hosting, router port forwarding, cloud relay, webhook, or application backend is required. Keep the dashboard at the same origin to retain its browser-local planner storage. Production output is `dist/`; a local static server must provide SPA fallback to `index.html`, including `/settings`.

### Authentication and connection

- `home-assistant-js-websocket` owns the browser `getAuth()` flow, token refresh and WS reconnects. Its `saveTokens`/`loadTokens` hooks keep access/refresh credentials in **browser-profile localStorage** (`home-harmony:ha-session`), scoped to the dashboard origin. Refreshing, opening a new tab or restarting the browser restores that login automatically, refreshes expired access tokens and waits for fresh HA state before enabling controls. Credentials are validated against the selected HA origin and dashboard client ID before reuse. Missing/corrupt/revoked credentials leave the planner usable and require an explicit **Connect**; there is no automatic login redirect loop.
- The selected HA URL and login are saved in localStorage; tokens never enter source, environment variables, URLs, UI state or logs. The one-time OAuth authorization code is removed from the callback URL immediately. Storage failures appear in Home settings, with no fallback to a different token store. If upgrading from the tab-only version, sign in once again; its old sessionStorage credentials are discarded.
- **Disconnect** closes subscriptions/socket, keeps the shared browser login and pauses only this tab across refreshes (the pause preference stays in sessionStorage). A newly opened tab can still reconnect. **Connect** resumes it. **Log out** immediately removes the browser login and cached home/user, disconnects other open tabs through storage events, then attempts to revoke the HA session (also when disconnected). A failed revocation is reported. Invalid authentication also removes saved credentials, and saved-session revisions prevent delayed callbacks from restoring a logged-out session or overwriting a different instance's login. The local planner is untouched.
- **Browser-storage limits:** this is the explicitly chosen frontend-only design. Persistent localStorage is readable by scripts from this app, including injected scripts, and is not a secret vault. Use a trusted device and a dedicated dashboard origin. Closing tabs does not log out. The login remains until **Log out**, HA revocation or clearing site data. Private browsing can clear it when the last private tab closes. Other browser profiles, devices and dashboard origins have separate storage. See [localStorage lifetime and scope](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage). Keeping tokens inaccessible to app scripts would require a local backend with HttpOnly session cookies.
- Production builds include a Content Security Policy restricting scripts to this origin and blocking plugins/base-URL changes. Development retains Vite's required inline preamble. The policy reduces injection opportunities; it does not make browser storage inaccessible to same-origin scripts.
- One connection is shared by the app in each browser tab. State comes from `subscribeEntities()`, with area/device/entity registries used for metadata. A physical device may expose several entities. Area priority is entity, then physical device, then Unassigned.
- Cached values are marked stale on connection loss. Controls stay disabled until a new entity snapshot and service metadata arrive. Commands are never queued or retried; a lost acknowledgement has an unknown outcome. Inspect the reported state before repeating it.
- HTTP HA uses WS; HTTPS HA uses WSS. An HTTPS dashboard cannot access HTTP HA. Prefer trusted local HTTPS for both to protect credentials in transit; local HTTP is supported but unencrypted. A self-signed/untrusted or mismatched certificate must be fixed/trusted in your browser/OS; the dashboard cannot bypass certificate checks.
- HA enforces access permissions. Registry/service load failures are shown in settings, without inventing device metadata or granting frontend roles. A non-admin account may have less metadata available.

### Calendar access

Set up [people in Home Assistant](https://www.home-assistant.io/integrations/person/) and add calendar integrations there. In this app, open **Home settings → People and calendars**. Each person’s row shows their selected calendars; use **Add calendar** to add one or the **×** button to remove one. Use **Everyone** for shared calendars. A calendar belongs to one person or Everyone; dropdown options indicate when selecting one moves its assignment. Unselected calendars stay hidden. Assignments use instance-scoped registry IDs where available and survive entity renames.

**Everyone** has its own row in the dashboard and calendar, with shared plans shown only there. No separate HA person is needed for the family. **Weekly grid** is the default layout; existing saved layout choices are preserved.

Set **Home settings → People order and timetables** with the up/down buttons. The saved order applies to the dashboard, both calendar layouts, tasks, daily tasks, school timetables and person selectors. Everyone stays first, and new people follow the saved people. Order is stored per HA instance and local planner in this browser and survives refreshes and temporarily missing people.

Use each person’s **Timetable** toggle in the same settings section to include them on the School board and dashboard. Existing saved timetable images start enabled; people without an image start disabled. Enable a person before adding their image URLs on the School board, one URL per line in page order. Swipe between pages or use the arrows; tapping a page opens it in an enlarged carousel. Remove or reorder lines to change the pages. Existing single-image timetables carry over automatically. Disabling a timetable hides it without deleting its saved URLs, so it returns when enabled again. These choices use the same browser, instance and planner scope as people order.

For multi-page PDFs, the existing Nextcloud → image conversion workflow still works: generate a stable image URL for each page and paste those URLs into the School board. Updating the images at those URLs avoids editing the app’s settings each week when the page count stays the same; browser/server caching controls when replacements become visible.

Calendar integrations remain in Home Assistant. The app subscribes to events for the displayed day/week and falls back to `GET /api/calendars/{entity_id}?start=…&end=…` with an in-memory bearer header on older HA versions. It uses HA’s timezone (including DST) and shows HA events alongside local plans in the dashboard, per-person calendar and weekly grid. Change the range or use **Refresh calendars** to fetch again.

New plans save through `calendar.create_event` when the selected calendar supports creation. Open an existing event to edit its title, dates/times, location and reminder through `calendar/event/update` when its calendar supports updates and supplies an event UID. All-day end dates in the editor include the last day; the app converts them to HA’s exclusive end. Recurring edits change only the selected occurrence; recurring events without an occurrence ID remain read-only. Calendar/person assignments and recurrence rules cannot be changed in this editor. Failed saves retain the draft; writes are never automatically retried or saved as local duplicates.

The built-in [Google Calendar integration](https://github.com/home-assistant/core/blob/dev/homeassistant/components/google/calendar.py) currently supports creating and deleting events, but does not implement updates. A calendar being writable in Google does not mean HA exposes editing for it. The app follows HA’s reported capabilities and explains whether editing is blocked by the integration, a missing event ID, or a missing recurring occurrence ID.

Allow the dashboard’s **exact origin**, including scheme and port, in HA’s CORS allowed origins. For current HA versions, use **Settings → System → Network → HTTP server → CORS allowed origins**. For versions configured through YAML, merge the following into the existing `http:` block and restart HA as required:

```yaml
http:
  cors_allowed_origins:
    - http://localhost:8080
    # Replace/add the exact LAN origin used by your tablet, if different.
```

Use the actual origin from the dashboard address bar, including `127.0.0.1` versus `localhost`. Do not use a wildcard. HA’s current HTTP settings UI may restart HA and require confirmation after saving; follow its prompts. See the [official HTTP settings documentation](https://www.home-assistant.io/integrations/http/).

REST fallback keeps calendar reads available across the declared HA range. See the [REST API](https://developers.home-assistant.io/docs/api/rest/) and [official frontend calendar API usage](https://github.com/home-assistant/frontend/blob/dev/src/data/calendar.ts).

### Tasks, daily tasks and shopping

Create lists in Home Assistant with [Local to-do](https://www.home-assistant.io/integrations/local_todo/), Shopping list, or another to-do integration (HA 2023.11+). Open **Home settings → People and to-do lists**. Everyone appears first, followed by your HA people. Choose one **Tasks** list and one **Daily tasks** list per person, plus one **Shared shopping list**. Each list has one assignment; choosing a list already assigned elsewhere moves it. Choose **No list selected** to remove an assignment. Selections are scoped to the HA instance and local planner and use registry IDs where available.

Connected dashboard and Lists views use the selected HA lists. Add, complete, reopen and remove items directly in those lists, subject to their supported features and HA permissions. Reads use HA’s `todo/item/list` WebSocket request; writes use `todo.add_item`, `todo.update_item` and `todo.remove_item` with item UIDs. Items are fetched when the view opens, after edits and when the list’s reported state changes; **Refresh list** reloads other external changes. Remote item contents are never saved in browser storage. Failed, missing and offline lists show explicit messages, and writes are disabled offline without queuing or retries.

**Daily resets belong in Home Assistant.** Assigning a daily list does not reset or recreate its items. Configure an HA automation to retrieve completed items with `todo.get_items` and set each item’s status back to `needs_action` using `todo.update_item` at your preferred time. It can run while the dashboard is closed. See [HA to-do actions](https://www.home-assistant.io/integrations/todo/).

Add controls appear above each list. As you type, matching existing entries appear below the input, including completed items. Adding a matching completed item reopens it; matching an active item keeps the existing entry. Matching ignores case and surrounding spaces and stays within the selected list/person. Checked-off entries are grouped under **Completed**, collapsed by default; expand it to reopen or remove them.

## Local family data

Before an HA instance is configured, the local planner includes the starter household. Once an instance URL is configured, all starter people, events, lists and school images are replaced with real HA people and setup messages. Disconnecting, reconnecting, logging out or reloading never brings demo content back.

Connected households use separate `afterglow-connected-planner-v1:<instance>:<planner>` datasets, initially empty. Existing `afterglow-planner-v1:*` data is preserved without copying its sample or edited entries into the connected household; only calendar display preferences and home favorites carry over. **App preferences → Local family planner** selects the planner for the current instance. Add local plans in this app and timetable image URLs on the School board. These entries and calendar/to-do assignments remain local to this browser; HA events and to-do items are never written into localStorage. Existing local list entries are preserved in storage, but connected views show only selected HA lists. Keep the same dashboard origin/browser to retain this data.

Missing people, calendar and to-do integrations link to setup in HA; missing assignments and timetable images explain their setup in this app. Loading, partial read failures and offline states remain explicit. Remote events and to-do items are hidden while offline; local plans remain accessible, including when their person is unavailable.

## Controls and limits

- Smart-home navigation uses **Areas**, **Zones**, **Automations** and **Integrations**. Earlier `/rooms`, `/automation` and `/services` links redirect to the renamed pages.
- **Zones** reads `zone.*` entities from the existing live HA state subscription, including presence counts, radius, coordinates and passive-zone metadata. Missing/unavailable values and stale readings remain explicit. Zone editing opens Home Assistant; there are no third-party map requests or location writes. See [Home Assistant zones](https://www.home-assistant.io/integrations/zone/).
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

Focused Vitest/Testing Library fixtures cover mapping, capabilities, units/missing values, payload conversions, authentication callback cleanup, refresh/new-tab recovery and token renewal, logout/revocation across tabs and delayed callbacks, corrupt/denied storage, connection teardown/reconnect, stale controls, rejected/in-flight commands without replay, transient alarm codes, calendar ranges, and preservation of local family data/navigation. These are controlled tests, not live HA validation. Before relying on a household connection, verify browser login, permissions, registry access, calendar CORS and your integration-specific behavior. No real lock, alarm or other physical device was operated during implementation.

API references: [WebSocket client](https://github.com/home-assistant/home-assistant-js-websocket), [WebSocket API](https://developers.home-assistant.io/docs/api/websocket/), [authentication](https://developers.home-assistant.io/docs/auth_api/), [alarm panels](https://developers.home-assistant.io/docs/core/entity/alarm-control-panel/), [calendar entities](https://developers.home-assistant.io/docs/core/entity/calendar/).
