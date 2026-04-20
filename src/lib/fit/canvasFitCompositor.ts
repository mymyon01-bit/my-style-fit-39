// ─── CANVAS FIT COMPOSITOR ─────────────────────────────────────────────────
// Pure HTMLCanvas drawing — no AI. Combines:
//   1. body image (or generated silhouette)
//   2. garment cutout, scaled NON-UNIFORMLY per fitSolver region ratios AND
//      the deterministic FitDetailMap (chest/waist/hem widths differ)
//   3. shoulder-drop / hem rise+drop applied as pixel deltas
//   4. subtle tension + drape overlays driven by FitDetailMap.wrinkleZones
//
// Output: a data URL (PNG) the FitVisual can render immediately.
//
// Failure rule: if any detail step throws, we fall back to a uniform draw —
// the user always sees SOMETHING. Detail is additive.

import type { ProjectedPose } from "./poseKeypoints";
import type { BodyFrame } from "./buildBodyFrame";
import type { SolverResult } from "./fitSolver";
import { buildFitDetailMap, type FitDetailMap } from "./buildFitDetailMap";

interface CompositeArgs {
  bodyImageUrl?: string | null;
  garmentImageUrl: string;
  pose: ProjectedPose;
  frame: BodyFrame;
  solver: SolverResult;
  productCategory?: string | null;
  /** Optional opacity for the garment overlay (0..1). Default 1. */
  garmentOpacity?: number;
}

export interface CompositeResult {
  dataUrl: string;
  width: number;
  height: number;
  /** Diagnostics for debug overlay. */
  debug: {
    chestScale: number;
    lengthScale: number;
    sleeveScale: number;
    bodySource: "photo" | "silhouette";
    detail: FitDetailMap;
  };
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img_load_failed"));
    img.src = url;
  });
}

// Region.delta from the solver is unitless ease; we map it into a *visual*
// scale factor so S/M/L/XL render with clearly visible width/length diffs.
function regionDeltaToScale(delta: number, base = 1.0, gain = 0.6): number {
  return Math.max(0.85, Math.min(1.25, base + delta * gain));
}

function drawSilhouette(ctx: CanvasRenderingContext2D, frame: BodyFrame) {
  const grad = ctx.createLinearGradient(0, 0, 0, frame.canvasHeight);
  grad.addColorStop(0, "rgba(245, 244, 240, 1)");
  grad.addColorStop(1, "rgba(228, 226, 220, 1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, frame.canvasWidth, frame.canvasHeight);

  ctx.fillStyle = "rgba(210, 205, 195, 0.85)";
  ctx.beginPath();
  const headCx = (frame.leftShoulderX + frame.rightShoulderX) / 2;
  ctx.ellipse(headCx, frame.shoulderLineY - 130, 70, 90, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(frame.leftShoulderX, frame.shoulderLineY);
  ctx.lineTo(frame.armLeftBox.x, frame.armLeftBox.y + frame.armLeftBox.h);
  ctx.lineTo(frame.armLeftBox.x + frame.armLeftBox.w, frame.armLeftBox.y + frame.armLeftBox.h);
  ctx.lineTo(frame.waistLeftX, frame.waistLineY + 40);
  ctx.lineTo(frame.waistLeftX, frame.hipLineY + 200);
  ctx.lineTo(frame.waistRightX, frame.hipLineY + 200);
  ctx.lineTo(frame.waistRightX, frame.waistLineY + 40);
  ctx.lineTo(frame.armRightBox.x + frame.armRightBox.w, frame.armRightBox.y + frame.armRightBox.h);
  ctx.lineTo(frame.armRightBox.x, frame.armRightBox.y + frame.armRightBox.h);
  ctx.lineTo(frame.rightShoulderX, frame.shoulderLineY);
  ctx.closePath();
  ctx.fill();
}

async function drawBodyPhoto(
  ctx: CanvasRenderingContext2D,
  bodyUrl: string,
  frame: BodyFrame
): Promise<boolean> {
  try {
    const img = await loadImg(bodyUrl);
    const canvasRatio = frame.canvasWidth / frame.canvasHeight;
    const imgRatio = img.width / img.height;
    let dw: number, dh: number, dx: number, dy: number;
    if (imgRatio > canvasRatio) {
      dh = frame.canvasHeight;
      dw = dh * imgRatio;
      dx = (frame.canvasWidth - dw) / 2;
      dy = 0;
    } else {
      dw = frame.canvasWidth;
      dh = dw / imgRatio;
      dx = 0;
      dy = (frame.canvasHeight - dh) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    return true;
  } catch {
    return false;
  }
}

// ── NON-UNIFORM GARMENT DRAW ───────────────────────────────────────────────
// Slice the garment into N horizontal strips. Each strip is drawn at its own
// width interpolated between chest → waist → hem multipliers. This produces
// the visible "tighter at waist", "wider at hem" silhouette without a real
// mesh warp.

function drawGarmentSliced(
  ctx: CanvasRenderingContext2D,
  garment: HTMLImageElement,
  args: {
    centerX: number;
    topY: number;
    drawW: number;
    drawH: number;
    chestMul: number;
    waistMul: number;
    hemMul: number;
    isBottom: boolean;
  }
) {
  const { centerX, topY, drawW, drawH, chestMul, waistMul, hemMul, isBottom } = args;
  const SLICES = 18;
  const sH = garment.height / SLICES;

  // Anchor lerp positions — for tops: chest at top quarter, waist at ~60%, hem at bottom
  // for bottoms: waist at top, hem at bottom.
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  for (let i = 0; i < SLICES; i++) {
    const t = i / (SLICES - 1); // 0 → 1
    let mul: number;
    if (isBottom) {
      // waist (top) → hem (bottom)
      mul = lerp(waistMul, hemMul, t);
    } else {
      // chest (0..0.25) → waist (0.25..0.65) → hem (0.65..1)
      if (t < 0.25) {
        mul = lerp(chestMul, chestMul, t / 0.25); // hold at chest
      } else if (t < 0.65) {
        mul = lerp(chestMul, waistMul, (t - 0.25) / 0.4);
      } else {
        mul = lerp(waistMul, hemMul, (t - 0.65) / 0.35);
      }
    }
    const stripW = drawW * mul;
    const sy = i * sH;
    const dy = topY + (drawH * i) / SLICES;
    const dh = drawH / SLICES + 0.5; // tiny overlap to hide seams
    ctx.drawImage(
      garment,
      0, sy, garment.width, sH,
      centerX - stripW / 2, dy, stripW, dh
    );
  }
}

// ── DETAIL OVERLAY (tension lines + drape folds) ───────────────────────────

function drawDetailOverlay(
  ctx: CanvasRenderingContext2D,
  detail: FitDetailMap,
  frame: BodyFrame,
  pose: ProjectedPose,
  isBottom: boolean
) {
  if (detail.wrinkleZones.length === 0) return;
  const shoulderMidX = (pose.leftShoulder.x + pose.rightShoulder.x) / 2;
  const shoulderY = (pose.leftShoulder.y + pose.rightShoulder.y) / 2;
  const hipMidX = (pose.leftHip.x + pose.rightHip.x) / 2;
  const hipY = (pose.leftHip.y + pose.rightHip.y) / 2;
  const shoulderWidth = Math.abs(pose.rightShoulder.x - pose.leftShoulder.x);
  const torsoH = Math.max(60, hipY - shoulderY);

  ctx.save();
  for (const w of detail.wrinkleZones) {
    const alpha = Math.min(0.22, w.intensity * 0.28);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 1.1;

    let cx = shoulderMidX;
    let cy = shoulderY + torsoH * 0.35;
    let zoneW = shoulderWidth * 1.3;
    let zoneH = torsoH * 0.35;

    switch (w.zone) {
      case "chest":
        cx = shoulderMidX;
        cy = shoulderY + torsoH * 0.22;
        zoneW = shoulderWidth * 1.2;
        zoneH = torsoH * 0.24;
        break;
      case "waist":
        cx = (shoulderMidX + hipMidX) / 2;
        cy = shoulderY + torsoH * 0.6;
        zoneW = shoulderWidth * 1.1;
        zoneH = torsoH * 0.3;
        break;
      case "shoulder":
        cx = shoulderMidX;
        cy = shoulderY + 6;
        zoneW = shoulderWidth * 1.4;
        zoneH = 28;
        break;
      case "sleeve":
        // draw on both arms
        for (const sx of [pose.leftShoulder.x - 18, pose.rightShoulder.x + 18]) {
          drawWrinkleLines(ctx, sx, shoulderY + 40, 36, 90, w.direction, w.intensity);
        }
        continue;
      case "hem":
        cx = isBottom ? hipMidX : (shoulderMidX + hipMidX) / 2;
        cy = isBottom ? frame.canvasHeight - 80 : hipY + 30;
        zoneW = shoulderWidth * 1.25;
        zoneH = 60;
        break;
    }
    drawWrinkleLines(ctx, cx, cy, zoneW, zoneH, w.direction, w.intensity);
  }
  ctx.restore();
}

// ── REALISM LAYERS ─────────────────────────────────────────────────────────
// Lightweight illusion-only layers. None of these change geometry — they just
// make the flat scaled overlay feel like a worn garment.

/** Soft contact shadow under the garment to anchor it on the body. */
function drawContactShadow(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  drawW: number,
  drawH: number,
  isBottom: boolean
) {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "rgba(0,0,0,1)";
  // canvas filter is widely supported in modern browsers; if unsupported,
  // the rect just renders sharper — still acceptable.
  try { (ctx as any).filter = "blur(10px)"; } catch { /* ignore */ }
  const padX = drawW * 0.08;
  const shadowY = isBottom ? topY + drawH * 0.15 : topY + drawH * 0.25;
  const shadowH = drawH * 0.7;
  ctx.beginPath();
  ctx.ellipse(
    centerX,
    shadowY + shadowH / 2,
    drawW / 2 - padX,
    shadowH / 2,
    0, 0, Math.PI * 2
  );
  ctx.fill();
  try { (ctx as any).filter = "none"; } catch { /* ignore */ }
  ctx.restore();
}

/** Curved hem mask — clears the rectangular bottom into a quadratic curve. */
function applyHemCurve(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  drawW: number,
  drawH: number,
  curvePx: number,
  canvasW: number,
  canvasH: number
) {
  if (curvePx === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0,0,0,1)";
  const left = centerX - drawW / 2 - 4;
  const right = centerX + drawW / 2 + 4;
  const baseY = topY + drawH;
  ctx.beginPath();
  if (curvePx > 0) {
    // hem dips lower in the center → carve a downward arc out of the area
    // *below* the rectangle so visible hem becomes convex
    ctx.moveTo(left, baseY - Math.abs(curvePx));
    ctx.quadraticCurveTo(centerX, baseY + Math.abs(curvePx) * 1.1, right, baseY - Math.abs(curvePx));
    ctx.lineTo(right, canvasH + 20);
    ctx.lineTo(left, canvasH + 20);
  } else {
    // hem rises in the center → carve an upward arc (concave hem)
    const rise = Math.abs(curvePx);
    ctx.moveTo(left, baseY - rise * 1.4);
    ctx.quadraticCurveTo(centerX, baseY + rise * 0.2, right, baseY - rise * 1.4);
    ctx.lineTo(right, canvasH + 20);
    ctx.lineTo(left, canvasH + 20);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Evenly spaced soft vertical drape lines — for L / XL / relaxed fits. */
function drawDrapeLines(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  drawW: number,
  drawH: number,
  intensity: number // 0..1
) {
  if (intensity <= 0) return;
  const count = Math.round(2 + intensity * 5); // 2..7 lines
  const usableW = drawW * 0.78;
  const left = centerX - usableW / 2;
  const step = usableW / (count + 1);
  const top = topY + drawH * 0.18;
  const bottom = topY + drawH * 0.92;
  ctx.save();
  ctx.globalAlpha = 0.10 + intensity * 0.12;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= count; i++) {
    const x = left + step * i;
    const sway = (i % 2 === 0 ? 1 : -1) * (1.5 + intensity * 3);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.quadraticCurveTo(x + sway, (top + bottom) / 2, x, bottom);
    ctx.stroke();
  }
  ctx.restore();
}

/** Very subtle film-grain noise across the garment area only. */
function drawFabricNoise(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  drawW: number,
  drawH: number
) {
  try {
    const w = Math.max(8, Math.floor(drawW));
    const h = Math.max(8, Math.floor(drawH));
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 10; // ~4% alpha — barely perceptible
    }
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    tctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.globalCompositeOperation = "overlay";
    ctx.drawImage(tmp, centerX - drawW / 2, topY, drawW, drawH);
    ctx.restore();
  } catch {
    /* noise is decorative — never break render */
  }
}

function drawWrinkleLines(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  dir: "horizontal" | "diagonal" | "vertical",
  intensity: number
) {
  const count = Math.max(2, Math.round(2 + intensity * 4));
  const step = h / (count + 1);
  const halfW = w / 2;

  for (let i = 1; i <= count; i++) {
    const y = cy - h / 2 + step * i;
    ctx.beginPath();
    if (dir === "horizontal") {
      // shallow curved line
      const dy = (i % 2 === 0 ? -1 : 1) * intensity * 2;
      ctx.moveTo(cx - halfW, y);
      ctx.quadraticCurveTo(cx, y + dy, cx + halfW, y);
    } else if (dir === "diagonal") {
      const slope = (i % 2 === 0 ? -1 : 1) * (8 + intensity * 6);
      ctx.moveTo(cx - halfW, y - slope / 2);
      ctx.quadraticCurveTo(cx, y, cx + halfW, y + slope / 2);
    } else {
      // vertical drape fold
      const x = cx - halfW + (w / (count + 1)) * i;
      ctx.moveTo(x, cy - h / 2);
      ctx.quadraticCurveTo(x + intensity * 3, cy, x, cy + h / 2);
    }
    ctx.stroke();
  }
}

export async function composeFitImage(args: CompositeArgs): Promise<CompositeResult> {
  const { frame, pose, solver, garmentImageUrl, bodyImageUrl } = args;
  const isBottom =
    /(pant|jean|trouser|short|skirt|legging|bottom)/i.test(args.productCategory || "");

  const detail = buildFitDetailMap({ solver, frame, isBottom });

  const canvas = document.createElement("canvas");
  canvas.width = frame.canvasWidth;
  canvas.height = frame.canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  // ── 1. BODY LAYER ────────────────────────────────────────────────────────
  let bodySource: "photo" | "silhouette" = "silhouette";
  if (bodyImageUrl) {
    const ok = await drawBodyPhoto(ctx, bodyImageUrl, frame);
    if (ok) bodySource = "photo";
    else drawSilhouette(ctx, frame);
  } else {
    drawSilhouette(ctx, frame);
  }

  // ── 2. GARMENT LAYER ─────────────────────────────────────────────────────
  let garmentImg: HTMLImageElement;
  try {
    garmentImg = await loadImg(garmentImageUrl);
  } catch {
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: frame.canvasWidth,
      height: frame.canvasHeight,
      debug: { chestScale: 1, lengthScale: 1, sleeveScale: 1, bodySource, detail },
    };
  }

  const chestScale = regionDeltaToScale(solver.regions.chest.delta, 1.0, 0.8);
  const waistScale = regionDeltaToScale(solver.regions.waist.delta, 1.0, 0.7);
  const lengthScale = regionDeltaToScale(solver.regions.length.delta, 1.0, 0.5);
  const sleeveScale = regionDeltaToScale(solver.regions.sleeve.delta, 1.0, 0.7);

  const shoulderMidX = (pose.leftShoulder.x + pose.rightShoulder.x) / 2;
  const shoulderY = (pose.leftShoulder.y + pose.rightShoulder.y) / 2;
  const hipMidX = (pose.leftHip.x + pose.rightHip.x) / 2;
  const hipY = (pose.leftHip.y + pose.rightHip.y) / 2;
  const shoulderWidth = Math.abs(pose.rightShoulder.x - pose.leftShoulder.x);
  const torsoHeight = Math.max(60, hipY - shoulderY);

  let targetW: number;
  let targetH: number;
  let topY: number;
  let centerX: number;

  if (isBottom) {
    const waistWidth = Math.max(80, Math.abs(pose.rightHip.x - pose.leftHip.x));
    targetW = waistWidth * 1.6 * waistScale;
    targetH =
      (frame.canvasHeight - hipY - 30) * lengthScale +
      detail.hemDropPx -
      detail.hemRisePx;
    centerX = hipMidX;
    topY = hipY - 20;
  } else {
    targetW =
      shoulderWidth * 1.55 * chestScale * Math.max(1, sleeveScale * 0.95) +
      detail.shoulderDropPx * 0.6; // dropped shoulder widens the silhouette
    targetH =
      torsoHeight * 1.65 * lengthScale +
      detail.hemDropPx -
      detail.hemRisePx;
    centerX = shoulderMidX;
    // shoulder drop nudges the garment down a touch as well
    topY = shoulderY - shoulderWidth * 0.15 + Math.max(0, detail.shoulderDropPx) * 0.25;
  }

  const garmentAspect = garmentImg.height / garmentImg.width;
  const aspectH = targetW * garmentAspect;
  const drawH = Math.max(60, aspectH * 0.6 + targetH * 0.4);
  const drawW = Math.max(60, targetW);

  // ── REALISM PARAMS (size-driven, deterministic) ──────────────────────────
  const shoulderOffsetPx = (() => {
    if (isBottom) return 0;
    switch (detail.silhouetteLabel) {
      case "TRIM":      return -5;
      case "FITTED":    return -2;
      case "REGULAR":   return 0;
      case "RELAXED":   return 10;
      case "OVERSIZED": return 20;
      default:          return 0;
    }
  })();
  const adjTopY = topY + shoulderOffsetPx;

  const hemCurvePx = (() => {
    switch (detail.silhouetteLabel) {
      case "TRIM":      return -6;
      case "FITTED":    return -2;
      case "REGULAR":   return 0;
      case "RELAXED":   return 10;
      case "OVERSIZED": return 18;
      default:          return 0;
    }
  })();

  const drapeIntensity = (() => {
    const base = detail.drapeAmount;
    const bias =
      detail.silhouetteLabel === "OVERSIZED" ? 0.35 :
      detail.silhouetteLabel === "RELAXED"   ? 0.20 :
      detail.silhouetteLabel === "TRIM"      ? 0.0  : 0.05;
    return Math.min(1, base + bias);
  })();

  // ── 2a. CONTACT SHADOW (anchors garment to body) ─────────────────────────
  try {
    drawContactShadow(ctx, centerX, adjTopY, drawW, drawH, isBottom);
  } catch (err) {
    console.warn("[canvasFitCompositor] contact shadow skipped", err);
  }

  // ── 2b. GARMENT (sliced, non-uniform) ────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = args.garmentOpacity ?? 1;
  if (bodySource === "photo") {
    ctx.globalCompositeOperation = "multiply";
  }
  try {
    drawGarmentSliced(ctx, garmentImg, {
      centerX,
      topY: adjTopY,
      drawW,
      drawH,
      chestMul: detail.chestWidthMul,
      waistMul: detail.waistWidthMul,
      hemMul: detail.hemWidthMul,
      isBottom,
    });
  } catch {
    ctx.drawImage(garmentImg, centerX - drawW / 2, adjTopY, drawW, drawH);
  }
  ctx.restore();

  // ── 2c. HEM CURVE (carve curved bottom edge) ─────────────────────────────
  try {
    applyHemCurve(ctx, centerX, adjTopY, drawW, drawH, hemCurvePx, frame.canvasWidth, frame.canvasHeight);
  } catch (err) {
    console.warn("[canvasFitCompositor] hem curve skipped", err);
  }

  // ── 3. DRAPE LINES (vertical fabric folds, L/XL) ─────────────────────────
  try {
    drawDrapeLines(ctx, centerX, adjTopY, drawW, drawH, drapeIntensity);
  } catch (err) {
    console.warn("[canvasFitCompositor] drape lines skipped", err);
  }

  // ── 4. TENSION OVERLAY (chest / shoulder tension lines) ──────────────────
  try {
    drawDetailOverlay(ctx, detail, frame, pose, isBottom);
  } catch (err) {
    console.warn("[canvasFitCompositor] detail overlay skipped", err);
  }

  // ── 5. FABRIC NOISE (kills flat-PNG sheen) ───────────────────────────────
  try {
    drawFabricNoise(ctx, centerX, adjTopY, drawW, drawH);
  } catch (err) {
    console.warn("[canvasFitCompositor] fabric noise skipped", err);
  }

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: frame.canvasWidth,
    height: frame.canvasHeight,
    debug: { chestScale, lengthScale, sleeveScale, bodySource, detail },
  };
}
