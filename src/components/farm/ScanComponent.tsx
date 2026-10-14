"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/farm/Modal";
import {
  SCAN_IMAGE_MAX_BYTES,
  SCAN_READ_ERROR,
  applyManualLookup,
  editMakeAndModel,
  editTaggedField,
  joinMakeAndModel,
  makeModelTag,
  reviewToComponentInput,
  scanScheduleDraft,
  scheduleSuggestionText,
  type ComponentScanReview,
  type ManualLookup,
  type ScanScheduleDraft,
  type ScanTag,
} from "@/lib/component-scan";
import type { SystemComponentInput } from "@/lib/farm-types";

type ZxingReader = {
  decodeFromCanvas: (canvas: HTMLCanvasElement) => { getText: () => string };
};

const UPLOAD_EDGE = 1024;

let zxingReader: Promise<ZxingReader> | null = null;

function getZxingReader(): Promise<ZxingReader> {
  zxingReader ??= import("@zxing/browser").then((mod) => new mod.BrowserMultiFormatReader());
  return zxingReader;
}

function drawFrame(source: CanvasImageSource, width: number, height: number, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function readCode(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const reader = await getZxingReader();
    const text = reader.decodeFromCanvas(canvas).getText().trim();
    return text ? text.slice(0, 500) : null;
  } catch {
    return null;
  }
}

async function canvasJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  let quality = 0.72;
  let current = canvas;
  for (let attempt = 0; attempt < 6; attempt++) {
    const blob = await new Promise<Blob | null>((resolve) => current.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size > 0 && blob.size <= SCAN_IMAGE_MAX_BYTES) return blob;
    if (quality > 0.45) {
      quality -= 0.12;
      continue;
    }
    const next = document.createElement("canvas");
    next.width = Math.max(1, Math.round(current.width * 0.75));
    next.height = Math.max(1, Math.round(current.height * 0.75));
    next.getContext("2d")?.drawImage(current, 0, 0, next.width, next.height);
    current = next;
  }
  throw new Error(SCAN_READ_ERROR);
}

async function postScan(blob: Blob, code: string | null): Promise<ComponentScanReview> {
  const body = new FormData();
  body.set("image", blob, "label.jpg");
  if (code) body.set("code", code);
  let response: Response;
  try {
    response = await fetch("/api/components/scan", {
      method: "POST",
      body,
      credentials: "include",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new Error(SCAN_READ_ERROR);
  }
  if (response.status === 401) {
    window.location.assign("/login?next=" + encodeURIComponent(window.location.pathname));
    throw new Error("Session expired — sign in again");
  }
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    result?: ComponentScanReview;
  };
  if (!response.ok || !payload.result) throw new Error(payload.error || SCAN_READ_ERROR);
  return payload.result;
}

function SourceTag({ tag }: { tag: ScanTag }) {
  return (
    <span className="shrink-0 self-center rounded-lg bg-[#fbf0d0] px-1.5 py-0.5 text-[12px] whitespace-nowrap text-[#a16207]">
      {tag}
    </span>
  );
}

function TaggedInput({
  label,
  value,
  tag,
  onChange,
  readOnly,
  placeholder,
}: {
  label: string;
  value: string;
  tag: ScanTag | null;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="mt-3.5 block text-[13px] text-[#78716c]">
      {label}
      <span className="mt-1.5 flex min-h-12 items-center gap-2 rounded-[14px] border border-[#e7dfd0] bg-[#fffdf8] px-3.5 py-3">
        <input
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[16px] text-[#1c1917] outline-none placeholder:text-stone-400 read-only:text-[#1c1917]"
        />
        {tag ? <SourceTag tag={tag} /> : null}
      </span>
    </label>
  );
}

export function ScanComponent({
  systemName,
  file,
  onClose,
  onTypeInstead,
  onSave,
}: {
  systemName: string;
  file: File;
  onClose: () => void;
  onTypeInstead: () => void;
  onSave: (input: SystemComponentInput, schedules: ScanScheduleDraft[]) => Promise<void>;
}) {
  const [review, setReview] = useState<ComponentScanReview | null>(null);
  const [readId, setReadId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [addedSchedule, setAddedSchedule] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError(null);
      setReview(null);
      try {
        const bitmap = await createImageBitmap(file);
        const decoded = drawFrame(bitmap, bitmap.width, bitmap.height, 1600);
        const code = await readCode(decoded);
        const upload =
          decoded.width <= UPLOAD_EDGE && decoded.height <= UPLOAD_EDGE
            ? decoded
            : drawFrame(decoded, decoded.width, decoded.height, UPLOAD_EDGE);
        bitmap.close();
        const blob = await canvasJpeg(upload);
        const result = await postScan(blob, code);
        if (cancelled) return;
        setAddedSchedule({});
        setReview(result);
        setReadId((id) => id + 1);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : SCAN_READ_ERROR);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (readId === 0 || !review) return;
    const manufacturer = review.manufacturer.value.trim();
    const modelNumber = review.modelNumber.value.trim();
    const productNumber = review.productNumber.value.trim();
    const needsManual = !review.userManual.value.trim();
    const needsSchedule = review.schedules.length === 0;
    if ((!manufacturer && !modelNumber && !productNumber) || (!needsManual && !needsSchedule)) return;
    const controller = new AbortController();
    let cancelled = false;
    setLookupPending(true);
    void (async () => {
      try {
        const response = await fetch("/api/components/scan/lookup", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            manufacturer,
            modelNumber,
            productNumber,
            name: review.name.value.trim(),
          }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(150_000)]),
        });
        const payload = (await response.json().catch(() => ({}))) as { result?: ManualLookup | null };
        if (cancelled || !response.ok || !payload.result) return;
        const found = payload.result;
        setReview((current) => (current ? applyManualLookup(current, found) : current));
      } catch {
        /* The label fields are already on screen. The manual is optional. */
      } finally {
        if (!cancelled) setLookupPending(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // One lookup per label read. Editing a field must not start another.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readId]);

  async function save() {
    if (!review || saving) return;
    const input = reviewToComponentInput(review);
    if (!input.name.trim()) return;
    const schedules = review.schedules.flatMap((item, index) => {
      if (!addedSchedule[index]) return [];
      const draft = scanScheduleDraft(item);
      return draft ? [draft] : [];
    });
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(input, schedules);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Couldn't save that component");
      setSaving(false);
    }
  }

  if (review) {
    const makeModel = joinMakeAndModel(review.manufacturer.value, review.modelNumber.value);
    const makeTag = makeModelTag(review.manufacturer, review.modelNumber);
    const scheduleRows = review.schedules.map((item) => scheduleSuggestionText(item));
    const manualKind =
      review.manualKind === "PDF" || /\.pdf($|\?)/i.test(review.userManual.value) ? "PDF" : "";
    return (
      <Modal variant="sheet" title="Add component" subtitle={review.intro} onClose={onClose}>
        <TaggedInput
          label="Name"
          value={review.name.value}
          placeholder="Component name"
          tag={review.name.value ? review.name.tag : null}
          onChange={(value) =>
            setReview((current) => (current ? { ...current, name: editTaggedField(current.name, value) } : current))
          }
        />
        {makeModel || review.manufacturer.value || review.modelNumber.value ? (
          <TaggedInput
            label="Make and model"
            value={makeModel}
            tag={makeTag}
            onChange={(value) =>
              setReview((current) =>
                current ? { ...current, ...editMakeAndModel(current.manufacturer, current.modelNumber, value) } : current,
              )
            }
          />
        ) : null}
        {review.serialNumber.value ? (
          <TaggedInput
            label="Serial number"
            value={review.serialNumber.value}
            tag={review.serialNumber.tag}
            onChange={(value) =>
              setReview((current) =>
                current ? { ...current, serialNumber: editTaggedField(current.serialNumber, value) } : current,
              )
            }
          />
        ) : null}
        {review.productNumber.value ? (
          <TaggedInput
            label="Part number"
            value={review.productNumber.value}
            tag={review.productNumber.tag}
            onChange={(value) =>
              setReview((current) =>
                current ? { ...current, productNumber: editTaggedField(current.productNumber, value) } : current,
              )
            }
          />
        ) : null}
        <TaggedInput label="System" value={systemName} tag="where you started" readOnly />
        {review.warrantyInfo.value ? (
          <TaggedInput
            label="Warranty"
            value={review.warrantyInfo.value}
            tag={review.warrantyInfo.tag}
            onChange={(value) =>
              setReview((current) =>
                current ? { ...current, warrantyInfo: editTaggedField(current.warrantyInfo, value) } : current,
              )
            }
          />
        ) : null}
        {review.vendorName.value ? (
          <TaggedInput
            label="Vendor"
            value={review.vendorName.value}
            tag={review.vendorName.tag}
            onChange={(value) =>
              setReview((current) =>
                current ? { ...current, vendorName: editTaggedField(current.vendorName, value) } : current,
              )
            }
          />
        ) : null}
        {review.userManual.value ? (
          <div className="mt-3.5">
            <p className="text-[13px] text-[#78716c]">Manual</p>
            <div className="mt-1.5 rounded-[14px] border border-[#e7dfd0] bg-[#fffdf8] px-3.5 py-3">
              <a
                href={review.userManual.value}
                target="_blank"
                rel="noreferrer"
                className="text-[16px] font-medium text-[#166534]"
              >
                {review.manualTitle || "Open manual"} ↗
              </a>
              <input
                aria-label="Manual link"
                value={review.userManual.value}
                onChange={(event) =>
                  setReview((current) =>
                    current
                      ? { ...current, userManual: editTaggedField(current.userManual, event.target.value) }
                      : current,
                  )
                }
                className="mt-1 w-full bg-transparent text-[13px] text-[#a8a29e] outline-none"
              />
              {review.userManual.tag === "found online" ? (
                <p className="mt-0.5 text-[13px] text-[#a8a29e]">
                  {manualKind ? `Found online, ${manualKind}` : "Found online"}
                </p>
              ) : null}
            </div>
          </div>
        ) : lookupPending ? (
          <p className="mt-3.5 text-[13px] text-[#a8a29e]">Looking up the manual…</p>
        ) : null}
        {scheduleRows.length ? (
          <div className="mt-3.5">
            <p className="text-[13px] text-[#78716c]">
              {scheduleRows.length === 1 ? "Suggested schedule" : "Suggested schedules"}
            </p>
            {scheduleRows.map((scheduleText, index) => (
              <div
                key={`${scheduleText.name}-${index}`}
                className="mt-1.5 rounded-[14px] border border-dashed border-[#d6cdbb] px-3.5 py-3 text-[15px] leading-snug text-[#1c1917]"
              >
                <p>
                  <b className="font-semibold">{scheduleText.name}</b> {scheduleText.rest}
                </p>
                <button
                  type="button"
                  aria-pressed={Boolean(addedSchedule[index])}
                  aria-label={
                    addedSchedule[index] ? `Remove schedule ${scheduleText.name}` : `Add schedule ${scheduleText.name}`
                  }
                  onClick={() =>
                    setAddedSchedule((current) => ({ ...current, [index]: !current[index] }))
                  }
                  className="mt-1.5 inline-flex min-h-11 items-center text-[15px] font-medium text-[#166534]"
                >
                  {addedSchedule[index] ? "Added" : "+ Add this schedule"}
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {saveError ? <p className="mt-3 text-[13px] text-[#b91c1c]">{saveError}</p> : null}
        <button
          type="button"
          disabled={saving || !review.name.value.trim()}
          onClick={() => void save()}
          className="mt-5 flex h-[50px] w-full items-center justify-center rounded-[14px] bg-[#1c1917] text-[16px] font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save component"}
        </button>
      </Modal>
    );
  }

  return (
    <Modal variant="sheet" title="Scan component" onClose={onClose}>
      {error ? (
        <>
          <p className="text-[15px] text-[#b91c1c]" role="alert">
            {error}
          </p>
          <button
            type="button"
            onClick={onTypeInstead}
            className="mt-4 inline-flex min-h-11 items-center text-[15px] font-medium text-[#166534]"
          >
            Type it in
          </button>
        </>
      ) : (
        <p className="text-[15px] text-[#44403c]">Reading the label…</p>
      )}
    </Modal>
  );
}
