// ─── BODY IMAGE QUALITY GATE ───────────────────────────────────────────────
// Runs before any try-on call. Validates dimensions / aspect ratio and, when
// possible, recrops + pads the input to a clean centered portrait canvas so
// Replicate (IDM-VTON) gets a consistent input across users and sessions.
//
// Strategy: lightweight heuristic pipeline (no heavy ML deps in the bundle).
// 1. Load image via <img> + canvas.
// 2. Reject if too small or extreme aspect ratio (likely cropped).
// 3. Auto-fix: pad/recrop to a 3:4 portrait canvas with neutral background,
//    centered horizontally, biased toward upper-third vertically (where the
//    head usually sits) so torso + legs stay visible.
// 4. Return a data URL ready to be uploaded or passed straight to the edge
//    function. The router accepts any HTTPS or data URL Replicate can fetch.

export interface PreprocessResult {
  valid: boolean;
  reason?:
    | "load_failed"
    | "too_small"
    | "extreme_aspect"
    | "missing_url";
  croppedImageUrl: string; // original URL on failure, processed data URL on success
  width?: number;
  height?: number;
  zoomRatio?: number;
  cropApplied?: boolean;
}

const TARGET_W = 768;
const TARGET_H = 1024; // 3:4 portrait
const MIN_LONG_EDGE = 512;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

/**
 * Heuristic recrop into a centered 3:4 portrait canvas.
 * - If source is wider than tall, we letterbox-pad with neutral grey.
 * - If source is taller than tall portrait, we keep the upper portion
 *   (which typically contains head + torso) and crop the bottom.
 */
function recropToPortrait(img: HTMLImageElement): { dataUrl: string; zoomRatio: number } {
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_W;
  canvas.height = TARGET_H;
  const ctx = canvas.getContext("2d")!;

  // Neutral light-grey background (works for both light & dark UIs and reads
  // as "studio-neutral" to the try-on model).
  ctx.fillStyle = "#ECECEC";
  ctx.fillRect(0, 0, TARGET_W, TARGET_H);

  const srcAspect = img.width / img.height;
  const targetAspect = TARGET_W / TARGET_H; // 0.75

  let drawW: number;
  let drawH: number;
  let dx: number;
  let dy: number;
  let zoomRatio = 1;

  if (srcAspect > targetAspect) {
    // Wider than 3:4 → fit by height, letterbox sides.
    drawH = TARGET_H;
    drawW = drawH * srcAspect;
    dx = (TARGET_W - drawW) / 2;
    dy = 0;
    zoomRatio = drawH / img.height;
  } else {
    // Taller / equal → fit by width, may crop bottom if very tall.
    drawW = TARGET_W;
    drawH = drawW / srcAspect;
    dx = 0;
    // Bias toward the top so head + torso stay visible when cropping legs.
    dy = drawH > TARGET_H ? -(drawH - TARGET_H) * 0.15 : (TARGET_H - drawH) / 2;
    zoomRatio = drawW / img.width;
  }

  ctx.drawImage(img, dx, dy, drawW, drawH);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), zoomRatio };
}

export async function preprocessBodyImage(imageUrl: string | null): Promise<PreprocessResult> {
  if (!imageUrl) {
    return { valid: false, reason: "missing_url", croppedImageUrl: "" };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(imageUrl);
  } catch {
    // CORS or 404 — still let the router try the original URL; flag invalid
    // so the UI can show a helpful CTA, but pass the original through so
    // server-side fetches (which don't have CORS) can still attempt.
    return {
      valid: false,
      reason: "load_failed",
      croppedImageUrl: imageUrl,
    };
  }

  const longEdge = Math.max(img.width, img.height);
  if (longEdge < MIN_LONG_EDGE) {
    return {
      valid: false,
      reason: "too_small",
      croppedImageUrl: imageUrl,
      width: img.width,
      height: img.height,
    };
  }

  const aspect = img.width / img.height;
  // Reject ultra-wide (panoramic) or ultra-tall (banner) inputs.
  if (aspect > 2.2 || aspect < 0.35) {
    return {
      valid: false,
      reason: "extreme_aspect",
      croppedImageUrl: imageUrl,
      width: img.width,
      height: img.height,
    };
  }

  try {
    const { dataUrl, zoomRatio } = recropToPortrait(img);
    return {
      valid: true,
      croppedImageUrl: dataUrl,
      width: TARGET_W,
      height: TARGET_H,
      zoomRatio,
      cropApplied: true,
    };
  } catch (e) {
    // Canvas tainted (cross-origin without proper CORS headers) → use original.
    console.warn("[preprocessBodyImage] canvas tainted, using original", e);
    return {
      valid: true, // we still trust the source enough to send it
      croppedImageUrl: imageUrl,
      width: img.width,
      height: img.height,
      zoomRatio: 1,
      cropApplied: false,
    };
  }
}
