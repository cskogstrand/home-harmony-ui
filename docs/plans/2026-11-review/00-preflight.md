# 00 · Preflight

[← Master plan](README.md)

**Goal:** a clean, known-good baseline before any change.

## Checklist

- [x] Make sure only one dev server runs against the data directory. During the review two Vite processes (ports 8081 and 8082) ran from this checkout at the same time, which [docs/development.md](../../development.md) forbids. Check with `lsof -iTCP -sTCP:LISTEN -nP | grep node`; ask the owner before stopping a server you did not start.
- [x] `git status` is clean and `main` is up to date with `origin/main` (`git fetch && git status -sb`).
- [x] Baseline passes: `npm run --silent test:silent`, `npm run --silent test:server:silent`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`. Record any pre-existing failure here as a `> Baseline:` note instead of fixing it inside another workstream.

  > Baseline (2026-11-24): one Vite dev server (port 8081). `main` clean, one local plan commit ahead of `origin/main` (not pushed by design). UI 61 files / 1161 tests pass, server tests pass, tsc and lint clean. No pre-existing failures.
- [x] ~~Read [PRODUCT.md](../../../PRODUCT.md) and the sections of [DESIGN.md](../../../DESIGN.md) on typography, colour, artwork and the shell.~~ — skipped: coordinator run; each workstream agent reads PRODUCT.md and DESIGN.md before its own UI work.
- [x] Note: `.impeccable/design.json` is older than DESIGN.md. Do not regenerate it here; that happens in [12](12-type-ramp-and-detector.md).

## Done when

All boxes ticked, baseline recorded, status set to ✅ in the master table.
