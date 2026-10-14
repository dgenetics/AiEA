import { emptyComponentInput } from "@/lib/farm-money";
import type { SystemComponentInput } from "@/lib/farm-types";
import { sheetRepeatToInput } from "@/lib/schedule-sheet";

/** Shown when a label or code cannot be read. */
export const SCAN_READ_ERROR = "Couldn't read that, try again or type it in";

/** Raw upload cap. The phone also compresses the frame before sending. */
export const SCAN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const SCAN_RATE_LIMIT = 8;
export const SCAN_RATE_WINDOW_MS = 10 * 60 * 1000;

export const SCAN_TOO_LARGE = "That photo is too large. Try again or type it in.";
export const SCAN_RATE_LIMITED = "Too many scans. Try again in a few minutes or type it in.";

export type ScanTag = "suggested" | "from label" | "barcode" | "where you started" | "found online";

export type TaggedText = {
  value: string;
  tag: ScanTag | null;
};

export type ScanEveryUnit = "day" | "week" | "month" | "year";

export type ScanSchedule = {
  name: string;
  everyCount: number;
  everyUnit: ScanEveryUnit;
  note: string;
};

export type ComponentScanReview = {
  configured: boolean;
  decodedCode: string | null;
  intro: string;
  name: TaggedText;
  manufacturer: TaggedText;
  modelNumber: TaggedText;
  productNumber: TaggedText;
  serialNumber: TaggedText;
  userManual: TaggedText;
  manualTitle: string;
  manualKind: string;
  warrantyInfo: TaggedText;
  vendorName: TaggedText;
  schedule: ScanSchedule | null;
};

export type ScanScheduleDraft = {
  name: string;
  description: string | null;
  frequency: string;
  intervalDays: number | null;
  isRecurring: boolean;
  nextDueDate: string;
};

const hits = new Map<string, number[]>();

export function resetScanRateLimit(): void {
  hits.clear();
}

/** In-memory cap per workspace. A fresh server process starts empty. */
export function takeScanSlot(
  key: string,
  now = Date.now(),
  limit = SCAN_RATE_LIMIT,
  windowMs = SCAN_RATE_WINDOW_MS,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const fresh = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (fresh.length >= limit) {
    hits.set(key, fresh);
    const oldest = fresh[0] ?? now;
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }
  fresh.push(now);
  hits.set(key, fresh);
  return { ok: true };
}

export function sniffScanImage(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes.length < 32) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

export function scanImageProblem(bytes: Uint8Array, maxBytes = SCAN_IMAGE_MAX_BYTES): string | null {
  if (bytes.byteLength > maxBytes) return SCAN_TOO_LARGE;
  if (!sniffScanImage(bytes)) return SCAN_READ_ERROR;
  return null;
}

export function firstBarcodeValue(codes: Array<{ rawValue?: string | null }>): string | null {
  for (const code of codes) {
    const value = code.rawValue?.trim();
    if (value) return value.slice(0, 500);
  }
  return null;
}

export function joinMakeAndModel(manufacturer: string, modelNumber: string): string {
  return [manufacturer.trim(), modelNumber.trim()].filter(Boolean).join(" ");
}

/** Keep an edited "Make and model" line in the two stored fields. */
export function splitMakeAndModel(
  text: string,
  previousManufacturer: string,
): { manufacturer: string; modelNumber: string } {
  const trimmed = text.trim().replace(/\s+/g, " ");
  const previous = previousManufacturer.trim();
  if (!trimmed) return { manufacturer: "", modelNumber: "" };
  if (previous && trimmed.toLowerCase().startsWith(previous.toLowerCase())) {
    return {
      manufacturer: trimmed.slice(0, previous.length).trim(),
      modelNumber: trimmed.slice(previous.length).trim(),
    };
  }
  const space = trimmed.indexOf(" ");
  if (space === -1) return { manufacturer: "", modelNumber: trimmed };
  return {
    manufacturer: trimmed.slice(0, space).trim(),
    modelNumber: trimmed.slice(space + 1).trim(),
  };
}

export function makeModelTag(manufacturer: TaggedText, modelNumber: TaggedText): ScanTag | null {
  const tags = [manufacturer, modelNumber]
    .filter((item) => item.value.trim() && item.tag)
    .map((item) => item.tag as ScanTag);
  if (tags.includes("from label")) return "from label";
  if (tags.includes("barcode")) return "barcode";
  return tags[0] ?? null;
}

/** A tag stays only while the field is still the value the scan supplied. */
export function editTaggedField(field: TaggedText, value: string): TaggedText {
  if (value === field.value) return field;
  return { value, tag: null };
}

export function editMakeAndModel(
  manufacturer: TaggedText,
  modelNumber: TaggedText,
  text: string,
): { manufacturer: TaggedText; modelNumber: TaggedText } {
  if (text === joinMakeAndModel(manufacturer.value, modelNumber.value)) {
    return { manufacturer, modelNumber };
  }
  const split = splitMakeAndModel(text, manufacturer.value);
  return {
    manufacturer: { value: split.manufacturer, tag: null },
    modelNumber: { value: split.modelNumber, tag: null },
  };
}

function blank(): TaggedText {
  return { value: "", tag: null };
}

function clip(value: string, max = 300): string {
  return value.trim().slice(0, max);
}

function httpUrl(value: string): string {
  const trimmed = value.trim().slice(0, 2000);
  if (!/^https?:\/\//i.test(trimmed)) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function tagged(value: string, tag: ScanTag): TaggedText {
  const clipped = clip(value);
  return clipped ? { value: clipped, tag } : blank();
}

export function emptyScanReview(configured: boolean, decodedCode: string | null): ComponentScanReview {
  return {
    configured,
    decodedCode,
    intro: "Read the code. Check it over, then save.",
    name: blank(),
    manufacturer: blank(),
    modelNumber: blank(),
    productNumber: blank(),
    serialNumber: blank(),
    userManual: blank(),
    manualTitle: "",
    manualKind: "",
    warrantyInfo: blank(),
    vendorName: blank(),
    schedule: null,
  };
}

function reviewHasFinding(review: ComponentScanReview): boolean {
  return Boolean(
    review.name.value ||
      review.manufacturer.value ||
      review.modelNumber.value ||
      review.productNumber.value ||
      review.serialNumber.value ||
      review.userManual.value ||
      review.warrantyInfo.value ||
      review.vendorName.value ||
      review.schedule,
  );
}

function withIntro(review: ComponentScanReview): ComponentScanReview {
  const fromLabel = [review.manufacturer, review.modelNumber, review.serialNumber, review.productNumber].some(
    (field) => field.tag === "from label" && field.value,
  );
  const lookedUp = Boolean(review.userManual.value || review.schedule || review.name.tag === "suggested");
  return {
    ...review,
    intro:
      fromLabel || lookedUp
        ? "Found it from the label. Check it over, then save."
        : "Read the code. Check it over, then save.",
  };
}

function applyDecodedCode(review: ComponentScanReview, code: string | null): ComponentScanReview {
  const value = code?.trim() ?? "";
  if (!value) return review;
  const next = { ...review, decodedCode: value.slice(0, 500) };
  const url = httpUrl(value);
  if (url) {
    if (!next.userManual.value) {
      next.userManual = { value: url, tag: "barcode" };
      next.manualTitle = next.manualTitle || url;
    }
    return next;
  }
  if (!next.productNumber.value) next.productNumber = { value: clip(value), tag: "barcode" };
  return next;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

const EVERY_UNIT: Record<string, ScanEveryUnit> = {
  day: "day",
  days: "day",
  week: "week",
  weeks: "week",
  month: "month",
  months: "month",
  year: "year",
  years: "year",
};

function parseSchedule(value: unknown): ScanSchedule | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = clip(textOf(record.name), 160);
  const unit = EVERY_UNIT[textOf(record.everyUnit).trim().toLowerCase()];
  const count = Number(record.everyCount);
  if (!name || !unit || !Number.isInteger(count) || count <= 0 || count > 120) return null;
  const note = clip(textOf(record.note), 80) || "per the manual";
  return { name, everyCount: count, everyUnit: unit, note };
}

/** Turn the model JSON into review fields. Null when the payload is not usable JSON. */
export function parseScanModelText(text: string): Omit<
  ComponentScanReview,
  "configured" | "decodedCode" | "intro"
> | null {
  const record = asRecord(extractJson(text));
  if (!record) return null;

  let manufacturer = textOf(record.manufacturer);
  let modelNumber = textOf(record.modelNumber);
  if (!manufacturer.trim() && !modelNumber.trim()) {
    const combined = textOf(record.makeAndModel);
    if (combined.trim()) {
      const split = splitMakeAndModel(combined, "");
      manufacturer = split.manufacturer;
      modelNumber = split.modelNumber;
    }
  }

  const manual = asRecord(record.manual);
  const manualUrl = httpUrl(textOf(manual?.url));
  const manualTitle = clip(textOf(manual?.title), 200);
  const kindRaw = textOf(manual?.kind).trim().toLowerCase();
  const manualKind = !manualUrl ? "" : kindRaw === "pdf" || /\.pdf($|\?)/i.test(manualUrl) ? "PDF" : "page";

  return {
    name: tagged(textOf(record.name), "suggested"),
    manufacturer: tagged(manufacturer, "from label"),
    modelNumber: tagged(modelNumber, "from label"),
    productNumber: tagged(textOf(record.productNumber), "from label"),
    serialNumber: tagged(textOf(record.serialNumber), "from label"),
    userManual: manualUrl ? { value: manualUrl, tag: "found online" } : blank(),
    manualTitle,
    manualKind,
    warrantyInfo: tagged(textOf(record.warrantyInfo), "found online"),
    vendorName: tagged(textOf(record.vendorName), "found online"),
    schedule: parseSchedule(record.schedule),
  };
}

function mergeVision(
  base: ComponentScanReview,
  vision: NonNullable<ReturnType<typeof parseScanModelText>>,
): ComponentScanReview {
  return {
    ...base,
    name: vision.name.value ? vision.name : base.name,
    manufacturer: vision.manufacturer.value ? vision.manufacturer : base.manufacturer,
    modelNumber: vision.modelNumber.value ? vision.modelNumber : base.modelNumber,
    productNumber: vision.productNumber.value ? vision.productNumber : base.productNumber,
    serialNumber: vision.serialNumber.value ? vision.serialNumber : base.serialNumber,
    userManual: vision.userManual.value ? vision.userManual : base.userManual,
    manualTitle: vision.manualTitle || base.manualTitle,
    manualKind: vision.manualKind || base.manualKind,
    warrantyInfo: vision.warrantyInfo.value ? vision.warrantyInfo : base.warrantyInfo,
    vendorName: vision.vendorName.value ? vision.vendorName : base.vendorName,
    schedule: vision.schedule ?? base.schedule,
  };
}

export function reviewToComponentInput(review: ComponentScanReview): SystemComponentInput {
  const input = emptyComponentInput();
  input.name = review.name.value.trim();
  input.manufacturer = review.manufacturer.value.trim();
  input.modelNumber = review.modelNumber.value.trim();
  input.productNumber = review.productNumber.value.trim();
  input.serialNumber = review.serialNumber.value.trim();
  input.userManual = review.userManual.value.trim();
  input.warrantyInfo = review.warrantyInfo.value.trim();
  input.vendorName = review.vendorName.value.trim();
  return input;
}

const REPEAT_UNIT = { day: "days", week: "weeks", month: "months", year: "years" } as const;

export function scanScheduleDraft(schedule: ScanSchedule, now = new Date()): ScanScheduleDraft | null {
  const cadence = sheetRepeatToInput(String(schedule.everyCount), REPEAT_UNIT[schedule.everyUnit]);
  if (!cadence?.isRecurring || cadence.intervalDays == null || cadence.intervalDays <= 0) return null;
  const name = schedule.name.trim();
  if (!name) return null;
  const due = new Date(now.getTime());
  due.setDate(due.getDate() + cadence.intervalDays);
  const y = due.getFullYear();
  const m = String(due.getMonth() + 1).padStart(2, "0");
  const d = String(due.getDate()).padStart(2, "0");
  return {
    name,
    description: schedule.note.trim() || null,
    frequency: cadence.frequency,
    intervalDays: cadence.intervalDays,
    isRecurring: true,
    nextDueDate: new Date(`${y}-${m}-${d}T12:00:00`).toISOString(),
  };
}

export function scheduleSuggestionText(schedule: ScanSchedule): { name: string; rest: string } {
  const unit = schedule.everyCount === 1 ? schedule.everyUnit : `${schedule.everyUnit}s`;
  const note = schedule.note.trim();
  const cadence = `every ${schedule.everyCount} ${unit}`;
  return { name: schedule.name.trim(), rest: note ? `${cadence}, ${note}` : cadence };
}

/** Barcode or QR only, when the photo never reached the model. */
export function reviewFromCode(decodedCode: string): ComponentScanReview | null {
  const review = withIntro(applyDecodedCode(emptyScanReview(false, decodedCode), decodedCode));
  return reviewHasFinding(review) ? review : null;
}

function toDataUrl(bytes: Uint8Array, mediaType: "image/jpeg" | "image/png"): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mediaType};base64,${btoa(binary)}`;
}

export async function interpretComponentScan(input: {
  bytes: Uint8Array;
  mediaType: "image/jpeg" | "image/png";
  decodedCode: string | null;
  configured: boolean;
  readModel?: (args: { imageDataUrl: string; decodedCode: string | null }) => Promise<string>;
}): Promise<{ ok: true; result: ComponentScanReview } | { ok: false; status: number; error: string }> {
  let review = applyDecodedCode(emptyScanReview(input.configured, input.decodedCode), input.decodedCode);

  if (input.configured && input.readModel) {
    try {
      const text = await input.readModel({
        imageDataUrl: toDataUrl(input.bytes, input.mediaType),
        decodedCode: input.decodedCode,
      });
      const vision = parseScanModelText(text);
      if (vision) review = mergeVision(review, vision);
    } catch {
      if (!reviewHasFinding(review)) {
        return { ok: false, status: 502, error: SCAN_READ_ERROR };
      }
    }
  }

  if (!reviewHasFinding(review)) {
    return { ok: false, status: 422, error: SCAN_READ_ERROR };
  }
  return { ok: true, result: withIntro(review) };
}
