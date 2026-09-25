/**
 * Pure assertions for the Tasks board lane rule (run in CI: npm run test:board).
 * laneOf is the ONE read-time place a stored task's column is decided.
 */
import assert from "node:assert/strict";
import { laneOf } from "../src/lib/board";

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

console.log("board: laneOf assertions passed");
