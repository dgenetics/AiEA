/**
 * Shared WebKit date/time alignment. Run in CI: npm run test:date-input
 * The pixel check is scripts/check-date-webkit.mjs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");

const shared = css.slice(css.indexOf("iOS WebKit paints a date or time value"));
assert.ok(shared.length > 0, "shared date/time rule is missing");

assert.match(shared, /-webkit-appearance:\s*none/);
assert.match(shared, /(?<!-webkit-)appearance:\s*none/);
assert.match(shared, /display:\s*flex/);
assert.match(shared, /align-items:\s*center/);
assert.match(shared, /line-height:\s*calc\(3rem - 2px\)/);
assert.match(shared, /input\[type="date"\],\s*input\[type="time"\],\s*input\[type="datetime-local"\]/);

const valueRule = shared.slice(shared.indexOf("::-webkit-date-and-time-value"));
assert.match(valueRule, /text-align:\s*left/);
assert.match(valueRule, /margin:\s*0/);
assert.match(valueRule, /line-height:\s*inherit/);
assert.match(valueRule, /min-height:\s*1\.5em/);

const editRule = shared.slice(shared.indexOf("::-webkit-datetime-edit"));
assert.match(editRule, /padding:\s*0/);
assert.match(shared, /content:\s*attr\(placeholder\)/);
assert.match(shared, /color:\s*#a8a29e/);

const narrow = css.slice(css.indexOf("@media (max-width: 767px)"), css.indexOf("iOS WebKit paints"));
assert.match(
  narrow,
  /input:not\(\[type="date"\]\):not\(\[type="time"\]\):not\(\[type="datetime-local"\]\),\s*select,\s*textarea\s*\{\s*line-height:\s*1\.25rem !important;/,
);

for (const file of [
  "src/components/date-field.tsx",
  "src/components/farm/ComponentsList.tsx",
  "src/components/farm/ScheduleForm.tsx",
]) {
  const source = readFileSync(join(root, file), "utf8");
  assert.match(source, /type="date"/);
  assert.match(source, /placeholder="mm\/dd\/yyyy"/);
}

console.log("date input styles ok");
