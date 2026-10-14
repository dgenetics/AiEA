# Farm Manager

One app for the farm: systems, the schedules that keep them up, and the tasks you actually do. Sign in once. Everything lives in one database.

## Getting around

The header shows only `Farm Manager`, centered, on a dark bar, and a small person icon on the right. Signed in, that icon opens an account menu under the header: your initials, name, and email, then Change password, then Sign out. On a phone the menu is a full-width cream panel with a light dim over the page. On a wider screen it is a 320px dropdown with a pointer. Tap the icon again, tap outside, press Escape, or change pages to close it. Signed out, the icon goes to sign-in. Systems, Schedules, and Tasks are a fixed bottom bar in that same dark style at every width: plain text, no icons, a thin top border, and padding for the home indicator. The current tab is bold white. Every page behind that bar is cream. Page content ends with a spacer the height of the footer, the home indicator, and about 24px more, so the last card or the Schedules legend stays clear of that bar. On iPhone Safari the spacer also covers the strip behind the browser toolbar, which is where the tab bar sits. Login and register sit outside this chrome.

`/` sends you to `/tasks`. The other routes are `/systems`, `/systems/:id`, `/systems/:id/components/:cid`, `/schedules`, `/tasks`, `/tasks/done`, `/login`, and `/register`. `/account` sends you to Tasks.

Old `/maintenance/*` bookmarks redirect to the new pages. Retired pages (`/inbox`, `/brief`, `/people`, `/areas`, `/capture`, `/archive`, `/recurring`, `/today`, `/upcoming`) send you to Tasks or Archive.

## Sign-in

Email and password. One session cookie (`aiea_session`, path `/`) covers every tab. The account menu shows your name and email and lets you change the password in place. Cancel closes that form. A successful change shows the green confirmation, then closes the form. Changing the password signs out other devices. Sign out is the red row at the bottom of the menu.

## Tasks

The Tasks tab is the cream board with three columns: Current, Backlog, and Icebox. On a phone the same lanes are tabs. Every open task is on the board. Nothing is filtered out, and there is no Inbox or proposed-review state. Cards, the capture field, and the edit sheet use the same cream and forest green as Systems and Schedules.

A task can have a due date, notes, and subtasks. You can complete it, edit it, move its lane, or cancel it. Completed tasks are on Archive at `/tasks/done`, which is the same cream. The board links there as Archive, and Archive links back to Tasks.

## Capture

At the top of Tasks there is one field: “Type a task…”. Enter sends it. Shift+Enter adds a line. `C` focuses the field when you are not already typing. Escape asks before discarding a draft. There is no microphone in the app. Dictation, if you want it, is the phone keyboard’s.

The text is split into tasks with dates (America/New_York) and a lane:

- “today”, “asap”, or due within about two days → Current
- “this week”, “next week”, or a date a bit further out → Backlog
- “someday”, “think about”, or no timing → Icebox

Unclear text defaults to Icebox. Tasks are created active immediately and listed under the field: “Added N · check the buckets”, with Accept all. Each row shows the title, the bucket, and the due date when there is one. Accept removes that row. The list disappears when it is empty. Edit opens the task sheet and says which bucket the AI picked. Changing the title or the bucket within seven days teaches the next capture. There is no undo. If the model is down, you can retry or save the whole note as one task. Gibberish still becomes one task so nothing you typed is dropped.

Moving an AI-created task to another lane within seven days records that correction so later captures can learn the preference.

## Systems

Systems is a cream tag cloud of pills grouped by category. Each pill is the full system name, never cut off, and the whole pill opens that system. Pills wrap onto new lines inside each category. Category labels are small muted uppercase text with no rule, and the groups sit apart from each other. A pill with an open task on one of its components is tinted amber, and a short legend says “Amber = has an open task”. A search field is always on the page. It filters by system name, component name, location, and category as you type. A system stays in the list when any of its components matches. ✕ or Escape clears the field. Nothing matching shows “No systems match”. “+ Add system” creates one. Inside a system the page is read-only until you tap Edit. The title is the name, then the category and the shared location, an Edit button, and a ⋯ menu whose only item is Delete. Components are one column of pills showing the full name. An open task tints a pill amber, and an overdue task or schedule tints it light red. A legend explains both. Tap a pill to expand it, and only one stays open. The expanded pill starts with Add schedule and Edit Component, then the filled-in fields and that component’s schedules. Find a component is always on the page and matches name, location, model, and vendor. + Add component adds one. System notes stay collapsed under the list. Edit mode is the name, category, and notes, then each component with add-schedule, move, duplicate, and delete. Purchase and replacement totals are not shown, the component count is not shown, and there is no whole-system duplicate. There is no farm banner and no second header.

## Schedules

Schedules is a cream grid of cards, rendered with the page. A refresh shows the cards immediately, with no loading line. Each card shows the schedule name, its system and component, and how often it repeats. Cards stack on a phone and sit in two columns, then three, on a wider screen. A card with an open task on Tasks is tinted amber, and a short legend explains that tint. The whole card opens that schedule’s editor, with save and cancel. “+ Add schedule” creates one. Each schedule keeps exactly one open task. Saving or adding a schedule updates the list in place.

A new chore is an ordinary task. If it is overdue or due within 7 days it starts in Current. Otherwise it starts in Backlog. It is never parked in Icebox automatically. The card links back to its schedule. After you place it, later edits to the schedule update the due date and do not move the lane.

Completing that task, in one step, marks it done, records the completion, advances the next due date, and creates the next open task.

A daily job (`/api/cron/materialize-schedules`, bearer `CRON_SECRET`) creates the open task for any recurring schedule that is missing one.

## Bringing over an existing farm database

Starting the app does not copy a bf-maintenance database, and it does not change the schema. Copying is only `scripts/import-bf-data.ts`, after a backup, into a workspace id you pass.

`scripts/push-turso-schema.mjs` applies migrations once. The farm migration rebuilds tables in a single transaction with foreign keys off, and records that in `_farm_schema_migrations`. A remote database also needs `FARM_SCHEMA_PUSH=1`. Run it immediately before merging this app, then merge right away: the code that is live now breaks on the new schema.

`scripts/import-bf-data.ts` copies systems, components, schedules, and chores into the workspace you name (`--workspace` or `FARM_IMPORT_WORKSPACE_ID`). Point `BF_SOURCE_DATABASE_URL` at the old database and pass `BF_SOURCE_AUTH_TOKEN` when that database needs one. Running it again does not duplicate rows. If several open chores share a schedule, only the earliest stays open, and that choice is made before any task is written. A remote target also needs `FARM_IMPORT_ALLOW_REMOTE=1`. If `TURSO_DATABASE_URL` is unset, the script stops unless you pass `--local`, so it cannot write `dev.db` by accident. Do not put `BF_SOURCE_*` in Vercel.

## What this app does not do

Inbox, Daily Brief, People, Areas, a separate Capture page, a chores archive, and the old two-app sync are gone. There is no hidden proposed status.
