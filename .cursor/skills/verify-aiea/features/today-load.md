# Today load

Today is the home board after sign-in. It must load with greeting chrome and a Tasks section — never HTTP 500 / Application error.

## Sub-features

- `today-chrome` shows Today eyebrow + greeting heading + Capture link.
- `today-tasks` shows Tasks section (list or empty message).
- `today-no-500` body must not contain server-error copy.

## Default density rule (Current chip, `/today`)

- Main list = Current lane AND (due today OR overdue by **7 days or fewer**), plus scheduled-for-today and follow-ups due <= today (follow-ups never go stale). Exactly 7 days overdue still shows; 8+ = stale.
- "Today" / overdue days use the app timezone (`AIEA_TIMEZONE`, default `America/New_York`) via `calendarDayDiff`, not the server's UTC date. Logic: `classifyTodayTask` in `src/lib/today-filters.ts` (`main | stale | hidden`); boundary assertions: `npm run test:today`.
- Stale Current items leave the main list and collapse into one row at the bottom of Tasks: `Stale · N` + `Review`. Review expands inline: `Move all to Backlog` (undo toast restores previous boards) and per-row Backlog / Reschedule (date, defaults to today) / Done (normal complete path). Acted-on items leave the list; N updates.
- In play / Overdue cards and the Current chip count exclude stale. All / Backlog / Icebox chips are not cut off.
- Empty main list with stale items: `Nothing in play today` (Backlog + Capture) and the Stale row stays visible under it.

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

- Empty task list is fine (`Nothing in play today`) — still a pass. A `Stale · N` row may sit under it.
- Doctor curl alone is not enough for the mapped UI feature; drive must open the page in Playwright.
