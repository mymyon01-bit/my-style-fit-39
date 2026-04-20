// ─── GARMENT OVERLAY MAP ────────────────────────────────────────────────────
// Converts (BodyFrame + GarmentFitMap + SolverResult + selectedSize) into
// PIXEL-LEVEL placement values driven by fitSolver.
//
// Same body frame, different overlay map per size → S/M/L/XL produce
// visibly different garment width, length, sleeve volume.

import type { BodyFrame } from "./buildBodyFrame";
import type { GarmentFitMap } from "./buildGarmentFitMap";
import type { SolverResult } from "./fitSolver";

export interface GarmentOverlayMap {
  // Garment widths at each anchor line (full width in px)
  chestWidthPx: number;
  waistWidthPx: number;
  hemWidthPx: number;
  // Vertical: where the garment ends (hem line in px)
  bodyLengthPx: number;
  // Shoulder seam offset from natural shoulder (positive = dropped onto arm)
  shoulderDropPx: number;
  // Sleeves
  sleeveWidthPx: number;
  sleeveLengthPx: number;
  // Drape depth — controls fold/shadow strength (0..1)
  drapeCurve: number;
  // For prompt + cache — descriptive labels per region
  fitType: SolverResult["fitType"];
  silhouette: GarmentFitMap["silhouetteType"];
  selectedSize: string;
  regionLabels: {
    chest: string;
    waist: string;
    shoulder: string;
    length: string;
    sleeve: string;
  };
}

const r = (n: number) => Math.round(n);

// Convert a body half-width to a garment full width with ease applied.
// ease is a unitless ratio (e.g. 0.07 → +7% of body girth).
function girthWithEase(bodyHalfWidthPx: number, ease: number): number {
  return r(bodyHalfWidthPx * 2 * (1 + Math.max(-0.05, ease)));
}

export function buildGarmentOverlayMap(args: {
  frame: BodyFrame;
  fit: GarmentFitMap;
  solver: SolverResult;
  selectedSize: string;
}): GarmentOverlayMap {
  const { frame, fit, solver, selectedSize } = args;

  const bodyChestHalf = (frame.torsoRightX - frame.torsoLeftX) / 2;
  const bodyWaistHalf = (frame.waistRightX - frame.waistLeftX) / 2;

  const chestWidthPx = girthWithEase(bodyChestHalf, fit.chestEase);
  const waistWidthPx = girthWithEase(bodyWaistHalf, fit.waistEase);
  const hemWidthPx = girthWithEase(bodyWaistHalf, fit.hemEase);

  // bodyLengthDelta is relative to torso length. Convert to px against the
  // shoulder→hem baseline (~480 px) so size differences are visible.
  const baselineLength = frame.hemLineY - frame.shoulderLineY;
  const bodyLengthPx = r(baselineLength * (1 + fit.bodyLengthDelta));

  // Shoulder drop (positive = past natural shoulder onto upper arm)
  const shoulderDropPx = r(40 * Math.max(0, fit.shoulderDrop) * 2.2);

  // Sleeves — bottom category clamps these to 0 already in fitMap
  const refArmW = frame.armRightBox.w;
  const sleeveWidthPx = r(refArmW * (1 + fit.sleeveVolume * 1.6));
  const sleeveLengthPx = r(frame.armRightBox.h * (1 + fit.sleeveLengthDelta));

  return {
    chestWidthPx,
    waistWidthPx,
    hemWidthPx,
    bodyLengthPx,
    shoulderDropPx,
    sleeveWidthPx,
    sleeveLengthPx,
    drapeCurve: Math.min(1, Math.max(0, fit.drapeDepth * 4)),
    fitType: solver.fitType,
    silhouette: fit.silhouetteType,
    selectedSize,
    regionLabels: {
      chest: solver.regions.chest.fit,
      waist: solver.regions.waist.fit,
      shoulder: solver.regions.shoulder.fit,
      length: solver.regions.length.fit,
      sleeve: solver.regions.sleeve.fit,
    },
  };
}

/** Build a coordinate-aware paragraph the image generator can follow. */
export function describeOverlayForPrompt(map: GarmentOverlayMap, frame: BodyFrame): string {
  return [
    `Garment placed on a fixed ${frame.canvasWidth}x${frame.canvasHeight} body frame.`,
    `Shoulder line at y=${frame.shoulderLineY}, chest line at y=${frame.chestLineY}, waist at y=${frame.waistLineY}, hem at y=${frame.shoulderLineY + map.bodyLengthPx}.`,
    `Garment width: chest ${map.chestWidthPx}px, waist ${map.waistWidthPx}px, hem ${map.hemWidthPx}px.`,
    map.shoulderDropPx > 0
      ? `Shoulder seam drops ${map.shoulderDropPx}px past the natural shoulder onto the upper arm.`
      : `Shoulder seam sits cleanly on the natural shoulder point.`,
    map.sleeveWidthPx > 0
      ? `Sleeve width approximately ${map.sleeveWidthPx}px, sleeve length ${map.sleeveLengthPx}px.`
      : `Bottom garment — no sleeves.`,
    `Drape strength ${(map.drapeCurve * 100).toFixed(0)}% — render fold/shadow depth accordingly.`,
    `Region labels — chest:${map.regionLabels.chest}, waist:${map.regionLabels.waist}, shoulder:${map.regionLabels.shoulder}, length:${map.regionLabels.length}, sleeve:${map.regionLabels.sleeve}.`,
    `Silhouette: ${map.silhouette.toUpperCase()} (size ${map.selectedSize}). The garment must visibly reflect this size — narrower/shorter for S, wider/longer for L/XL.`,
  ].join(" ");
}
