import { NextResponse } from "next/server";
import { getComponentScanConfig, readComponentLabel } from "@/lib/component-scan-ai";
import {
  SCAN_IMAGE_MAX_BYTES,
  SCAN_RATE_LIMITED,
  SCAN_READ_ERROR,
  SCAN_TOO_LARGE,
  interpretComponentScan,
  reviewFromCode,
  scanImageProblem,
  sniffScanImage,
  takeScanSlot,
} from "@/lib/component-scan";
import { downscaleScanImage } from "@/lib/scan-image";
import { requireWorkspace } from "@/lib/require-workspace";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: SCAN_READ_ERROR }, { status: 400 });
  }

  const codeRaw = form.get("code");
  const decodedCode = typeof codeRaw === "string" && codeRaw.trim() ? codeRaw.trim().slice(0, 500) : null;
  const image = form.get("image");
  const config = getComponentScanConfig();

  if (!(image instanceof File) || image.size === 0) {
    const result = decodedCode ? reviewFromCode(decodedCode) : null;
    if (!result) return NextResponse.json({ error: SCAN_READ_ERROR }, { status: 400 });
    return NextResponse.json({ result });
  }

  if (image.size > SCAN_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: SCAN_TOO_LARGE }, { status: 413 });
  }

  const bytes = new Uint8Array(await image.arrayBuffer());
  const problem = scanImageProblem(bytes);
  if (problem) {
    const status = problem === SCAN_TOO_LARGE ? 413 : 400;
    return NextResponse.json({ error: problem }, { status });
  }
  const mediaType = sniffScanImage(bytes);
  if (!mediaType) return NextResponse.json({ error: SCAN_READ_ERROR }, { status: 400 });

  const slot = takeScanSlot(auth.workspaceId);
  if (!slot.ok) {
    return NextResponse.json(
      { error: SCAN_RATE_LIMITED },
      { status: 429, headers: { "Retry-After": String(slot.retryAfterSec) } },
    );
  }

  const prepared = await downscaleScanImage(bytes, mediaType);

  try {
    const outcome = await interpretComponentScan({
      bytes: prepared.bytes,
      mediaType: prepared.mediaType,
      decodedCode,
      configured: config.configured,
      readModel: config.configured ? (args) => readComponentLabel(args, config) : undefined,
    });
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json({ result: outcome.result });
  } catch (error) {
    console.error("component scan failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: SCAN_READ_ERROR }, { status: 502 });
  }
}
