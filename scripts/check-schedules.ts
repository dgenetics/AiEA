/**
 * Schedule card phrasing and the /schedules view shape.
 * Run in CI: npm run test:schedules
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scheduleCardFrequency } from "../src/lib/chore-display";
import {
  beginSchedulesFetch,
  clearSchedulesCache,
  readSchedulesCache,
  schedulesFetchIsCurrent,
  writeSchedulesCache,
} from "../src/lib/schedules-cache";

assert.equal(scheduleCardFrequency("7d", 7), "Every week");
assert.equal(scheduleCardFrequency("14d", 14), "Every 2 weeks");
assert.equal(scheduleCardFrequency("30d", 30), "Every month");
assert.equal(scheduleCardFrequency("60d", 60), "Every 2 months");
assert.equal(scheduleCardFrequency("90d", 90), "Every 3 months");
assert.equal(scheduleCardFrequency("6mo", 182), "Every 6 months");
assert.equal(scheduleCardFrequency("1y", 365), "Every year");
assert.equal(scheduleCardFrequency("12mo", null), "Every year");
assert.equal(scheduleCardFrequency("custom", 45), "Every 45 days");
assert.equal(scheduleCardFrequency("custom", 1), "Every day");
assert.equal(scheduleCardFrequency("every 90 days", 90), "Every 3 months");
assert.equal(scheduleCardFrequency(null, null), "—");

const root = join(import.meta.dirname, "..");
const view = readFileSync(join(root, "src/components/farm/schedules-view.tsx"), "utf8");

assert.doesNotMatch(view, /<table\b/);
assert.doesNotMatch(view, /Next due/);
assert.doesNotMatch(view, /on Tasks ›/);
assert.doesNotMatch(view, /href=["']\/tasks["']/);
assert.match(view, /Tinted = has an open task on Tasks/);
assert.match(view, /aria-label=\{`Edit \$\{s\.name\}`\}/);
assert.match(view, /type="button"/);
assert.match(view, /updateSchedule/);
assert.match(view, /bg-\[#fdf0d5\]/);
assert.match(view, /grid-cols-1/);
assert.match(view, /md:grid-cols-2/);
assert.match(view, /lg:grid-cols-3/);
assert.match(view, /scheduleCardFrequency/);
assert.match(view, /title="Edit schedule"/);
assert.match(view, /readSchedulesCache\(\)/);
assert.match(view, /writeSchedulesCache\(/);
assert.match(view, /useState\(\(\) => readSchedulesCache\(\) == null\)/);
assert.match(view, /if \(!background\) setLoading\(true\)/);
assert.match(view, /void load\(readSchedulesCache\(\) != null\)/);
assert.match(view, /await load\(true\)/);
assert.doesNotMatch(view, /useState\(true\)/);
assert.doesNotMatch(view, /await load\(\)/);

clearSchedulesCache();
assert.equal(readSchedulesCache(), null);
const older = beginSchedulesFetch();
const newer = beginSchedulesFetch();
assert.equal(schedulesFetchIsCurrent(older), false);
assert.equal(schedulesFetchIsCurrent(newer), true);
writeSchedulesCache({
  schedules: [
    {
      id: "s1",
      componentId: "c1",
      name: "Oil",
      description: null,
      frequency: "90d",
      intervalDays: 90,
      isRecurring: true,
      nextDueDate: "2026-10-13",
      lastCompletedAt: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ],
  openCards: [],
});
const cached = readSchedulesCache();
assert.ok(cached);
assert.equal(cached.schedules[0]?.name, "Oil");
assert.equal(cached.openCards.length, 0);
clearSchedulesCache();
assert.equal(readSchedulesCache(), null);

console.log("schedules: cards show name, place, and frequency; open tasks are tinted");
