// ─── ANTHROPOMETRY ──────────────────────────────────────────────────────────
// Deterministic body-measurement estimator. Replaces BMI-curve guessing with
// fixed, rule-based formulas the user explicitly specified. Same input MUST
// always produce the same output.
//
// Formulas (per the strict FIT spec):
//
//   MALE
//     chest    = (height * 0.52) + weight_adj
//     waist    = (height * 0.45) + weight_adj
//     shoulder = (height * 0.26)
//     hip      = waist * 1.05
//
//   FEMALE
//     chest    = (height * 0.49) + weight_adj
//     waist    = (height * 0.38) + weight_adj
//     hip      = (height * 0.54) + weight_adj
//     shoulder = (height * 0.23)
//
//   weight_adj  → slim: −3, regular: 0, solid: +5, heavy: +10
//
// Inseam, sleeve, thigh fall back to standard ratios since the spec doesn't
// dictate them. Every estimate is flagged `inferred` so the UI can warn.

import type { Gender, MeasurementValue, BodyType } from "./types";

export interface AnthropometryInput {
  gender: Gender;
  heightCm: number;
  /** Optional — used when bodyType isn't provided to derive a sensible adj. */
  weightKg?: number | null;
  /** User's stated build. Drives the fixed weight_adjustment offset. */
  bodyType?: BodyType | null;
  /**
   * Optional per-region multipliers from the BodyShape selectors
   * (shoulder/chest/waist/hip/leg). Applied AFTER the formula so the same
   * H/W/bodyType can still vary slightly per shape. Centered on 1.0.
   */
  shapeScales?: {
    shoulderWidthScale?: number;
    chestScale?: number;
    waistScale?: number;
    hipScale?: number;
    legScale?: number;
  } | null;
}

export interface AnthropometryOutput {
  shoulderCm: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
  inseamCm: number;
  sleeveCm: number;
  thighCm: number;
}

/** Fixed weight adjustments (cm) per body type. Deterministic. */
const BODY_TYPE_ADJ: Record<BodyType, number> = {
  slim: -3,
  regular: 0,
  solid: 5,
  heavy: 10,
};

/** Fallback weight_adj when bodyType is missing — derived from BMI bucket. */
function adjFromWeight(heightCm: number, weightKg: number | null | undefined): number {
  if (!weightKg || !heightCm) return 0;
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  if (bmi < 19) return BODY_TYPE_ADJ.slim;
  if (bmi < 25) return BODY_TYPE_ADJ.regular;
  if (bmi < 29) return BODY_TYPE_ADJ.solid;
  return BODY_TYPE_ADJ.heavy;
}

/** Returns deterministic measurements per the strict FIT spec. */
export function estimateAnthropometry(input: AnthropometryInput): AnthropometryOutput {
  const h = input.heightCm;
  const adj = input.bodyType
    ? BODY_TYPE_ADJ[input.bodyType]
    : adjFromWeight(h, input.weightKg);

  // Deterministic baseline from the spec.
  let shoulderCm: number;
  let chestCm: number;
  let waistCm: number;
  let hipCm: number;

  if (input.gender === "male") {
    shoulderCm = h * 0.26;
    chestCm    = h * 0.52 + adj;
    waistCm    = h * 0.45 + adj;
    hipCm      = waistCm * 1.05;
  } else if (input.gender === "female") {
    shoulderCm = h * 0.23;
    chestCm    = h * 0.49 + adj;
    waistCm    = h * 0.38 + adj;
    hipCm      = h * 0.54 + adj;
  } else {
    // Neutral = average of the two. Still deterministic.
    shoulderCm = h * 0.245;
    chestCm    = h * 0.505 + adj;
    waistCm    = h * 0.415 + adj;
    hipCm      = h * 0.535 + adj;
  }

  // Apply shape-scale multipliers (clamped). Default 1.0 = no change.
  const s = input.shapeScales ?? {};
  shoulderCm *= clampScale(s.shoulderWidthScale, 0.85, 1.15);
  chestCm    *= clampScale(s.chestScale,         0.85, 1.20);
  waistCm    *= clampScale(s.waistScale,         0.80, 1.25);
  hipCm      *= clampScale(s.hipScale ?? s.waistScale, 0.85, 1.20);

  // Length-related segments — standard ratios (no spec value provided).
  const inseamRatio = input.gender === "female" ? 0.460 : 0.450;
  const sleeveRatio = input.gender === "female" ? 0.330 : 0.340;
  const inseamCm = h * inseamRatio * clampScale(s.legScale, 0.90, 1.10);
  const sleeveCm = h * sleeveRatio;

  // Thigh — derived from hip ratio (no spec value).
  const thighCm = hipCm * 0.58 * clampScale(s.legScale, 0.85, 1.20);

  return {
    shoulderCm: round1(shoulderCm),
    chestCm:    round1(chestCm),
    waistCm:    round1(waistCm),
    hipCm:      round1(hipCm),
    inseamCm:   round1(inseamCm),
    sleeveCm:   round1(sleeveCm),
    thighCm:    round1(thighCm),
  };
}

function clampScale(v: number | null | undefined, min: number, max: number): number {
  if (typeof v !== "number" || !isFinite(v) || v <= 0) return 1;
  return Math.min(max, Math.max(min, v));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function asInferred(cm: number): MeasurementValue {
  return { cm: round1(cm), source: "inferred" };
}
export function asExact(cm: number): MeasurementValue {
  return { cm: round1(cm), source: "exact" };
}
export function asDefault(cm: number): MeasurementValue {
  return { cm: round1(cm), source: "default" };
}
