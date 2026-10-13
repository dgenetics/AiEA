/**
 * `next` on login and register, and the shared Farm Manager bar.
 * Run in CI: npm run test:safe-next
 *
 * The bar file is byte-identical to bf-maintenance
 * cursor/bf-aiea-sso-7685 src/components/site-nav.tsx.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { safeNextPath, signedInNextPath } from "../src/lib/safe-next";

const FALLBACK = "/tasks";
const SITE_NAV_SHA256 = "6a13b05fcf4a700cbd4187e78c6c9d832f9a8bc0bddd453ca8a740cd625d2f0f";

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
  ["/maintenance/schedules?next=https://evil.com", "/maintenance/schedules?next=https://evil.com"],
  ["/", "/"],
  ["/login", "/login"],
  ["/register?foo=1", "/register?foo=1"],
];

const rejected = [
  null,
  undefined,
  "",
  "   ",
  "  /tasks",
  "https://evil.com",
  "http://evil.com",
  "https://evil.com/tasks",
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
  "%2Ftasks",
  "%2F%2Fevil.com",
  "%252F%252Fevil.com",
  "foo",
  "?/tasks",
  "\\tasks",
  "/\t/evil.com",
  "/\n/evil.com",
  "/\r/evil.com",
  "/\r\n/evil.com",
  "/\u0000/evil.com",
  "/\u000b/evil.com",
  "/\u000c/evil.com",
  "/\u007f/evil.com",
  "/foo\t/evil.com",
  "/\t\\evil.com",
  "\t//evil.com",
];

// Tab, newline, and CR are stripped by the URL parser, so these are
// protocol-relative and leave the dummy origin. The guard must reject
// them even if a later edit drops the control-character test.
assert.equal(new URL("/\t/evil.com", "http://x").origin, "http://evil.com");
assert.equal(new URL("/\n/evil.com", "http://x").origin, "http://evil.com");
assert.equal(new URL("/\r/evil.com", "http://x").origin, "http://evil.com");
assert.notEqual(new URL("/\t/evil.com", "http://x").origin, "http://x");
assert.notEqual(new URL("/\n/evil.com", "http://x").origin, "http://x");

// Null, VT, FF, and DEL stay on the dummy origin (they are percent-encoded).
// Only the control-character reject catches them.
for (const raw of ["/\u0000/evil.com", "/\u000b/evil.com", "/\u000c/evil.com", "/\u007f/evil.com", "/foo\tbar"]) {
  assert.equal(new URL(raw, "http://x").origin, "http://x", `origin stays for ${JSON.stringify(raw)}`);
  assert.equal(safeNextPath(raw), FALLBACK, `control ${JSON.stringify(raw)}`);
}

for (let code = 0; code <= 0x1f; code++) {
  const ch = String.fromCharCode(code);
  assert.equal(safeNextPath(`/${ch}/evil.com`), FALLBACK, `U+${code.toString(16)} host`);
  assert.equal(safeNextPath(`/tasks${ch}`), FALLBACK, `U+${code.toString(16)} trailing`);
}
assert.equal(safeNextPath("/\u007fevil"), FALLBACK);

const guardSrc = readFileSync(join(import.meta.dirname, "../src/lib/safe-next.ts"), "utf8");
assert.match(guardSrc, /\[\\u0000-\\u001F\\u007F\]/);
assert.match(guardSrc, /new URL\(input, "http:\/\/x"\)\.origin !== "http:\/\/x"/);

const pin = readFileSync(join(import.meta.dirname, "../scripts/pins/site-nav.sha256"), "utf8");
assert.match(pin, new RegExp(`^${SITE_NAV_SHA256}  src/components/site-nav\\.tsx\\n$`));

for (const [input, expected] of allowed) {
  assert.equal(safeNextPath(input), expected, `allow ${JSON.stringify(input)}`);
}

for (const input of rejected) {
  assert.equal(safeNextPath(input), FALLBACK, `reject ${JSON.stringify(input)}`);
}

assert.equal(safeNextPath("/tasks"), "/tasks");
assert.equal(safeNextPath(safeNextPath("//evil.com")), FALLBACK);
assert.equal(signedInNextPath("/maintenance/schedules"), "/maintenance/schedules");
assert.equal(signedInNextPath("/login"), FALLBACK);
assert.equal(signedInNextPath("/login?next=/tasks"), FALLBACK);
assert.equal(signedInNextPath("/register/"), FALLBACK);
assert.equal(signedInNextPath("//evil.com"), FALLBACK);

const navPath = join(import.meta.dirname, "../src/components/site-nav.tsx");
const nav = readFileSync(navPath);
const navText = nav.toString("utf8");
const hash = createHash("sha256").update(nav).digest("hex");
assert.equal(hash, SITE_NAV_SHA256, "site-nav.tsx must match bf-maintenance's pin");
assert.equal(navText.includes('from "@/'), false, "site-nav must stay copyable into bf-maintenance");
assert.match(navText, /useSearchParams/);
assert.match(navText, /\/api\/auth\/me/);
assert.match(navText, /credentials:\s*"include"/);
assert.match(navText, /\/login\?next=/);
assert.match(navText, /"\/account"/);
assert.doesNotMatch(navText, /zone !== "maintenance"/);
assert.doesNotMatch(navText, /if \(zone === "maintenance"\) return/);

const layout = readFileSync(join(import.meta.dirname, "../src/app/layout.tsx"), "utf8");
assert.match(layout, /<Suspense[\s\S]*<SiteNav \/>[\s\S]*<\/Suspense>/);

console.log(`safe-next: open redirects fall back to ${FALLBACK}`);
console.log(`site-nav sha256: ${hash}`);
