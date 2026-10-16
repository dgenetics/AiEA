# Tasks board

`/tasks` is the home board: Current, Backlog, and Icebox. Completed tasks are on Archive at `/tasks/done`. The header is Farm Manager and an Account icon. Systems, Schedules, and Tasks are the bottom bar.

## Sub-features

- `board-columns` shows the three lane headings.
- `redirects` send `/today` and `/upcoming` to `/tasks`.

## How to get to it (user POV)

- Sign in. `/` goes to `/tasks`. Logged out, `/` is the public landing page.
- The bottom bar switches to Systems and Schedules.

## Driving it with Playwright

- **Open.** `node scripts/drive.mjs --feature tasks-board --base-url <url>`. Heading `Tasks`, three `h2` lane names, capture placeholder, bottom-bar links Systems, Schedules, Tasks. An Archive link opens `/tasks/done`, titled Archive, with a Tasks link back.
- **Redirects.** `/today` and `/upcoming` land on `/tasks`.

## Gotchas

- No Inbox, Today, or Upcoming links.
- Mobile lane tabs are in the DOM (`[data-board-tabs]`) even when the desktop columns are showing.
