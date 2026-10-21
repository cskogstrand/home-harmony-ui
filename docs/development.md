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
```

Server tests require Poppler and permission to open local test ports. The container smoke test requires Docker. Tests use temporary data and fake credentials; they do not connect to your household or control devices.

`npm run test:ha-app -- <image>` tests an already-built image without rebuilding it; the release workflow uses this to test the exact image it publishes. `test:release` checks the release metadata validation and publication/free-usage safeguards without contacting GitHub or pushing images.

## Publishing an app update

Home Assistant downloads the versioned, multi-architecture image named by `image` in `config.yaml`. Build and publish that image **before merging the version bump into `main`**, so the app store never advertises an image that does not exist.

1. On a release branch, update the quoted `version` in `config.yaml` and add its changelog entry. Keep `image` pointed at this repository's GHCR package.
2. Run the [verification commands](#verification) and commit the release changes. Tag that commit `v<version>` and push the branch and tag. For the first prebuilt release, use `v0.9.8`. Pushing the tag runs **Publish Home Assistant image**, even before its workflow is merged into `main`.
3. Wait for both native builds and container smoke tests to pass, and for the final version manifest to be published. The workflow builds ARM64 and AMD64 separately and publishes the exact images that passed their tests. It refuses to replace an existing release version. A failed run can be retried before the final manifest exists.
4. **First publication only:** open the repository owner's GitHub **Packages → home-harmony-ui → Package settings → Change visibility** and make the container package **Public**. Repository visibility does not make a newly published package public automatically. Confirm that the package grants this repository Actions access if an existing package was created elsewhere.
5. Before merging, verify that the version can be inspected without registry credentials and contains both `linux/amd64` and `linux/arm64`. For example, use a temporary empty Docker configuration with `docker --config <empty-directory> manifest inspect ghcr.io/cskogstrand/home-harmony-ui:0.9.8`. Then merge the tagged commit into `main` without changing its release contents. Refresh the Home Assistant app store and install the update.

Do not push a version bump to `main` first, move an existing release tag, or use `latest` for Home Assistant updates. If a released image needs a fix, publish a new version. The workflow uses the built-in `GITHUB_TOKEN`; no personal access token or household configuration is needed. `packages: write` is required for GHCR publication.

**Free usage:** release tags are the only build trigger. All jobs use standard public-repository Linux runners, and every job is disabled if the repository becomes private. Node's automatic package cache is disabled; the workflow uploads no Actions artifacts or persistent build caches. Images are stored directly in GHCR, whose container storage and bandwidth are currently free. Jobs have time limits and releases are serialized. See [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) and [GHCR billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages); recheck pricing before changing runners, repository visibility, or storage settings.
