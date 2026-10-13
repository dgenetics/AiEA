#!/usr/bin/env node
/**
 * Playwright (system Chrome) driver for AiEA.
 *
 * Usage:
 *   node drive.mjs --feature capture-accept [--base-url URL] [--run-id ID]
 *   node drive.mjs --feature tasks-board ...
 *   node drive.mjs --feature board-lanes ...
 *   node drive.mjs --feature bf-sync ...
 *   node drive.mjs --feature live-smoke ...
 *
 * Env: VERIFY_BASE_URL / SMOKE_BASE_URL / AIEA_BASE_URL,
 *      AIEA_SMOKE_EMAIL + AIEA_SMOKE_PASSWORD (live/post-auth; preferred),
 *      legacy AIEA_EMAIL/AIEA_PASSWORD demoted — migrate to SMOKE names,
 *      VERIFY_RUN_ID
 * Evidence under ../evidence/<run-id>/
 *
 * Feature live-smoke: when smoke secrets absent → clean skip (exit 0 for gate).
 * When both set → login on live base + post-auth home (Tasks board) path.
 */
import { createRequire } from "node:module";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = join(__dirname, "..");
const REPO_ROOT = join(__dirname, "../../../..");
const EVIDENCE_ROOT = join(SKILL_DIR, "evidence");

function loadDotEnv() {
  const envPath = join(REPO_ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function gitShort() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "nogit";
}

function runId() {
  return (
    arg("--run-id", null) ||
    process.env.VERIFY_RUN_ID ||
    `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-${gitShort()}`
  );
}

/** Dedicated smoke login — both required. Never invent; never personal account. */
function loadSmokeCreds() {
  const email = (process.env.AIEA_SMOKE_EMAIL || "").trim();
  const password = (process.env.AIEA_SMOKE_PASSWORD || "").trim();
  if (email && password) {
    return { email, password, source: "smoke" };
  }
  return null;
}

/**
 * Credential resolution for drive features:
 * 1. verify-user.json (local disposable from doctor register)
 * 2. AIEA_SMOKE_EMAIL + AIEA_SMOKE_PASSWORD
 * 3. legacy AIEA_EMAIL + AIEA_PASSWORD (demoted — migrate to SMOKE)
 */
function loadCreds(out) {
  const credPath = join(out, "verify-user.json");
  if (existsSync(credPath)) {
    const d = JSON.parse(readFileSync(credPath, "utf8"));
    if (d.email && d.password) {
      return {
        email: d.email,
        password: d.password,
        source: "verify-user.json",
      };
    }
  }
  const smoke = loadSmokeCreds();
  if (smoke) return smoke;
  const legacyEmail = (process.env.AIEA_EMAIL || "").trim();
  const legacyPass = (process.env.AIEA_PASSWORD || "").trim();
  if (legacyEmail && legacyPass) {
    console.warn(
      "WARN: AIEA_EMAIL/AIEA_PASSWORD demoted — migrate to AIEA_SMOKE_EMAIL/AIEA_SMOKE_PASSWORD (smoke user only; never personal login)",
    );
    return { email: legacyEmail, password: legacyPass, source: "legacy" };
  }
  return null;
}

async function screenshot(page, path) {
  await page.screenshot({ path, fullPage: true });
}

async function ariaDump(page, path) {
  const snap = await page.locator("body").ariaSnapshot();
  writeFileSync(path, snap);
}

/** Login page labels are not htmlFor-associated — use input types + button names. */
async function signIn(page, email, password) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Welcome back" }).waitFor({
    timeout: 20000,
  });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Home is the Tasks board (/tasks). A pre-board live deploy lands on /today.
  await page.waitForURL(HOME_URL, { timeout: 20000 });
  await page.getByRole("heading", { name: "Tasks" }).first().waitFor({
    timeout: 20000,
  });
}

const HOME_URL = /\/(tasks|today)(\?|$)/;
const LANES = ["Current", "Backlog", "Icebox"];

async function ensureSignedIn(page, out) {
  const creds = loadCreds(out);
  if (!creds) {
    throw new Error(
      "No credentials: need verify-user.json (local doctor register) or AIEA_SMOKE_EMAIL+AIEA_SMOKE_PASSWORD — never invent personal login",
    );
  }
  await signIn(page, creds.email, creds.password);
  return creds;
}

async function driveCaptureAccept(page, out) {
  const steps = [];
  await ensureSignedIn(page, out);

  await page.goto("/tasks", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor({ timeout: 20000 });
  const box = page.getByPlaceholder(/Type a task/i);
  await box.waitFor({ timeout: 10000 });
  await screenshot(page, join(out, "capture-empty.png"));
  await ariaDump(page, join(out, "capture-empty.aria.txt"));
  steps.push("tasks: Type a task field visible on the board");

  const marker = `Verify capture ${Date.now()}`;
  const dump = `${marker} call the plumber about the kitchen leak`;
  await box.fill(dump);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText(/Added \d+/).waitFor({ timeout: 60000 });
  await screenshot(page, join(out, "capture-proposed.png"));
  steps.push("add: tasks created immediately (no review step)");

  const body = page.locator("body");
  await body.getByText(/plumber|kitchen leak|Verify capture/i).first().waitFor({ timeout: 20000 });
  steps.push("board: capture content is visible as an active task");
  await screenshot(page, join(out, "capture-accepted-board.png"));
  await ariaDump(page, join(out, "capture-accepted-board.aria.txt"));
  return { steps, status: "pass" };
}

async function driveTasksBoard(page, out) {
  const steps = [];
  await ensureSignedIn(page, out);
  await page.goto("/tasks", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor({
    timeout: 20000,
  });
  const body = await page.locator("body").innerText();
  if (/Internal Server Error|Application error|HTTP 500/i.test(body)) {
    throw new Error("Tasks board shows server error");
  }
  if (/nothing hidden|from schedules/i.test(body)) {
    throw new Error("Tasks board still shows the open-task subheader");
  }
  // Desktop columns (md+) expose the three lane headings; mobile tabs are also in the DOM.
  for (const name of LANES) {
    await page.getByRole("heading", { name, level: 2, exact: true }).waitFor({
      timeout: 10000,
    });
  }
  await page.locator('[data-board-layout="columns"]').waitFor({ state: "attached", timeout: 5000 });
  // Mobile tabs are md:hidden on the default desktop viewport — assert presence, not visibility.
  await page.locator("[data-board-tabs]").waitFor({ state: "attached", timeout: 5000 });
  steps.push("board: Tasks heading + desktop columns + mobile tabs (Current | Backlog | Icebox)");
  for (const name of ["Today", "Upcoming"]) {
    if (await page.getByRole("link", { name, exact: true }).count()) {
      throw new Error(`nav still has a ${name} link`);
    }
  }
  steps.push("nav: no Today / Upcoming links");
  for (const old of ["/today", "/upcoming"]) {
    await page.goto(old, { waitUntil: "networkidle" });
    if (!/\/tasks(\?|$)/.test(new URL(page.url()).pathname + new URL(page.url()).search)) {
      throw new Error(`${old} did not redirect to /tasks (at ${page.url()})`);
    }
  }
  steps.push("redirect: /today and /upcoming land on /tasks");
  await page.getByPlaceholder(/Type a task/i).waitFor({ timeout: 10000 });
  for (const name of ["Systems", "Schedules", "Tasks"]) {
    await page.getByRole("link", { name, exact: true }).first().waitFor({ timeout: 5000 });
  }
  if (await page.getByRole("link", { name: "Inbox", exact: true }).count()) {
    throw new Error("nav still has an Inbox link");
  }
  const archive = page.locator("main").getByRole("link", { name: "Archive", exact: true });
  if ((await archive.count()) < 1) throw new Error("Tasks board is missing the Archive link");
  await archive.first().click();
  await page.getByRole("heading", { name: "Archive", level: 1 }).waitFor({ timeout: 15000 });
  await page.locator("main").getByRole("link", { name: "Tasks", exact: true }).click();
  await page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor({ timeout: 15000 });
  steps.push("archive: Archive opens /tasks/done and Tasks returns to the board");
  await screenshot(page, join(out, "tasks-board.png"));
  await ariaDump(page, join(out, "tasks-board.aria.txt"));
  return { steps, status: "pass" };
}

async function driveBoardLanes(page, out) {
  const steps = [];
  await ensureSignedIn(page, out);
  await page.goto("/tasks", { waitUntil: "networkidle" });
  const marker = `Lane check ${Date.now()}`;
  const dump = `${marker} call plumber asap`;
  await page.getByPlaceholder(/Type a task/i).fill(dump);
  await screenshot(page, join(out, "board-lanes-picker.png"));
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText(/Added \d+/).waitFor({ timeout: 60000 });
  steps.push("capture: asap phrasing parsed without a review picker");

  const current = page.locator('[data-board-layout="columns"] section[data-lane="CURRENT"]');
  await current.waitFor({ timeout: 10000 });
  await current.getByText(/plumber|Lane check/i).first().waitFor({ timeout: 15000 });
  steps.push("board: asap task renders in the Current column");
  await screenshot(page, join(out, "board-lanes-board.png"));
  await ariaDump(page, join(out, "board-lanes-board.aria.txt"));
  return { steps, status: "pass" };
}

async function driveBfSync(page, out) {
  const steps = [];
  await ensureSignedIn(page, out);
  const marker = `Oil change ${Date.now()}`;
  async function authed(path, body) {
    return page.evaluate(
      async ({ path, body }) => {
        const res = await fetch(path, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        return { status: res.status, text };
      },
      { path, body },
    );
  }
  const created = await authed("/api/systems", {
    name: "Tractor",
    category: "Farm Equipment",
    components: [{ name: "Engine" }],
  });
  if (created.status !== 201 && created.status !== 200) {
    throw new Error(`create system failed ${created.status}: ${created.text}`);
  }
  const system = JSON.parse(created.text);
  const componentId = system.components?.[0]?.id;
  if (!componentId) throw new Error("system response missing component id");
  const schedule = await authed("/api/schedules", {
    componentId,
    name: marker,
    frequency: "every 90 days",
    intervalDays: 90,
    isRecurring: true,
    nextDueDate: new Date().toISOString(),
  });
  if (schedule.status !== 201 && schedule.status !== 200) {
    throw new Error(`create schedule failed ${schedule.status}: ${schedule.text}`);
  }
  steps.push("schedule: created a recurring chore on a component");

  await page.goto("/tasks", { waitUntil: "networkidle" });
  const current = page.locator('[data-board-layout="columns"] section[data-lane="CURRENT"]');
  await current.getByText(marker).waitFor({ timeout: 20000 });
  steps.push("tasks: overdue-or-today schedule card is an ordinary Current task");
  await screenshot(page, join(out, "bf-sync-inbox.png"));

  await page.goto("/schedules", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Schedules", level: 1 }).waitFor({ timeout: 15000 });
  await page.getByText(marker).waitFor({ timeout: 15000 });
  steps.push("schedules: the same schedule is listed as a card");
  await screenshot(page, join(out, "bf-sync-after-pull.png"));
  await ariaDump(page, join(out, "bf-sync-after-pull.aria.txt"));
  return { steps, status: "pass" };
}

async function driveLiveSmoke(page, out) {
  const steps = [];
  const smoke = loadSmokeCreds();
  if (!smoke) {
    const legacy =
      (process.env.AIEA_EMAIL || "").trim() &&
      (process.env.AIEA_PASSWORD || "").trim();
    const reason = legacy
      ? "AIEA_SMOKE_EMAIL/AIEA_SMOKE_PASSWORD not set (legacy AIEA_EMAIL/PASSWORD present but demoted for live-smoke) — clean-skip live/post-auth"
      : "AIEA_SMOKE_EMAIL and/or AIEA_SMOKE_PASSWORD not set — clean-skip live/post-auth (not a failure)";
    steps.push(`SKIP: ${reason}`);
    writeFileSync(join(out, "live-smoke-skipped.txt"), reason + "\n", "utf8");
    return { steps, status: "skipped", skipReason: reason };
  }

  steps.push(`smoke login: using AIEA_SMOKE_EMAIL (source=${smoke.source})`);
  await signIn(page, smoke.email, smoke.password);
  steps.push(`smoke login: signed in → ${new URL(page.url()).pathname}`);

  // Home: /tasks (board); a pre-board live deploy serves /today.
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForURL(HOME_URL, { timeout: 20000 });
  const body = await page.locator("body").innerText();
  if (/Internal Server Error|Application error|HTTP 500/i.test(body)) {
    throw new Error("live-smoke: home page shows server error after smoke login");
  }
  await page.getByRole("heading", { name: "Tasks" }).first().waitFor({ timeout: 10000 });
  steps.push(`post-auth: Tasks heading visible on live ${new URL(page.url()).pathname}`);
  await page.getByPlaceholder(/Type a task/i).waitFor({ timeout: 10000 });
  await screenshot(page, join(out, "live-smoke-home.png"));
  await ariaDump(page, join(out, "live-smoke-home.aria.txt"));
  steps.push("post-auth: live Tasks board with the capture field");
  return { steps, status: "pass" };
}

const FEATURES = {
  "capture-accept": driveCaptureAccept,
  "tasks-board": driveTasksBoard,
  "board-lanes": driveBoardLanes,
  "bf-sync": driveBfSync,
  "live-smoke": driveLiveSmoke,
};

async function main() {
  loadDotEnv();
  const feature = arg("--feature", "capture-accept");
  if (!FEATURES[feature]) {
    console.error(
      `unknown feature ${feature}; choose: ${Object.keys(FEATURES).join(", ")}`,
    );
    process.exit(2);
  }
  const featureDefaultLive = feature === "live-smoke";
  const base =
    arg("--base-url", null) ||
    process.env.VERIFY_BASE_URL ||
    process.env.SMOKE_BASE_URL ||
    process.env.AIEA_BASE_URL ||
    (featureDefaultLive
      ? "https://aiea-cyan.vercel.app"
      : "http://127.0.0.1:3200");
  const id = runId();
  const out = join(EVIDENCE_ROOT, id);
  mkdirSync(out, { recursive: true });

  // live-smoke without secrets: write skip evidence and exit 0 before Chrome
  if (feature === "live-smoke" && !loadSmokeCreds()) {
    const result = await driveLiveSmoke(null, out);
    const summary = {
      feature,
      base,
      runId: id,
      status: result.status || "skipped",
      skipReason: result.skipReason || null,
      steps: result.steps || [],
      sha: gitShort(),
      finished: new Date().toISOString(),
    };
    writeFileSync(
      join(out, `drive-${feature}.json`),
      JSON.stringify(summary, null, 2),
    );
    console.log(JSON.stringify(summary, null, 2));
    console.log(`evidence: ${out}`);
    return;
  }

  const launchOpts = {
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  };
  if (process.env.PLAYWRIGHT_CHROME_PATH) {
    launchOpts.executablePath = process.env.PLAYWRIGHT_CHROME_PATH;
  } else {
    launchOpts.channel = "chrome";
  }
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    baseURL: base,
  });
  const page = await context.newPage();

  let result;
  try {
    result = await FEATURES[feature](page, out);
  } finally {
    await browser.close();
  }

  const summary = {
    feature,
    base,
    runId: id,
    status: result.status || "pass",
    skipReason: result.skipReason || null,
    steps: result.steps || [],
    sha: gitShort(),
    finished: new Date().toISOString(),
  };
  writeFileSync(
    join(out, `drive-${feature}.json`),
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));
  console.log(`evidence: ${out}`);
  // skipped is honest success for gate (not fake green on missing env)
  if (summary.status === "fail") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
