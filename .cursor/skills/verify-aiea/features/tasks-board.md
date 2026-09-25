# Tasks board

Tasks is the home board after sign-in: every non-done task in its lane, subtasks nested in their parent's card. Desktop: Current | Backlog | Icebox columns; mobile: one-lane tabs via `?lane=`. No due-date windows or auto-curation — due dates show on cards but never move a card between lanes. It must never render HTTP 500 / Application error.

## Sub-features

- `board-chrome` shows the `Tasks` heading, desktop three-column layout + mobile lane tabs, and a Capture link.
- `board-all-open` every ACTIVE / INBOX / SNOOZED one-time task renders exactly once; null or unknown lanes render in Backlog (`laneOf` in `src/lib/board.ts`; `npm run test:board`).
- `board-subtasks` an open subtask whose parent is on the board renders inside the parent card, in the parent's lane; an orphaned open subtask (parent done / cancelled / proposed / missing) is its own card in its own lane, labelled `Part of · parent` (`buildBoard` in `src/lib/board.ts`).
- `board-mobile-tabs` below `md`, lanes are tabs (default Current; `?lane=current|backlog|icebox`; invalid → Current). Desktop keeps side-by-side columns. Both layouts stay in the DOM with responsive classes.
- `board-redirects` `/today` and `/upcoming` (and subpaths) server-redirect (307) to `/tasks`; nav has no Today / Upcoming links.
- Done tasks live in `/archive`; PROPOSED items stay in Inbox until accepted.

## How to get to it (user POV)

- Sign in → redirected to `/tasks`.
- Sidebar / bottom nav **Tasks**.

## Driving it with Playwright

Preconditions:

- `doctor.sh` green (checks `GET /tasks` → 200).
- Signed-in credentials available.

- **Load board.** Run `node scripts/drive.mjs --feature tasks-board --base-url <url>`. After sign-in, open `/tasks`. Heading `Tasks`, desktop column headings `Current` / `Backlog` / `Icebox`, mobile tablist, and link `Capture` appear; no `Today` / `Upcoming` links; `/today` and `/upcoming` land on `/tasks`. Capture `tasks-board.png` + aria.
- **Full data proof.** `node scripts/prove-board.mjs --build` (local SQLite, real routes) asserts DB open-task set == top-level cards + nested subtasks.

## Gotchas

- Empty columns are fine (`Nothing here.`).
- Live smoke may hit a pre-board deploy that still serves `/today`; `signIn`, doctor and live-smoke accept either home until the board ships.
- Doctor curl alone is not enough for the mapped UI feature; drive must open the page in Playwright.
