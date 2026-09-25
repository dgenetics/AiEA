# Capture → accept

Capture lets a user paste a messy brain dump, get proposed tasks (AI or local heuristics), edit them, and accept selected items onto the board — landing on the Tasks board (`/tasks`).

## Sub-features

- `capture-open` shows Brain dump → organized plan with the dump textarea.
- `capture-propose` runs Organize with AI and shows Review & edit before accept.
- `capture-accept` accepts selected items and navigates to the Tasks board with work present.

## How to get to it (user POV)

- Nav / Tasks board CTA → **Capture** (`/capture`).
- After login, deep-link `/capture`.

## Driving it with Playwright

Preconditions:

- `doctor.sh` green for the target base URL.
- Signed-in session (drive signs in via `/login` using `AIEA_SMOKE_*` (live) or `verify-user.json` (local)).

- **Open capture.** Run `node scripts/drive.mjs --feature capture-accept --base-url <url>`. Heading matching `Brain dump` appears; capture `capture-empty.png`.
- **Propose.** Fill the first `textarea` with a tagged dump (include a unique marker + concrete chore). Click `Organize with AI`. Heading `Review & edit before accept` appears within ~60s (heuristics or AI). Capture `capture-proposed.png`.
- **Accept.** Click button matching `/Accept \d+ item/`. URL becomes `/tasks`. Capture `capture-accepted-board.png` + aria.
- **Proof.** Artifacts show empty → proposed → Tasks board. Marker or chore keywords ideally visible; at minimum the `Tasks` heading after accept.

## Gotchas

- Without `XAI_API_KEY`, propose still works via **Local heuristics** (amber source label) — that is a valid path.
- AI may rewrite titles; do not assert the exact dump string as the only success criterion.
- Login labels are not `htmlFor`-wired; do not rely on `getByLabel('Email')`.
