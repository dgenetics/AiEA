# Schedule chores on the Tasks board

A recurring schedule creates one ordinary open task. Due today starts in Current. This stays inside Farm Manager.

## Sub-features

- `schedule-create` posts a system, component, and schedule.
- `schedule-card` shows that name in Current and on `/schedules`.

## How to get to it (user POV)

- Systems → add a system and component, or use the API the drive uses.
- Schedules → the row links to the open card on Tasks.

## Driving it with Playwright

- **Create.** `node scripts/drive.mjs --feature bf-sync --base-url <url>`. `POST /api/systems` then `POST /api/schedules` with `nextDueDate` now.
- **Board.** `/tasks` Current column contains the schedule name.
- **Table.** `/schedules` lists the same name.

## Gotchas

- Always runs. Missing `BF_MAINTENANCE_URL` is not a skip.
- The feature id stays `bf-sync` so the existing gate command still selects it.
