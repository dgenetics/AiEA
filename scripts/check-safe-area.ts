/**
 * Assert iOS PWA safe-area wiring.
 * Run in CI: npm run test:safe-area
 *
 * The Farm Manager bar is sticky at the top of the document and owns
 * safe-area-inset-top. A fixed height plus .safe-top under border-box eats
 * the inset — the bar must grow. There is no second in-app header.
 * The page main pads for the fixed bottom tabs and the home indicator.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const shell = readFileSync(join(root, "src/components/app-shell.tsx"), "utf8");
const nav = readFileSync(join(root, "src/components/site-nav.tsx"), "utf8");
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");

assert.match(layout, /viewportFit:\s*"cover"/);
assert.match(layout, /statusBarStyle:\s*"black-translucent"/);

assert.match(
  css,
  /\.safe-top\s*\{[\s\S]*?padding-top:\s*env\(\s*safe-area-inset-top/,
);
assert.match(
  css,
  /\.safe-bottom\s*\{[\s\S]*?padding-bottom:\s*env\(\s*safe-area-inset-bottom/,
);

const navHeader = nav.match(/<header\s+className="([^"]*)"/);
assert.ok(navHeader, "Farm Manager bar header className not found");
const navClass = navHeader![1];
assert.match(navClass, /\bsafe-top\b/);
assert.match(navClass, /\bmin-h-10\b/);
assert.match(navClass, /\bsticky\b/);
assert.match(navClass, /\btop-0\b/);
assert.doesNotMatch(
  navClass,
  /(?:^|\s)h-10(?:\s|$)/,
  "fixed h-10 on the Farm Manager bar collapses its row under border-box + safe-top padding",
);

assert.doesNotMatch(shell, /<header\b/, "in-app shell must not add a second header");
assert.match(shell, /pad-tab-bar/);
assert.doesNotMatch(shell, /safe-top/);
assert.match(
  css,
  /\.pad-tab-bar\s*\{[\s\S]*?padding-bottom:\s*calc\(\s*3\.5rem\s*\+\s*env\(\s*safe-area-inset-bottom/,
);
assert.match(nav, /fixed inset-x-0 bottom-0/);
assert.match(nav, /safe-area-inset-bottom/);
assert.doesNotMatch(nav, /href: "\/systems"[\s\S]*lucide-react/);

const account = readFileSync(join(root, "src/app/(app)/account/page.tsx"), "utf8");
assert.match(account, /Your account/);
assert.doesNotMatch(account, /uppercase tracking-wider/);
assert.match(account, /pb-\[calc\(2rem\+env\(safe-area-inset-bottom,0px\)\)\]/);
assert.match(shell, /pad-tab-bar/);

console.log("safe-area: header owns the top inset; main pads the bottom tabs and home indicator");
