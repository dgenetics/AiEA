# BF sync

Inbox can **Pull farm maintenance** from BF Maintenance (server env `BF_MAINTENANCE_URL` + `BF_INTEGRATION_SECRET`), showing suggestions to import as proposed tasks. This is AiEA’s integration happy path — not BF’s own verify skill.

## Sub-features

- `bf-inbox-chrome` Inbox shows Review & accept + Pull farm maintenance.
- `bf-pull-happy` pull returns suggestion / import UI when BF is reachable.
- `bf-pull-skip` clean skip when secrets missing or BF unreachable (documented, not fake green).

## How to get to it (user POV)

- Nav → **Inbox** (`/inbox`).
- Account → Farm maintenance (connection status); pull still lives on Inbox.

## Driving it with Playwright

Preconditions:

- `doctor.sh` green; signed-in.
- For happy path: `BF_MAINTENANCE_URL` and `BF_INTEGRATION_SECRET` set and BF answering.
- If either secret missing: drive exits **skipped** with `bf-sync-skipped.txt` — gate still PASSes with an explicit SKIP note.

- **Open Inbox.** Run `node scripts/drive.mjs --feature bf-sync --base-url <url>`. Heading `Review & accept` and button `Pull farm maintenance` appear.
- **Pull.** Click the button. Within ~45s either suggestion/import UI appears (pass) or a connection/config error (skip with note). Capture `bf-sync-after-pull.png`.
- **Proof.** Happy path: suggestion UI artifact. Skip path: `bf-sync-skipped.txt` states why.

## Gotchas

- Missing env must not be reported as a green happy-path pass.
- Do not steal BF account-login / sync branch work (`hong/aiea-bf-complete-sync`, BF #20); only exercise AiEA’s existing pull UI.
- Live Turso + prod BF may create real proposed tasks — prefer local AiEA with BF URL pointed at a safe instance when mutating.
