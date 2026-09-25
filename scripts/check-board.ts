/**
 * Pure assertions for the Tasks board (run in CI: npm run test:board).
 * laneOf is the ONE read-time place a stored task's column is decided;
 * buildBoard groups open tasks into cards (subtasks nest under an on-board parent).
 */
import assert from "node:assert/strict";
import { buildBoard, laneFromParam, laneOf, laneToParam, type BoardCard } from "../src/lib/board";

assert.equal(laneOf({ board: "CURRENT" }), "CURRENT");
assert.equal(laneOf({ board: "BACKLOG" }), "BACKLOG");
assert.equal(laneOf({ board: "ICEBOX" }), "ICEBOX");
// Nothing vanishes: null / missing / unknown → Backlog (no backfill needed)
assert.equal(laneOf({ board: null }), "BACKLOG");
assert.equal(laneOf({}), "BACKLOG");
assert.equal(laneOf({ board: "" }), "BACKLOG");
assert.equal(laneOf({ board: "SOMEDAY" }), "BACKLOG");
assert.equal(laneOf({ board: "current" }), "BACKLOG");
// Legacy priority never overrides the stored lane at read time
assert.equal(laneOf({ board: "SOMEDAY", priority: 1 } as { board: string }), "BACKLOG");
// Due dates are not an input: a past-due Icebox task stays in Icebox
assert.equal(
  laneOf({ board: "ICEBOX", dueAt: new Date("2020-01-01") } as { board: string }),
  "ICEBOX",
);

// buildBoard: subtasks nest in their parent's card and follow the parent's lane
type T = { id: string; status: string; board?: string | null; parentId?: string | null };
const t = (id: string, board: string | null, status = "ACTIVE", parentId?: string): T => ({
  id,
  board,
  status,
  parentId,
});
const tasks: T[] = [
  t("p", "CURRENT"),
  t("nestedIce", "ICEBOX", "ACTIVE", "p"), // own lane ignored → inside p (Current)
  t("nestedInbox", "SOMEDAY", "INBOX", "p"),
  t("grandchild", "BACKLOG", "SNOOZED", "nestedIce"), // nests under its parent, still in p's card
  t("doneSub", "CURRENT", "DONE", "p"), // done subtasks are not on the board
  t("pDone", "CURRENT", "DONE"),
  t("orphanDone", "ICEBOX", "ACTIVE", "pDone"),
  t("pCancelled", "CURRENT", "CANCELLED"),
  t("orphanCancelled", null, "ACTIVE", "pCancelled"), // own laneOf → Backlog
  t("pProposed", "ICEBOX", "PROPOSED"),
  t("orphanProposed", "CURRENT", "ACTIVE", "pProposed"),
  t("orphanMissing", "ICEBOX", "SNOOZED", "gone"),
  t("cycA", "CURRENT", "ACTIVE", "cycB"), // bad-data cycle: stays top-level, never vanishes
  t("cycB", "ICEBOX", "ACTIVE", "cycA"),
];
const board = buildBoard(tasks);
const shape = (cards: BoardCard<T>[]): unknown[] =>
  cards.map((c) => (c.subtasks.length ? { [c.task.id]: shape(c.subtasks) } : c.task.id));
assert.deepEqual([...board.keys()], ["CURRENT", "BACKLOG", "ICEBOX"]);
assert.deepEqual(shape(board.get("CURRENT")!), [
  { p: [{ nestedIce: ["grandchild"] }, "nestedInbox"] },
  "orphanProposed",
  "cycA",
]);
assert.deepEqual(shape(board.get("BACKLOG")!), ["orphanCancelled"]);
assert.deepEqual(shape(board.get("ICEBOX")!), ["orphanDone", "orphanMissing", "cycB"]);
// Every open task appears exactly once (top-level or nested); nothing else does
const ids: string[] = [];
const walk = (cards: BoardCard<T>[]) =>
  cards.forEach((c) => (ids.push(c.task.id), walk(c.subtasks)));
for (const cards of board.values()) walk(cards);
const openIds = tasks.filter((x) => ["ACTIVE", "INBOX", "SNOOZED"].includes(x.status)).map((x) => x.id);
assert.deepEqual([...ids].sort(), [...openIds].sort());

// ?lane= URL param: invalid/missing → Current (mobile tab default)
assert.equal(laneFromParam(undefined), "CURRENT");
assert.equal(laneFromParam(null), "CURRENT");
assert.equal(laneFromParam(""), "CURRENT");
assert.equal(laneFromParam("backlog"), "BACKLOG");
assert.equal(laneFromParam("ICEBOX"), "ICEBOX");
assert.equal(laneFromParam("current"), "CURRENT");
assert.equal(laneFromParam("SOMEDAY"), "CURRENT");
assert.equal(laneToParam("BACKLOG"), "backlog");

console.log("board: laneOf + buildBoard + laneFromParam assertions passed");
