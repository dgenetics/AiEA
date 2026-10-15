/**
 * WebKit visual check: date and time values sit on the same vertical center
 * as a neighboring text input, within 1px, at the iPhone 13 width.
 *
 *   node scripts/check-date-webkit.mjs              # fixture + live Purchase date
 *   node scripts/check-date-webkit.mjs --fixture-only
 *
 * Requires playwright-core (verify harness) and its WebKit build.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { webkit, devices } = require(
  join(root, ".cursor/skills/verify-aiea/scripts/node_modules/playwright-core"),
);
const sharp = require(join(root, "node_modules/sharp"));

const fixtureOnly = process.argv.includes("--fixture-only");
const base = process.env.AIEA_BASE_URL ?? "http://127.0.0.1:3200";
const shotDir = process.env.DATE_SHOT_DIR ?? "/tmp/pw-date";
mkdirSync(shotDir, { recursive: true });

function assertClose(label, actual, expected) {
  const delta = Math.abs(actual - expected);
  if (delta > 1) {
    throw new Error(`${label} vertical center is ${delta.toFixed(2)}px off (limit 1)`);
  }
}

async function inkCenter(png, boxHeight) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ys = [];
  const limitX = Math.floor(info.width * 0.7);
  for (let y = 0; y < info.height; y++) {
    for (let x = 2; x < limitX; x++) {
      const i = (y * info.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 210 && max - min < 45) continue;
      ys.push(y);
    }
  }
  if (ys.length < 20) return { count: ys.length, center: null };
  ys.sort((a, b) => a - b);
  const mid = ys[Math.floor(ys.length / 2)];
  const dpr = info.height / boxHeight;
  return { count: ys.length, center: mid / dpr };
}

async function measure(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("control has no box");
  const png = await locator.screenshot();
  const ink = await inkCenter(png, box.height);
  const style = await locator.evaluate((el) => {
    const computed = getComputedStyle(el);
    return {
      appearance: computed.appearance,
      fontSize: parseFloat(computed.fontSize),
      paddingLeft: parseFloat(computed.paddingLeft),
      lineHeight: computed.lineHeight,
      height: parseFloat(computed.height),
    };
  });
  return { ...ink, ...style, box };
}

const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
const fixture = `<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  ${css}
  body { margin: 16px; background: #f6f1e7; }
  .control {
    box-sizing: border-box;
    width: 320px;
    height: 3rem;
    margin-top: 12px;
    border: 1px solid #d6d3d1;
    border-radius: 12px;
    background: #fffdf8;
    padding-left: 14px;
    padding-right: 14px;
    font-size: 16px;
    color: #1c1917;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
</style>
<input id="text" class="control" type="text" value="3329">
<input id="date" class="control sheet-date" type="date" value="2017-05-24">
<input id="time" class="control" type="time" value="14:30">
<input id="empty" class="control sheet-date" type="date" value="" placeholder="mm/dd/yyyy">
<input id="empty-time" class="control" type="time" value="" placeholder="--:--">
`;

const browser = await webkit.launch();
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();

async function checkPair(textId, otherId) {
  const text = await measure(page.locator(textId));
  const other = await measure(page.locator(otherId));
  if (text.center == null || other.center == null) {
    throw new Error(`${otherId} text is not visible (${other.count} ink px)`);
  }
  assertClose(otherId, other.center, text.center);
  if (other.appearance !== "none") throw new Error(`${otherId} appearance is ${other.appearance}`);
  if (other.fontSize < 16) throw new Error(`${otherId} font-size is ${other.fontSize}`);
  if (Math.abs(other.paddingLeft - text.paddingLeft) > 1) {
    throw new Error(`${otherId} left padding ${other.paddingLeft} vs text ${text.paddingLeft}`);
  }
  return { text: text.center, other: other.center, fontSize: other.fontSize };
}

await page.setContent(fixture, { waitUntil: "load" });
if (page.viewportSize().width !== 390) {
  throw new Error(`expected iPhone 13 width 390, got ${page.viewportSize().width}`);
}
const fixtureResult = {
  date: await checkPair("#text", "#date"),
  time: await checkPair("#text", "#time"),
  empty: await checkPair("#text", "#empty"),
  emptyTime: await checkPair("#text", "#empty-time"),
};
console.log("fixture", JSON.stringify(fixtureResult));

if (!fixtureOnly) {
  const email = process.env.AIEA_EMAIL ?? "delete-sched-20261014@aiea.test";
  const password = process.env.AIEA_PW ?? "AiEaVerify1!";
  const login = await context.request.post(`${base}/api/auth/login`, {
    data: { email, password },
  });
  if (!login.ok()) throw new Error(`login failed: ${login.status()}`);
  await page.goto(`${base}/systems/cmv8p8zxh000e96jskir3nush`, { waitUntil: "domcontentloaded" });
  const engine = page.getByRole("button", { name: "HONDA GX390 Engine" });
  await engine.waitFor();
  if (!(await page.getByRole("button", { name: "Edit Component" }).isVisible())) {
    await engine.click();
  }
  await page.getByRole("button", { name: "Edit Component" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit component" });
  await dialog.waitFor();
  const date = dialog.locator('input[type="date"]');
  const cost = dialog.getByLabel("Cost");
  await date.scrollIntoViewIfNeeded();
  await date.fill("2017-05-24");
  const liveDate = await measure(date);
  const liveCost = await measure(cost);
  if (liveDate.center == null || liveCost.center == null) {
    throw new Error("Purchase date or Cost text is not visible");
  }
  assertClose("Purchase date", liveDate.center, liveCost.center);
  if (Math.abs(liveDate.paddingLeft - liveCost.paddingLeft) > 1) {
    throw new Error(`Purchase date padding ${liveDate.paddingLeft} vs Cost ${liveCost.paddingLeft}`);
  }
  if (Math.abs(liveDate.box.height - liveCost.box.height) > 1) {
    throw new Error(`Purchase date height ${liveDate.box.height} vs Cost ${liveCost.box.height}`);
  }

  const box = liveDate.box;
  const shot = join(shotDir, "webkit-purchase-date.png");
  await page.screenshot({
    path: shot,
    clip: {
      x: 0,
      y: Math.max(0, box.y - 88),
      width: 390,
      height: Math.min(280, 664 - Math.max(0, box.y - 88)),
    },
  });

  await date.fill("");
  const empty = await measure(date);
  if (empty.center == null) throw new Error("empty Purchase date shows no placeholder");
  console.log("centers", { date: liveDate.center, cost: liveCost.center, empty: empty.center });
  assertClose("empty Purchase date", empty.center, liveCost.center);
  const emptyShot = join(shotDir, "webkit-purchase-date-empty.png");
  await page.screenshot({
    path: emptyShot,
    clip: {
      x: 0,
      y: Math.max(0, box.y - 88),
      width: 390,
      height: Math.min(280, 664 - Math.max(0, box.y - 88)),
    },
  });
  console.log("live", JSON.stringify({ liveDate, liveCost, empty, shot, emptyShot }));
}

await browser.close();
console.log("webkit date input ok");
