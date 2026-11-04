# Repository instructions

## Branch workflow

- Make all changes directly on `main` unless the user explicitly asks to create or work on another branch.

## Personal information and secrets

- Never add real personal or household-specific information to this repository, including source code, documentation, examples, test fixtures, screenshots, or commit messages. This includes names, contact details, addresses, locations, schedules, reminders, and private device or calendar identifiers. Never commit credentials, tokens, or API keys.
- When Home Assistant examples need these values, store the actual values in the user's local Home Assistant `secrets.yaml`, outside this repository, and reference them with `!secret` in file-loaded YAML configuration.
- Home Assistant UI editors cannot resolve `!secret`; follow the existing examples by resolving secrets in file-loaded configuration and passing the values to UI-managed automations or scripts.
- Committed secrets example files must contain only generic placeholders or clearly fictional data. Keep real `secrets.yaml` files and other private configuration out of Git.
