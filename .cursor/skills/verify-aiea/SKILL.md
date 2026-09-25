---
name: verify-aiea
description: >-
  Drive AiEA (AI Executive Assistant kanban / capture / Tasks board web app) like a
  user: launch, doctor instance health, Playwright paths for capture→accept /
  Tasks board / board lanes / BF sync / live-smoke. Use before merge/ship or when
  asked to verify this repo. Not bf-maintenance farm chores.
---

# verify-aiea

AiEA — personal OS for life/home/work: **capture → confirm → Tasks board**, board lanes Icebox / Backlog / Current, optional BF Maintenance pull into Inbox. Web UI + Next API. **Not** bf-maintenance date/schedule chores.

**Agents / Hong:** use **poteto-mode** + this verify skill. Account-wide pstack plugin is installed; box rule `~/.cursor/rules/pstack-models.mdc` must exist (confirm before long runs).

Evidence root (survives cleanup): `.cursor/skills/verify-aiea/evidence/<run-id>/`

Default live target: `https://aiea-cyan.vercel.app` (override with **`AIEA_BASE_URL`**). Prefer an agent-owned local instance on port **3200** when mutating data (avoids human `:3000` and bf-maintenance `:3100`).

## Auth

App account **email + password** (BF PIN path is going away — do not use PIN here). **No separate `BF_*` pair for smoke login.**

| Mode | Credentials |
|------|-------------|
| Local / CI (`gate.sh --local`) | Doctor **auto-registers** a disposable `verify+…@aiea.test` user into the run’s SQLite DB and writes `evidence/<run-id>/verify-user.json`. No secrets required for the core gate. `AIEA_SMOKE_*` is **ignored** on local bases. |
| Live / post-auth (`gate.sh --live-smoke`) | Set **`AIEA_SMOKE_EMAIL`** + **`AIEA_SMOKE_PASSWORD`** (both). Real AiEA User row — **Hong creates**; verify does **not** create the smoke user. When **both** set → login + post-auth path on live. When **absent** → **clean-skip** (gate stays green). |

**Smoke user only — never Will’s personal login / 1Password.**

### Migration (demoted names)

| Old (demoted) | New (required for live) |
|---------------|-------------------------|
| `AIEA_EMAIL` | `AIEA_SMOKE_EMAIL` |
| `AIEA_PASSWORD` | `AIEA_SMOKE_PASSWORD` |

Helpers still accept the old pair with a **WARN** and document this migration. Prefer SMOKE names only for new secrets / CI.

Optional BF sync: `BF_MAINTENANCE_URL` + `BF_INTEGRATION_SECRET`. If missing or BF unreachable, `bf-sync` **skips with a note** (not a fake green happy-path). These are **not** smoke-login secrets.

## Launch

```bash
# once per machine for the Playwright helper
(cd .cursor/skills/verify-aiea/scripts && npm install)

./.cursor/skills/verify-aiea/scripts/launch.sh 3200
# prints run-id; ready when GET http://127.0.0.1:3200/ → 200
```

`launch.sh` builds if needed, creates a disposable SQLite DB under the evidence run dir, clears Turso env so local verify never hits prod, starts `next start -p 3200 -H 127.0.0.1`, writes `evidence/<run-id>/server.pid`.

Or point at live / already-running:

```bash
export AIEA_BASE_URL=https://aiea-cyan.vercel.app   # or VERIFY_BASE_URL
export AIEA_SMOKE_EMAIL=… AIEA_SMOKE_PASSWORD=…     # required for live; smoke user only
./.cursor/skills/verify-aiea/scripts/gate.sh --live-smoke
```

Teardown: `./.cursor/skills/verify-aiea/scripts/cleanup.sh [run-id]` — kills only the PID in that run’s `server.pid`. Never deletes `evidence/`.

## Doctor

Instance health (port, auth, Tasks board) — **not** a compile-only gate:

```bash
VERIFY_BASE_URL=… \
  ./.cursor/skills/verify-aiea/scripts/doctor.sh
```

Must pass:

1. `GET /` → 200
2. Wrong login → `401`/`400` on `POST /api/auth/login`
3. Auth: **local** disposable register **or** live login via `AIEA_SMOKE_*` (legacy `AIEA_EMAIL`/`AIEA_PASSWORD` demoted) → 200 + `aiea_session` cookie
4. `GET /tasks` → **200** (must not 500; falls back to `/today` only on a pre-board live deploy)
5. `GET /api/tasks` → 200 JSON
6. `GET /capture` → 200

Reports `repo_sha` + `package_version`. Compile (`npm run build`) may run separately; it is **not** a substitute for doctor.

## Drive

Harness: **Playwright** via `playwright-core` + system Chrome (`channel: 'chrome'`).

```bash
(cd .cursor/skills/verify-aiea/scripts && npm install)  # once

node .cursor/skills/verify-aiea/scripts/drive.mjs \
  --feature capture-accept \
  --base-url "$VERIFY_BASE_URL" \
  --run-id "$VERIFY_RUN_ID"
```

Features: `capture-accept` | `tasks-board` | `board-lanes` | `bf-sync` | `live-smoke`.

Stable handles: heading `Welcome back` / `Brain dump → organized plan` / `Tasks` / `Review & edit before accept`; buttons `Sign in`, `Organize with AI`, `/Accept \d+ item/`, `Pull farm maintenance`; `getByRole('group', { name: 'Board lane' })` with `Icebox` | `Backlog` | `Current`. Login inputs lack `htmlFor` — use `input[type=email|password]`.

Recipes live in `features/`. Prefer those over inventing selectors.

## Evidence

Each run writes under `evidence/<run-id>/`:

| Artifact | Meaning |
|----------|---------|
| `SUMMARY.md` | pass/fail/skip, sha, feature, steps |
| `doctor.txt` | instance health transcript |
| `drive.txt` / `drive-<feature>.json` | Playwright steps |
| `*.png` / `*.aria.txt` | screenshots + a11y snapshots |
| `verify-user.json` | disposable local creds (local only) |
| `live-smoke-skipped.txt` | present when live-smoke clean-skipped |
| `server.pid` / `server.txt` | local launch only |

Proof bar: real user path (UI), capture action + resulting state, keep evidence after cleanup. Skip vs run must be obvious in `SUMMARY.md` / `drive-*.json`.

## Cleanup

```bash
./.cursor/skills/verify-aiea/scripts/cleanup.sh [run-id]
```

Stops recorded PIDs only. Evidence dirs stay.

## Helpers

All under `.cursor/skills/verify-aiea/scripts/`:

| Script | Role |
|--------|------|
| `launch.sh [port] [run-id]` | Start local `:3200` (default), pidfile in evidence |
| `doctor.sh [base-url]` | Instance health |
| `drive.mjs --feature …` | Playwright user-path driver |
| `gate.sh [--local] [--live-smoke] [--feature …]` | doctor + drive + SUMMARY |
| `cleanup.sh [run-id]` | Tear down agent server |

### One-shot gate (preferred)

```bash
# local agent instance (auto-register; core features — no smoke secrets needed)
./.cursor/skills/verify-aiea/scripts/gate.sh --local \
  --feature capture-accept,tasks-board,board-lanes,bf-sync

# live/post-auth (needs AIEA_SMOKE_* both; clean-skips when unset)
AIEA_SMOKE_EMAIL=… AIEA_SMOKE_PASSWORD=… \
  ./.cursor/skills/verify-aiea/scripts/gate.sh --live-smoke
```

## Feature map

Index: `features/README.md`. Keep honest with `/maintain-verification-skill` when routes or auth change.

## CI secrets (Will)

For required-check style workflow (`.github/workflows/verify.yml`):

| Secret | Required? | Purpose |
|--------|-----------|---------|
| *(none for local gate core)* | — | CI creates disposable user via register on fresh SQLite |
| `AIEA_SMOKE_EMAIL` / `AIEA_SMOKE_PASSWORD` | Live / optional | Live/post-auth smoke on `aiea-cyan.vercel.app` (or `AIEA_BASE_URL`). **Both** or clean-skip. Smoke user only — never personal / 1Password. |
| `AIEA_BASE_URL` | Optional | Override live base (default `https://aiea-cyan.vercel.app`) |
| `BF_MAINTENANCE_URL` / `BF_INTEGRATION_SECRET` | Optional | `bf-sync` happy path; otherwise skip with note. **Not** smoke login. |
| `AUTH_SECRET` | CI writes one | Session signing for local instance |
| `XAI_API_KEY` | Optional | Capture uses heuristics without it |

### Set smoke secrets (Will)

Hong creates the real smoke **User** row in AiEA first. Then:

```bash
gh secret set AIEA_SMOKE_EMAIL --body 'smoke@…' --repo dgenetics/AiEA
gh secret set AIEA_SMOKE_PASSWORD --body '…' --repo dgenetics/AiEA
# optional:
# gh secret set AIEA_BASE_URL --body 'https://aiea-cyan.vercel.app' --repo dgenetics/AiEA
```

Do **not** put Will’s personal account or 1Password vault login into these secrets. Do **not** use demoted `AIEA_EMAIL` / `AIEA_PASSWORD` for new CI wiring.

Branch for this work: `eggbot/aiea-smoke-auth` (separate from `eggbot/aiea-verify`). Hold merge until Will/Hong confirm smoke user + secrets.
