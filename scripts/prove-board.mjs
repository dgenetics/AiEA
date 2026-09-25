#!/usr/bin/env node
/**
 * Local end-to-end proof for the single Tasks board.
 *
 * Builds + runs AiEA locally (`next start`) on a FRESH SQLite file, signs in via
 * the real register/login routes, seeds a mix of tasks through the real task
 * routes (plus direct SQL for states the UI can't create: unknown lane, INBOX /
 * PROPOSED status), then asserts against the rendered /tasks HTML:
 *   - set (and count) of open tasks in the DB == top-level cards + nested
 *     subtasks, each task exactly once
 *   - a subtask whose own lane differs from its parent's renders INSIDE the
 *     parent card, in the parent's lane; an orphaned open subtask (parent done)
 *     is its own card in its own lane, labelled "Part of · parent"
 *   - null / unknown lanes render in Backlog; past-due tasks stay in their lane
 *   - done / cancelled / proposed tasks (and done subtasks) are not on the board
 *   - GET /today, /upcoming (+ subpaths) → server redirect to /tasks
 *   - nav has no Today / Upcoming link
 * Exits non-zero on any mismatch. Kills its own server process group on exit.
 *
 *   node scripts/prove-board.mjs [--build]
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AIEA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT ?? "/workspace/tmp/prove-board-output.txt";
const TMP = process.env.PROVE_TMP ?? "/workspace/tmp/prove-board-run";
const PORT = Number(process.env.PROVE_PORT ?? 4401);
const BASE = `http://127.0.0.1:${PORT}`;

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

// Nothing from the shell may point at real services (prod Turso etc.).
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
const DB = path.join(TMP, "aiea.db");
const appEnv = cleanEnv({
  DATABASE_URL: `file:${DB}`,
  AUTH_SECRET: "prove-board-local-auth-secret",
  AIEA_TIMEZONE: "America/New_York",
});

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: AIEA_DIR, env: appEnv, encoding: "utf8" });
  if (r.status !== 0) {
    log(r.stdout, r.stderr);
    throw new Error(`${cmd} ${args.join(" ")} failed`);
  }
  return r.stdout;
}

const appLog = [];
let proc = null;
function startApp() {
  proc = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(PORT)], {
    cwd: AIEA_DIR,
    env: appEnv,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group → cleanup kills next-server too
  });
  const push = (d) => {
    for (const line of d.toString().split("\n")) if (line.trim()) appLog.push(line);
  };
  proc.stdout.on("data", push);
  proc.stderr.on("data", push);
}
async function portInUse() {
  return fetch(`${BASE}/`, { redirect: "manual" }).then(() => true, () => false);
}
async function waitUp() {
  for (let i = 0; i < 120; i++) {
    if (await portInUse()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`app on ${PORT} did not start`);
}

// HTTP client with a cookie jar
const jar = new Map();
async function call(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
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
  return { status: res.status, location: res.headers.get("location"), json, text };
}

const Database = createRequire(path.join(AIEA_DIR, "package.json"))("better-sqlite3");
function q(sql, ...args) {
  const db = new Database(DB, { readonly: true, fileMustExist: true });
  try {
    return db.prepare(sql).all(...args);
  } finally {
    db.close();
  }
}
/** Direct write for data states the UI can't produce (legacy / bad data). */
function w(sql, ...args) {
  const db = new Database(DB, { fileMustExist: true });
  try {
    return db.prepare(sql).run(...args);
  } finally {
    db.close();
  }
}

/**
 * Parse the rendered board by real <div> nesting. Returns lane → top-level
 * cards, plus every task row (top-level or nested) with `nestedIn` = the task
 * card it sits inside (null = its own card). `html` is the row's own head, up
 * to its first nested row, so a parent's text never includes its subtasks'.
 */
function parseBoard(html) {
  const lanes = {};
  const rows = [];
  const re = /<section[^>]*data-lane="([A-Z]+)"[^>]*>([\s\S]*?)<\/section>/g;
  let m;
  while ((m = re.exec(html))) {
    const [, lane, inner] = m;
    lanes[lane] = [];
    const laneRows = [];
    const stack = []; // open <div>s: task row object, or null for plain divs
    const tag = /<div\b[^>]*>|<\/div>/g;
    let t;
    while ((t = tag.exec(inner))) {
      if (t[0] === "</div>") {
        const row = stack.pop();
        if (row) row.end = t.index;
        continue;
      }
      const id = /data-task-id="([^"]+)"/.exec(t[0])?.[1];
      if (!id) {
        stack.push(null);
        continue;
      }
      const parent = [...stack].reverse().find(Boolean) ?? null;
      const row = { id, lane, nestedIn: parent?.id ?? null, subtasks: [], start: t.index, end: inner.length };
      stack.push(row);
      laneRows.push(row);
      if (parent) parent.subtasks.push(row);
      else lanes[lane].push(row);
    }
    laneRows.forEach((r, i) => {
      r.html = inner.slice(r.start, Math.min(r.end, laneRows[i + 1]?.start ?? r.end));
    });
    rows.push(...laneRows);
  }
  return { lanes, rows };
}

const DAY = 86400_000;

async function main() {
  log(`# prove-board ${new Date().toISOString()}`);
  const sha = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: AIEA_DIR, encoding: "utf8" }).stdout.trim();
  const dirty = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: AIEA_DIR, encoding: "utf8" }).stdout.trim();
  log(`AiEA: ${AIEA_DIR} @ ${sha}${dirty ? " (+ uncommitted changes)" : ""}`);
  log(`DB: fresh SQLite ${DB} (no Turso / prod env)`);

  log("\n## unit: laneOf (npm run test:board)");
  log("  " + run("npm", ["run", "-s", "test:board"]).trim());

  if (process.argv.includes("--build")) {
    log("building…");
    run("npm", ["run", "build"]);
  }
  log("creating fresh local SQLite schema (prisma db push)…");
  run("npx", ["prisma", "db", "push"]);
  if (await portInUse()) throw new Error(`port ${PORT} already in use (stale server?)`);
  startApp();
  await waitUp();
  log(`app up: ${BASE}`);

  log("\n## sign in (real routes)");
  const email = `prove-board-${Date.now()}@example.test`;
  const password = "prove-board-password-1";
  let r = await call("POST", "/api/auth/register", { name: "Prove Board", email, password });
  check(r.status === 200, `POST /api/auth/register → ${r.status}`);
  jar.clear();
  r = await call("POST", "/api/auth/login", { email, password });
  check(r.status === 200 && jar.size > 0, `POST /api/auth/login → ${r.status} (session cookie set)`);

  log("\n## seed (POST /api/tasks + PATCH /api/tasks/:id; SQL only for non-UI states)");
  const now = Date.now();
  const seeded = {};
  async function create(key, body) {
    const res = await call("POST", "/api/tasks", body);
    if (res.status !== 200 || !res.json?.task?.id) throw new Error(`create ${key} → ${res.status} ${res.text.slice(0, 200)}`);
    seeded[key] = res.json.task.id;
    return res.json.task.id;
  }
  async function act(key, action) {
    const res = await call("PATCH", `/api/tasks/${seeded[key]}`, { action });
    if (res.status !== 200) throw new Error(`${action} ${key} → ${res.status} ${res.text.slice(0, 200)}`);
  }
  await create("currentFuture", { title: "Current, due in 3 days", board: "CURRENT", dueAt: new Date(now + 3 * DAY).toISOString() });
  await create("currentPastDue", { title: "Current, 10 days overdue", board: "CURRENT", dueAt: new Date(now - 10 * DAY).toISOString() });
  await create("backlogUndated", { title: "Backlog, undated", board: "BACKLOG" });
  await create("iceboxPastDue", { title: "Icebox, 30 days overdue", board: "ICEBOX", dueAt: new Date(now - 30 * DAY).toISOString() });
  await create("unknownLane", { title: "Unknown lane value (legacy priority 1)", board: "CURRENT" });
  await create("nullLane", { title: "Null / missing lane", board: "CURRENT" });
  await create("snoozed", { title: "Snoozed (still open)", board: "CURRENT" });
  await create("inboxStatus", { title: "INBOX-status task", board: "ICEBOX" });
  await create("subtask", { title: "Subtask of the past-due Current task (own lane Icebox)", board: "ICEBOX", parentId: seeded.currentPastDue });
  await create("doneSubtask", { title: "Done subtask (must not show)", board: "CURRENT", parentId: seeded.currentFuture });
  await create("orphanParent", { title: "Done parent of an orphan (must not show)", board: "CURRENT" });
  await create("orphanSubtask", { title: "Orphaned subtask (parent done, own lane Icebox)", board: "ICEBOX", parentId: seeded.orphanParent });
  await create("done1", { title: "Done #1 (must not show)", board: "CURRENT", dueAt: new Date(now - 2 * DAY).toISOString() });
  await create("done2", { title: "Done #2 (must not show)", board: "BACKLOG" });
  await create("cancelled", { title: "Cancelled (must not show)", board: "BACKLOG" });
  await create("proposed", { title: "PROPOSED capture item (Inbox triage)", board: "BACKLOG" });
  await act("snoozed", "snooze");
  await act("done1", "complete");
  await act("done2", "complete");
  await act("doneSubtask", "complete");
  await act("orphanParent", "complete");
  await act("cancelled", "cancel");

  // Legacy / bad data the UI can't produce
  w(`UPDATE "Task" SET board = 'SOMEDAY', priority = 1 WHERE id = ?`, seeded.unknownLane);
  let nullErr = null;
  try {
    w(`UPDATE "Task" SET board = NULL WHERE id = ?`, seeded.nullLane);
  } catch (e) {
    nullErr = e.message;
  }
  log(`  null lane: SQL SET board = NULL → ${nullErr ? `rejected by schema (${nullErr})` : "stored"}`);
  if (nullErr) {
    // Column is NOT NULL DEFAULT 'BACKLOG' (migration 20260902120000), so a
    // real NULL can't exist in the DB. Store the closest "missing" value; the
    // literal null/undefined path is covered by the laneOf unit test above.
    w(`UPDATE "Task" SET board = '' WHERE id = ?`, seeded.nullLane);
  }
  w(`UPDATE "Task" SET status = 'INBOX' WHERE id = ?`, seeded.inboxStatus);
  w(`UPDATE "Task" SET status = 'PROPOSED' WHERE id = ?`, seeded.proposed);

  const workspaceId = q(`SELECT workspaceId FROM "Task" WHERE id = ?`, seeded.currentFuture)[0].workspaceId;
  const rows = q(
    `SELECT id, title, status, kind, board, priority, dueAt, parentId FROM "Task" WHERE workspaceId = ? ORDER BY createdAt`,
    workspaceId,
  );
  log("  DB rows (direct read):");
  for (const t of rows) {
    log(`    ${t.id} status=${t.status} board=${JSON.stringify(t.board)} prio=${t.priority} due=${t.dueAt ? new Date(Number(t.dueAt) || t.dueAt).toISOString().slice(0, 10) : "-"} ${t.parentId ? "(subtask) " : ""}"${t.title}"`);
  }

  log("\n## board page GET /tasks (the UI read path)");
  r = await call("GET", "/tasks");
  check(r.status === 200, `GET /tasks → ${r.status}`);
  const { lanes: board, rows: rendered } = parseBoard(r.text);
  const titleOf = (id) => rows.find((t) => t.id === id)?.title ?? "?";
  function logCard(c, depth) {
    const due = /(\d+d overdue|Yesterday|Today|Tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun|[A-Z][a-z]{2} \d{1,2})<\/span>/.exec(c.html)?.[1];
    log(`${"  ".repeat(depth + 2)}${depth ? "↳ nested" : "-"} ${c.id} "${titleOf(c.id)}"${due ? ` [due: ${due}]` : ""}`);
    for (const s of c.subtasks) logCard(s, depth + 1);
  }
  for (const [lane, cards] of Object.entries(board)) {
    log(`  ${lane}: ${cards.length} card(s), ${rendered.filter((x) => x.lane === lane && x.nestedIn).length} nested subtask(s)`);
    for (const c of cards) logCard(c, 0);
  }
  const shown = new Map(rendered.map((x) => [x.id, x]));
  const dupes = rendered.filter((x, i) => rendered.findIndex((y) => y.id === x.id) !== i).map((x) => x.id);
  check(dupes.length === 0, `each task renders exactly once (duplicates: ${dupes.length ? dupes.join(", ") : "none"})`);
  const topCount = rendered.filter((x) => !x.nestedIn).length;
  const nestedCount = rendered.length - topCount;
  check(
    JSON.stringify(Object.keys(board)) === JSON.stringify(["CURRENT", "BACKLOG", "ICEBOX"]),
    `columns in order Current | Backlog | Icebox (got ${Object.keys(board).join(", ")})`,
  );

  const allNotDone = q(`SELECT id, status, kind FROM "Task" WHERE workspaceId = ? AND status <> 'DONE'`, workspaceId);
  const openDb = q(
    `SELECT id FROM "Task" WHERE workspaceId = ? AND kind = 'ONE_TIME' AND status IN ('ACTIVE','INBOX','SNOOZED')`,
    workspaceId,
  ).map((t) => t.id);
  log(
    `  DB: ${allNotDone.length} rows not DONE (${Object.entries(
      allNotDone.reduce((a, t) => ((a[t.status] = (a[t.status] ?? 0) + 1), a), {}),
    )
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}); open tasks (ACTIVE/INBOX/SNOOZED, one-time) = ${openDb.length}`,
  );
  check(
    openDb.length === rendered.length,
    `count: DB open tasks ${openDb.length} == top-level cards ${topCount} + nested subtasks ${nestedCount}`,
  );
  const missing = openDb.filter((id) => !shown.has(id));
  const extra = [...shown.keys()].filter((id) => !openDb.includes(id));
  check(missing.length === 0 && extra.length === 0, `set: open DB tasks == top-level cards ∪ nested subtasks (missing=${missing.length}, extra=${extra.length})`);

  // [lane, nested inside which card (null = its own top-level card)]
  const expectPlace = {
    currentFuture: ["CURRENT", null],
    currentPastDue: ["CURRENT", null],
    backlogUndated: ["BACKLOG", null],
    iceboxPastDue: ["ICEBOX", null],
    unknownLane: ["BACKLOG", null],
    nullLane: ["BACKLOG", null],
    snoozed: ["CURRENT", null],
    inboxStatus: ["ICEBOX", null],
    subtask: ["CURRENT", "currentPastDue"],
    orphanSubtask: ["ICEBOX", null],
  };
  for (const [key, [lane, parentKey]] of Object.entries(expectPlace)) {
    const x = shown.get(seeded[key]);
    const where = x ? `${x.lane}${x.nestedIn ? ` inside ${x.nestedIn}` : " as own card"}` : "not rendered";
    check(
      x?.lane === lane && x?.nestedIn === (parentKey ? seeded[parentKey] : null),
      `${key} renders ${parentKey ? `inside the ${parentKey} card` : "as its own card"} in ${lane} (got ${where})`,
    );
  }
  for (const key of ["done1", "done2", "cancelled", "proposed", "doneSubtask", "orphanParent"]) {
    check(!shown.has(seeded[key]), `${key} is NOT on the board`);
  }
  const dbBoard = (key) => rows.find((t) => t.id === seeded[key])?.board;
  check(
    dbBoard("subtask") === "ICEBOX" && dbBoard("currentPastDue") === "CURRENT" && shown.get(seeded.subtask)?.lane === "CURRENT",
    `nested subtask's own lane (${dbBoard("subtask")}) differs from its parent's (${dbBoard("currentPastDue")}); it follows the parent into ${shown.get(seeded.subtask)?.lane}`,
  );
  check(
    rows.find((t) => t.id === seeded.orphanParent)?.status === "DONE" && dbBoard("orphanSubtask") === shown.get(seeded.orphanSubtask)?.lane,
    `orphaned subtask (parent DONE) is its own card in its own lane (${dbBoard("orphanSubtask")})`,
  );
  const rowHtml = (key) => shown.get(seeded[key])?.html ?? "";
  check(/\d+d overdue/.test(rowHtml("currentPastDue")), "past-due Current card shows its due date (\"Nd overdue\") and stays in Current");
  check(/\d+d overdue/.test(rowHtml("iceboxPastDue")), "past-due Icebox card shows its due date and stays in Icebox");
  check(/Part of · /.test(rowHtml("orphanSubtask")), "orphaned subtask card is labelled \"Part of · <parent>\"");
  check(!/Part of · /.test(rowHtml("subtask")), "nested subtask has no \"Part of\" label (it is inside the parent card)");

  log("\n## other read paths");
  r = await call("GET", "/api/tasks?view=board");
  const apiIds = (r.json?.tasks ?? []).map((t) => t.id);
  check(r.status === 200 && apiIds.length === openDb.length && openDb.every((id) => apiIds.includes(id)), `GET /api/tasks?view=board → ${r.status}, ${apiIds.length} tasks == DB open set`);
  r = await call("GET", "/api/tasks");
  check(r.status === 200 && (r.json?.tasks ?? []).length === openDb.length, `GET /api/tasks (default view) → ${r.status}, ${(r.json?.tasks ?? []).length} tasks (board list, no due window)`);
  r = await call("GET", "/api/tasks?view=archive&kind=all&limit=40&offset=0");
  const archIds = (r.json?.tasks ?? []).map((t) => t.id);
  check(r.status === 200 && archIds.includes(seeded.done1) && archIds.includes(seeded.done2), `GET /api/tasks?view=archive → ${r.status}; done tasks are in Archive`);
  r = await call("GET", "/inbox");
  check(r.status === 200 && r.text.includes("PROPOSED capture item"), `GET /inbox → ${r.status}; PROPOSED item is in Inbox`);

  log("\n## redirects (server, no JS)");
  for (const p of ["/today", "/today?lane=backlog", "/today/anything", "/upcoming", "/upcoming/x/y"]) {
    r = await call("GET", p);
    const loc = r.location ? new URL(r.location, BASE).pathname : null;
    check([307, 308].includes(r.status) && loc === "/tasks", `GET ${p} → ${r.status} Location: ${r.location}`);
  }
  r = await call("GET", "/");
  check([307, 308].includes(r.status) && new URL(r.location ?? "/", BASE).pathname === "/tasks", `GET / (signed in) → ${r.status} Location: ${r.location}`);

  log("\n## nav");
  r = await call("GET", "/tasks");
  const navHrefs = [...new Set([...r.text.matchAll(/<a[^>]*href="(\/[a-z]*)"/g)].map((m) => m[1]))];
  log(`  nav/link hrefs on /tasks: ${navHrefs.join(" ")}`);
  check(!navHrefs.includes("/today") && !navHrefs.includes("/upcoming"), "no link to /today or /upcoming");
  check(!/<a[^>]*>(?:(?!<\/a>)[\s\S])*>(Today|Upcoming)<\/span>/.test(r.text), "no nav link labelled Today or Upcoming");
  check(navHrefs.includes("/tasks") && />Tasks<\/span>/.test(r.text), "nav has a Tasks link");

  log(`\n## result: ${failures.length === 0 ? "ALL CHECKS PASSED" : `${failures.length} FAILED`}`);
  for (const f of failures) log(`  - ${f}`);
  return failures.length === 0;
}

let ok = false;
try {
  ok = await main();
} catch (e) {
  log(`ERROR: ${e?.stack ?? e}`);
  log("--- app log tail ---\n" + appLog.slice(-40).join("\n"));
} finally {
  if (proc) {
    try {
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      proc.kill("SIGTERM");
    }
  }
  await new Promise((r) => outStream.end(r));
  process.exit(ok ? 0 : 1);
}
