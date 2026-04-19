// ─── SCORE WRAPPER ──────────────────────────────────────────────────────────
// Re-exports the canonical computeFit so the active path imports from /lib/fit.
// Real scoring lives in fitEngine.ts (recalibrated weights: shoulder>chest>waist>length).

export { computeFit } from "../fitEngine";
export type { FitResult, SizeFitResult, RegionFit, BodyMeasurements, ProductFitData } from "../fitEngine";
