# Tasks board

Tasks is the home board after sign-in: every non-done task, one card each, in its lane (Current | Backlog | Icebox). No due-date windows or auto-curation — due dates show on cards but never move a card between lanes. It must never render HTTP 500 / Application error.

## Sub-features

- `board-chrome` shows the `Tasks` heading, the three lane columns, and a Capture link.
- `board-all-open` every ACTIVE / INBOX / SNOOZED one-time task renders as a card; null or unknown lanes render in Backlog (`laneOf` in `src/lib/board.ts`; `npm run test:board`).
- `board-redirects` `/today` and `/upcoming` (and subpaths) server-redirect (307) to `/tasks`; nav has no Today / Upcoming links.
- Done tasks live in `/archive`; PROPOSED items stay in Inbox until accepted.

## How to get to it (user POV)

- Sign in → redirected to `/tasks`.
- Sidebar / bottom nav **Tasks**.

## Driving it with Playwright

Preconditions:

- `doctor.sh` green (checks `GET /tasks` → 200).
- Signed-in credentials available.

- **Load board.** Run `node scripts/drive.mjs --feature tasks-board --base-url <url>`. After sign-in, open `/tasks`. Heading `Tasks`, column headings `Current`, `Backlog`, `Icebox`, and link `Capture` appear; no `Today` / `Upcoming` links; `/today` and `/upcoming` land on `/tasks`. Capture `tasks-board.png` + aria.
- **Full data proof.** `node scripts/prove-board.mjs --build` (local SQLite, real routes) asserts DB open-task set == rendered cards.

## Gotchas

- Empty columns are fine (`Nothing here.`).
- Live smoke may hit a pre-board deploy that still serves `/today`; `signIn`, doctor and live-smoke accept either home until the board ships.
- Doctor curl alone is not enough for the mapped UI feature; drive must open the page in Playwright.
