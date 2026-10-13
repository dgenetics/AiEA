# Farm Manager

One app for the farm: systems, the schedules that keep them up, and the tasks you actually do. Sign in once. Everything lives in one database.

## Getting around

The header shows only `Farm Manager`, centered, on a dark bar, and a small person icon on the right that opens Account. Systems, Schedules, and Tasks are a fixed cream bottom bar at every width: plain text, no icons, a thin top border, and padding for the home indicator. The current tab is bold. Every page behind that bar is the same cream. Page content is padded so it does not sit under that bar. Login and register sit outside this chrome.

`/` sends you to `/tasks`. The other routes are `/systems`, `/systems/:id`, `/systems/:id/components/:cid`, `/schedules`, `/tasks`, `/tasks/done`, `/account`, `/login`, and `/register`.

Old `/maintenance/*` bookmarks redirect to the new pages. Retired pages (`/inbox`, `/brief`, `/people`, `/areas`, `/capture`, `/archive`, `/recurring`, `/today`, `/upcoming`) send you to Tasks or Archive.

## Sign-in

Email and password. One session cookie (`aiea_session`, path `/`) covers every tab. Account shows your name and email and lets you change the password. Changing it signs out other devices.

## Tasks

The Tasks tab is the cream board with three columns: Current, Backlog, and Icebox. On a phone the same lanes are tabs. Every open task is on the board. Nothing is filtered out, and there is no Inbox or proposed-review state. Cards, the capture field, and the edit sheet use the same cream and forest green as Systems and Schedules.

A task can have a due date, notes, and subtasks. You can complete it, edit it, move its lane, or cancel it. Completed tasks are on Archive at `/tasks/done`, which is the same cream. The board links there as Archive, and Archive links back to Tasks.

## Capture

At the top of Tasks there is one field: “Type or talk…”. Enter sends it. Shift+Enter adds a line. `C` focuses the field when you are not already typing. Escape asks before discarding a draft.

The mic uses the browser Web Speech API. If the browser has no speech recognition, the mic is hidden and the page says “Voice unavailable; type instead”. There is no paid speech service.

The text is split into tasks with dates (America/New_York) and a lane:

- “today”, “asap”, or due within about two days → Current
- “this week”, “next week”, or a date a bit further out → Backlog
- “someday”, “think about”, or no timing → Icebox

Unclear text defaults to Icebox. Tasks are created active immediately, with one undo for the batch. If the model is down, you can retry or save the whole note as one task. Gibberish still becomes one task so nothing you typed is dropped.

Moving an AI-created task to another lane within seven days records that correction so later captures can learn the preference.

## Systems

Systems is a cream grid of cards grouped by category. A card shows the system name, a short type and location line when those are known, and how many components it has. Category headers are small muted uppercase labels with a thin rule. Categories run A–Z, systems are alphabetical inside each group, and empty categories are left out. Cards stack on a phone and sit in three columns on a wider screen. A system with an open task on one of its components is tinted amber, and a short legend explains that tint. The whole card opens that system. “+ Add system” creates one. Inside a system you edit it, add components, and open a component for its fields (model, vendor, costs, notes), to move or duplicate it, and to attach schedules. There is no farm banner and no second header.

## Schedules

Schedules is a cream grid of cards. Each card shows the schedule name, its system and component, and how often it repeats. Cards stack on a phone and sit in two columns, then three, on a wider screen. A card with an open task on Tasks is tinted amber, and a short legend explains that tint. The whole card opens that schedule’s editor, with save and cancel. “+ Add schedule” creates one. Each schedule keeps exactly one open task. Coming back to Schedules shows the last list at once and refreshes it in the background. Saving or adding a schedule updates that list without a loading screen.

A new chore is an ordinary task. If it is overdue or due within 7 days it starts in Current. Otherwise it starts in Backlog. It is never parked in Icebox automatically. The card links back to its schedule. After you place it, later edits to the schedule update the due date and do not move the lane.

Completing that task, in one step, marks it done, records the completion, advances the next due date, and creates the next open task.

A daily job (`/api/cron/materialize-schedules`, bearer `CRON_SECRET`) creates the open task for any recurring schedule that is missing one.

## Bringing over an existing farm database

Starting the app does not copy a bf-maintenance database, and it does not change the schema. Copying is only `scripts/import-bf-data.ts`, after a backup, into a workspace id you pass.

`scripts/push-turso-schema.mjs` applies migrations once. The farm migration rebuilds tables in a single transaction with foreign keys off, and records that in `_farm_schema_migrations`. A remote database also needs `FARM_SCHEMA_PUSH=1`. Run it immediately before merging this app, then merge right away: the code that is live now breaks on the new schema.

`scripts/import-bf-data.ts` copies systems, components, schedules, and chores into the workspace you name (`--workspace` or `FARM_IMPORT_WORKSPACE_ID`). Point `BF_SOURCE_DATABASE_URL` at the old database and pass `BF_SOURCE_AUTH_TOKEN` when that database needs one. Running it again does not duplicate rows. If several open chores share a schedule, only the earliest stays open, and that choice is made before any task is written. A remote target also needs `FARM_IMPORT_ALLOW_REMOTE=1`. If `TURSO_DATABASE_URL` is unset, the script stops unless you pass `--local`, so it cannot write `dev.db` by accident. Do not put `BF_SOURCE_*` in Vercel.

## What this app does not do

Inbox, Daily Brief, People, Areas, a separate Capture page, a chores archive, and the old two-app sync are gone. There is no hidden proposed status.
