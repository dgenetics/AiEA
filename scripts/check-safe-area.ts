/**
 * Assert iOS PWA safe-area wiring.
 * Run in CI: npm run test:safe-area
 *
 * The Farm Manager bar is the topmost element, so it owns safe-area-inset-top.
 * A fixed height plus .safe-top under border-box eats the inset — the bar
 * must grow. The in-app mobile header sits below that bar and must not add
 * a second inset. The drawer still covers the viewport, so it keeps its own.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const shell = readFileSync(join(root, "src/components/app-shell.tsx"), "utf8");
const nav = readFileSync(join(root, "src/components/site-nav.tsx"), "utf8");
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

// Farm Manager bar owns the top inset and must grow with it (min-h, not fixed h-*).
const navHeader = nav.match(/<header\s+className="([^"]*)"/);
assert.ok(navHeader, "Farm Manager bar header className not found");
const navClass = navHeader![1];
assert.match(navClass, /\bsafe-top\b/);
assert.match(navClass, /\bmin-h-10\b/);
assert.doesNotMatch(
  navClass,
  /(?:^|\s)h-10(?:\s|$)/,
  "fixed h-10 on the Farm Manager bar collapses its row under border-box + safe-top padding",
);

// In-app mobile header sits under that bar: keep min-h/sticky, do not add a second inset.
const headerMatch = shell.match(
  /<header\s+className="([^"]*md:hidden[^"]*)"/,
);
assert.ok(headerMatch, "mobile sticky header className not found");
const headerClass = headerMatch![1];
assert.doesNotMatch(
  headerClass,
  /\bsafe-top\b/,
  "in-app mobile header must not repeat safe-top; the Farm Manager bar already consumed the inset",
);
assert.match(headerClass, /\bmin-h-12\b/);
assert.doesNotMatch(
  headerClass,
  /(?:^|\s)h-12(?:\s|$)/,
  "fixed h-12 on the mobile header collapses content under border-box",
);
assert.match(headerClass, /\bsticky\b/);
assert.match(headerClass, /\btop-0\b/);

// Drawer covers the bar, so it still pads for the notch. Bottom tabs keep safe-bottom.
assert.match(shell, /safe-top/);
assert.match(shell, /safe-bottom/);

console.log("safe-area: Farm Manager bar owns the top inset; in-app header does not double it");
