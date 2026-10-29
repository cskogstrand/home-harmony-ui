# Home Harmony UI

**Afterglow** brings your family’s calendars, lists, school timetables and Home Assistant controls onto one shared dashboard.

![Afterglow dashboard with family plans, tasks and home controls](https://raw.githubusercontent.com/cskogstrand/home-harmony-ui/main/docs/images/dashboard.png)

*Current app with fictional demo data.*

## At a glance

- **Plan together** — a family calendar, daily tasks and a shared shopping list.
- **Keep school close** — PDF timetables or Home Assistant calendars, with iPhone uploads.
- **Control your home** — lights, climate, scenes and other Home Assistant devices.
- **Share across screens** — one server keeps preferences and timetables in sync. English and Norwegian Bokmål, light and dark themes.

Home Assistant owns your people, events, lists and devices. Afterglow stores dashboard preferences and uploaded timetables; the HA token stays on the server.

Unfinished to-dos with due dates appear under their assigned person in the month, week and day calendars, including Today’s calendar previews. A small task icon distinguishes them from calendar events. Date-only deadlines appear as all-day items; timed deadlines use the home’s time zone. Open a task for its details and a link to its list. Completed tasks, undated tasks and the shared shopping list stay out of the calendar.

## Get started

### Home Assistant OS

1. Add `https://github.com/cskogstrand/home-harmony-ui` to your app/add-on repositories and install **Home Harmony UI**.
2. In **Configuration**, set `home_assistant_url`, `home_assistant_token` (a long-lived access token) and `dashboard_password` (at least 12 characters).
3. Start the app and open its web interface on port **8099**. Sign in as **dashboard** with your dashboard password.
4. Open **Home settings**, choose your people, calendars and lists, then use the same dashboard address on your other screens.

[Full installation and connection help →](https://github.com/cskogstrand/home-harmony-ui/blob/main/DOCS.md#haos-app-installation)

### Docker

```sh
cp .env.example .env
# Set the Home Assistant URL, token and dashboard password in .env.
docker compose up --build -d
```

Open port **8099** on the Docker host and sign in as above. Settings and uploads live in `./data`; back up that entire folder. [Docker details →](https://github.com/cskogstrand/home-harmony-ui/blob/main/DOCS.md#manual-docker-deployment)

Use a trusted LAN/VPN or an HTTPS reverse proxy. Anyone with dashboard access can use the configured HA account’s controls.

## A week at a glance

![Weekly family calendar with color-coded plans for fictional demo people](https://raw.githubusercontent.com/cskogstrand/home-harmony-ui/main/docs/images/calendar.png)

## Go deeper

| Guide | What’s inside |
| --- | --- |
| [Setup and everyday use](https://github.com/cskogstrand/home-harmony-ui/blob/main/DOCS.md) | Installation, connection help, preferences, backups, timetables and iPhone uploads |
| [Morning summaries](https://github.com/cskogstrand/home-harmony-ui/blob/main/docs/morning-summary.md) | Optional Home Assistant automation, phone notifications and spoken summaries |
| [Notifications](https://github.com/cskogstrand/home-harmony-ui/blob/main/docs/notifications.md) | Ongoing tasks, state and calendar alerts, and doorbell camera popups |
| [Development and releases](https://github.com/cskogstrand/home-harmony-ui/blob/main/docs/development.md) | Node 24+ setup, verification commands and image publishing |

For local development, configure `.env` as above, then run `npm ci` and `npm run dev`. Open port **8080**. PDF conversion also needs [Poppler](https://github.com/cskogstrand/home-harmony-ui/blob/main/docs/development.md#local-development-and-node-deployment).
