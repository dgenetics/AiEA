#!/usr/bin/env node
/**
 * Local proof for Slack due-today + done/snooze (mocked Slack Web API).
 * Fresh SQLite, real prisma mutations, no live Slack / prod DB.
 *
 *   node scripts/prove-slack.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AIEA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT ?? "/workspace/tmp/prove-slack-output.txt";
const TMP = process.env.PROVE_TMP ?? "/workspace/tmp/prove-slack-run";
const DB = path.join(TMP, "aiea.db");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const outStream = fs.createWriteStream(OUT);
function log(...a) {
  const line = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(line);
  outStream.write(line + "\n");
}
const failures = [];
function check(cond, label) {
  log(`${cond ? "  PASS" : "  FAIL"} ${label}`);
  if (!cond) failures.push(label);
}

function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^(TURSO_|AIEA_|BF_|DATABASE_URL|VERCEL|XAI_|CRON_SECRET|AUTH_SECRET|NEXT_PUBLIC_|SLACK_)/.test(k)) continue;
    env[k] = v;
  }
  return { ...env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", ...extra };
}

const appEnv = cleanEnv({
  DATABASE_URL: `file:${DB}`,
  AUTH_SECRET: "prove-slack-local-auth-secret",
  AIEA_TIMEZONE: "America/New_York",
  SLACK_BOT_TOKEN: "xoxb-prove-fake",
  SLACK_AIEA_CHANNEL: "#aiea",
  SLACK_USER_MAP: JSON.stringify({
    UWILL: "will-prove@example.test",
    UOTHER: "other-prove@example.test",
  }),
});

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: AIEA_DIR, env: appEnv, encoding: "utf8" });
  if (r.status !== 0) {
    log(r.stdout, r.stderr);
    throw new Error(`${cmd} ${args.join(" ")} failed`);
  }
  return r.stdout;
}

async function main() {
  log(`# prove-slack ${new Date().toISOString()}`);
  const sha = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: AIEA_DIR,
    encoding: "utf8",
  }).stdout.trim();
  log(`AiEA: ${AIEA_DIR} @ ${sha}`);
  log(`DB: fresh SQLite ${DB} (mocked Slack — no live API)`);

  log("\n## unit: npm run test:slack");
  log("  " + run("npm", ["run", "-s", "test:slack"]).trim());

  log("\n## schema + generate");
  run("npx", ["prisma", "generate"]);
  run("npx", ["prisma", "db", "push"]);

  const proveJson = path.join(TMP, "result.json");
  log("\n## harness (seed 2 users, mock Slack, mutate)");
  const hr = spawnSync("npx", ["tsx", "scripts/prove-slack-harness.ts"], {
    cwd: AIEA_DIR,
    env: { ...appEnv, PROVE_JSON: proveJson },
    encoding: "utf8",
  });
  if (hr.status !== 0) {
    log(hr.stdout, hr.stderr);
    throw new Error("harness failed");
  }
  const result = JSON.parse(fs.readFileSync(proveJson, "utf8"));

  log("\n## due-today nudges (per-user messages)");
  check(result.nudge.ok === true, `nudge ok (posted=${result.nudge.posted})`);
  check(result.nudge.posted === 2, `two per-user posts (got ${result.nudge.posted})`);
  const texts = result.posts.map((p) => p.text);
  check(
    texts.some((t) => t.includes("<@UWILL>") && t.includes("Will milk tanks") && !t.includes("Other fence")),
    "Will's message mentions Will + his task only",
  );
  check(
    texts.some((t) => t.includes("<@UOTHER>") && t.includes("Other fence") && !t.includes("Will milk")),
    "Other's message mentions Other + their task only",
  );
  check(
    texts.every((t) => !t.includes("Will tomorrow chore")),
    "tomorrow tasks not in due-today lists",
  );

  log("\n## done / snooze / privacy");
  check(result.doneWill.ok === true && result.willDueAfter.status === "DONE", "Will done → task DONE");
  check(
    result.doneCross.ok === false && /your.*workspace|No task matching/i.test(result.doneCross.reply),
    `Will cannot done Other's id (got: ${result.doneCross.reply})`,
  );
  check(
    result.otherDueAfter.status === "SNOOZED" && result.snoozeOther.ok === true,
    "Other snooze 3d → SNOOZED",
  );
  check(
    result.doneAgain.ok === true && /Already done/i.test(result.doneAgain.reply),
    "idempotent done replies Already done",
  );
  check(
    result.unmapped.ok === false && /not linked/i.test(result.unmapped.reply),
    "unmapped Slack user rejected",
  );
  check(result.willLaterAfter.status === "ACTIVE", "Will's tomorrow task untouched");

  log(`\n## result: ${failures.length === 0 ? "ALL CHECKS PASSED" : `${failures.length} FAILED`}`);
  for (const f of failures) log(`  - ${f}`);
  return failures.length === 0;
}

let ok = false;
try {
  ok = await main();
} catch (e) {
  log(`ERROR: ${e?.stack ?? e}`);
} finally {
  await new Promise((r) => outStream.end(r));
  process.exit(ok ? 0 : 1);
}
