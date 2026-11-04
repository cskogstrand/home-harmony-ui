# Repository instructions

## Branch workflow

- Make all changes directly on `main` unless the user explicitly asks to create or work on another branch.

## Task-specific documentation

Before editing, read the documents relevant to the task and follow their links as needed. Skip unrelated guides. Update the relevant documentation when changing the behavior it describes.

| Task | Read |
| --- | --- |
| Product scope, user needs or feature behavior | [README.md](README.md) and [PRODUCT.md](PRODUCT.md) |
| UI, layout, styling, accessibility or motion | [DESIGN.md](DESIGN.md) and any matching surface notes in [.impeccable/surfaces/](.impeccable/surfaces/) |
| Installation, Home Assistant connection, authentication, storage, backups or timetables | [DOCS.md](DOCS.md) |
| Local development, verification, builds or deployment | [docs/development.md](docs/development.md) |
| Cameras, connections, playback or snapshots | [docs/cameras.md](docs/cameras.md) |
| Notification rules, triggers, presentation or camera popups | [docs/notifications.md](docs/notifications.md); also [docs/cameras.md](docs/cameras.md) for camera behavior |
| Entity selection or picker reuse | [docs/entity-picker.md](docs/entity-picker.md) |
| Morning summaries, spoken playback or their Home Assistant examples | [docs/morning-summary.md](docs/morning-summary.md) |
| Versioning, releases or release notes | [docs/development.md](docs/development.md) and [CHANGELOG.md](CHANGELOG.md) |
| Bundled fonts or font licensing | [public/fonts/README.md](public/fonts/README.md) |

Treat past verification notes as historical evidence, not proof of current behavior. Check the current code; use `PRODUCT.md` and `DESIGN.md` for the current product and design direction.

## Personal information and secrets

- Never add real personal or household-specific information to this repository, including source code, documentation, examples, test fixtures, screenshots, or commit messages. This includes names, contact details, addresses, locations, schedules, reminders, and private device or calendar identifiers. Never commit credentials, tokens, or API keys.
- When Home Assistant examples need these values, store the actual values in the user's local Home Assistant `secrets.yaml`, outside this repository, and reference them with `!secret` in file-loaded YAML configuration.
- Home Assistant UI editors cannot resolve `!secret`; follow the existing examples by resolving secrets in file-loaded configuration and passing the values to UI-managed automations or scripts.
- Committed secrets example files must contain only generic placeholders or clearly fictional data. Keep real `secrets.yaml` files and other private configuration out of Git.
