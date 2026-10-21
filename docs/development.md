# Development and releases

[← Overview](../README.md) · [Setup guide](../DOCS.md)

## Local development and Node deployment

Use **Node 24+**. Copy [`.env.example`](../.env.example) to `.env`, set the Home Assistant URL/token and dashboard password, then:

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

Node and Vite read `.env` automatically; already-set environment variables win. Required values are `HOME_ASSISTANT_URL`, `HOME_ASSISTANT_TOKEN` and `DASHBOARD_PASSWORD` (at least 12 characters). For a trusted local network, set `DASHBOARD_AUTH_DISABLED=true` to skip login and make `DASHBOARD_PASSWORD` optional; it defaults to `false` and accepts only `true` or `false`. This also works in Docker Compose. `HOME_ASSISTANT_URL` is an HTTP(S) origin without credentials, path, or trailing slash. `PORT` defaults to 8099 for the Node server; Vite uses its own `--port` option. `DATA_DIR` selects the persistent directory.

PDF conversion requires Poppler (`pdfinfo` and `pdftoppm`): `brew install poppler` on macOS or `apt install poppler-utils` on Debian/Ubuntu. The Docker image includes Poppler and fonts.

## Verification

```sh
npm test
npm run test:server
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npm run build
npm run test:ha-app
npm run test:release
npm run test:deploy
```

Server tests require Poppler and permission to open local test ports. The container smoke test requires Docker. Tests use temporary data and fake credentials; they do not connect to your household or control devices.

For compact output, use `npm run --silent test:silent` and `npm run --silent test:server:silent`. Passing tests show dots; failures retain their details. `deploy.sh` uses these commands automatically.

`npm run test:ha-app -- <image>` tests an already-built image without rebuilding it; the release workflow uses this to test the exact image it publishes. `test:release` checks version validation, public-image verification, publication retries, stale releases, concurrent Git updates and free-usage safeguards. It uses a fake registry and temporary local Git repositories; it does not contact GitHub or push images.

## Deploying this repository

Run from a clean `main` checkout after committing your code and changelog changes:

```sh
./deploy.sh
```

`npm run deploy` is an alias. This script operates only on this repository; run each integration's own `./deploy.sh` separately. It fetches `origin/main` and stops if the checkout is behind or diverged. Committed local changes ahead of `origin/main` are included in the push.

Install the local test dependencies once:

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-test.txt
```

Docker must be running with enough disk space, and Poppler must be installed. The signed `public/shortcuts/Upload timetable.shortcut` must be present and committed; see its build command in the [setup guide](../DOCS.md). The script checks the PDF tools and shortcut before changing `VERSION`, with setup instructions if either is missing.

The script patch-bumps `VERSION`, leaving `config.yaml` for CI to promote. It runs the UI, server, release and deploy tests, morning-summary and design checks, TypeScript, lint, production build and Docker smoke test. Only after all checks pass does it commit the version file and push `main`. Automatic bumps require stable `MAJOR.MINOR.PATCH` versions; use the manual release process below for other version changes.

**If any check fails, the original version is restored and nothing is committed or pushed.** Concurrent edits are preserved. If the commit or push fails after testing, inspect the local release commit and finish the push manually; do not run the script again and bump twice. The script never force-pushes or resets your work.

`npm run test:deploy` exercises the deploy script with temporary local Git repositories and fake test commands; it never publishes a real release.

## Publishing an app update

`VERSION` is the requested release. `config.yaml` contains the version already available to Home Assistant. **Bump only `VERSION`**, leaving the published version for the workflow to update.

1. Finish the release changes, add a changelog entry, and run the [verification commands](#verification).
2. Increase the plain version in the root `VERSION` file, for example from `0.9.8` to `0.9.9`. Use three numbers without a `v` prefix or prerelease suffix. Commit and push the changes to `main`, or merge a pull request containing the bump. No release tag is needed.
3. Watch **Publish Home Assistant image** in GitHub Actions. It builds and smoke-tests native AMD64 and ARM64 images from that commit. Inside the build checkout, it sets `config.yaml` to the requested version so the app displays the right version; the published repository configuration stays unchanged.
4. After pushing the versioned manifest, the workflow downloads both images using an empty Docker configuration to verify anonymous access, architectures, versions and source commit. It then commits only the new `config.yaml` version to current `main`. Home Assistant can now offer the update. Pull the bot commit before your next local push.

If a build, push or public-image check fails, Home Assistant keeps the previous version. A newer `VERSION` request supersedes an older run. An older run never lowers the published version, and a concurrent push to `main` is preserved: the bot uses an ordinary push and fails rather than force-pushing. If other app configuration changed during the build, promotion stops; publish a new `VERSION` containing that configuration.

**Retries:** use **Re-run failed jobs** on the original run after fixing a transient failure, package visibility or push permission. If the version image already exists, the workflow verifies and reuses it without overwriting it, and requires it to match the original source commit. If code changed, bump `VERSION` again. **Run workflow** on `main` can start a pending release manually; when `VERSION` already equals `config.yaml`, it skips building and publishing. The initial `VERSION` file matches the existing `0.9.8` release, so installing this workflow alone does not release anything.

**GitHub setup:** the built-in `GITHUB_TOKEN` needs `packages: write` for GHCR and `contents: write` for the final bot commit; these permissions are declared in the workflow. Repository rules must allow that commit to `main`. If branch protection blocks it, promotion fails safely and the old version stays advertised. No personal access token or household configuration is needed. The bot commit changes only `config.yaml`, so it does not trigger another release.

**Package visibility:** the existing GHCR package remains public. For a new installation or fork, open the repository owner's GitHub **Packages → home-harmony-ui → Package settings → Change visibility** after the first push and make it **Public**, then rerun the failed job. A public repository does not automatically make its container package public. An existing package created elsewhere must also grant this repository Actions access.

**Free usage:** automatic builds run only for `VERSION` changes on `main`; manual runs are restricted to `main` too. All jobs use standard public-repository Linux runners, and every job is disabled if the repository becomes private. Node's automatic package cache is disabled; the workflow uploads no Actions artifacts or persistent build caches. Images are stored directly in GHCR, whose container storage and bandwidth are currently free. Jobs have time limits and releases are serialized. See [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) and [GHCR billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages); recheck pricing before changing runners, repository visibility, or storage settings.
