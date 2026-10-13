# Farm Manager

One app for the farm: systems, the schedules that keep them up, and the tasks you actually do. Sign in once. Everything lives in one database.

## Getting around

The header is `Farm Manager | Systems | Schedules | Tasks`, with Account on the right. Account is a link, not a tab. The same bar is the only navigation on desktop and on a phone. Login and register sit outside that bar.

`/` sends you to `/tasks`. The other routes are `/systems`, `/systems/:id`, `/systems/:id/components/:cid`, `/schedules`, `/tasks`, `/tasks/done`, `/account`, `/login`, and `/register`.

Old `/maintenance/*` bookmarks redirect to the new pages. Retired pages (`/inbox`, `/brief`, `/people`, `/areas`, `/capture`, `/archive`, `/recurring`, `/today`, `/upcoming`) send you to Tasks or Done.

## Sign-in

Email and password. One session cookie (`aiea_session`, path `/`) covers every tab. Account shows your name and email and lets you change the password. Changing it signs out other devices.

## Tasks

The Tasks tab is the dark board with three columns: Current, Backlog, and Icebox. On a phone the same lanes are tabs. Every open task is on the board. Nothing is filtered out, and there is no Inbox or proposed-review state.

A task can have a due date, notes, and subtasks. You can complete it, edit it, move its lane, or cancel it. Done tasks live at `/tasks/done`.

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

Systems is the cream list of equipment: a plain “Systems” title and “+ Add system”. Open a system to edit it, add components, and see what is overdue. Open a component for its fields (model, vendor, costs, notes), to move or duplicate it, and to attach schedules. There is no farm banner and no second header.

## Schedules

Schedules is a cream table: name, system and component, cadence, next due, and the open card on Tasks. “+ Add schedule” creates one. Each schedule keeps exactly one open task.

A new chore is an ordinary task. If it is overdue or due within 7 days it starts in Current. Otherwise it starts in Backlog. It is never parked in Icebox automatically. The card links back to its schedule. After you place it, later edits to the schedule update the due date and do not move the lane.

Completing that task, in one step, marks it done, records the completion, advances the next due date, and creates the next open task.

A daily job (`/api/cron/materialize-schedules`, bearer `CRON_SECRET`) creates the open task for any recurring schedule that is missing one.

## Bringing over an existing farm database

If `BF_SOURCE_DATABASE_URL` is set, startup copies systems, components, schedules, and chores into the oldest workspace. Running it again does not duplicate rows. Open chores become tasks on the board, still linked to their schedule.

## What this app does not do

Inbox, Daily Brief, People, Areas, a separate Capture page, a chores archive, and the old two-app sync are gone. There is no hidden proposed status.
