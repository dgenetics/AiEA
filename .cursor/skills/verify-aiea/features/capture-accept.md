# Capture → accept

Capture lets a user paste a messy brain dump, get proposed tasks (AI or local heuristics), edit them, and accept selected items onto the board — landing on Today.

## Sub-features

- `capture-open` shows Brain dump → organized plan with the dump textarea.
- `capture-propose` runs Organize with AI and shows Review & edit before accept.
- `capture-accept` accepts selected items and navigates to Today with work present.

## How to get to it (user POV)

- Nav / Today CTA → **Capture** (`/capture`).
- After login, deep-link `/capture`.

## Driving it with Playwright

Preconditions:

- `doctor.sh` green for the target base URL.
- Signed-in session (drive signs in via `/login` using `AIEA_EMAIL`/`AIEA_PASSWORD` or `verify-user.json`).

- **Open capture.** Run `node scripts/drive.mjs --feature capture-accept --base-url <url>`. Heading matching `Brain dump` appears; capture `capture-empty.png`.
- **Propose.** Fill the first `textarea` with a tagged dump (include a unique marker + concrete chore). Click `Organize with AI`. Heading `Review & edit before accept` appears within ~60s (heuristics or AI). Capture `capture-proposed.png`.
- **Accept.** Click button matching `/Accept \d+ item/`. URL becomes `/today`. Capture `capture-accepted-today.png` + aria.
- **Proof.** Artifacts show empty → proposed → Today. Marker or chore keywords ideally visible; at minimum Today `Tasks` heading after accept.

## Gotchas

- Without `XAI_API_KEY`, propose still works via **Local heuristics** (amber source label) — that is a valid path.
- AI may rewrite titles; do not assert the exact dump string as the only success criterion.
- Login labels are not `htmlFor`-wired; do not rely on `getByLabel('Email')`.
