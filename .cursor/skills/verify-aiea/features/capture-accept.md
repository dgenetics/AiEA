# Capture on the Tasks board

The capture field sits on `/tasks`. Add creates active tasks immediately. There is no review page.

## Sub-features

- `capture-field` shows “Type or talk…”.
- `capture-add` creates the task and shows “Added N”.

## How to get to it (user POV)

- Sign in. The board is `/tasks`.
- The field is at the top of the board.

## Driving it with Playwright

- **Open the board.** `node scripts/drive.mjs --feature capture-accept --base-url <url>`. Heading `Tasks` and placeholder `Type or talk`.
- **Add.** Fill the field with a unique marker and “call the plumber about the kitchen leak”. Click `Add`. Toast matching `Added \d+` appears. The board shows the plumber text.

## Gotchas

- Heuristics run when `XAI_API_KEY` is unset. With a key, the model may rewrite the title; the drive accepts plumber, kitchen leak, or the marker.
- `/capture` redirects to `/tasks`. Do not look for “Organize with AI”.
