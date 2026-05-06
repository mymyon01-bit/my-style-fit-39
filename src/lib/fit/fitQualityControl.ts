// ─── FIT QUALITY CONTROL (V3.7) ─────────────────────────────────────────────
// Post-generation validation layer that compares the AI try-on result against
// the user's reference body silhouette and detects common AI artifacts
// (melted garment, broken limbs, identity drift, blank renders, etc.).
//
// The output drives:
//   • auto re-render once when score is too low
//   • internal logging for debugging
//   • subtle "trust" chips shown on the result page
//
// Pure browser/canvas analysis — no extra network round-trips.

export interface BodyConsistencyResult {
  bodyConsistencyScore: number;     // 0..100
  silhouetteDrift: number;          // 0..1 (lower = more consistent)
  shoulderDrift: number;
  waistDrift: number;
  hipDrift: number;
  legLengthDrift: number;
  poseDrift: number;
  passed: boolean;                  // score >= 85
}

export interface VisualIntegrityResult {
  visualIntegrityScore: number;     // 0..100
  detectedIssues: string[];
  requiresRerender: boolean;        // score < 75 or major issue
}

export interface QualityVerdict extends BodyConsistencyResult, VisualIntegrityResult {
  shouldRerender: boolean;
  reason: string | null;
}

// ── helpers ────────────────────────────────────────────────────────────────
function loadImg(url: string, timeoutMs = 12_000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let done = false;
    const t = window.setTimeout(() => { if (done) return; done = true; reject(new Error("timeout")); }, timeoutMs);
    img.onload = () => { if (done) return; done = true; window.clearTimeout(t); resolve(img); };
    img.onerror = () => { if (done) return; done = true; window.clearTimeout(t); reject(new Error("img_error")); };
    img.src = url;
  });
}

/** Build a low-res luminance grid for fast silhouette analysis. */
function toLumaGrid(img: HTMLImageElement, W = 64, H = 96): Uint8ClampedArray | null {
  try {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    const out = new Uint8ClampedArray(W * H);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      out[j] = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) | 0;
    }
    return out;
  } catch { return null; }
}

/** Estimate background luma by sampling the four corners. */
function estimateBg(grid: Uint8ClampedArray, W: number, H: number): number {
  const samples: number[] = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    samples.push(grid[y * W + x], grid[y * W + (W - 1 - x)], grid[(H - 1 - y) * W + x], grid[(H - 1 - y) * W + (W - 1 - x)]);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

/** Returns row-by-row foreground widths normalized to [0..1] of image width. */
function silhouetteWidths(grid: Uint8ClampedArray, W: number, H: number): number[] {
  const bg = estimateBg(grid, W, H);
  const threshold = 18;
  const widths: number[] = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    let left = -1, right = -1;
    for (let x = 0; x < W; x++) {
      if (Math.abs(grid[y * W + x] - bg) > threshold) {
        if (left === -1) left = x;
        right = x;
      }
    }
    widths[y] = left === -1 ? 0 : (right - left + 1) / W;
  }
  return widths;
}

/** Mean column index of foreground for a row band — used as pose center. */
function poseCenter(grid: Uint8ClampedArray, W: number, H: number, y0: number, y1: number): number | null {
  const bg = estimateBg(grid, W, H);
  let sum = 0, count = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    if (Math.abs(grid[y * W + x] - bg) > 18) { sum += x; count++; }
  }
  return count ? sum / count / W : null;
}

function avg(a: number[], from: number, to: number): number {
  let s = 0, n = 0;
  for (let i = from; i < to; i++) { s += a[i]; n++; }
  return n ? s / n : 0;
}

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

// ── BODY CONSISTENCY ───────────────────────────────────────────────────────
export async function compareBodyConsistency(
  referenceUrl: string | null,
  resultUrl: string,
): Promise<BodyConsistencyResult> {
  // Without a reference photo, give a neutral pass — we have nothing to drift against.
  if (!referenceUrl) {
    return {
      bodyConsistencyScore: 90,
      silhouetteDrift: 0, shoulderDrift: 0, waistDrift: 0, hipDrift: 0, legLengthDrift: 0, poseDrift: 0,
      passed: true,
    };
  }
  try {
    const [ref, res] = await Promise.all([loadImg(referenceUrl), loadImg(resultUrl)]);
    const W = 64, H = 96;
    const refGrid = toLumaGrid(ref, W, H);
    const resGrid = toLumaGrid(res, W, H);
    if (!refGrid || !resGrid) return neutralPass();

    const wRef = silhouetteWidths(refGrid, W, H);
    const wRes = silhouetteWidths(resGrid, W, H);

    // Region bands (top→bottom): shoulder ~10–22%, waist ~38–48%, hip ~52–62%, legs ~72–96%.
    const shoulderRef = avg(wRef, Math.floor(H * 0.10), Math.floor(H * 0.22));
    const shoulderRes = avg(wRes, Math.floor(H * 0.10), Math.floor(H * 0.22));
    const waistRef    = avg(wRef, Math.floor(H * 0.38), Math.floor(H * 0.48));
    const waistRes    = avg(wRes, Math.floor(H * 0.38), Math.floor(H * 0.48));
    const hipRef      = avg(wRef, Math.floor(H * 0.52), Math.floor(H * 0.62));
    const hipRes      = avg(wRes, Math.floor(H * 0.52), Math.floor(H * 0.62));

    const drift = (a: number, b: number) => (a + b) > 0 ? Math.abs(a - b) / Math.max(a, b, 0.01) : 0;
    const shoulderDrift = drift(shoulderRef, shoulderRes);
    const waistDrift    = drift(waistRef, waistRes);
    const hipDrift      = drift(hipRef, hipRes);

    // Leg length: top of legs to bottom of foreground.
    const legTop = (g: number[]) => {
      for (let y = Math.floor(H * 0.55); y < H; y++) if (g[y] > 0.05) return y;
      return H - 1;
    };
    const legBot = (g: number[]) => {
      for (let y = H - 1; y >= 0; y--) if (g[y] > 0.05) return y;
      return H - 1;
    };
    const legRefLen = (legBot(wRef) - legTop(wRef)) / H;
    const legResLen = (legBot(wRes) - legTop(wRes)) / H;
    const legLengthDrift = drift(legRefLen, legResLen);

    // Pose drift: torso horizontal center.
    const cRef = poseCenter(refGrid, W, H, Math.floor(H * 0.20), Math.floor(H * 0.50));
    const cRes = poseCenter(resGrid, W, H, Math.floor(H * 0.20), Math.floor(H * 0.50));
    const poseDrift = cRef !== null && cRes !== null ? Math.abs(cRef - cRes) * 2 : 0;

    // Overall silhouette drift = mean per-row width difference.
    let totalDiff = 0, totalN = 0;
    for (let y = 0; y < H; y++) {
      const ref = wRef[y], res = wRes[y];
      if (ref + res > 0) { totalDiff += Math.abs(ref - res); totalN++; }
    }
    const silhouetteDrift = clamp01(totalN ? totalDiff / totalN * 1.5 : 0);

    const score = Math.round(100 * (1 - clamp01(
      0.30 * silhouetteDrift +
      0.18 * shoulderDrift +
      0.18 * waistDrift +
      0.14 * hipDrift +
      0.10 * legLengthDrift +
      0.10 * poseDrift
    )));
    const bounded = Math.max(0, Math.min(100, score));
    return {
      bodyConsistencyScore: bounded,
      silhouetteDrift, shoulderDrift, waistDrift, hipDrift, legLengthDrift, poseDrift,
      passed: bounded >= 85,
    };
  } catch {
    return neutralPass();
  }
}

function neutralPass(): BodyConsistencyResult {
  return {
    bodyConsistencyScore: 88,
    silhouetteDrift: 0, shoulderDrift: 0, waistDrift: 0, hipDrift: 0, legLengthDrift: 0, poseDrift: 0,
    passed: true,
  };
}

// ── VISUAL INTEGRITY ───────────────────────────────────────────────────────
export async function detectVisualErrors(resultUrl: string): Promise<VisualIntegrityResult> {
  try {
    const img = await loadImg(resultUrl);
    const W = 64, H = 96;
    const grid = toLumaGrid(img, W, H);
    if (!grid) return { visualIntegrityScore: 50, detectedIssues: ["decode_failed"], requiresRerender: true };

    const bg = estimateBg(grid, W, H);
    let fg = 0;
    for (let i = 0; i < grid.length; i++) if (Math.abs(grid[i] - bg) > 18) fg++;
    const fgRatio = fg / grid.length;

    const issues: string[] = [];
    let score = 100;

    // Almost no foreground = blank/melted/missing subject.
    if (fgRatio < 0.06) { issues.push("missing_subject"); score -= 60; }
    // Too much foreground = composition broke or subject is huge.
    if (fgRatio > 0.85) { issues.push("composition_broken"); score -= 35; }

    // Silhouette continuity: count vertical "jumps" — sudden width spikes
    // suggest extra limbs / fragmented body.
    const widths = silhouetteWidths(grid, W, H);
    let spikes = 0;
    for (let y = 1; y < widths.length - 1; y++) {
      const dPrev = widths[y] - widths[y - 1];
      const dNext = widths[y] - widths[y + 1];
      if (dPrev > 0.30 && dNext > 0.30) spikes++;
    }
    if (spikes >= 4) { issues.push("fragmented_silhouette"); score -= 25; }
    else if (spikes >= 2) { issues.push("minor_silhouette_artifacts"); score -= 10; }

    // Bottom-heavy emptiness = legs cropped / missing.
    const bottomFg = avg(widths, Math.floor(H * 0.75), H);
    const midFg = avg(widths, Math.floor(H * 0.30), Math.floor(H * 0.55));
    if (midFg > 0.15 && bottomFg < 0.04) { issues.push("legs_missing"); score -= 20; }

    // Top-heavy emptiness = head/shoulders missing.
    const topFg = avg(widths, 0, Math.floor(H * 0.20));
    if (midFg > 0.15 && topFg < 0.03) { issues.push("upper_body_missing"); score -= 20; }

    // Variance check — featureless plane.
    let mean = 0; for (let i = 0; i < grid.length; i++) mean += grid[i]; mean /= grid.length;
    let variance = 0; for (let i = 0; i < grid.length; i++) variance += (grid[i] - mean) ** 2; variance /= grid.length;
    if (variance < 80) { issues.push("low_detail"); score -= 30; }

    const bounded = Math.max(0, Math.min(100, Math.round(score)));
    const major = issues.some((k) => k === "missing_subject" || k === "composition_broken" || k === "decode_failed");
    return {
      visualIntegrityScore: bounded,
      detectedIssues: issues,
      requiresRerender: bounded < 75 || major,
    };
  } catch {
    return { visualIntegrityScore: 50, detectedIssues: ["analysis_failed"], requiresRerender: true };
  }
}

// ── COMBINED VERDICT ───────────────────────────────────────────────────────
export async function evaluateFitQuality(
  referenceUrl: string | null,
  resultUrl: string,
): Promise<QualityVerdict> {
  const [body, visual] = await Promise.all([
    compareBodyConsistency(referenceUrl, resultUrl),
    detectVisualErrors(resultUrl),
  ]);
  let reason: string | null = null;
  if (body.bodyConsistencyScore < 70) reason = "body_changed";
  else if (visual.requiresRerender) reason = `visual_issue:${visual.detectedIssues[0] ?? "unknown"}`;
  return {
    ...body,
    ...visual,
    shouldRerender: reason !== null,
    reason,
  };
}

// ── NEGATIVE PROMPT ADD-ON ─────────────────────────────────────────────────
export const STRONG_BODY_LOCK_NEGATIVE =
  "Previous render failed because the body changed. Preserve exact body silhouette, pose, crop, scale, and proportions. Do not alter waist, hips, legs, shoulders, torso, or posture. Keep the identical mannequin from the reference — only the garment may change.";
