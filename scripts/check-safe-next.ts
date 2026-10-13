/**
 * Open-redirect guard for /login?next= and /register?next=.
 * Run in CI: npm run test:safe-next
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { safeNextPath } from "../src/lib/safe-next";

const FALLBACK = "/tasks";

const allowed: Array<[string, string]> = [
  ["/tasks", "/tasks"],
  ["/account", "/account"],
  ["/inbox", "/inbox"],
  ["/maintenance", "/maintenance"],
  ["/maintenance/schedules", "/maintenance/schedules"],
  ["/maintenance/assets/abc", "/maintenance/assets/abc"],
  ["/maintenance/schedules?x=1", "/maintenance/schedules?x=1"],
  ["/maintenance/schedules?x=1&y=2", "/maintenance/schedules?x=1&y=2"],
  ["/tasks#today", "/tasks#today"],
  ["  /capture  ", "/capture"],
  ["/maintenance/schedules?next=https://evil.com", "/maintenance/schedules?next=https://evil.com"],
  ["%2Ftasks", "/tasks"],
  ["%2Fmaintenance%2Fschedules", "/maintenance/schedules"],
];

const rejected = [
  null,
  undefined,
  "",
  "   ",
  "https://evil.com",
  "http://evil.com",
  "https://evil.com/tasks",
  "http://127.0.0.1/tasks",
  "https://farm-manager.local/tasks",
  "//evil.com",
  "///evil.com",
  "//evil.com/tasks",
  " //evil.com",
  "/\\evil.com",
  "\\\\evil.com",
  "\\/evil.com",
  "/\\\\evil.com",
  "/tasks\\@evil.com",
  "javascript:alert(1)",
  "mailto:a@b.c",
  "https:evil.com",
  "\n/tasks",
  "/\n/tasks",
  "/%0a/tasks",
  "/%0d%0aLocation:%20https://evil.com",
  "/%2f%2fevil.com",
  "/%2F%2Fevil.com",
  "/%5Cevil.com",
  "%2F%2Fevil.com",
  "%252F%252Fevil.com",
  "/login",
  "/login/",
  "/login?next=/tasks",
  "/register",
  "/register/",
  "/register?foo=1",
  "foo",
  "?/tasks",
  "\\tasks",
  "a".repeat(2049),
];

for (const [input, expected] of allowed) {
  assert.equal(safeNextPath(input), expected, `allow ${JSON.stringify(input)}`);
}

for (const input of rejected) {
  assert.equal(
    safeNextPath(input),
    FALLBACK,
    `reject ${JSON.stringify(input)}`,
  );
}

assert.equal(safeNextPath("/tasks"), "/tasks");
assert.equal(safeNextPath(safeNextPath("//evil.com")), FALLBACK);

const navPath = join(import.meta.dirname, "../src/components/site-nav.tsx");
const nav = readFileSync(navPath);
const navText = nav.toString("utf8");
assert.equal(navText.includes('from "@/'), false, "site-nav must stay copyable into bf-maintenance");
assert.match(navText, /\/api\/auth\/me/);
assert.match(navText, /credentials:\s*"include"/);
assert.doesNotMatch(navText, /if \(zone === "maintenance"\) return/);
assert.doesNotMatch(navText, /zone !== "maintenance"/);
assert.match(navText, /href: "\/account"|signedIn \? "\/account"/);
assert.match(navText, /\/login\?next=/);
assert.match(navText, /encodeURIComponent/);
assert.match(navText, /window\.location\.pathname/);
assert.match(navText, /safe-top/);
assert.match(navText, /min-h-10/);
assert.doesNotMatch(navText, /Sessions are not shared/);

const hash = createHash("sha256").update(nav).digest("hex");
console.log(`safe-next: open redirects fall back to ${FALLBACK}`);
console.log(`site-nav sha256: ${hash}`);
