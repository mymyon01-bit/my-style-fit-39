// ─── SIZE-BASED GARMENT DISTORTION ──────────────────────────────────────────
// Applies non-uniform geometric warp to the AI-generated garment overlay
// BEFORE it is composited onto the body base. Driven entirely by the
// overlay map (which is itself driven by fitSolver).
//
// Result: the same product at S/M/L/XL produces visibly different chest
// width, waist width, hem width, body length, sleeve length and shoulder
// drop in the final composite — even if the underlying AI image was similar.

import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

export interface DistortionPlan {
  // Per-anchor horizontal scale factors (1.0 = no change)
  chestScaleX: number;
  waistScaleX: number;
  hemScaleX: number;
  // Vertical scale of the whole garment
  scaleY: number;
  // Sleeve length scale (vertical at the arm region)
  sleeveScale: number;
  // Pixels to shift the upper-shoulder band downward (positive = drop)
  shoulderOffsetPx: number;
  // Reference canvas height (for anchor-line math, must match composite canvas)
  canvasHeight: number;
  // Y of shoulder, chest, waist, hem on the canvas
  shoulderLineY: number;
  chestLineY: number;
  waistLineY: number;
  hemLineY: number;
  // Debug label: e.g. "S","M","L","XL"
  sizeLabel: string;
}

interface BuildArgs {
  selectedSize: string;
  chestWidthPx: number;
  waistWidthPx: number;
  hemWidthPx: number;
  bodyLengthPx: number;
  sleeveLengthPx: number;
  shoulderDropPx: number;
  canvasWidth: number;
  canvasHeight: number;
  shoulderLineY: number;
  chestLineY: number;
  waistLineY: number;
}

/**
 * Convert overlay-map pixel widths into per-anchor scale factors.
 *
 * Reference width = the chest width at size M for THIS body. We approximate
 * the M-baseline as the chest width / silhouette neutral ratio (1.0) using
 * a stable canvas-fraction reference. Then S→XL scale relative to that.
 */
export function buildDistortionPlan(args: BuildArgs): DistortionPlan {
  const size = (args.selectedSize || "M").toUpperCase();

  // Per-size MULTIPLIERS applied on top of the overlay map widths.
  // These guarantee S/M/L/XL look visibly different even when the AI
  // produced near-identical silhouettes.
  //  - S: tighter, slightly shorter, sleeves trimmer
  //  - M: neutral
  //  - L: relaxed, slightly longer
  //  - XL+: oversized, dropped shoulder, longer sleeves
  const SIZE_MULT: Record<string, {
    chestK: number; waistK: number; hemK: number;
    yK: number; sleeveK: number; shoulderDropK: number;
  }> = {
    XS: { chestK: 0.90, waistK: 0.90, hemK: 0.92, yK: 0.94, sleeveK: 0.92, shoulderDropK: 0.0  },
    S:  { chestK: 0.94, waistK: 0.94, hemK: 0.95, yK: 0.97, sleeveK: 0.95, shoulderDropK: 0.0  },
    M:  { chestK: 1.00, waistK: 1.00, hemK: 1.00, yK: 1.00, sleeveK: 1.00, shoulderDropK: 1.0  },
    L:  { chestK: 1.06, waistK: 1.08, hemK: 1.06, yK: 1.03, sleeveK: 1.05, shoulderDropK: 1.5  },
    XL: { chestK: 1.13, waistK: 1.14, hemK: 1.11, yK: 1.06, sleeveK: 1.10, shoulderDropK: 2.2  },
    XXL:{ chestK: 1.20, waistK: 1.20, hemK: 1.16, yK: 1.09, sleeveK: 1.14, shoulderDropK: 2.8  },
  };
  const m = SIZE_MULT[size] ?? SIZE_MULT.M;

  // Convert absolute pixel widths into scale factors against the canvas.
  // We anchor "scale 1.0" at: chest occupies ~46% of canvas width on size M.
  const ref = args.canvasWidth * 0.46;
  const chestScaleX = clamp((args.chestWidthPx / ref) * m.chestK, 0.78, 1.35);
  const waistScaleX = clamp((args.waistWidthPx / ref) * m.waistK, 0.78, 1.40);
  const hemScaleX   = clamp((args.hemWidthPx   / ref) * m.hemK,   0.78, 1.40);

  // Vertical scale: derived from body length vs baseline (shoulder→hem ≈ 480px).
  const baseLen = 480;
  const scaleY = clamp((args.bodyLengthPx / baseLen) * m.yK, 0.90, 1.18);

  // Sleeve scale: relative to baseline 230px.
  const sleeveScale = clamp((args.sleeveLengthPx / 230) * m.sleeveK, 0.85, 1.25);

  // Shoulder drop multiplier — overlay map already gives px; amplify per size.
  const shoulderOffsetPx = Math.round(args.shoulderDropPx * m.shoulderDropK);

  const hemLineY = Math.round(args.shoulderLineY + args.bodyLengthPx);

  return {
    chestScaleX, waistScaleX, hemScaleX,
    scaleY, sleeveScale,
    shoulderOffsetPx,
    canvasHeight: args.canvasHeight,
    shoulderLineY: args.shoulderLineY,
    chestLineY:    args.chestLineY,
    waistLineY:    args.waistLineY,
    hemLineY,
    sizeLabel:     size,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Apply the distortion plan to a garment overlay image.
 *
 * Pipeline:
 *  1. resize the source to (W, H) so we work in canvas coordinates
 *  2. for each horizontal slice (band) compute a per-band scaleX:
 *       - 0..shoulderLineY              → chestScaleX (with shoulder drop offset)
 *       - shoulderLineY..waistLineY     → linear blend chestScaleX → waistScaleX
 *       - waistLineY..hemLineY          → linear blend waistScaleX → hemScaleX
 *       - hemLineY..H                   → hemScaleX (clipped/feathered)
 *  3. write each band centered horizontally, then squeeze/stretch via Image.resize on a slice
 *  4. apply sleeve vertical scale to the side regions (outside of chest band) — approximated via vertical squash on the L/R 22% margins
 *  5. apply scaleY by squashing/stretching the entire pre-warped image in Y
 *  6. apply shoulder drop by translating the top band down by shoulderOffsetPx
 *
 * NOTE: ImageScript has no full warp; we emulate non-uniform width by
 * stitching per-band horizontally-resized slices. This is fast and
 * deterministic on Deno.
 */
export async function applyGarmentDistortion(
  overlayBytes: Uint8Array,
  plan: DistortionPlan,
  canvasWidth: number,
): Promise<Uint8Array> {
  const src = await Image.decode(overlayBytes);
  src.resize(canvasWidth, plan.canvasHeight);

  // Step 1 — vertical scale (apply scaleY to the whole image, then center on canvas)
  const scaledH = Math.max(1, Math.round(plan.canvasHeight * plan.scaleY));
  const yScaled = src.clone().resize(canvasWidth, scaledH);

  // Compose into a fresh canvas, top-aligned at shoulderLineY (so anchors stay valid)
  const yCanvas = new Image(canvasWidth, plan.canvasHeight);
  // Center vertically around the chest line
  const yOffset = clampI(plan.chestLineY - Math.round(scaledH * (plan.chestLineY / plan.canvasHeight)), -plan.canvasHeight, plan.canvasHeight);
  yCanvas.composite(yScaled, 0, yOffset);

  // Step 2 — per-band horizontal warp
  const out = new Image(canvasWidth, plan.canvasHeight);
  const bands = buildBands(plan);

  for (const band of bands) {
    const h = band.y2 - band.y1;
    if (h <= 0) continue;
    // Crop the y-scaled canvas to this horizontal band
    const slice = yCanvas.clone().crop(0, band.y1, canvasWidth, h);
    // Resize the slice horizontally to (canvasWidth * bandScale)
    const newW = Math.max(8, Math.round(canvasWidth * band.scaleX));
    slice.resize(newW, h);
    // Center horizontally
    const xOff = Math.round((canvasWidth - newW) / 2);
    // Apply shoulder-drop offset only to the top band (above shoulder line)
    const yOff = band.y1 + (band.applyShoulderDrop ? plan.shoulderOffsetPx : 0);
    out.composite(slice, xOff, yOff);
  }

  // Step 3 — sleeve vertical adjustment on side regions
  if (Math.abs(plan.sleeveScale - 1) > 0.02) {
    applySleeveAdjust(out, plan, canvasWidth);
  }

  return await out.encode();
}

interface Band {
  y1: number; y2: number;
  scaleX: number;
  applyShoulderDrop: boolean;
}

function buildBands(p: DistortionPlan): Band[] {
  const bands: Band[] = [];
  const STEP = 8; // 8px slices for smooth blending
  const sections: Array<{ from: number; to: number; sFrom: number; sTo: number; topBand?: boolean }> = [
    { from: 0, to: p.shoulderLineY, sFrom: p.chestScaleX, sTo: p.chestScaleX, topBand: true },
    { from: p.shoulderLineY, to: p.waistLineY, sFrom: p.chestScaleX, sTo: p.waistScaleX },
    { from: p.waistLineY, to: p.hemLineY, sFrom: p.waistScaleX, sTo: p.hemScaleX },
    { from: p.hemLineY, to: p.canvasHeight, sFrom: p.hemScaleX, sTo: p.hemScaleX },
  ];
  for (const sec of sections) {
    const span = Math.max(1, sec.to - sec.from);
    for (let y = sec.from; y < sec.to; y += STEP) {
      const y2 = Math.min(sec.to, y + STEP);
      const t = (y - sec.from) / span;
      const scaleX = sec.sFrom + (sec.sTo - sec.sFrom) * t;
      bands.push({ y1: y, y2, scaleX, applyShoulderDrop: !!sec.topBand });
    }
  }
  return bands;
}

/**
 * Approximate sleeve length adjustment by squashing/stretching the L/R side
 * columns (outer 22% on each side) vertically between shoulderLineY and hemLineY.
 */
function applySleeveAdjust(img: Image, p: DistortionPlan, W: number): void {
  const sideW = Math.round(W * 0.22);
  const top = p.shoulderLineY;
  const bottom = Math.min(p.hemLineY, p.canvasHeight);
  const h = bottom - top;
  if (h <= 0) return;

  for (const xStart of [0, W - sideW]) {
    const slice = img.clone().crop(xStart, top, sideW, h);
    const newH = Math.max(8, Math.round(h * p.sleeveScale));
    slice.resize(sideW, newH);
    // Clear original side band
    for (let yy = top; yy < bottom; yy++) {
      for (let xx = xStart; xx < xStart + sideW; xx++) {
        img.setPixelAt(xx + 1, yy + 1, 0x00000000);
      }
    }
    // Anchor sleeves at the shoulder line — extra length hangs down (or shortens up)
    img.composite(slice, xStart, top);
  }
}

function clampI(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function describeDistortion(p: DistortionPlan): string {
  return `size=${p.sizeLabel} chestX=${p.chestScaleX.toFixed(2)} waistX=${p.waistScaleX.toFixed(2)} hemX=${p.hemScaleX.toFixed(2)} Y=${p.scaleY.toFixed(2)} sleeve=${p.sleeveScale.toFixed(2)} shoulderDropPx=${p.shoulderOffsetPx}`;
}
