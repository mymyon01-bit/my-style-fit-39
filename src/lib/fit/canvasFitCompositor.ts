// ─── CANVAS FIT COMPOSITOR ─────────────────────────────────────────────────
// Pure HTMLCanvas drawing — no AI. Combines:
//   1. body image (or generated silhouette)
//   2. garment cutout, scaled non-uniformly per fitSolver region ratios
//   3. positioned via shoulder + hip keypoints
//
// Output: a data URL (PNG) the FitVisual can render immediately.
//
// Size differences are visible because the garment is scaled by the actual
// chest/waist/length ratios coming out of the SolverResult — S vs XL produces
// clearly different overlay widths and lengths.

import type { ProjectedPose } from "./poseKeypoints";
import type { BodyFrame } from "./buildBodyFrame";
import type { SolverResult } from "./fitSolver";

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
  // delta is roughly in [-0.05, 0.20]. Multiply by gain to amplify visually,
  // then add to base so 0 → 1.0, +0.10 → ~1.06, -0.05 → ~0.97.
  return Math.max(0.85, Math.min(1.25, base + delta * gain));
}

function drawSilhouette(ctx: CanvasRenderingContext2D, frame: BodyFrame) {
  // Soft neutral silhouette so the garment overlay reads even without a photo.
  const grad = ctx.createLinearGradient(0, 0, 0, frame.canvasHeight);
  grad.addColorStop(0, "rgba(245, 244, 240, 1)");
  grad.addColorStop(1, "rgba(228, 226, 220, 1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, frame.canvasWidth, frame.canvasHeight);

  // Head
  ctx.fillStyle = "rgba(210, 205, 195, 0.85)";
  ctx.beginPath();
  const headCx = (frame.leftShoulderX + frame.rightShoulderX) / 2;
  ctx.ellipse(headCx, frame.shoulderLineY - 130, 70, 90, 0, 0, Math.PI * 2);
  ctx.fill();

  // Torso + arms (simple polygon)
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
    // Cover-fit into canvas
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

export async function composeFitImage(args: CompositeArgs): Promise<CompositeResult> {
  const { frame, pose, solver, garmentImageUrl, bodyImageUrl } = args;
  const isBottom =
    /(pant|jean|trouser|short|skirt|legging|bottom)/i.test(args.productCategory || "");

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
    // Without a garment we still return the body — never blank.
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: frame.canvasWidth,
      height: frame.canvasHeight,
      debug: { chestScale: 1, lengthScale: 1, sleeveScale: 1, bodySource },
    };
  }

  // Scaling driven by SolverResult — this is what makes S vs XL visible.
  const chestScale = regionDeltaToScale(solver.regions.chest.delta, 1.0, 0.8);
  const waistScale = regionDeltaToScale(solver.regions.waist.delta, 1.0, 0.7);
  const lengthScale = regionDeltaToScale(solver.regions.length.delta, 1.0, 0.5);
  const sleeveScale = regionDeltaToScale(solver.regions.sleeve.delta, 1.0, 0.7);

  // Use shoulder→hip span as the body anchor for tops; hip→canvas-bottom for bottoms.
  const shoulderMidX = (pose.leftShoulder.x + pose.rightShoulder.x) / 2;
  const shoulderY = (pose.leftShoulder.y + pose.rightShoulder.y) / 2;
  const hipMidX = (pose.leftHip.x + pose.rightHip.x) / 2;
  const hipY = (pose.leftHip.y + pose.rightHip.y) / 2;
  const shoulderWidth = Math.abs(pose.rightShoulder.x - pose.leftShoulder.x);
  const torsoHeight = Math.max(60, hipY - shoulderY);

  // Garment width = shoulderWidth (or waistWidth for bottoms) × chestScale.
  // Add padding so cutouts that include sleeves don't clip.
  let targetW: number;
  let targetH: number;
  let topY: number;
  let centerX: number;

  if (isBottom) {
    const waistWidth = Math.max(80, Math.abs(pose.rightHip.x - pose.leftHip.x));
    targetW = waistWidth * 1.6 * waistScale;
    targetH = (frame.canvasHeight - hipY - 30) * lengthScale;
    centerX = hipMidX;
    topY = hipY - 20;
  } else {
    targetW = shoulderWidth * 1.55 * chestScale * Math.max(1, sleeveScale * 0.95);
    targetH = torsoHeight * 1.65 * lengthScale;
    centerX = shoulderMidX;
    topY = shoulderY - shoulderWidth * 0.15;
  }

  // Preserve garment aspect ratio loosely — allow some non-uniform stretch.
  const garmentAspect = garmentImg.height / garmentImg.width;
  const aspectH = targetW * garmentAspect;
  // Blend solver-driven height with natural aspect to get visible length diffs
  // without crushing the cutout.
  const drawH = aspectH * 0.6 + targetH * 0.4;
  const drawW = targetW;

  ctx.save();
  ctx.globalAlpha = args.garmentOpacity ?? 1;
  // If we're using the original (non-cutout) product image (white bg), use
  // multiply blend so the white disappears against the body. Pure cutouts
  // (transparent PNG) draw normally — multiply still looks fine on neutral bg.
  if (bodySource === "photo") {
    ctx.globalCompositeOperation = "multiply";
  }
  ctx.drawImage(
    garmentImg,
    centerX - drawW / 2,
    topY,
    drawW,
    drawH
  );
  ctx.restore();

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: frame.canvasWidth,
    height: frame.canvasHeight,
    debug: { chestScale, lengthScale, sleeveScale, bodySource },
  };
}
