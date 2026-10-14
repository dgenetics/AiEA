/**
 * The footer toolbar inset and the keyboard lift share one visual-viewport read.
 * Run in CI: npm run test:keyboard-inset
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  browserChromeBottom,
  fixedViewportStyle,
  keyboardFrame,
  layoutViewportGap,
  MAX_BROWSER_CHROME_BOTTOM,
  type ViewportSample,
} from "../src/lib/visual-viewport";

assert.equal(MAX_BROWSER_CHROME_BOTTOM, 100);
assert.equal(layoutViewportGap(844, 430, 20), 394);
assert.equal(layoutViewportGap(700, 800, 10), 0);

const toolbar: ViewportSample = {
  layoutHeight: 800,
  height: 760,
  offsetTop: 0,
  scale: 1,
  textFocused: false,
};
assert.equal(browserChromeBottom(toolbar), 40);
assert.deepEqual(keyboardFrame(toolbar), { open: false, bottom: 0, height: 0 });
assert.equal(fixedViewportStyle(keyboardFrame(toolbar)), undefined);

const typingToolbar: ViewportSample = { ...toolbar, textFocused: true };
assert.equal(browserChromeBottom(typingToolbar), null);
assert.equal(keyboardFrame(typingToolbar).open, false);

const zoom: ViewportSample = {
  layoutHeight: 800,
  height: 400,
  offsetTop: 0,
  scale: 1.5,
  textFocused: false,
};
assert.equal(browserChromeBottom(zoom), null);
assert.equal(keyboardFrame(zoom).open, false);

const keyboard: ViewportSample = {
  layoutHeight: 844,
  height: 430,
  offsetTop: 20,
  scale: 1,
  textFocused: true,
};
assert.equal(browserChromeBottom(keyboard), null);
assert.deepEqual(keyboardFrame(keyboard), { open: true, bottom: 394, height: 430 });
assert.deepEqual(fixedViewportStyle(keyboardFrame(keyboard)), {
  top: "auto",
  bottom: 394,
  height: 430,
  maxHeight: 430,
});

const dismissing: ViewportSample = { ...keyboard, textFocused: false };
assert.equal(browserChromeBottom(dismissing), null);
assert.equal(keyboardFrame(dismissing).bottom, 394);

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) acc.push(path);
  }
  return acc;
}

const root = join(import.meta.dirname, "..");
const listeners = walk(join(root, "src")).filter((file) => {
  const source = readFileSync(file, "utf8");
  return source.includes("visualViewport") && source.includes('addEventListener("resize"');
});
assert.deepEqual(
  listeners.map((file) => file.slice(root.length + 1)),
  ["src/components/browser-chrome-inset.tsx"],
);

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

const modal = source("src/components/farm/Modal.tsx");
assert.match(modal, /useKeyboardFrame\(\)/);
assert.match(modal, /useLockBodyScroll\(true\)/);
assert.match(modal, /style=\{viewportStyle\}/);
assert.match(modal, /pb-5/);
assert.match(modal, /pb-\[calc\(20px\+env\(safe-area-inset-bottom\)\)\]/);
assert.match(modal, /maxHeight: frame\.height/);

for (const path of [
  "src/components/task-edit-modal.tsx",
  "src/components/farm/MoveComponentSheet.tsx",
  "src/components/account-menu.tsx",
]) {
  const file = source(path);
  assert.match(file, /useKeyboardFrame\(\)/);
  assert.match(file, /useLockBodyScroll/);
  assert.match(file, /fixedViewportStyle/);
}

const saveBar = source("src/components/farm/StickySaveBar.tsx");
assert.match(saveBar, /useKeyboardFrame\(\)/);
assert.match(saveBar, /bottom: frame\.bottom/);
assert.doesNotMatch(saveBar, /useLockBodyScroll/);

const capture = source("src/components/capture-composer.tsx");
assert.doesNotMatch(capture, /useKeyboardFrame/);
assert.doesNotMatch(capture, /fixed inset-0/);

const nav = source("src/components/site-nav.tsx");
assert.match(nav, /fixed inset-x-0 bottom-0/);
assert.doesNotMatch(nav, /useKeyboardFrame/);

console.log("keyboard inset: one visual-viewport read lifts fixed inputs and leaves the toolbar spacer alone");
