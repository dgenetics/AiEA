# Board lanes

Capture chooses Current, Backlog, or Icebox from the words. “asap” lands in Current. There is no picker before the task exists.

## Sub-features

- `lane-asap` puts an asap task in the Current column.

## How to get to it (user POV)

- Sign in and open `/tasks`.
- Type into the capture field and click Add.

## Driving it with Playwright

- **Add.** `node scripts/drive.mjs --feature board-lanes --base-url <url>`. Fill “Lane check … call plumber asap”. Click `Add`.
- **Column.** `section[data-lane="CURRENT"]` contains plumber or “Lane check”.

## Gotchas

- Desktop columns are `md:grid` and hidden below `md`. The default Playwright viewport is desktop.
- Do not look for a “Board lane” group. That review picker is gone.
