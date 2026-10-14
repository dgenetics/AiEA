import sharp from "sharp";

/** Longest edge sent to the label model. */
export const SCAN_IMAGE_EDGE = 1024;

/**
 * Shrink a nameplate so the vision call stays small.
 * Returns the original bytes when sharp cannot read them.
 */
export async function downscaleScanImage(
  bytes: Uint8Array,
  mediaType: "image/jpeg" | "image/png",
): Promise<{ bytes: Uint8Array; mediaType: "image/jpeg" | "image/png" }> {
  try {
    const meta = await sharp(bytes, { failOn: "none" }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height) return { bytes, mediaType };
    const out = await sharp(bytes, { failOn: "none", animated: false })
      .rotate()
      .resize({
        width: SCAN_IMAGE_EDGE,
        height: SCAN_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();
    return { bytes: new Uint8Array(out), mediaType: "image/jpeg" };
  } catch {
    return { bytes, mediaType };
  }
}
