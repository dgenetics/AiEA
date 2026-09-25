/**
 * Assert iOS PWA safe-area wiring for the sticky mobile header.
 * Run in CI: npm run test:safe-area
 *
 * Root bug: fixed h-12 + .safe-top under border-box ate the inset, so
 * hamburger / title sat under the status bar. Header must grow with the inset.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const shell = readFileSync(join(root, "src/components/app-shell.tsx"), "utf8");
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");

// viewport-fit=cover required for non-zero env(safe-area-inset-*) in iOS PWA
assert.match(layout, /viewportFit:\s*"cover"/);
assert.match(layout, /statusBarStyle:\s*"black-translucent"/);

// Utility that pads with the CSS env inset
assert.match(
  css,
  /\.safe-top\s*\{[\s\S]*?padding-top:\s*env\(\s*safe-area-inset-top/,
);
assert.match(
  css,
  /\.safe-bottom\s*\{[\s\S]*?padding-bottom:\s*env\(\s*safe-area-inset-bottom/,
);

// Mobile sticky header: must use safe-top AND min-h (not fixed h-*) so inset grows the bar
const headerMatch = shell.match(
  /<header\s+className="([^"]*md:hidden[^"]*)"/,
);
assert.ok(headerMatch, "mobile sticky header className not found");
const headerClass = headerMatch![1];
assert.match(headerClass, /\bsafe-top\b/);
assert.match(headerClass, /\bmin-h-12\b/);
assert.doesNotMatch(
  headerClass,
  /(?:^|\s)h-12(?:\s|$)/,
  "fixed h-12 on the mobile header collapses content under border-box + safe-top padding",
);
assert.match(headerClass, /\bsticky\b/);
assert.match(headerClass, /\btop-0\b/);

// Bottom tab bar keeps safe-bottom
assert.match(shell, /safe-bottom/);

console.log("safe-area: viewport-fit + header min-h-12/safe-top assertions passed");
