# Board lanes

Tasks carry a kanban lane — **Icebox**, **Backlog**, or **Current** — via `BoardLanePicker` (ARIA group `Board lane`) on capture review and task edit.

## Sub-features

- `lanes-visible` Icebox / Backlog / Current buttons appear on a proposed capture item.
- `lanes-select` user can select Current before accept.
- `lanes-persist` accepted work surfaces on Today (Current undated items are Today-eligible).

## How to get to it (user POV)

- Capture → Organize → expand proposal → **Board** picker.
- Task edit modal → Board picker (same component).

## Driving it with Playwright

Preconditions:

- `doctor.sh` green; signed-in.
- Prefer local instance so lane mutations stay disposable.

- **Propose.** Run `node scripts/drive.mjs --feature board-lanes --base-url <url>`. On review, `getByRole('group', { name: 'Board lane' })` contains buttons `Icebox`, `Backlog`, `Current`. Capture `board-lanes-picker.png`.
- **Select Current.** Click `Current`, then Accept. Land on `/today`. Capture `board-lanes-today.png`.
- **Proof.** Picker artifacts show all three lane labels; Today loads after accept.

## Gotchas

- Lane labels are title case (`Current`), lane enum is `CURRENT`.
- Dated Current work may prefer Upcoming until due — undated Current is safer for Today proof.
