# Board lanes

Tasks carry a kanban lane — **Icebox**, **Backlog**, or **Current** — via `BoardLanePicker` (ARIA group `Board lane`) on capture review and task edit.

## Sub-features

- `lanes-visible` Icebox / Backlog / Current buttons appear on a proposed capture item.
- `lanes-select` user can select Current before accept.
- `lanes-persist` accepted work renders in its lane column on the Tasks board (desktop columns layout).

## How to get to it (user POV)

- Capture → Organize → expand proposal → **Board** picker.
- Task edit modal → Board picker (same component).

## Driving it with Playwright

Preconditions:

- `doctor.sh` green; signed-in.
- Prefer local instance so lane mutations stay disposable.

- **Propose.** Run `node scripts/drive.mjs --feature board-lanes --base-url <url>`. On review, `getByRole('group', { name: 'Board lane' })` contains buttons `Icebox`, `Backlog`, `Current`. Capture `board-lanes-picker.png`.
- **Select Current.** Click `Current`, then Accept. Land on `/tasks`; the card is in the Current column (`[data-board-layout=columns]`). Capture `board-lanes-board.png`.
- **Proof.** Picker artifacts show all three lane labels; the Current column holds the card after accept.

## Gotchas

- Lane labels are title case (`Current`), lane enum is `CURRENT`.
- Due dates never move a card between lanes.
