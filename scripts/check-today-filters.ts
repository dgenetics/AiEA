/**
 * Boundary assertions for the Today 7-day overdue cutoff.
 * Run: npm run test:today   (no test runner in repo — plain node:assert via tsx)
 */
import assert from "node:assert/strict";
import {
  classifyTodayTask,
  overdueDays,
  STALE_OVERDUE_DAYS,
} from "../src/lib/today-filters";

// 8:40pm New York on Sep 24 = 00:40Z Sep 25 — local date must win over UTC.
const now = new Date("2026-09-24T20:40:00-04:00");
// Due days stored as local noon (app convention) in America/New_York.
const nyNoon = (ymd: string) => new Date(`${ymd}T12:00:00-04:00`);
const cur = (dueAt: Date | string | null, extra = {}) => ({
  board: "CURRENT",
  dueAt,
  ...extra,
});

assert.equal(STALE_OVERDUE_DAYS, 7);

// 0 / 7 / 8 days overdue
assert.equal(overdueDays(nyNoon("2026-09-24"), now), 0);
assert.equal(classifyTodayTask(cur(nyNoon("2026-09-24")), now), "main");
assert.equal(overdueDays(nyNoon("2026-09-17"), now), 7);
assert.equal(classifyTodayTask(cur(nyNoon("2026-09-17")), now), "main");
assert.equal(overdueDays(nyNoon("2026-09-16"), now), 8);
assert.equal(classifyTodayTask(cur(nyNoon("2026-09-16")), now), "stale");
assert.equal(classifyTodayTask(cur(nyNoon("2026-07-20")), now), "stale");

// Legacy UTC-midnight storage = that calendar day
assert.equal(classifyTodayTask(cur("2026-09-17T00:00:00.000Z"), now), "main");
assert.equal(classifyTodayTask(cur("2026-09-16T00:00:00.000Z"), now), "stale");

// Tomorrow (NY) is future even though it's already Sep 25 in UTC
assert.equal(classifyTodayTask(cur(nyNoon("2026-09-25")), now), "hidden");

// Other lanes / undated never in default
assert.equal(
  classifyTodayTask({ board: "BACKLOG", dueAt: nyNoon("2026-09-24") }, now),
  "hidden",
);
assert.equal(classifyTodayTask(cur(null), now), "hidden");

// Scheduled today / follow-ups unchanged (follow-ups never go stale)
assert.equal(
  classifyTodayTask(cur(nyNoon("2026-07-01"), { scheduledFor: nyNoon("2026-09-24") }), now),
  "main",
);
assert.equal(
  classifyTodayTask(cur(null, { followUpDueAt: nyNoon("2026-07-01") }), now),
  "main",
);
assert.equal(
  classifyTodayTask(cur(nyNoon("2026-07-01"), { isFollowUp: true }), now),
  "main",
);

console.log("today-filters: all boundary assertions passed");
