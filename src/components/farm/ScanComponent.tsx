"use client";

import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { Modal } from "@/components/farm/Modal";
import { useLockBodyScroll } from "@/components/use-keyboard-frame";
import {
  SCAN_IMAGE_MAX_BYTES,
  SCAN_READ_ERROR,
  firstBarcodeValue,
  joinMakeAndModel,
  makeModelTag,
  reviewToComponentInput,
  scanScheduleDraft,
  scheduleSuggestionText,
  splitMakeAndModel,
  type ComponentScanReview,
  type ScanScheduleDraft,
  type ScanTag,
} from "@/lib/component-scan";
import type { SystemComponentInput } from "@/lib/farm-types";

type Detector = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

type DetectorCtor = new (options?: { formats?: string[] }) => Detector;

type ZxingReader = {
  decodeFromCanvas: (canvas: HTMLCanvasElement) => { getText: () => string };
};

const FORMATS = [
  "qr_code",
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "data_matrix",
  "pdf417",
  "itf",
  "codabar",
  "aztec",
];

function createDetector(): Detector | null {
  const Ctor = (window as Window & { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: FORMATS });
  } catch {
    try {
      return new Ctor();
    } catch {
      return null;
    }
  }
}

let zxingReader: Promise<ZxingReader> | null = null;

function getZxingReader(): Promise<ZxingReader> {
  zxingReader ??= import("@zxing/browser").then((mod) => new mod.BrowserMultiFormatReader());
  return zxingReader;
}

async function readCode(canvas: HTMLCanvasElement, detector: Detector | null): Promise<string | null> {
  if (detector) {
    try {
      const found = await detector.detect(canvas);
      const code = firstBarcodeValue(found);
      if (code) return code;
    } catch {
      /* The native detector can reject a frame. ZXing still gets a turn. */
    }
  }
  try {
    const reader = await getZxingReader();
    const text = reader.decodeFromCanvas(canvas).getText().trim();
    return text ? text.slice(0, 500) : null;
  } catch {
    return null;
  }
}

function drawFrame(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
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
      signal: AbortSignal.timeout(70_000),
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
  onClose,
  onTypeInstead,
  onSave,
}: {
  systemName: string;
  onClose: () => void;
  onTypeInstead: () => void;
  onSave: (input: SystemComponentInput, schedule: ScanScheduleDraft | null) => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sending = useRef(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [review, setReview] = useState<ComponentScanReview | null>(null);
  const [scheduleAdded, setScheduleAdded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useLockBodyScroll(true);

  useEffect(() => {
    let cancelled = false;
    let active: MediaStream | null = null;
    async function open() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setCameraError("Couldn't open the camera. Use Photo of label or type it in.");
        return;
      }
      try {
        const next = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        active = next;
        setStream(next);
        const track = next.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchAvailable(Boolean(caps?.torch));
      } catch {
        if (!cancelled) setCameraError("Couldn't open the camera. Use Photo of label or type it in.");
      }
    }
    void open();
    return () => {
      cancelled = true;
      active?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!review) return;
    stream?.getTracks().forEach((track) => track.stop());
  }, [review, stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || review) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    const detector = createDetector();
    let stopped = false;
    const timer = window.setInterval(() => {
      if (stopped || sending.current || video.readyState < 2) return;
      const canvas = drawFrame(video, video.videoWidth, video.videoHeight);
      if (canvas.width < 2) return;
      void readCode(canvas, detector).then((code) => {
        if (!code || stopped || sending.current) return;
        void submit(canvas, code);
      });
    }, 700);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      video.srcObject = null;
    };
    // submit is stable enough for the life of the stream; review closes the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, review]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !review) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, review]);

  async function submit(canvas: HTMLCanvasElement, code: string | null) {
    if (sending.current) return;
    sending.current = true;
    setReading(true);
    setError(null);
    try {
      const blob = await canvasJpeg(canvas);
      const result = await postScan(blob, code);
      setScheduleAdded(false);
      setReview(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SCAN_READ_ERROR);
    } finally {
      sending.current = false;
      setReading(false);
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file || sending.current) return;
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = drawFrame(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      const code = await readCode(canvas, createDetector());
      await submit(canvas, code);
    } catch {
      sending.current = false;
      setReading(false);
      setError(SCAN_READ_ERROR);
    }
  }

  async function toggleTorch() {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  async function save() {
    if (!review || saving) return;
    const input = reviewToComponentInput(review);
    if (!input.name.trim()) return;
    const schedule =
      scheduleAdded && review.schedule ? scanScheduleDraft(review.schedule) : null;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(input, schedule);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Couldn't save that component");
      setSaving(false);
    }
  }

  if (review) {
    const makeModel = joinMakeAndModel(review.manufacturer.value, review.modelNumber.value);
    const makeTag = makeModelTag(review.manufacturer, review.modelNumber);
    const scheduleText = review.schedule ? scheduleSuggestionText(review.schedule) : null;
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
            setReview({ ...review, name: { value, tag: review.name.tag ?? "suggested" } })
          }
        />
        {makeModel || review.manufacturer.value || review.modelNumber.value ? (
          <TaggedInput
            label="Make and model"
            value={makeModel}
            tag={makeTag}
            onChange={(value) => {
              const split = splitMakeAndModel(value, review.manufacturer.value);
              const tag = makeTag;
              setReview({
                ...review,
                manufacturer: { value: split.manufacturer, tag },
                modelNumber: { value: split.modelNumber, tag },
              });
            }}
          />
        ) : null}
        {review.serialNumber.value ? (
          <TaggedInput
            label="Serial number"
            value={review.serialNumber.value}
            tag={review.serialNumber.tag}
            onChange={(value) =>
              setReview({ ...review, serialNumber: { ...review.serialNumber, value } })
            }
          />
        ) : null}
        {review.productNumber.value ? (
          <TaggedInput
            label="Part number"
            value={review.productNumber.value}
            tag={review.productNumber.tag}
            onChange={(value) =>
              setReview({ ...review, productNumber: { ...review.productNumber, value } })
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
              setReview({ ...review, warrantyInfo: { ...review.warrantyInfo, value } })
            }
          />
        ) : null}
        {review.vendorName.value ? (
          <TaggedInput
            label="Vendor"
            value={review.vendorName.value}
            tag={review.vendorName.tag}
            onChange={(value) => setReview({ ...review, vendorName: { ...review.vendorName, value } })}
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
                  setReview({
                    ...review,
                    userManual: { ...review.userManual, value: event.target.value },
                  })
                }
                className="mt-1 w-full bg-transparent text-[13px] text-[#a8a29e] outline-none"
              />
              <p className="mt-0.5 text-[13px] text-[#a8a29e]">
                {manualKind ? `Found online, ${manualKind}` : "Found online"}
              </p>
            </div>
          </div>
        ) : null}
        {review.schedule && scheduleText ? (
          <div className="mt-3.5">
            <p className="text-[13px] text-[#78716c]">Suggested schedule</p>
            <div className="mt-1.5 rounded-[14px] border border-dashed border-[#d6cdbb] px-3.5 py-3 text-[15px] leading-snug text-[#1c1917]">
              <p>
                <b className="font-semibold">{scheduleText.name}</b> {scheduleText.rest}
              </p>
              <button
                type="button"
                aria-pressed={scheduleAdded}
                onClick={() => setScheduleAdded((added) => !added)}
                className="mt-1.5 inline-flex min-h-11 items-center text-[15px] font-medium text-[#166534]"
              >
                {scheduleAdded ? "Added" : "+ Add this schedule"}
              </button>
            </div>
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

  const hint = reading ? "Reading the label…" : "Point at the nameplate, barcode, or QR code";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#1d1b19] text-white" role="dialog" aria-label="Scan component">
      <div className="flex items-center justify-between px-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-[22px]"
        >
          ×
        </button>
        <p className="text-[17px]">Scan component</p>
        {torchAvailable ? (
          <button
            type="button"
            aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
            aria-pressed={torchOn}
            onClick={() => void toggleTorch()}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center ${torchOn ? "text-[#facc15]" : "text-white"}`}
          >
            <Zap className="size-5" aria-hidden />
          </button>
        ) : (
          <span className="inline-flex min-h-11 min-w-11" />
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline autoPlay muted />
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[220px] w-[min(310px,calc(100%-48px))] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border-[3px] border-white shadow-[0_0_0_2000px_rgba(0,0,0,0.45)]" />
      </div>
      <p className="px-6 text-center text-[16px]">{hint}</p>
      {cameraError ? <p className="mt-2 px-6 text-center text-[14px] text-[#fecaca]">{cameraError}</p> : null}
      {error ? (
        <p className="mt-2 px-6 text-center text-[14px] text-[#fecaca]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-center gap-7 px-5 pt-4 pb-[max(24px,env(safe-area-inset-bottom))] text-[15px] text-[#e7e5e4]">
        <label className="inline-flex min-h-11 cursor-pointer items-center">
          Photo of label
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onPhoto(file);
            }}
          />
        </label>
        <button type="button" onClick={onTypeInstead} className="inline-flex min-h-11 items-center">
          Type it in
        </button>
      </div>
    </div>
  );
}
