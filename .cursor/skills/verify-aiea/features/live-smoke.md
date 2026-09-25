# Live smoke (post-auth)

Prove production/preview login with the dedicated smoke user, then at least one post-auth path (home / Tasks board load). Clean-skips when smoke secrets are unset so the gate stays green.

## Sub-features

- `smoke-creds-gate` both `AIEA_SMOKE_EMAIL` + `AIEA_SMOKE_PASSWORD` required; else SKIP with `live-smoke-skipped.txt`.
- `smoke-login` Sign in on live base (default `https://aiea-cyan.vercel.app` or `AIEA_BASE_URL`).
- `post-auth-home` home (`/tasks`, or `/today` on a pre-board deploy) loads with the `Tasks` heading (no 500).

## How to get to it (user POV)

- Open live AiEA → Sign in with the **smoke** account (not a personal login).
- Land on the Tasks board.

## Driving it with Playwright

Preconditions:

- Smoke User row already exists (Hong creates). Verify never registers the smoke user on live.
- Both `AIEA_SMOKE_EMAIL` and `AIEA_SMOKE_PASSWORD` set, **or** expect a clean skip.
- No separate `BF_*` pair for this login.

```bash
# skip path (no secrets) — exit 0, evidence shows SKIP
./.cursor/skills/verify-aiea/scripts/gate.sh --live-smoke

# run path (secrets in env already — do not invent)
AIEA_SMOKE_EMAIL=… AIEA_SMOKE_PASSWORD=… \
  ./.cursor/skills/verify-aiea/scripts/gate.sh --live-smoke
```

Or: `node scripts/drive.mjs --feature live-smoke` (defaults base to live when no `--base-url`).

## Gotchas

- Legacy `AIEA_EMAIL`/`AIEA_PASSWORD` alone do **not** satisfy live-smoke (demoted; migrate to SMOKE names).
- Local `gate.sh --local` ignores `AIEA_SMOKE_*` and uses disposable register.
- Never Will’s personal / 1Password credentials.
