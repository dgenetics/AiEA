/**
 * Account menu replaces the /account page.
 * Run in CI: npm run test:account-menu
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initials } from "../src/components/account-menu";

assert.equal(initials("Will Djinis", "will@beausoleil.farm"), "WD");
assert.equal(initials("Farm Manager", "cream@aiea.test"), "FM");
assert.equal(initials("Ada", "ada@example.com"), "A");
assert.equal(initials("  ", "bea@example.com"), "B");
assert.equal(initials("", ""), "?");

const root = join(import.meta.dirname, "..");
const menu = readFileSync(join(root, "src/components/account-menu.tsx"), "utf8");
const nav = readFileSync(join(root, "src/components/site-nav.tsx"), "utf8");
const page = readFileSync(join(root, "src/app/(app)/account/page.tsx"), "utf8");
const me = readFileSync(join(root, "src/app/api/auth/me/route.ts"), "utf8");
const form = readFileSync(join(root, "src/components/change-password-form.tsx"), "utf8");
const signOut = readFileSync(join(root, "src/components/sign-out-button.tsx"), "utf8");

assert.match(menu, /role="dialog"/);
assert.match(menu, /aria-label="Account"/);
assert.match(menu, /aria-expanded=\{open\}/);
assert.match(menu, /aria-controls="account-menu"/);
assert.match(menu, /Escape/);
assert.match(menu, /usePathname/);
assert.match(menu, /ChangePasswordForm/);
assert.match(menu, /SignOutButton/);
assert.match(menu, /onCancel/);
assert.match(menu, /onSuccess/);
assert.match(menu, /bg-\[#1c19172e\]/);
assert.match(menu, /md:bg-transparent/);
assert.match(menu, /md:w-80/);
assert.match(menu, /rounded-b-\[20px\]/);
assert.match(menu, /text-rose-700/);
assert.match(menu, /h-\[18px\] w-\[18px\]/);

assert.match(nav, /<AccountMenu/);
assert.match(nav, /\/login\?next=/);
assert.match(nav, /aria-label="Sign in"/);
assert.doesNotMatch(nav, /href: "\/account"|href=\{?"\/account"/);

assert.match(page, /redirect\("\/tasks"\)/);
assert.doesNotMatch(page, /Your account/);
assert.doesNotMatch(page, /ChangePasswordForm/);

assert.match(me, /signedIn: true/);
assert.match(me, /name: user\.name/);
assert.match(me, /email: user\.email/);

assert.match(form, /onCancel\?: \(\) => void/);
assert.match(form, /onSuccess\?: \(\) => void/);
assert.match(form, /space-y-3/);
assert.match(form, /2000/);
assert.match(form, /Cancel/);

assert.match(signOut, /iconClassName/);
assert.match(signOut, /iconClassName \?\? "h-3\.5 w-3\.5"/);

console.log("account-menu: popup replaces /account; signed-out icon still goes to login");
