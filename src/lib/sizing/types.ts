// ─── SIZING ENGINE TYPES ────────────────────────────────────────────────────
// Measurement-driven sizing pipeline. Replaces the legacy fitEngine for
// USER-VISIBLE recommendations. The locked working FIT visual pipeline
// (fit-generate-v2 → Replicate IDM-VTON, canvas hooks) is untouched —
// it just consumes the structured `fitOutcomes` we produce here.

export type Gender = "male" | "female" | "neutral";

export type FitPreference = "fitted" | "regular" | "relaxed" | "oversized";

export type MeasurementSource = "exact" | "inferred" | "default";

export interface MeasurementValue {
  cm: number;
  source: MeasurementSource;
}

/** All body measurements relevant to garment fit. Inferred values are flagged. */
export interface ResolvedBody {
  gender: Gender;
  heightCm: MeasurementValue;
  weightKg: MeasurementValue | null;
  shoulderCm: MeasurementValue;
  chestCm: MeasurementValue;
  waistCm: MeasurementValue;
  hipCm: MeasurementValue;
  inseamCm: MeasurementValue;
  sleeveCm: MeasurementValue;
  thighCm: MeasurementValue;
  bmi: number | null;
  /** True when ANY of shoulder/chest/waist/hip/inseam was inferred or defaulted. */
  hasInferredFields: boolean;
  /** Names of measurement fields that are NOT user-provided. */
  inferredFieldNames: string[];
}

/** Garment categories with distinct fit logic. */
export type SizingCategory =
  | "tshirt"      // soft jersey top, light ease
  | "shirt"       // structured woven shirt
  | "hoodie"     // casual fleece pullover, generous ease
  | "knit"        // sweater / knitwear, mid ease, allows slight stretch
  | "jacket"      // bomber, denim jacket, light outerwear
  | "coat"        // overcoat / parka, heavy outerwear, max ease
  | "pants"       // trousers / chinos
  | "denim"       // jeans, low stretch
  | "shorts"
  | "dress"
  | "skirt"
  | "cropped"     // cropped top — short length is intentional
  | "other";

export type Region =
  | "shoulder" | "chest" | "waist" | "hip"
  | "sleeve"   | "length" | "thigh" | "inseam";

export type RegionStatus =
  | "tooTight"
  | "slightlyTight"
  | "regular"
  | "slightlyLoose"
  | "loose"
  | "oversized";

export type OverallFitLabel =
  | "verySmall"
  | "tightFit"
  | "fitted"
  | "regularFit"
  | "relaxedFit"
  | "oversizedFit"
  | "tooLarge";

export interface RegionOutcome {
  region: Region;
  status: RegionStatus;
  /** garment − body, in cm. Positive = room. Null when neither side is known. */
  deltaCm: number | null;
  /** Source of the garment number used. */
  garmentSource: "exact" | "graded" | "categoryDefault" | "missing";
}

export interface SizeOutcome {
  /** Original retailer label, e.g. "M", "32", "L". */
  size: string;
  /** Computed regions (only the ones relevant for the category). */
  regions: RegionOutcome[];
  overall: OverallFitLabel;
  /** 0–100 score used for sorting. NOT shown to the user as truth. */
  score: number;
  /** One-line plain-English summary, e.g. "Tight in chest, short in length". */
  summary: string;
}

export type RecommendationConfidence = "high" | "medium" | "low";

export interface SizeRecommendation {
  category: SizingCategory;
  /** Sorted by retail order (XS→XXL or numeric ascending). */
  sizes: SizeOutcome[];
  primarySize: string | null;
  alternateSize: string | null;
  /** Why the primary was picked (1–2 sentences). */
  primaryReason: string;
  confidence: RecommendationConfidence;
  /** Why confidence is what it is (chart completeness + body completeness). */
  confidenceReason: string;
  /** Style preference active at compute time. */
  preference: FitPreference;
  /** True if any category-default fallback was used. */
  usedCategoryDefaults: boolean;
  /**
   * "tooSmall"  → user's body exceeds the largest size in the chart (e.g. 180/100kg picking S).
   * "tooLarge"  → user's body is below the smallest size in the chart.
   * "ok"        → at least one size in the chart actually fits.
   */
  rangeStatus: "ok" | "tooSmall" | "tooLarge";
  /** Plain-English warning when rangeStatus !== "ok". */
  rangeWarning: string | null;
}
