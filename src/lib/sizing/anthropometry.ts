// ─── ANTHROPOMETRY ──────────────────────────────────────────────────────────
// Estimate body segments from height + weight + gender when the user has not
// provided the exact value. Sources: anthropometric averages from ISO 8559 +
// CAESAR survey. NEVER pretend these are measured — every estimate is flagged
// as `inferred` so the UI can warn the user.

import type { Gender, MeasurementValue } from "./types";

export interface AnthropometryInput {
  gender: Gender;
  heightCm: number;
  /** Optional — needed for chest/waist/hip estimates. */
  weightKg?: number | null;
  /**
   * Optional per-region multipliers from the user's stated body type
   * (slim/regular/solid/heavy → shoulder/chest/waist/hip/thigh scales).
   * When supplied, these are applied AFTER BMI-driven baselines so two users
   * of the same height/weight but different body types do NOT collapse into
   * identical proportions. Each scale is centered on 1.0.
   */
  shapeScales?: {
    shoulderWidthScale?: number;
    chestScale?: number;
    waistScale?: number;
    /** Optional hip scale; defaults to waist scale when omitted (typical pear/apple). */
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

const REF_BMI = 22; // average healthy adult

function bmiOf(h: number, w: number | null | undefined): number {
  if (!w || !h) return REF_BMI;
  return w / Math.pow(h / 100, 2);
}

/** Returns plausible-average measurements for a person with the given height. */
export function estimateAnthropometry(input: AnthropometryInput): AnthropometryOutput {
  const h = input.heightCm;
  const bmi = bmiOf(h, input.weightKg);
  const bmiDelta = bmi - REF_BMI;

  // Shoulder: men ≈ 0.259*H, women ≈ 0.241*H, neutral 0.250 (CAESAR averages)
  const shoulderRatio =
    input.gender === "male" ? 0.259 :
    input.gender === "female" ? 0.241 :
    0.250;

  // Inseam: men 0.45*H, women 0.46*H (women slightly longer leg ratio)
  const inseamRatio =
    input.gender === "male" ? 0.450 :
    input.gender === "female" ? 0.460 :
    0.455;

  // Sleeve length (shoulder→wrist): ~0.34*H men, 0.33*H women
  const sleeveRatio = input.gender === "female" ? 0.330 : 0.340;

  // Chest/waist/hip: based on BMI deviation from reference + gender baseline
  const baseline = baselineCircumferences(input.gender);

  // Apply body-type scales so different builds don't collapse into the same shape.
  // Each scale is centered on 1.0; defaults preserve legacy behaviour exactly.
  const s = input.shapeScales ?? {};
  const shoulderScale = clampScale(s.shoulderWidthScale, 0.85, 1.15);
  const chestScale    = clampScale(s.chestScale,         0.85, 1.20);
  const waistScale    = clampScale(s.waistScale,         0.80, 1.25);
  const hipScale      = clampScale(s.hipScale ?? s.waistScale, 0.85, 1.20);
  const legScale      = clampScale(s.legScale,           0.85, 1.20);

  const shoulderCm = h * shoulderRatio * shoulderScale;
  const inseamCm = h * inseamRatio;
  const sleeveCm = h * sleeveRatio;
  const chestCm = (baseline.chest + bmiDelta * baseline.chestPerBmi) * chestScale;
  const waistCm = (baseline.waist + bmiDelta * baseline.waistPerBmi) * waistScale;
  const hipCm   = (baseline.hip   + bmiDelta * baseline.hipPerBmi)   * hipScale;
  const thighCm = (baseline.thigh + bmiDelta * baseline.thighPerBmi) * legScale;

  return {
    shoulderCm: round1(shoulderCm),
    chestCm: round1(chestCm),
    waistCm: round1(waistCm),
    hipCm: round1(hipCm),
    inseamCm: round1(inseamCm),
    sleeveCm: round1(sleeveCm),
    thighCm: round1(thighCm),
  };
}

function clampScale(v: number | null | undefined, min: number, max: number): number {
  if (typeof v !== "number" || !isFinite(v) || v <= 0) return 1;
  return Math.min(max, Math.max(min, v));
}

function baselineCircumferences(g: Gender) {
  // CAESAR / ISO 8559 averages for a 22-BMI adult, adjusted slightly per gender.
  if (g === "male") {
    return {
      chest: 96, chestPerBmi: 1.8,
      waist: 82, waistPerBmi: 2.2,
      hip:   96, hipPerBmi:   1.5,
      thigh: 56, thighPerBmi: 1.0,
    };
  }
  if (g === "female") {
    return {
      chest: 88, chestPerBmi: 1.7,
      waist: 72, waistPerBmi: 2.0,
      hip:   97, hipPerBmi:   1.7,
      thigh: 56, thighPerBmi: 1.1,
    };
  }
  return {
    chest: 92, chestPerBmi: 1.75,
    waist: 78, waistPerBmi: 2.1,
    hip:   96, hipPerBmi:   1.6,
    thigh: 56, thighPerBmi: 1.05,
  };
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
