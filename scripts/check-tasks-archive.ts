/**
 * Tasks board Archive link and the Archive page header.
 * Run in CI: npm run test:tasks-archive
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const board = readFileSync(join(root, "src/app/(app)/tasks/page.tsx"), "utf8");
const done = readFileSync(join(root, "src/app/(app)/tasks/done/page.tsx"), "utf8");
const archive = readFileSync(join(root, "src/components/archive-board.tsx"), "utf8");

assert.doesNotMatch(board, /fromSchedules/);
assert.doesNotMatch(board, /nothing hidden/);
assert.doesNotMatch(board, /from schedules/);
assert.doesNotMatch(board, /Done ›/);
assert.equal((board.match(/href="\/tasks\/done"/g) ?? []).length, 2);
assert.equal((board.match(/<Archive className="h-4 w-4" aria-hidden \/>/g) ?? []).length, 2);
assert.equal((board.match(/min-h-11 items-center gap-1/g) ?? []).length, 2);
assert.match(board, /import \{ Archive \} from "lucide-react"/);
assert.match(board, /text-xs font-medium text-forest-800 hover:text-forest-950/);
assert.match(board, /active:text-forest-950 active:opacity-80/);
assert.match(board, /focus-visible:outline-forest-700/);
assert.match(board, /pt-2 text-center md:hidden/);
assert.match(board, /items-baseline justify-between gap-3/);

assert.match(done, /href="\/tasks"/);
assert.match(done, /<ChevronLeft className="h-4 w-4" aria-hidden \/>/);
assert.match(done, /min-h-11 items-center gap-0\.5/);
assert.match(done, /-ml-1\.5/);
assert.match(done, /text-sm text-stone-600 hover:text-ink/);
assert.match(done, /active:text-ink active:opacity-80/);
assert.match(done, />\s*Tasks\s*</);
assert.match(
  done,
  /<h1 className="mt-0\.5 text-xl font-semibold tracking-tight text-ink md:text-2xl">Archive<\/h1>/,
);
assert.match(done, /Completed tasks, newest first\./);
assert.doesNotMatch(done, />Done</);
assert.match(done, /max-w-3xl/);
assert.match(board, /max-w-6xl/);

assert.doesNotMatch(archive, /Today or Upcoming/);
assert.match(archive, /Finish tasks on the board and they&apos;ll show up here\./);

console.log("tasks archive: Archive links replace Done, and the archive page links back to Tasks");
