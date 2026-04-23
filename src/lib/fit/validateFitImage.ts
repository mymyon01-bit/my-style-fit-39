// ─── FIT IMAGE QUALITY GATE ────────────────────────────────────────────────
// Validates an AI-generated fit image BEFORE we show it as the final result.
// Catches the most common failure modes that produce broken / blurry / cut /
// blank output:
//
//   • image fails to load at all (404 / CORS / blob expired)
//   • resolution below production threshold (= upscaled garbage)
//   • image is essentially blank (single dominant color, e.g. all-white,
//     all-black, all-gray padding) — typical "rendering failed" placeholder
//   • aspect ratio wildly off (extremely thin or extremely flat) — cropping
//     went wrong
//
// On failure, the caller (`useFitTryOn`) auto-retries ONCE with a safer
// preset and only surfaces the error UI if that retry also fails. The user
// never sees the broken image.

export interface FitImageValidation {
  ok: boolean;
  reason?:
    | "load_failed"
    | "too_small"
    | "blank"
    | "too_blurry"
    | "bad_aspect"
    | "decode_failed";
  width?: number;
  height?: number;
  /** Variance of sampled pixels (0..~7000). Lower = blanker. */
  variance?: number;
  /** Edge/detail score. Lower = blurrier / more smeared. */
  sharpness?: number;
}

const MIN_WIDTH = 512;
const MIN_HEIGHT = 640;
const MIN_VARIANCE = 220;     // empirically: real fit photos > 600, blanks < 80
const MIN_SHARPNESS = 4.2;    // measured on the cropped mannequin/garment zone, not the empty studio background
const MIN_ASPECT = 0.45;      // width / height
const MAX_ASPECT = 1.30;
const SAMPLE_GRID = 18;       // 18×18 = 324 samples — fast, robust

function prepareAnalysisCanvas(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  const cropW = Math.max(64, Math.min(img.naturalWidth, 256));
  const cropH = Math.max(64, Math.min(img.naturalHeight, 256));
  c.width = cropW;
  c.height = cropH;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  // Focus validation on the mannequin + garment area instead of the full studio
  // frame. A large white background can make clean renders look "blurry" even
  // when the garment itself is sharp and intact.
  const srcX = img.naturalWidth * 0.18;
  const srcY = img.naturalHeight * 0.10;
  const srcW = img.naturalWidth * 0.64;
  const srcH = img.naturalHeight * 0.82;

  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, cropW, cropH);
  return { ctx, width: cropW, height: cropH };
}

function loadImage(url: string, timeoutMs = 15_000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let settled = false;
    const t = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("timeout"));
    }, timeoutMs);
    img.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(t);
      reject(new Error("img_load_failed"));
    };
    img.src = url;
  });
}

function computeVariance(img: HTMLImageElement): number | null {
  try {
    const prepared = prepareAnalysisCanvas(img);
    if (!prepared) return null;
    const { ctx, width: W, height: H } = prepared;
    const data = ctx.getImageData(0, 0, W, H).data;

    // Sample on a coarse grid for speed.
    const samples: number[] = [];
    const stepX = Math.max(1, Math.floor(W / SAMPLE_GRID));
    const stepY = Math.max(1, Math.floor(H / SAMPLE_GRID));
    for (let y = 0; y < H; y += stepY) {
      for (let x = 0; x < W; x += stepX) {
        const i = (y * W + x) * 4;
        // Luma
        samples.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }
    }
    if (!samples.length) return 0;
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
    return variance;
  } catch {
    return null;
  }
}

function computeSharpness(img: HTMLImageElement): number | null {
  try {
    const prepared = prepareAnalysisCanvas(img);
    if (!prepared) return null;
    const { ctx, width: W, height: H } = prepared;
    const data = ctx.getImageData(0, 0, W, H).data;

    const lumaAt = (x: number, y: number) => {
      const i = (y * W + x) * 4;
      return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    };

    let total = 0;
    let count = 0;
    for (let y = 1; y < H - 1; y += 2) {
      for (let x = 1; x < W - 1; x += 2) {
        const center = lumaAt(x, y);
        const dx = Math.abs(center - lumaAt(x + 1, y));
        const dy = Math.abs(center - lumaAt(x, y + 1));
        total += dx + dy;
        count += 2;
      }
    }
    return count ? total / count : 0;
  } catch {
    return null;
  }
}

export async function validateFitImage(url: string): Promise<FitImageValidation> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } catch {
    return { ok: false, reason: "load_failed" };
  }
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (!W || !H) return { ok: false, reason: "decode_failed" };
  if (W < MIN_WIDTH || H < MIN_HEIGHT) {
    return { ok: false, reason: "too_small", width: W, height: H };
  }
  const aspect = W / H;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) {
    return { ok: false, reason: "bad_aspect", width: W, height: H };
  }
  const variance = computeVariance(img);
  if (variance !== null && variance < MIN_VARIANCE) {
    return { ok: false, reason: "blank", width: W, height: H, variance };
  }
  const sharpness = computeSharpness(img);
  if (sharpness !== null && sharpness < MIN_SHARPNESS) {
    return {
      ok: false,
      reason: "too_blurry",
      width: W,
      height: H,
      variance: variance ?? undefined,
      sharpness,
    };
  }
  return {
    ok: true,
    width: W,
    height: H,
    variance: variance ?? undefined,
    sharpness: sharpness ?? undefined,
  };
}
