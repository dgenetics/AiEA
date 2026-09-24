# Today load

Today is the home board after sign-in. It must load with greeting chrome and a Tasks section — never HTTP 500 / Application error.

## Sub-features

- `today-chrome` shows Today eyebrow + greeting heading + Capture link.
- `today-tasks` shows Tasks section (list or empty message).
- `today-no-500` body must not contain server-error copy.

## How to get to it (user POV)

- Sign in → redirected to `/today`.
- Sidebar / bottom nav **Today**.

## Driving it with Playwright

Preconditions:

- `doctor.sh` green (already checks `GET /today` → 200).
- Signed-in credentials available.

- **Load Today.** Run `node scripts/drive.mjs --feature today-load --base-url <url>`. After sign-in, open `/today`. Exact text `Today`, Today chrome (heading `Tasks` or legacy `One-time`), and link `Capture` appear. Capture `today-load.png` + aria.
- **Proof.** Screenshot shows Today chrome; no Internal Server Error.

## Gotchas

- Empty task list is fine (`Nothing in play today`) — still a pass.
- Doctor curl alone is not enough for the mapped UI feature; drive must open the page in Playwright.
