/**
 * Schedule card phrasing and the /schedules view shape.
 * Run in CI: npm run test:schedules
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scheduleCardFrequency } from "../src/lib/chore-display";
import { sheetRepeatFromSchedule, sheetRepeatToInput } from "../src/lib/schedule-sheet";
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
assert.match(view, /title="Add schedule"/);
assert.match(view, /variant="sheet"/);
assert.match(view, /subtitle=\{meta\.get\(editing\.componentId\)\?\.component\}/);
assert.match(view, /components=\{picks\}/);
assert.match(view, /onComponentChange=\{setComponentId\}/);
assert.match(view, /\$\{system\.name\} · \$\{component\.name\}/);
assert.doesNotMatch(view, /\$\{system\.name\} \/ \$\{component\.name\}/);
const addBlock = view.slice(view.indexOf("{addOpen && ("));
assert.doesNotMatch(addBlock, /subtitle=/);
assert.doesNotMatch(view, /embedActions/);
assert.doesNotMatch(view, /onCancel/);
assert.match(view, /initial\.schedules/);
assert.match(view, /initial\.places/);
assert.match(view, /await load\(\)/);
assert.doesNotMatch(view, /Loading schedules/);
assert.doesNotMatch(view, /setLoading\(true\)/);
assert.doesNotMatch(view, /readSchedulesCache/);

const page = readFileSync(join(root, "src/app/(app)/(farm)/schedules/page.tsx"), "utf8");
assert.match(page, /loadSchedulesPage/);
assert.match(page, /<SchedulesView initial=\{initial\}/);
assert.match(page, /await getCurrentUser\(\)/);

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

assert.deepEqual(sheetRepeatFromSchedule(null), { unit: "", count: "1" });
assert.deepEqual(sheetRepeatFromSchedule({ frequency: "7d", intervalDays: 7, isRecurring: true }), {
  unit: "weeks",
  count: "1",
});
assert.deepEqual(sheetRepeatFromSchedule({ frequency: "14d", intervalDays: 14, isRecurring: true }), {
  unit: "weeks",
  count: "2",
});
assert.deepEqual(sheetRepeatFromSchedule({ frequency: "30d", intervalDays: 30, isRecurring: true }), {
  unit: "months",
  count: "1",
});
assert.deepEqual(sheetRepeatFromSchedule({ frequency: "90d", intervalDays: 90, isRecurring: true }), {
  unit: "months",
  count: "3",
});
assert.deepEqual(sheetRepeatFromSchedule({ frequency: "6mo", intervalDays: 182, isRecurring: true }), {
  unit: "months",
  count: "6",
});
assert.deepEqual(sheetRepeatFromSchedule({ frequency: "1y", intervalDays: 365, isRecurring: true }), {
  unit: "years",
  count: "1",
});
assert.deepEqual(sheetRepeatFromSchedule({ frequency: "custom", intervalDays: 21, isRecurring: true }), {
  unit: "weeks",
  count: "3",
});
assert.deepEqual(sheetRepeatFromSchedule({ frequency: "custom", intervalDays: 10, isRecurring: true }), {
  unit: "days",
  count: "10",
});
assert.deepEqual(sheetRepeatFromSchedule({ frequency: "7d", intervalDays: 7, isRecurring: false }), {
  unit: "once",
  count: "1",
});

assert.deepEqual(sheetRepeatToInput("1", ""), null);
assert.deepEqual(sheetRepeatToInput("0", "days"), null);
assert.deepEqual(sheetRepeatToInput("1.5", "weeks"), null);
assert.deepEqual(sheetRepeatToInput("1", "weeks"), {
  frequency: "7d",
  intervalDays: 7,
  isRecurring: true,
});
assert.deepEqual(sheetRepeatToInput("2", "weeks"), {
  frequency: "14d",
  intervalDays: 14,
  isRecurring: true,
});
assert.deepEqual(sheetRepeatToInput("1", "months"), {
  frequency: "30d",
  intervalDays: 30,
  isRecurring: true,
});
assert.deepEqual(sheetRepeatToInput("3", "months"), {
  frequency: "90d",
  intervalDays: 90,
  isRecurring: true,
});
assert.deepEqual(sheetRepeatToInput("6", "months"), {
  frequency: "6mo",
  intervalDays: 182,
  isRecurring: true,
});
assert.deepEqual(sheetRepeatToInput("1", "years"), {
  frequency: "1y",
  intervalDays: 365,
  isRecurring: true,
});
assert.deepEqual(sheetRepeatToInput("5", "days"), {
  frequency: "custom",
  intervalDays: 5,
  isRecurring: true,
});
assert.deepEqual(sheetRepeatToInput("1", "once"), {
  frequency: "custom",
  intervalDays: null,
  isRecurring: false,
});

const form = readFileSync(join(root, "src/components/farm/ScheduleForm.tsx"), "utf8");
assert.match(form, /sheetRepeatFromSchedule\(initial\)/);
assert.match(form, /useState\(repeat\.count\)/);
assert.match(form, /useState<RepeatUnit>\(repeat\.unit\)/);
assert.match(form, /Choose…/);
assert.match(form, /Doesn't repeat/);
assert.match(form, /First due/);
assert.match(form, /Notes \(optional\)/);
assert.match(form, /e\.g\. Backflush filter/);
assert.match(form, /h-\[50px\]/);
assert.match(form, /Saving…/);
assert.match(form, /disabled=\{unit === "once"\}/);
assert.match(form, /disabled=\{!canSave\}/);
assert.match(form, /Choose a component/);
assert.ok(form.indexOf("Choose a component") < form.indexOf("e.g. Backflush filter"));
assert.ok(form.indexOf("autoFocus") > form.indexOf("Choose a component"));
assert.equal((form.match(/autoFocus/g) ?? []).length, 1);
assert.match(form, /!needsComponent \|\| componentId/);
assert.match(form, /components\?: \{ id: string; label: string \}\[\]/);
assert.doesNotMatch(form, /Cancel/);
assert.doesNotMatch(form, /Recurring \(create next task/);
assert.doesNotMatch(form, /Frequency/);
assert.doesNotMatch(form, /Save schedule/);
assert.doesNotMatch(form, /variant\?: "default" \| "sheet"/);
assert.doesNotMatch(form, /StickySaveBar/);
assert.doesNotMatch(form, /embedActions/);
assert.doesNotMatch(form, /className="space-y-3"/);

const list = readFileSync(join(root, "src/components/farm/ComponentsList.tsx"), "utf8");
assert.match(list, /variant="sheet"/);
assert.match(list, /title="Add schedule"/);
assert.match(list, /subtitle=\{liveNames\[schedulePart\.id\] \?\? schedulePart\.name\}/);
assert.match(list, /error=\{scheduleError\}/);
assert.match(list, /setRelatedTick\(\(tick\) => tick \+ 1\)/);
assert.doesNotMatch(list, /embedActions/);
assert.doesNotMatch(list, /onCancel/);
assert.doesNotMatch(list, /components=/);

const detail = readFileSync(join(root, "src/components/farm/component-detail.tsx"), "utf8");
assert.match(detail, /variant="sheet"/);
assert.match(detail, /title="Add schedule"/);
assert.match(detail, /subtitle=\{component\.name\}/);
assert.match(detail, /deleteSchedule/);
assert.doesNotMatch(detail, /embedActions/);
assert.doesNotMatch(detail, /onCancel/);
assert.doesNotMatch(detail, /components=/);

const modal = readFileSync(join(root, "src/components/farm/Modal.tsx"), "utf8");
assert.match(modal, /subtitle\?: string/);
assert.match(modal, /text-\[#78716c\] \[overflow-wrap:anywhere\]/);
assert.match(modal, /items-start justify-between/);
assert.match(modal, /useKeyboardFrame\(\)/);
assert.match(modal, /useLockBodyScroll\(true\)/);
assert.match(modal, /fixedViewportStyle\(frame\)/);
assert.match(modal, /style=\{viewportStyle\}/);

const route = readFileSync(join(root, "src/app/api/schedules/route.ts"), "utf8");
assert.match(route, /isRecurring: body\.isRecurring \?\? true/);
assert.match(route, /intervalDaysFromFrequency\(frequency\)/);

console.log("schedules: cards show name, place, and frequency; open tasks are tinted");
