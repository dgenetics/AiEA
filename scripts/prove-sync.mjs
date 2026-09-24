#!/usr/bin/env node
/**
 * End-to-end proof of AiEA <-> BF Maintenance complete/reopen sync, fully local.
 *
 * Runs both apps (`next start`, already built at the branch tips) against fresh
 * local SQLite files, with peer URLs pointing at each other through a logging
 * proxy (records every cross-app call: path, status, bypass header, body).
 * Drives the same user-facing routes the UI calls, with real login sessions.
 * Never touches Turso, previews or prod: all TURSO_/VERCEL_/app env is stripped.
 *
 *   BF_DIR=../bf-maintenance-bf-sync node scripts/prove-sync.mjs [--build]
 *
 * Exits non-zero on any mismatch. Output is also written to $OUT
 * (default /workspace/tmp/prove-sync-output.txt).
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AIEA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BF_DIR = path.resolve(process.env.BF_DIR ?? path.join(AIEA_DIR, "../bf-maintenance-bf-sync"));
const OUT = process.env.OUT ?? "/workspace/tmp/prove-sync-output.txt";
const TMP = process.env.PROVE_TMP ?? "/workspace/tmp/prove-sync-run";
const PORTS = { aiea: 4301, bf: 4302, toBf: 4311, toAiea: 4312 };
const SECRET = "prove-sync-local-integration-secret";
const BYPASS = { toBf: "local-bypass-aiea-to-bf", toAiea: "local-bypass-bf-to-aiea" };
const NOTICE_AIEA = "Couldn't sync to BF Maintenance — try again.";
const NOTICE_BF = "Couldn't sync to AiEA — try again.";

fs.mkdirSync(path.dirname(OUT), { recursive: true });
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

// --- env hygiene: nothing from the shell may point at real services ---------
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^(TURSO_|AIEA_|BF_|DATABASE_URL|VERCEL|XAI_|CRON_SECRET|AUTH_SECRET|NEXT_PUBLIC_)/.test(k)) continue;
    env[k] = v;
  }
  return { ...env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", ...extra };
}

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
const AIEA_DB = path.join(TMP, "aiea.db");
const BF_DB = path.join(TMP, "bf.db");

const aieaEnv = cleanEnv({
  DATABASE_URL: `file:${AIEA_DB}`,
  BF_MAINTENANCE_URL: `http://127.0.0.1:${PORTS.toBf}`,
  BF_INTEGRATION_SECRET: SECRET,
  BF_MAINTENANCE_PROTECTION_BYPASS: BYPASS.toBf,
});
const bfEnv = cleanEnv({
  DATABASE_URL: `file:${BF_DB}`,
  AIEA_DATABASE_URL: `file:${AIEA_DB}`,
  AIEA_URL: `http://127.0.0.1:${PORTS.toAiea}`,
  BF_INTEGRATION_SECRET: SECRET,
  BF_SESSION_SECRET: "prove-sync-local-session-secret",
  AIEA_PROTECTION_BYPASS: BYPASS.toAiea,
});

function run(cmd, args, cwd, env) {
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8" });
  if (r.status !== 0) {
    log(r.stdout, r.stderr);
    throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}`);
  }
}

// --- logging proxy between the apps ----------------------------------------
const crossCalls = [];
function proxy(name, listen, target, bypassExpected) {
  const state = { mode: "pass" };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const headers = { ...req.headers, host: `127.0.0.1:${target}` };
      if (state.mode === "wrong-secret") headers.authorization = "Bearer wrong-secret";
      const up = http.request(
        { host: "127.0.0.1", port: target, method: req.method, path: req.url, headers },
        (ur) => {
          const rc = [];
          ur.on("data", (c) => rc.push(c));
          ur.on("end", () => {
            const body = Buffer.concat(rc);
            crossCalls.push({
              name,
              t: new Date().toISOString(),
              method: req.method,
              path: req.url,
              status: ur.statusCode,
              bypassHeader:
                req.headers["x-vercel-protection-bypass"] === bypassExpected ? "present" : "MISSING",
              mode: state.mode,
              body: body.toString("utf8").slice(0, 200),
            });
            res.writeHead(ur.statusCode, ur.headers);
            res.end(body);
          });
        },
      );
      up.on("error", (e) => {
        crossCalls.push({ name, method: req.method, path: req.url, status: 502, error: e.message });
        res.writeHead(502).end();
      });
      up.end(Buffer.concat(chunks));
    });
  });
  server.listen(listen, "127.0.0.1");
  return { state, server };
}

// --- app processes ---------------------------------------------------------
const appLogs = { aiea: [], bf: [] };
const procs = [];
function startApp(name, dir, port, env) {
  const p = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: dir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const push = (d) => {
    for (const line of d.toString().split("\n")) if (line.trim()) appLogs[name].push(line);
  };
  p.stdout.on("data", push);
  p.stderr.on("data", push);
  procs.push(p);
}
async function waitUp(port) {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`app on ${port} did not start`);
}

// --- HTTP client with a cookie jar per app ---------------------------------
function client(port) {
  const jar = new Map();
  return async function call(method, p, body) {
    const res = await fetch(`http://127.0.0.1:${port}${p}`, {
      method,
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* html */
    }
    return { status: res.status, json, text };
  };
}

// --- DB readers (read-only, straight from the SQLite files) ----------------
const Database = createRequire(path.join(AIEA_DIR, "package.json"))("better-sqlite3");
function q(file, sql, ...args) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return db.prepare(sql).all(...args);
  } finally {
    db.close();
  }
}

async function main() {
  log(`# prove-sync ${new Date().toISOString()}`);
  for (const [n, d] of [["AiEA", AIEA_DIR], ["BF", BF_DIR]]) {
    const sha = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: d, encoding: "utf8" }).stdout.trim();
    const dirty = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: d, encoding: "utf8" }).stdout.trim();
    log(`${n}: ${d} @ ${sha}${dirty ? " (+ uncommitted changes)" : ""}`);
  }

  if (process.argv.includes("--build")) {
    log("building both apps…");
    run("npm", ["run", "build"], AIEA_DIR, aieaEnv);
    run("npm", ["run", "build"], BF_DIR, bfEnv);
  }
  log("creating fresh local SQLite schemas…");
  run("npx", ["prisma", "db", "push"], AIEA_DIR, aieaEnv);
  run("npx", ["prisma", "db", "push"], BF_DIR, bfEnv);

  const toBf = proxy("AiEA->BF", PORTS.toBf, PORTS.bf, BYPASS.toBf);
  const toAiea = proxy("BF->AiEA", PORTS.toAiea, PORTS.aiea, BYPASS.toAiea);
  startApp("aiea", AIEA_DIR, PORTS.aiea, aieaEnv);
  startApp("bf", BF_DIR, PORTS.bf, bfEnv);
  await Promise.all([waitUp(PORTS.aiea), waitUp(PORTS.bf)]);
  log(`apps up: AiEA :${PORTS.aiea}, BF :${PORTS.bf} (peers via proxies :${PORTS.toBf} / :${PORTS.toAiea})`);

  const aiea = client(PORTS.aiea);
  const bf = client(PORTS.bf);
  const email = `prove-sync-${Date.now()}@example.test`;
  const password = "prove-sync-password-1";
  const tag = Math.random().toString(36).slice(2, 8);

  log("\n## seed (real routes)");
  let r = await aiea("POST", "/api/auth/register", { name: "Prove Sync", email, password });
  check(r.status === 200, `AiEA register → ${r.status}`);
  r = await aiea("POST", "/api/auth/login", { email, password });
  check(r.status === 200, `AiEA login (real route) → ${r.status}`);
  r = await bf("POST", "/api/auth/login", { email, password });
  check(r.status === 200, `BF login (real route, AiEA identity) → ${r.status}`);

  r = await bf("POST", "/api/systems", { name: `Prove Energy ${tag}` });
  const systemId = r.json?.id;
  check(r.status === 201 && systemId, `BF create system → ${r.status}`);
  r = await bf("POST", `/api/systems/${systemId}/components`, { name: "Prove Panels" });
  const componentId = r.json?.id;
  check(r.status === 201 && componentId, `BF create component → ${r.status}`);
  const due = new Date(Date.now() + 3 * 86400_000);
  const scheduleName = `Prove clean panels ${tag}`;
  r = await bf("POST", "/api/schedules", {
    componentId,
    name: scheduleName,
    nextDueDate: due.toISOString(),
    frequency: "90d",
    intervalDays: 90,
    isRecurring: true,
  });
  const scheduleId = r.json?.id;
  check(r.status === 201 && scheduleId, `BF create schedule → ${r.status}`);
  r = await bf("GET", "/api/tasks/suggest?all=1");
  check(r.status === 200, `BF Chores materialize (GET /api/tasks/suggest?all=1) → ${r.status}`);
  const bfTask = q(BF_DB, "select id from MaintenanceTask where scheduleId = ?", scheduleId)[0];
  check(Boolean(bfTask), "BF open task materialized for schedule");
  const bfTaskId = bfTask.id;

  r = await aiea("GET", "/api/integrations/bf-maintenance/pull");
  check(r.status === 200, `AiEA Pull (GET /api/integrations/bf-maintenance/pull) → ${r.status}`);
  const sug = (r.json?.suggestions ?? []).find((s) => s.externalId === `bf-task:${bfTaskId}`);
  check(Boolean(sug), "Pull returned the BF task as a suggestion");
  r = await aiea("POST", "/api/integrations/bf-maintenance/import", { suggestions: [sug], asStatus: "ACTIVE" });
  check(r.status === 200, `AiEA Import → ${r.status}`);
  const aieaTask = q(AIEA_DB, "select id, title from Task where externalId = ?", `bf-task:${bfTaskId}`)[0];
  check(Boolean(aieaTask), `AiEA task linked to bf-task:${bfTaskId}`);
  const aieaTaskId = aieaTask.id;
  log(`linked pair: AiEA ${aieaTaskId} <-> BF ${bfTaskId} (schedule ${scheduleId}, "${aieaTask.title}")`);

  async function snapshot(label) {
    const aRow = q(AIEA_DB, "select id, status, completedAt from Task where id = ?", aieaTaskId)[0];
    const upcoming = await aiea("GET", "/api/tasks?view=upcoming");
    const archive = await aiea("GET", "/api/tasks?view=archive");
    const upcomingPage = await aiea("GET", "/upcoming");
    const bRows = q(
      BF_DB,
      "select id, status, dueDate, completedAt, createdAt, updatedAt from MaintenanceTask where scheduleId = ? order by createdAt",
      scheduleId,
    );
    const sched = q(BF_DB, "select nextDueDate, lastCompletedAt from MaintenanceSchedule where id = ?", scheduleId)[0];
    const bfOpen = await bf("GET", "/api/tasks?open=1");
    const bfDone = await bf("GET", "/api/tasks?status=COMPLETED");
    const s = {
      aieaDb: aRow,
      aieaUi: {
        inUpcomingApi: (upcoming.json?.tasks ?? []).some((t) => t.id === aieaTaskId),
        inArchiveApi: (archive.json?.tasks ?? []).some((t) => t.id === aieaTaskId),
        inUpcomingPageHtml: upcomingPage.text.includes(aieaTaskId),
      },
      bfDb: bRows,
      bfSchedule: sched,
      bfUi: {
        open: (bfOpen.json ?? []).filter((t) => t.scheduleId === scheduleId).map((t) => `${t.id}:${t.status}`),
        completed: (bfDone.json ?? []).filter((t) => t.scheduleId === scheduleId).map((t) => `${t.id}:${t.status}`),
      },
    };
    log(`  [${label}] AiEA db: ${JSON.stringify(s.aieaDb)}`);
    log(`  [${label}] AiEA UI read paths: ${JSON.stringify(s.aieaUi)}`);
    log(`  [${label}] BF db tasks: ${JSON.stringify(s.bfDb)}`);
    log(`  [${label}] BF db schedule: ${JSON.stringify(s.bfSchedule)}`);
    log(`  [${label}] BF UI read paths: ${JSON.stringify(s.bfUi)}`);
    return s;
  }
  function callsSince(n) {
    const c = crossCalls.slice(n);
    for (const x of c) log(`  cross-app: ${JSON.stringify(x)}`);
    return c;
  }
  const isOpen = (st) => ["PENDING", "DUE_SOON", "OVERDUE"].includes(st);

  // a) Complete in AiEA
  log("\n## a) complete in AiEA → BF completed + next spawned");
  await snapshot("before");
  let n = crossCalls.length;
  r = await aiea("PATCH", `/api/tasks/${aieaTaskId}`, { action: "complete" });
  log(`  user call: PATCH AiEA /api/tasks/${aieaTaskId} {action:complete} → ${r.status} bfSyncError=${JSON.stringify(r.json?.bfSyncError)}`);
  let c = callsSince(n);
  let s = await snapshot("after");
  check(r.status === 200 && r.json?.bfSyncError == null, "AiEA complete 200, no sync error");
  check(c.some((x) => x.path === "/api/integrations/tasks/complete" && x.status === 200 && x.bypassHeader === "present"), "AiEA→BF /api/integrations/tasks/complete 200 with x-vercel-protection-bypass");
  check(s.aieaDb.status === "DONE" && !s.aieaUi.inUpcomingApi && s.aieaUi.inArchiveApi && !s.aieaUi.inUpcomingPageHtml, "AiEA DONE in DB and UI read paths");
  const orig = s.bfDb.find((t) => t.id === bfTaskId);
  const spawned = s.bfDb.filter((t) => t.id !== bfTaskId && isOpen(t.status));
  check(orig?.status === "COMPLETED", "BF linked task COMPLETED (DB)");
  check(spawned.length === 1, "BF spawned exactly one next occurrence (DB)");
  check(s.bfUi.completed.some((x) => x.startsWith(bfTaskId)) && s.bfUi.open.length === 1, "BF UI lists: linked in completed, spawned in open");

  // b) Reopen in AiEA
  log("\n## b) reopen in AiEA → BF open again + spawned next deleted");
  n = crossCalls.length;
  r = await aiea("PATCH", `/api/tasks/${aieaTaskId}`, { action: "reopen" });
  log(`  user call: PATCH AiEA /api/tasks/${aieaTaskId} {action:reopen} → ${r.status} bfSyncError=${JSON.stringify(r.json?.bfSyncError)}`);
  c = callsSince(n);
  s = await snapshot("after");
  check(r.status === 200 && r.json?.bfSyncError == null, "AiEA reopen 200, no sync error");
  check(c.some((x) => x.path === "/api/integrations/tasks/reopen" && x.status === 200 && x.bypassHeader === "present"), "AiEA→BF /api/integrations/tasks/reopen 200 with bypass header");
  check(s.aieaDb.status === "ACTIVE" && s.aieaUi.inUpcomingApi && s.aieaUi.inUpcomingPageHtml, "AiEA ACTIVE in DB and UI read paths");
  check(s.bfDb.length === 1 && s.bfDb[0].id === bfTaskId && isOpen(s.bfDb[0].status), "BF linked task open, spawned next deleted (DB)");
  check(s.bfUi.open.length === 1 && s.bfUi.open[0].startsWith(bfTaskId) && s.bfUi.completed.length === 0, "BF UI lists: linked open, nothing completed");

  // c) Complete in BF
  log("\n## c) complete in BF → AiEA completed");
  n = crossCalls.length;
  r = await bf("PATCH", `/api/tasks/${bfTaskId}`, { status: "COMPLETED" });
  log(`  user call: PATCH BF /api/tasks/${bfTaskId} {status:COMPLETED} → ${r.status} aieaSyncError=${JSON.stringify(r.json?.aieaSyncError)}`);
  c = callsSince(n);
  s = await snapshot("after");
  check(r.status === 200 && r.json?.aieaSyncError == null, "BF complete 200, no sync error");
  check(c.some((x) => x.path === "/api/integrations/bf-maintenance/complete" && x.status === 200 && x.bypassHeader === "present"), "BF→AiEA /api/integrations/bf-maintenance/complete 200 with bypass header");
  check(s.aieaDb.status === "DONE" && !s.aieaUi.inUpcomingApi && s.aieaUi.inArchiveApi && !s.aieaUi.inUpcomingPageHtml, "AiEA DONE in DB and UI read paths");
  check(s.bfDb.find((t) => t.id === bfTaskId)?.status === "COMPLETED" && s.bfUi.open.length === 1, "BF linked COMPLETED + next spawned");

  // d) Reopen in BF
  log("\n## d) reopen in BF → AiEA open");
  n = crossCalls.length;
  r = await bf("PATCH", `/api/tasks/${bfTaskId}`, { status: "PENDING", reopen: true });
  log(`  user call: PATCH BF /api/tasks/${bfTaskId} {status:PENDING,reopen:true} → ${r.status} aieaSyncError=${JSON.stringify(r.json?.aieaSyncError)}`);
  c = callsSince(n);
  s = await snapshot("after");
  check(r.status === 200 && r.json?.aieaSyncError == null, "BF reopen 200, no sync error");
  check(c.some((x) => x.path === "/api/integrations/bf-maintenance/reopen" && x.status === 200 && x.bypassHeader === "present"), "BF→AiEA /api/integrations/bf-maintenance/reopen 200 with bypass header");
  check(s.aieaDb.status === "ACTIVE" && s.aieaUi.inUpcomingApi && s.aieaUi.inUpcomingPageHtml, "AiEA ACTIVE in DB and UI read paths");
  check(s.bfDb.length === 1 && isOpen(s.bfDb[0].status), "BF linked open, spawned next deleted");

  // e) Failure: wrong secret on each direction
  log("\n## e) failure: AiEA→BF call rejected (wrong secret) → user sees sync error");
  toBf.state.mode = "wrong-secret";
  n = crossCalls.length;
  const logMark = appLogs.aiea.length;
  r = await aiea("PATCH", `/api/tasks/${aieaTaskId}`, { action: "complete" });
  log(`  user call: PATCH AiEA complete → ${r.status} bfSyncError=${JSON.stringify(r.json?.bfSyncError)}`);
  c = callsSince(n);
  await new Promise((res) => setTimeout(res, 300));
  const aLog = appLogs.aiea.slice(logMark).filter((l) => /sync failed/.test(l));
  for (const l of aLog) log(`  AiEA server log: ${l}`);
  check(r.status === 200 && r.json?.bfSyncError === NOTICE_AIEA, "AiEA response carries the notice text the UI shows");
  check(c.some((x) => x.status === 401), "cross-app call returned 401");
  check(aLog.some((l) => l.includes("401") && l.includes("Unauthorized")), "AiEA logged status + body of the failed sync");
  toBf.state.mode = "pass";
  await aiea("PATCH", `/api/tasks/${aieaTaskId}`, { action: "reopen" });

  log("\n## e2) failure: BF→AiEA call rejected (wrong secret) → user sees sync error");
  toAiea.state.mode = "wrong-secret";
  n = crossCalls.length;
  const bfMark = appLogs.bf.length;
  r = await bf("PATCH", `/api/tasks/${bfTaskId}`, { status: "COMPLETED" });
  log(`  user call: PATCH BF complete → ${r.status} aieaSyncError=${JSON.stringify(r.json?.aieaSyncError)}`);
  c = callsSince(n);
  await new Promise((res) => setTimeout(res, 300));
  const bLog = appLogs.bf.slice(bfMark).filter((l) => /sync failed/.test(l));
  for (const l of bLog) log(`  BF server log: ${l}`);
  check(r.status === 200 && r.json?.aieaSyncError === NOTICE_BF, "BF response carries the notice text the UI shows");
  check(c.some((x) => x.status === 401), "cross-app call returned 401");
  check(bLog.some((l) => l.includes("401") && l.includes("Unauthorized")), "BF logged status + body of the failed sync");
  toAiea.state.mode = "pass";

  log(`\n## result: ${failures.length === 0 ? "ALL CHECKS PASSED" : `${failures.length} FAILED`}`);
  for (const f of failures) log(`  - ${f}`);
  return failures.length === 0;
}

let ok = false;
try {
  ok = await main();
} catch (e) {
  log(`ERROR: ${e?.stack ?? e}`);
  log("--- AiEA app log tail ---\n" + appLogs.aiea.slice(-30).join("\n"));
  log("--- BF app log tail ---\n" + appLogs.bf.slice(-30).join("\n"));
} finally {
  for (const p of procs) p.kill("SIGTERM");
  await new Promise((r) => outStream.end(r));
  process.exit(ok ? 0 : 1);
}
