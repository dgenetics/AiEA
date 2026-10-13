/**
 * Capture review list replaces the Added/Undo toast, and title edits teach capture.
 * Run: npm run test:capture-review
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { correctionsForCaptureEdit, formatCorrectionsForPrompt } from "../src/lib/ai/corrections";

const day = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 13);
const fresh = new Date(now - 2 * day);
const stale = new Date(now - 8 * day);

const titleOnly = correctionsForCaptureEdit({
  sourceCaptureId: "cap-1",
  createdAt: fresh,
  now,
  prevTitle: "Fix the fence",
  nextTitle: "Fix the north pasture fence",
  prevBoard: "BACKLOG",
  nextBoard: "BACKLOG",
});
assert.deepEqual(titleOnly, [
  {
    field: "title",
    taskTitle: "Fix the north pasture fence",
    beforeValue: "Fix the fence",
    afterValue: "Fix the north pasture fence",
  },
]);

const boardOnly = correctionsForCaptureEdit({
  sourceCaptureId: "cap-1",
  createdAt: fresh,
  now,
  prevTitle: "Call the vet",
  nextTitle: "Call the vet",
  prevBoard: "BACKLOG",
  nextBoard: "CURRENT",
});
assert.equal(boardOnly.length, 1);
assert.equal(boardOnly[0]?.field, "board");
assert.equal(boardOnly[0]?.beforeValue, "BACKLOG");
assert.equal(boardOnly[0]?.afterValue, "CURRENT");

const both = correctionsForCaptureEdit({
  sourceCaptureId: "cap-1",
  createdAt: fresh,
  now,
  prevTitle: "Old",
  nextTitle: "New",
  prevBoard: "ICEBOX",
  nextBoard: "CURRENT",
});
assert.deepEqual(
  both.map((item) => item.field),
  ["board", "title"],
);

assert.deepEqual(
  correctionsForCaptureEdit({
    sourceCaptureId: null,
    createdAt: fresh,
    now,
    prevTitle: "Old",
    nextTitle: "New",
    prevBoard: "ICEBOX",
    nextBoard: "CURRENT",
  }),
  [],
);

assert.deepEqual(
  correctionsForCaptureEdit({
    sourceCaptureId: "cap-1",
    createdAt: stale,
    now,
    prevTitle: "Old",
    nextTitle: "New",
    prevBoard: "ICEBOX",
    nextBoard: "CURRENT",
  }),
  [],
);

assert.deepEqual(
  correctionsForCaptureEdit({
    sourceCaptureId: "cap-1",
    createdAt: fresh,
    now,
    prevTitle: "Same",
    prevBoard: "CURRENT",
    nextBoard: null,
  }),
  [],
);

const prompt = formatCorrectionsForPrompt([
  {
    field: "title",
    taskTitle: "Fix the north pasture fence",
    beforeValue: "Fix the fence",
    afterValue: "Fix the north pasture fence",
    note: null,
  },
]);
assert.match(prompt, /### Title rewrites/);
assert.match(prompt, /Fix the north pasture fence/);

const root = join(import.meta.dirname, "..");
const composer = readFileSync(join(root, "src/components/capture-composer.tsx"), "utf8");
assert.match(composer, /Added \{review\.length\}/);
assert.match(composer, /check the buckets/);
assert.match(composer, /Accept all/);
assert.match(composer, /aria-label=\{`Accept \$\{task\.title\}`\}/);
assert.match(composer, /aiBoard=\{editing\.aiBoard\}/);
assert.match(composer, /dueAt: task\.dueAt \?\? null/);
assert.doesNotMatch(composer, /Undo|action: "undo"|function undo/);

const route = readFileSync(join(root, "src/app/api/tasks/[id]/route.ts"), "utf8");
assert.match(route, /correctionsForCaptureEdit/);
assert.match(route, /recordCorrections\(workspaceId, edits\)/);

const capture = readFileSync(join(root, "src/app/api/capture/route.ts"), "utf8");
assert.doesNotMatch(capture, /"undo"/);
assert.match(capture, /dueAt: task\.dueAt\?\.toISOString\(\) \?\? null/);

const modal = readFileSync(join(root, "src/components/task-edit-modal.tsx"), "utf8");
assert.match(modal, /AI picked \{boardLabel\(aiBoard\)\}\. Your change teaches it\./);

const features = readFileSync(join(root, "FEATURES.md"), "utf8");
assert.match(features, /check the buckets/);
assert.match(features, /There is no undo/);

console.log("capture-review: accept list replaces undo; title and board edits teach capture");
