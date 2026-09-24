# AiEA feature map

Maintained verification source for AiEA (capture, Today, board lanes, BF pull). Read this index, then the feature file. Drive the real UI with Playwright (`scripts/drive.mjs`); curl alone is not enough for a mapped UI feature.

## Baseline preconditions

- Base URL: local `http://127.0.0.1:3200` (from `launch.sh`) **or** `https://aiea-cyan.vercel.app`.
- Auth: `AIEA_EMAIL` + `AIEA_PASSWORD`, **or** doctor-registered disposable user (`verify-user.json`) on a fresh local DB.
- `doctor.sh` green for that base URL before driving.
- Never attach to a browser session the human already owns; use headless Playwright or a fresh context.
- bf-maintenance PIN / farm chores UI is **out of scope** (separate verify skill).

## Driving conventions

- Harness: `node .cursor/skills/verify-aiea/scripts/drive.mjs --feature <id> --base-url <url>`.
- Prefer ARIA roles / accessible names. Login email/password inputs are **not** labelled via `htmlFor` — use `input[type="email"]` / `input[type="password"]`.
- Board lanes: `getByRole('group', { name: 'Board lane' })` then buttons `Icebox` / `Backlog` / `Current`.
- Mutations on live: prefer local `--local` gate; on live avoid junk titles or use a clearly tagged `Verify …` prefix.
- Never delete `evidence/` in cleanup.

## Proof and skip reporting

- Capture action + resulting state (screenshot + aria under `evidence/<run-id>/`).
- Record feature id and base URL in `drive-<feature>.json` / `SUMMARY.md`.
- `bf-sync` without env or with unreachable BF → **skipped** with `bf-sync-skipped.txt` (not claimed as happy-path pass).
- Unreachable path → report attempted command + unmet precondition; do not claim verified via a different entry point.

## Feature entry contract

Each feature file: H1 + one paragraph, then exactly four H2s — `Sub-features`, `How to get to it (user POV)`, `Driving it with Playwright`, `Gotchas`.

## Features

- [Capture → accept](./capture-accept.md) — brain dump → organize → accept onto Today.
- [Today load](./today-load.md) — Today must render (no 500).
- [Board lanes](./board-lanes.md) — Icebox / Backlog / Current picker on capture.
- [BF sync](./bf-sync.md) — Pull farm maintenance into Inbox (skip if env missing).
