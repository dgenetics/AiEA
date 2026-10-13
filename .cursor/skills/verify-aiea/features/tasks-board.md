# Tasks board

`/tasks` is the home board: Current, Backlog, and Icebox. Done tasks live at `/tasks/done`. The header is Farm Manager, Systems, Schedules, and Tasks.

## Sub-features

- `board-columns` shows the three lane headings.
- `redirects` send `/today` and `/upcoming` to `/tasks`.

## How to get to it (user POV)

- Sign in. `/` goes to `/tasks`.
- The header tabs switch to Systems and Schedules.

## Driving it with Playwright

- **Open.** `node scripts/drive.mjs --feature tasks-board --base-url <url>`. Heading `Tasks`, three `h2` lane names, capture placeholder, header links Systems, Schedules, Tasks.
- **Redirects.** `/today` and `/upcoming` land on `/tasks`.

## Gotchas

- No Inbox, Today, or Upcoming links.
- Mobile lane tabs are in the DOM (`[data-board-tabs]`) even when the desktop columns are showing.
