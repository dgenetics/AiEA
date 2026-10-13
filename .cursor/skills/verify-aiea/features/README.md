# Farm Manager feature map

Verification source for Farm Manager (capture field, Tasks board, lanes, schedule chores, live smoke). Read this index, then the feature file. Drive the real UI with Playwright (`scripts/drive.mjs`); curl alone is not enough for a mapped UI feature.

## Baseline preconditions

- Base URL: local `http://127.0.0.1:3200` (from `launch.sh`) **or** `https://aiea-cyan.vercel.app` (`AIEA_BASE_URL`).
- Auth:
  - Local: doctor-registered disposable user (`verify-user.json`) on a fresh local DB.
  - Live/post-auth: **`AIEA_SMOKE_EMAIL` + `AIEA_SMOKE_PASSWORD`** (both). Smoke user only — never personal / 1Password. Absent → clean-skip live-smoke.
  - Legacy `AIEA_EMAIL`/`AIEA_PASSWORD` demoted — migrate to SMOKE names.
- `doctor.sh` green for that base URL before driving (except live-smoke skip-before-doctor when secrets unset).
- Never attach to a browser session the human already owns; use headless Playwright or a fresh context.
- No separate `BF_*` pair for smoke login. Schedule chores are created through this app's API.

## Driving conventions

- Harness: `node .cursor/skills/verify-aiea/scripts/drive.mjs --feature <id> --base-url <url>`.
- Prefer ARIA roles / accessible names. Login email/password inputs are **not** labelled via `htmlFor` — use `input[type="email"]` / `input[type="password"]`.
- Capture field: placeholder `Type or talk`, button `Add`.
- Board columns: `section[data-lane="CURRENT"|"BACKLOG"|"ICEBOX"]`.
- Mutations on live: prefer local `--local` gate; on live avoid junk titles or use a clearly tagged `Verify …` prefix.
- Never delete `evidence/` in cleanup.

## Proof and skip reporting

- Capture action + resulting state (screenshot + aria under `evidence/<run-id>/`).
- Record feature id and base URL in `drive-<feature>.json` / `SUMMARY.md`.
- `bf-sync` always runs in-app. It does not skip for missing BF secrets.
- `live-smoke` without `AIEA_SMOKE_*` → **skipped** with `live-smoke-skipped.txt` (gate green).
- Unreachable path → report attempted command + unmet precondition; do not claim verified via a different entry point.

## Feature entry contract

Each feature file: H1 + one paragraph, then exactly four H2s — `Sub-features`, `How to get to it (user POV)`, `Driving it with Playwright`, `Gotchas`.

## Features

- [Capture](./capture-accept.md) — type on the Tasks board and the task is created active.
- [Tasks board](./tasks-board.md) — every open task in its lane; /today + /upcoming redirect (no 500).
- [Board lanes](./board-lanes.md) — “asap” lands in Current without a review picker.
- [Schedule chores](./bf-sync.md) — a due-today schedule appears as a Current task.
- [Live smoke](./live-smoke.md) — smoke login + post-auth home on live (skip if secrets unset).
