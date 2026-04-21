// ─── Module D — FitCoordinateMapper ──────────────────────────────────────────
// Converts measurement deltas into normalized visual placement hints. NOT a
// 3D solver — just a consistent, explainable "where does this garment sit"
// model that drives the prompt builder and (optionally) any UI silhouette
// overlays.

import type { FitComputationResult, FitRegionResult } from "./types";

export interface VisualAdjustments {
  // 0..2 multipliers around 1.0 (= true to body)
  shoulderWidth: number;
  torsoVolume: number;
  waistCinch: number;     // <1 cinched, =1 straight, >1 loose
  hipVolume: number;
  thighWidth: number;
  // signed offsets in normalized 0..1 of body height (positive = lower)
  sleeveEndOffset: number;  // 0 = wrist, +0.05 = 5% past wrist
  hemOffset: number;        // 0 = natural hem point, +0.05 = below natural
  inseamOffset: number;
  riseOffset: number;
  silhouette: "fitted" | "balanced" | "relaxed" | "oversized";
}

function widthFromLabel(label: FitRegionResult["label"]): number {
  switch (label) {
    case "tight": return 0.92;
    case "close": return 0.97;
    case "ideal": return 1.0;
    case "relaxed": return 1.07;
    case "oversized": return 1.18;
    default: return 1.0;
  }
}

function offsetFromLengthLabel(label: FitRegionResult["label"]): number {
  switch (label) {
    case "too-short": return -0.06;
    case "slightly-short": return -0.025;
    case "ideal": return 0;
    case "slightly-long": return 0.03;
    case "too-long": return 0.07;
    default: return 0;
  }
}

function regionLabel(fit: FitComputationResult, region: FitRegionResult["region"]) {
  return fit.regions.find(r => r.region === region)?.label ?? "n/a";
}

export function computeVisualAdjustments(fit: FitComputationResult): VisualAdjustments {
  const adj: VisualAdjustments = {
    shoulderWidth: widthFromLabel(regionLabel(fit, "shoulder")),
    torsoVolume:   widthFromLabel(regionLabel(fit, "chest")),
    waistCinch:    widthFromLabel(regionLabel(fit, "waist")),
    hipVolume:     widthFromLabel(regionLabel(fit, "hip")),
    thighWidth:    widthFromLabel(regionLabel(fit, "thigh")),
    sleeveEndOffset: offsetFromLengthLabel(regionLabel(fit, "sleeve")),
    hemOffset:       offsetFromLengthLabel(regionLabel(fit, "length")),
    inseamOffset:    offsetFromLengthLabel(regionLabel(fit, "inseam")),
    riseOffset:      offsetFromLengthLabel(regionLabel(fit, "rise")),
    silhouette:
      fit.overallFit === "tight" ? "fitted"
      : fit.overallFit === "oversized" ? "oversized"
      : fit.overallFit === "relaxed" ? "relaxed"
      : "balanced",
  };
  return adj;
}
