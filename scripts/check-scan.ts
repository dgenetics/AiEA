/**
 * Label scan: field mapping, limits, and the system-page entry points.
 * The model is a stub. Run in CI: npm run test:scan
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { componentIdentityRows } from "../src/lib/component-identity";
import { SCAN_IMAGE_EDGE, downscaleScanImage } from "../src/lib/scan-image";
import sharp from "sharp";
import { emptyComponentInput } from "../src/lib/farm-money";
import { getComponentScanConfig } from "../src/lib/component-scan-ai";
import {
  SCAN_READ_ERROR,
  SCAN_TOO_LARGE,
  applyManualLookup,
  describeScheduleLookup,
  editMakeAndModel,
  editTaggedField,
  firstBarcodeValue,
  manualLookupFromText,
  interpretComponentScan,
  joinMakeAndModel,
  makeModelTag,
  parseScanModelText,
  resetScanRateLimit,
  reviewFromCode,
  reviewToComponentInput,
  scanImageProblem,
  scanScheduleDraft,
  scheduleSuggestionText,
  sniffScanImage,
  splitMakeAndModel,
  takeScanSlot,
} from "../src/lib/component-scan";

const root = join(import.meta.dirname, "..");

function jpeg(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return bytes;
}

function png(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  header.forEach((byte, index) => {
    bytes[index] = byte;
  });
  return bytes;
}

const grundfos = {
  name: "Well Pump",
  manufacturer: "Grundfos",
  modelNumber: "SQ 3-65",
  productNumber: "96510192",
  serialNumber: "0342 1187",
  warrantyInfo: "2 years from install",
  vendorName: "Pond Supply Co",
  manual: {
    url: "https://www.grundfos.com/manuals/sq-sqe.pdf",
    title: "Grundfos SQ / SQE installation and operating instructions",
    kind: "PDF",
  },
  schedule: {
    name: "Check pressure and amp draw",
    everyCount: 1,
    everyUnit: "year",
    note: "per the manual",
  },
};

async function main() {
const called = { n: 0 };
const outcome = await interpretComponentScan({
  bytes: jpeg(64),
  mediaType: "image/jpeg",
  decodedCode: "0342 1187",
  configured: true,
  readModel: async () => {
    called.n += 1;
    return "```json\n" + JSON.stringify(grundfos) + "\n```";
  },
});
assert.equal(outcome.ok, true);
if (!outcome.ok) throw new Error("scan failed");
assert.equal(called.n, 1);
assert.equal(outcome.result.name.value, "Well Pump");
assert.equal(outcome.result.name.tag, "suggested");
assert.equal(outcome.result.manufacturer.value, "Grundfos");
assert.equal(outcome.result.modelNumber.value, "SQ 3-65");
assert.equal(outcome.result.manufacturer.tag, "from label");
assert.equal(outcome.result.serialNumber.value, "0342 1187");
assert.equal(outcome.result.productNumber.value, "96510192");
assert.equal(outcome.result.productNumber.tag, "from label");
assert.equal(outcome.result.userManual.value, "");
assert.equal(outcome.result.userManual.tag, null);
assert.equal(outcome.result.manualKind, "");
assert.equal(outcome.result.schedule, null);
assert.equal(outcome.result.warrantyInfo.value, "2 years from install");
assert.equal(outcome.result.vendorName.value, "Pond Supply Co");
assert.equal(outcome.result.intro, "Found it from the label. Check it over, then save.");

const input = reviewToComponentInput(outcome.result);
const allowed = new Set(Object.keys(emptyComponentInput()));
for (const key of Object.keys(input)) assert.equal(allowed.has(key), true);
assert.equal(input.manufacturer, "Grundfos");
assert.equal(input.modelNumber, "SQ 3-65");
assert.equal(input.productNumber, "96510192");
assert.equal(input.serialNumber, "0342 1187");
assert.equal(input.userManual, "");
assert.equal(input.warrantyInfo, "2 years from install");
assert.equal(input.vendorName, "Pond Supply Co");
assert.equal(input.name, "Well Pump");
assert.equal(joinMakeAndModel(input.manufacturer, input.modelNumber), "Grundfos SQ 3-65");
assert.deepEqual(splitMakeAndModel("Grundfos SQ 3-65 extra", "Grundfos"), {
  manufacturer: "Grundfos",
  modelNumber: "SQ 3-65 extra",
});
assert.deepEqual(splitMakeAndModel("Acme Jet", "Grundfos"), {
  manufacturer: "Acme",
  modelNumber: "Jet",
});
assert.equal(makeModelTag(outcome.result.manufacturer, outcome.result.modelNumber), "from label");

const lookedUp = manualLookupFromText(JSON.stringify(grundfos));
assert.equal(lookedUp?.manualUrl, "https://www.grundfos.com/manuals/sq-sqe.pdf");
assert.equal(lookedUp?.manualKind, "PDF");
assert.equal(lookedUp?.schedule?.everyUnit, "year");
const withManual = applyManualLookup(outcome.result, lookedUp!);
assert.equal(withManual.userManual.value, "https://www.grundfos.com/manuals/sq-sqe.pdf");
assert.equal(withManual.userManual.tag, "found online");
assert.equal(withManual.name.tag, "suggested");
assert.deepEqual(scheduleSuggestionText(withManual.schedule!), {
  name: "Check pressure and amp draw",
  rest: "every 1 year, per the manual",
});

const now = new Date(2026, 9, 14, 15, 0, 0);
const draft = scanScheduleDraft(withManual.schedule!, now);
assert.equal(draft?.frequency, "1y");
assert.equal(draft?.intervalDays, 365);
assert.equal(draft?.isRecurring, true);
assert.equal(draft?.description, "per the manual");
assert.equal(draft?.nextDueDate, new Date(2027, 9, 14, 12, 0, 0).toISOString());

const codeOnly = await interpretComponentScan({
  bytes: jpeg(64),
  mediaType: "image/jpeg",
  decodedCode: "96510192",
  configured: false,
  readModel: async () => {
    throw new Error("model must not run without a key");
  },
});
assert.equal(codeOnly.ok, true);
if (!codeOnly.ok) throw new Error("code scan failed");
assert.equal(codeOnly.result.productNumber.value, "96510192");
assert.equal(codeOnly.result.productNumber.tag, "barcode");
assert.equal(codeOnly.result.name.value, "");
assert.equal(codeOnly.result.intro, "Read the code. Check it over, then save.");
assert.equal(reviewFromCode("https://example.com/manual.pdf")?.userManual.tag, "barcode");
const scriptCode = reviewFromCode("javascript:alert(1)");
assert.equal(scriptCode?.userManual.value, "");
assert.equal(scriptCode?.productNumber.value, "javascript:alert(1)");

const missed = await interpretComponentScan({
  bytes: jpeg(64),
  mediaType: "image/jpeg",
  decodedCode: null,
  configured: false,
});
assert.deepEqual(missed, { ok: false, status: 422, error: SCAN_READ_ERROR });

let modelCalls = 0;
const fellBack = await interpretComponentScan({
  bytes: jpeg(64),
  mediaType: "image/jpeg",
  decodedCode: "PN-1",
  configured: true,
  readModel: async () => {
    modelCalls += 1;
    throw new Error("upstream down");
  },
});
assert.equal(modelCalls, 1);
assert.equal(fellBack.ok, true);
if (!fellBack.ok) throw new Error("fallback failed");
assert.equal(fellBack.result.productNumber.value, "PN-1");
assert.equal(fellBack.result.productNumber.tag, "barcode");

const blankModel = await interpretComponentScan({
  bytes: jpeg(64),
  mediaType: "image/jpeg",
  decodedCode: null,
  configured: true,
  readModel: async () => "sorry, no",
});
assert.deepEqual(blankModel, { ok: false, status: 422, error: SCAN_READ_ERROR });

const combined = parseScanModelText(
  JSON.stringify({ makeAndModel: "Grundfos SQ 3-65", name: "Well Pump" }),
);
assert.equal(combined?.manufacturer.value, "Grundfos");
assert.equal(combined?.modelNumber.value, "SQ 3-65");
const unsafe = parseScanModelText(
  JSON.stringify({ manual: { url: "javascript:alert(1)", title: "nope" } }),
);
assert.equal(unsafe?.userManual.value, "");

const annual = manualLookupFromText(
  JSON.stringify({
    manual: { url: "https://www.grundfos.com/manuals/sq-sqe.pdf", title: "SQ", kind: "PDF" },
    schedule: { name: "Check the motor", everyCount: 1, everyUnit: "annually" },
  }),
);
assert.equal(annual?.schedule?.everyCount, 1);
assert.equal(annual?.schedule?.everyUnit, "year");
const sixMonths = manualLookupFromText(
  JSON.stringify({
    manual: { url: "https://www.grundfos.com/manuals/sq-sqe.pdf", title: "SQ", kind: "PDF" },
    schedule: { task: "Change the oil", interval: "every 6 months" },
  }),
);
assert.equal(sixMonths?.schedule?.name, "Change the oil");
assert.equal(sixMonths?.schedule?.everyCount, 6);
assert.equal(sixMonths?.schedule?.everyUnit, "month");
const yearlyPhrase = parseScanModelText(
  JSON.stringify({
    manual: { url: "https://example.com/m.pdf", kind: "PDF" },
    schedule: "Check the motor annually",
  }),
);
assert.equal(yearlyPhrase?.schedule?.name, "Check the motor");
assert.equal(yearlyPhrase?.schedule?.everyUnit, "year");
const noInterval = describeScheduleLookup(
  JSON.stringify({
    manual: { url: "https://www.grundfos.com/manuals/sq-sqe.pdf", title: "SQ", kind: "PDF" },
    schedule: { name: "", everyCount: 1, everyUnit: "year" },
  }),
);
assert.equal(noInterval.lookup?.manualUrl, "https://www.grundfos.com/manuals/sq-sqe.pdf");
assert.equal(noInterval.lookup?.schedule, null);
assert.equal(noInterval.scheduleNote, "manual did not include a maintenance interval");
const unreadable = describeScheduleLookup(
  JSON.stringify({
    manual: { url: "https://www.grundfos.com/manuals/sq-sqe.pdf", title: "SQ", kind: "PDF" },
    schedule: { name: "Check seals", everyUnit: "sometimes" },
  }),
);
assert.equal(unreadable.lookup?.manualUrl, "https://www.grundfos.com/manuals/sq-sqe.pdf");
assert.equal(unreadable.lookup?.schedule, null);
assert.match(unreadable.scheduleNote, /could not read the interval/);
const maintenanceFree = describeScheduleLookup(
  JSON.stringify({
    manual: {
      url: "https://api.grundfos.com/literature/Grundfosliterature-144823.pdf",
      title: "SQ, SQE",
      kind: "PDF",
    },
    schedule: {
      name: "The pumps are normally maintenance-free",
      everyCount: 1,
      everyUnit: "year",
      note: "per the manual",
    },
  }),
);
assert.equal(maintenanceFree.lookup?.schedule, null);
assert.match(maintenanceFree.lookup?.manualUrl ?? "", /api\.grundfos\.com/);
assert.equal(maintenanceFree.scheduleNote, "manual did not include a maintenance interval");

const genericName = await interpretComponentScan({
  bytes: jpeg(64),
  mediaType: "image/jpeg",
  decodedCode: null,
  configured: true,
  readModel: async () => JSON.stringify({ name: "Pump", manufacturer: "Grundfos", modelNumber: "SQ 3-65" }),
});
assert.equal(genericName.ok, true);
if (!genericName.ok) throw new Error("generic name failed");
assert.equal(genericName.result.name.value, "Grundfos SQ 3-65 Pump");
assert.equal(genericName.result.name.tag, "suggested");
assert.equal(genericName.result.userManual.value, "");
assert.equal(genericName.result.schedule, null);

assert.equal(sniffScanImage(jpeg(40)), "image/jpeg");
assert.equal(sniffScanImage(png(40)), "image/png");
assert.equal(sniffScanImage(new Uint8Array(40)), null);
assert.equal(scanImageProblem(jpeg(80), 40), SCAN_TOO_LARGE);
assert.equal(scanImageProblem(new Uint8Array(40)), SCAN_READ_ERROR);
assert.equal(scanImageProblem(jpeg(40)), null);

resetScanRateLimit();
assert.equal(takeScanSlot("ws-a", 1_000, 2, 10_000).ok, true);
assert.equal(takeScanSlot("ws-a", 1_100, 2, 10_000).ok, true);
const blocked = takeScanSlot("ws-a", 1_200, 2, 10_000);
assert.equal(blocked.ok, false);
if (blocked.ok) throw new Error("rate limit missed");
assert.ok(blocked.retryAfterSec > 0);
assert.equal(takeScanSlot("ws-b", 1_200, 2, 10_000).ok, true);
resetScanRateLimit();

assert.equal(firstBarcodeValue([{ rawValue: "  " }, { rawValue: " ABC " }]), "ABC");
assert.equal(firstBarcodeValue([]), null);

const savedKey = process.env.COMPONENT_SCAN_API_KEY;
const savedModel = process.env.COMPONENT_SCAN_MODEL;
const savedLabelModel = process.env.COMPONENT_SCAN_LABEL_MODEL;
delete process.env.COMPONENT_SCAN_API_KEY;
delete process.env.COMPONENT_SCAN_MODEL;
delete process.env.COMPONENT_SCAN_LABEL_MODEL;
assert.equal(getComponentScanConfig().configured, false);
assert.equal(getComponentScanConfig().model, "grok-4.7");
assert.equal(getComponentScanConfig().labelModel, "grok-4.3");
process.env.COMPONENT_SCAN_API_KEY = "scan-test-key";
process.env.COMPONENT_SCAN_MODEL = "grok-test";
process.env.COMPONENT_SCAN_LABEL_MODEL = "grok-label-test";
assert.equal(getComponentScanConfig().configured, true);
assert.equal(getComponentScanConfig().model, "grok-test");
assert.equal(getComponentScanConfig().labelModel, "grok-label-test");
if (savedKey === undefined) delete process.env.COMPONENT_SCAN_API_KEY;
else process.env.COMPONENT_SCAN_API_KEY = savedKey;
if (savedModel === undefined) delete process.env.COMPONENT_SCAN_MODEL;
else process.env.COMPONENT_SCAN_MODEL = savedModel;
if (savedLabelModel === undefined) delete process.env.COMPONENT_SCAN_LABEL_MODEL;
else process.env.COMPONENT_SCAN_LABEL_MODEL = savedLabelModel;

const list = readFileSync(join(root, "src/components/farm/ComponentsList.tsx"), "utf8");
const scanUi = readFileSync(join(root, "src/components/farm/ScanComponent.tsx"), "utf8");
const route = readFileSync(join(root, "src/app/api/components/scan/route.ts"), "utf8");
const ai = readFileSync(join(root, "src/lib/component-scan-ai.ts"), "utf8");
const envExample = readFileSync(join(root, ".env.example"), "utf8");
const features = readFileSync(join(root, "FEATURES.md"), "utf8");
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const workflow = readFileSync(join(root, ".github/workflows/verify.yml"), "utf8");
const scanLib = readFileSync(join(root, "src/lib/component-scan.ts"), "utf8");

const scanAt = list.indexOf("Scan Component");
const manualAt = list.indexOf("Add Manually");
const findAt = list.indexOf("Find a component");
assert.ok(scanAt > 0 && manualAt > scanAt && manualAt < findAt);
assert.match(list, /gap-7/);
assert.match(list, /min-h-11/);
assert.match(list, /ScanFrameIcon/);
assert.doesNotMatch(list, /\+ Add Manually/);
assert.match(list, /\{!readMode \? \([\s\S]*\+ Add component/);
assert.match(list, /capture="environment"/);
assert.match(list, /accept="image\/\*"/);
assert.match(list, /aria-label="Take a photo of the label"/);
assert.match(list, /aria-label="Choose a photo from the library"/);
assert.match(list, /Photo library/);
const libraryAt = list.indexOf("Choose a photo from the library");
assert.ok(libraryAt > scanAt && libraryAt < manualAt);
assert.doesNotMatch(list.slice(libraryAt - 90, libraryAt), /capture=/);
assert.match(scanUi, /Type it in/);
assert.match(scanUi, /Reading the label…/);
assert.doesNotMatch(scanUi, /getUserMedia/);
assert.doesNotMatch(scanUi, /BarcodeDetector/);
assert.doesNotMatch(scanUi, /Read label/);
assert.doesNotMatch(scanUi, /<video/);
assert.match(scanUi, /@zxing\/browser/);
assert.match(scanUi, /UPLOAD_EDGE = 1024/);
assert.equal(SCAN_READ_ERROR, "Couldn't read that, try again or type it in");
assert.match(scanUi, /SCAN_READ_ERROR/);
assert.match(scanLib, /Couldn't read that, try again or type it in/);
assert.match(scanUi, /\+ Add this schedule/);
assert.match(scanLib, /"from label"/);
assert.match(scanUi, /where you started/);
assert.match(scanUi, /Make and model/);
assert.match(scanUi, /editTaggedField\(current\.name, value\)/);
assert.doesNotMatch(scanUi, /tag: review\.name\.tag \?\? "suggested"/);
assert.deepEqual(editTaggedField({ value: "", tag: null }, "Well Pump"), {
  value: "Well Pump",
  tag: null,
});
assert.deepEqual(editTaggedField({ value: "Well Pump", tag: "suggested" }, "Sump Pump"), {
  value: "Sump Pump",
  tag: null,
});
assert.deepEqual(editTaggedField({ value: "96510192", tag: "barcode" }, "96510192"), {
  value: "96510192",
  tag: "barcode",
});
const editedMake = editMakeAndModel(
  { value: "Grundfos", tag: "from label" },
  { value: "SQ 3-65", tag: "from label" },
  "Acme Jet",
);
assert.equal(editedMake.manufacturer.tag, null);
assert.equal(editedMake.modelNumber.tag, null);
assert.equal(editedMake.manufacturer.value, "Acme");
assert.equal(editedMake.modelNumber.value, "Jet");
const keptMake = editMakeAndModel(
  { value: "Grundfos", tag: "from label" },
  { value: "SQ 3-65", tag: "from label" },
  "Grundfos SQ 3-65",
);
assert.equal(keptMake.manufacturer.tag, "from label");
assert.equal(keptMake.modelNumber.tag, "from label");
assert.deepEqual(
  componentIdentityRows({
    manufacturer: "Grundfos",
    modelNumber: "SQ 3-65",
    productNumber: "96510192",
    serialNumber: "0342 1187",
  }).map((row) => row.label),
  ["Model", "Part number", "Serial"],
);
assert.equal(
  componentIdentityRows({
    manufacturer: "Grundfos",
    modelNumber: "SQ 3-65",
    productNumber: "96510192",
    serialNumber: "0342 1187",
  })[1]?.value,
  "96510192",
);
assert.deepEqual(
  componentIdentityRows({
    manufacturer: "Grundfos",
    modelNumber: "SQ 3-65",
    productNumber: "   ",
    serialNumber: "0342 1187",
  }).map((row) => row.label),
  ["Model", "Serial"],
);
assert.match(list, /componentIdentityRows\(part\)/);
assert.match(features, /Part number sits with the model and serial/);
assert.match(features, /Changing it removes the tag/);
assert.match(route, /requireWorkspace/);
assert.match(route, /takeScanSlot/);
assert.match(route, /SCAN_IMAGE_MAX_BYTES/);
assert.match(route, /maxDuration = 300/);
assert.match(route, /downscaleScanImage/);
const lookupRoute = readFileSync(join(root, "src/app/api/components/scan/lookup/route.ts"), "utf8");
assert.match(lookupRoute, /maxDuration = 300/);
assert.match(lookupRoute, /lookupComponentManual/);
assert.match(lookupRoute, /console\.error\("schedule lookup:"/);
assert.match(lookupRoute, /console\.warn\("schedule lookup:"/);
assert.match(scanUi, /needsSchedule/);
assert.match(scanUi, /AbortSignal\.timeout\(25_000\)/);
assert.match(scanUi, /AbortSignal\.timeout\(150_000\)/);
assert.equal(SCAN_IMAGE_EDGE, 1024);
const labelFn = ai.slice(
  ai.indexOf("export async function readComponentLabel"),
  ai.indexOf("export async function lookupComponentManual"),
);
assert.match(labelFn, /detail: "low"/);
assert.match(labelFn, /config\.labelModel/);
assert.match(labelFn, /effort: "none"/);
assert.doesNotMatch(labelFn, /web_search/);
assert.doesNotMatch(labelFn, /detail: "high"/);
const lookupFn = ai.slice(ai.indexOf("export async function lookupComponentManual"));
assert.match(lookupFn, /web_search/);
assert.match(lookupFn, /effort: "low"/);
assert.doesNotMatch(lookupFn, /input_image/);
assert.match(ai, /COMPONENT_SCAN_API_KEY/);
assert.match(ai, /grok-4\.3/);
assert.match(ai, /grok-4\.7/);
assert.match(ai, /store: false/);
assert.match(ai, /Do not invent URLs/);
assert.match(features, /low detail/);
assert.match(features, /grok-4\.3/);
assert.match(features, /Grundfos SQ 3-65 Pump/);
assert.match(envExample, /COMPONENT_SCAN_LABEL_MODEL/);
assert.match(features, /Photo library/);
const barcodeOnly = reviewFromCode("96510192");
assert.ok(barcodeOnly);
const typed = applyManualLookup(
  { ...barcodeOnly, name: { value: "Well Pump", tag: null } },
  {
    manualUrl: "https://www.grundfos.com/manuals/sq.pdf",
    manualTitle: "SQ manual",
    manualKind: "PDF",
    schedule: { name: "Check seals", everyCount: 1, everyUnit: "year", note: "per the manual" },
  },
);
assert.equal(typed.name.value, "Well Pump");
assert.equal(typed.name.tag, null);
assert.equal(typed.userManual.tag, "found online");
assert.equal(typed.userManual.value, "https://www.grundfos.com/manuals/sq.pdf");
assert.equal(typed.schedule?.name, "Check seals");
const keptManual = applyManualLookup(
  { ...typed, userManual: { value: "https://example.com/mine", tag: null } },
  {
    manualUrl: "https://www.grundfos.com/manuals/sq.pdf",
    manualTitle: "SQ manual",
    manualKind: "PDF",
    schedule: null,
  },
);
assert.equal(keptManual.userManual.value, "https://example.com/mine");
assert.equal(keptManual.userManual.tag, null);
assert.equal(
  manualLookupFromText('{"name":"Suggested pump","manual":{"url":"https://example.com/m.pdf","title":"M","kind":"PDF"}}')
    ?.manualUrl,
  "https://example.com/m.pdf",
);
const wide = await sharp({
  create: { width: 2000, height: 800, channels: 3, background: "#ffffff" },
}).jpeg().toBuffer();
const scaled = await downscaleScanImage(new Uint8Array(wide), "image/jpeg");
const scaledMeta = await sharp(scaled.bytes).metadata();
assert.equal(Math.max(scaledMeta.width ?? 0, scaledMeta.height ?? 0), 1024);
assert.equal(scaled.mediaType, "image/jpeg");
assert.match(envExample, /COMPONENT_SCAN_API_KEY=""/);
assert.doesNotMatch(envExample, /COMPONENT_SCAN_API_KEY="xai-/);
assert.match(features, /Scan Component/);
assert.match(features, /Add Manually/);
assert.match(features, /COMPONENT_SCAN_API_KEY/);
assert.match(workflow, /npm run test:scan/);
assert.doesNotMatch(scanLib, /prisma/);

const componentModel = schema.slice(
  schema.indexOf("model Component {"),
  schema.indexOf("model MaintenanceSchedule"),
);
for (const field of [
  "manufacturer",
  "modelNumber",
  "productNumber",
  "serialNumber",
  "userManual",
  "warrantyInfo",
  "vendorName",
]) {
  assert.match(componentModel, new RegExp(`\\b${field}\\b`));
}

console.log("scan: maps a label into existing component fields; no schema change");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
