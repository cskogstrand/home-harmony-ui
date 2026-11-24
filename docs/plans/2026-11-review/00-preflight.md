# 00 · Preflight

[← Master plan](README.md)

**Goal:** a clean, known-good baseline before any change.

## Checklist

- [ ] Make sure only one dev server runs against the data directory. During the review two Vite processes (ports 8081 and 8082) ran from this checkout at the same time, which [docs/development.md](../../development.md) forbids. Check with `lsof -iTCP -sTCP:LISTEN -nP | grep node`; ask the owner before stopping a server you did not start.
- [ ] `git status` is clean and `main` is up to date with `origin/main` (`git fetch && git status -sb`).
- [ ] Baseline passes: `npm run --silent test:silent`, `npm run --silent test:server:silent`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`. Record any pre-existing failure here as a `> Baseline:` note instead of fixing it inside another workstream.
- [ ] Read [PRODUCT.md](../../../PRODUCT.md) and the sections of [DESIGN.md](../../../DESIGN.md) on typography, colour, artwork and the shell.
- [ ] Note: `.impeccable/design.json` is older than DESIGN.md. Do not regenerate it here; that happens in [12](12-type-ramp-and-detector.md).

## Done when

All boxes ticked, baseline recorded, status set to ✅ in the master table.
