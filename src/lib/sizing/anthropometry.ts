// ─── ANTHROPOMETRY ──────────────────────────────────────────────────────────
// Deterministic body-measurement estimator. Same input MUST always produce
// the same output.
//
// TWO-AXIS MODEL (per strict FIT spec sections [13]–[16]):
//   1. HEIGHT  — drives vertical length (shoulder, inseam, sleeve, torso)
//   2. WEIGHT  — drives horizontal volume (chest, waist, hip, thigh, arm)
//   They scale INDEPENDENTLY. A 170cm/100kg body must be SHORT + WIDE,
//   a 190cm/60kg body must be TALL + NARROW. Never scale uniformly.
//
// Width formula:
//   base_width = (height * gender_ratio)        ← from spec
//   bmi_adj    = (bmi - 22) * REGION_BMI_GAIN   ← volumetric scaling
//   final      = base_width + body_type_adj + bmi_adj
//
//   body_type_adj  → slim: −3, regular: 0, solid: +5, heavy: +10  (cm)
//   REGION_BMI_GAIN → chest 1.6, waist 2.2, hip 1.8, thigh 1.0, arm 0.6
//     (per cm-of-circumference per BMI point above/below 22)
//
// Result: at 175cm height, going from 60→100kg now adds ~26cm to waist
// circumference (was +10cm), making the size difference visually obvious
// in any downstream mannequin/visual rendering.

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

/**
 * Per-region BMI gain (cm circumference per BMI point above/below 22).
 * Tuned so 60kg→100kg @ 175cm produces realistic deltas:
 *   waist gain ≈ 2.2 cm × (BMI_100 - BMI_22) ≈ 2.2 × 10.6 ≈ +23cm
 * Shoulder & sleeve barely scale with weight (skeletal). Length never does.
 */
const BMI_GAIN: Record<"chest" | "waist" | "hip" | "thigh" | "shoulder" | "sleeve", number> = {
  chest:    1.6,
  waist:    2.2,
  hip:      1.8,
  thigh:    1.0,
  shoulder: 0.15,
  sleeve:   0.10,
};

/** Compute BMI deviation from the 22 baseline (positive = heavier). */
function bmiDelta(heightCm: number, weightKg: number | null | undefined): number {
  if (!weightKg || !heightCm) return 0;
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  // Clamp to a realistic adult range so extreme inputs don't break math.
  const clamped = Math.min(40, Math.max(15, bmi));
  return clamped - 22;
}

/** Returns deterministic measurements per the strict FIT spec. */
export function estimateAnthropometry(input: AnthropometryInput): AnthropometryOutput {
  const h = input.heightCm;
  const w = input.weightKg ?? null;
  const adj = input.bodyType
    ? BODY_TYPE_ADJ[input.bodyType]
    : adjFromWeight(h, w);

  // Volumetric BMI delta — drives horizontal width/volume independently
  // of the height-driven baseline. Same height + heavier weight → wider body.
  const bd = bmiDelta(h, w);

  // ── 1. HEIGHT-DRIVEN BASELINE (skeletal frame) ──
  let shoulderCm: number;
  let chestCm: number;
  let waistCm: number;
  let hipCm: number;

  if (input.gender === "male") {
    shoulderCm = h * 0.26;
    chestCm    = h * 0.52;
    waistCm    = h * 0.45;
    hipCm      = (h * 0.45) * 1.05;
  } else if (input.gender === "female") {
    shoulderCm = h * 0.23;
    chestCm    = h * 0.49;
    waistCm    = h * 0.38;
    hipCm      = h * 0.54;
  } else {
    shoulderCm = h * 0.245;
    chestCm    = h * 0.505;
    waistCm    = h * 0.415;
    hipCm      = h * 0.535;
  }

  // ── 2. WEIGHT/BMI-DRIVEN VOLUMETRIC ADD ──
  // Weight visibly affects circumference, NOT skeletal width. So shoulder
  // gets a tiny BMI bump (fat layer over deltoids), but chest/waist/hip get
  // the full volumetric scaling.
  shoulderCm += bd * BMI_GAIN.shoulder;
  chestCm    += adj + bd * BMI_GAIN.chest;
  waistCm    += adj + bd * BMI_GAIN.waist;
  hipCm      += adj + bd * BMI_GAIN.hip;

  // ── 3. SHAPE-SCALE (slim/regular/solid/heavy fine-tuning) ──
  const s = input.shapeScales ?? {};
  shoulderCm *= clampScale(s.shoulderWidthScale, 0.85, 1.15);
  chestCm    *= clampScale(s.chestScale,         0.85, 1.20);
  waistCm    *= clampScale(s.waistScale,         0.80, 1.25);
  hipCm      *= clampScale(s.hipScale ?? s.waistScale, 0.85, 1.20);

  // ── 4. LENGTH SEGMENTS — height only, NOT affected by weight ──
  const inseamRatio = input.gender === "female" ? 0.460 : 0.450;
  const sleeveRatio = input.gender === "female" ? 0.330 : 0.340;
  const inseamCm = h * inseamRatio * clampScale(s.legScale, 0.90, 1.10);
  // Sleeve gets a tiny BMI add (bicep volume) but stays mostly height-driven.
  const sleeveCm = h * sleeveRatio + bd * BMI_GAIN.sleeve;

  // ── 5. THIGH — derived from hip with own BMI gain ──
  const thighCm = (hipCm * 0.58) * clampScale(s.legScale, 0.85, 1.20)
                + bd * BMI_GAIN.thigh;

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

/** BMI category — exposed so the visual prompt can describe the build. */
export function bmiCategory(heightCm: number, weightKg: number | null | undefined):
  "verySlim" | "slim" | "regular" | "solid" | "heavy" {
  if (!weightKg || !heightCm) return "regular";
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  if (bmi < 18.5) return "verySlim";
  if (bmi < 22)   return "slim";
  if (bmi < 25)   return "regular";
  if (bmi < 30)   return "solid";
  return "heavy";
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
