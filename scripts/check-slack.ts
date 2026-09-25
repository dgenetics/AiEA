/**
 * Pure Slack spike assertions (CI: npm run test:slack).
 */
import assert from "node:assert/strict";
import {
  parseSlackCommand,
  resolveTaskId,
  shortId,
} from "../src/lib/slack/commands";
import { selectDueToday } from "../src/lib/slack/due-today";
import { formatDueTodayForUser } from "../src/lib/slack/format";
import {
  aieaEmailForSlackUser,
  linkedUsers,
  loadSlackConfig,
  parseUserMap,
} from "../src/lib/slack/config";
import { localNoonToday, localNoonPlusDays } from "../src/lib/calendar";

// --- commands ---
assert.deepEqual(parseSlackCommand("done abc12def"), {
  action: "done",
  shortId: "abc12def",
});
assert.deepEqual(parseSlackCommand("  DONE  AbC12Def  "), {
  action: "done",
  shortId: "abc12def",
});
assert.deepEqual(parseSlackCommand("snooze xyz999"), {
  action: "snooze",
  shortId: "xyz999",
  days: 1,
});
assert.deepEqual(parseSlackCommand("snooze xyz999 3d"), {
  action: "snooze",
  shortId: "xyz999",
  days: 3,
});
assert.deepEqual(parseSlackCommand("snooze xyz999 3"), {
  action: "snooze",
  shortId: "xyz999",
  days: 3,
});
assert.equal(parseSlackCommand("snooze xyz999 0"), null);
assert.equal(parseSlackCommand("hello"), null);
assert.equal(parseSlackCommand("done"), null);

const id = "cmug8bg5w0005wf9hnbytubxc";
assert.equal(shortId(id), id.slice(-8).toLowerCase());
assert.equal(
  resolveTaskId([{ id }, { id: "otherxxxxxxxx" }], id.slice(-8)),
  id,
);
assert.equal(resolveTaskId([{ id }], "nope"), null);

// --- due today ---
const today = localNoonToday();
const tomorrow = localNoonPlusDays(1);
const tasks = [
  { id: "a", title: "today", dueAt: today, status: "ACTIVE", kind: "ONE_TIME" },
  { id: "b", title: "tomorrow", dueAt: tomorrow, status: "ACTIVE", kind: "ONE_TIME" },
  { id: "c", title: "done", dueAt: today, status: "DONE", kind: "ONE_TIME" },
  { id: "d", title: "undated", dueAt: null, status: "ACTIVE", kind: "ONE_TIME" },
  { id: "e", title: "inbox today", dueAt: today, status: "INBOX", kind: "ONE_TIME" },
];
const due = selectDueToday(tasks, today);
assert.deepEqual(
  due.map((t) => t.id).sort(),
  ["a", "e"],
);

// --- multi-user map ---
assert.deepEqual(parseUserMap('{"U1":"Will@Farm.Example","U2":"other@farm.example"}'), {
  U1: "will@farm.example",
  U2: "other@farm.example",
});
const cfg = loadSlackConfig({
  SLACK_BOT_TOKEN: "xoxb-test",
  SLACK_USER_MAP: '{"UWILL":"will@farm.example","UOTHER":"other@farm.example"}',
  SLACK_AIEA_CHANNEL: "#aiea",
} as unknown as NodeJS.ProcessEnv);
assert.ok(cfg);
assert.equal(linkedUsers(cfg!).length, 2);
assert.equal(aieaEmailForSlackUser(cfg!, "UWILL"), "will@farm.example");
assert.equal(aieaEmailForSlackUser(cfg!, "USTRANGER"), null);

// single-user back-compat
const single = loadSlackConfig({
  SLACK_BOT_TOKEN: "xoxb-test",
  SLACK_AIEA_USER_EMAIL: "will@farm.example",
  SLACK_NOTIFY_USER_ID: "UWILL",
} as unknown as NodeJS.ProcessEnv);
assert.equal(aieaEmailForSlackUser(single!, "UWILL"), "will@farm.example");

// format is per-user (mention + no other emails)
const msg = formatDueTodayForUser({
  slackUserId: "UWILL",
  tasks: [tasks[0]],
  ymd: "2026-09-25",
});
assert.match(msg, /<@UWILL>/);
assert.match(msg, /`a`/);
assert.match(msg, /Only your own AiEA tasks/);

console.log("slack: command + due-today + multi-user map assertions passed");
