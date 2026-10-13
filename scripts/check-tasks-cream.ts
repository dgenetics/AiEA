/**
 * Tasks and Archive use the cream theme. Header stays dark.
 * Run in CI: npm run test:tasks-cream
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const themed = [
  "src/app/(app)/tasks/page.tsx",
  "src/app/(app)/tasks/done/page.tsx",
  "src/components/board-mobile-tabs.tsx",
  "src/components/capture-composer.tsx",
  "src/components/task-row.tsx",
  "src/components/task-list.tsx",
  "src/components/archive-board.tsx",
  "src/components/task-edit-modal.tsx",
];

for (const path of themed) {
  const text = read(path);
  assert.doesNotMatch(text, /\bzinc-/, `${path} still uses zinc`);
  assert.doesNotMatch(text, /\bindigo-/, `${path} still uses indigo`);
  assert.doesNotMatch(text, /white\//, `${path} still uses a white/ opacity class`);
}

const shell = read("src/components/app-shell.tsx");
assert.match(shell, /bg-cream-100 text-ink/);
assert.doesNotMatch(shell, /#07070b/);
assert.doesNotMatch(shell, /startsWith\("\/systems"\)/);

const nav = read("src/components/site-nav.tsx");
assert.match(nav, /border-b border-white\/10 bg-\[#12141c\]/);
assert.match(nav, /border-t border-white\/10 bg-\[#12141c\]/);
assert.match(nav, /font-bold text-white/);
assert.match(nav, /font-medium text-zinc-400/);
assert.doesNotMatch(nav, /#fbf9f4/);
assert.doesNotMatch(nav, /startsWith\("\/systems"\)/);

const board = read("src/lib/board.ts");
assert.match(board, /text-stone-600 bg-\[#f1ece2\] border-cream-300/);
assert.match(board, /text-sky-800 bg-sky-50 border-sky-200/);
assert.match(board, /text-rose-800 bg-rose-50 border-rose-200/);

const css = read("src/app/globals.css");
assert.match(css, /--background:\s*#f7f3eb/);
assert.match(css, /--foreground:\s*#1c1917/);
assert.match(css, /scrollbar-color:\s*#d9cfb8 transparent/);
assert.match(css, /rgba\(74,\s*112,\s*94,\s*0\.9\)/);
assert.match(css, /background-color:\s*#fdfbf7/);
assert.match(css, /color:\s*#1c1917/);
assert.doesNotMatch(css, /color:\s*#fff/);

const modal = read("src/components/task-edit-modal.tsx");
assert.match(modal, /bg-cream-50/);
assert.match(modal, /bg-forest-900/);
assert.match(modal, /border-cream-300 bg-cream-50/);

console.log("tasks cream: Tasks, Archive, and the edit sheet use cream and forest green");
