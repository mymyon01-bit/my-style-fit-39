// ─── GARMENT FALLBACK TABLE ─────────────────────────────────────────────────
// Category-specific size charts used when neither exact-size data nor a
// neighbor size are available in `garment_measurements`. Values are realistic
// industry medians and are CLEARLY marked as fallback so the UI surfaces an
// "approximate" warning. Never use these to claim exact precision.
//
// Source notes (all in cm):
// - Tops/shirts/hoodies/jackets — chest, shoulder, total length, sleeve
// - Pants/jeans — waist, hip, inseam, thigh
// - Skirts — waist, hip, total length
//
// Each entry is a per-size override. Sizes default to XS/S/M/L/XL/XXL.

import type { ResolvedGarmentSize } from "./garmentSizeResolver";

export type FallbackCategory =
  | "regular_shirt"
  | "oversized_shirt"
  | "hoodie"
  | "jacket"
  | "regular_pants"
  | "wide_pants"
  | "skirt"
  | "dress";

type Measurement = ResolvedGarmentSize["measurements"];

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"] as const;
type StandardSize = (typeof SIZE_ORDER)[number];

const FALLBACK_CHARTS: Record<FallbackCategory, Record<StandardSize, Measurement>> = {
  regular_shirt: {
    XS:  { shoulderCm: 41, chestCm: 96,  totalLengthCm: 65, sleeveLengthCm: 58 },
    S:   { shoulderCm: 43, chestCm: 100, totalLengthCm: 67, sleeveLengthCm: 59 },
    M:   { shoulderCm: 45, chestCm: 104, totalLengthCm: 69, sleeveLengthCm: 60 },
    L:   { shoulderCm: 47, chestCm: 108, totalLengthCm: 71, sleeveLengthCm: 61 },
    XL:  { shoulderCm: 49, chestCm: 112, totalLengthCm: 73, sleeveLengthCm: 62 },
    XXL: { shoulderCm: 51, chestCm: 116, totalLengthCm: 75, sleeveLengthCm: 63 },
  },
  oversized_shirt: {
    XS:  { shoulderCm: 50, chestCm: 110, totalLengthCm: 70, sleeveLengthCm: 56 },
    S:   { shoulderCm: 52, chestCm: 114, totalLengthCm: 72, sleeveLengthCm: 57 },
    M:   { shoulderCm: 54, chestCm: 118, totalLengthCm: 74, sleeveLengthCm: 58 },
    L:   { shoulderCm: 56, chestCm: 122, totalLengthCm: 76, sleeveLengthCm: 59 },
    XL:  { shoulderCm: 58, chestCm: 126, totalLengthCm: 78, sleeveLengthCm: 60 },
    XXL: { shoulderCm: 60, chestCm: 130, totalLengthCm: 80, sleeveLengthCm: 61 },
  },
  hoodie: {
    XS:  { shoulderCm: 47, chestCm: 108, totalLengthCm: 65, sleeveLengthCm: 60 },
    S:   { shoulderCm: 49, chestCm: 112, totalLengthCm: 67, sleeveLengthCm: 61 },
    M:   { shoulderCm: 51, chestCm: 116, totalLengthCm: 69, sleeveLengthCm: 62 },
    L:   { shoulderCm: 53, chestCm: 120, totalLengthCm: 71, sleeveLengthCm: 63 },
    XL:  { shoulderCm: 55, chestCm: 124, totalLengthCm: 73, sleeveLengthCm: 64 },
    XXL: { shoulderCm: 57, chestCm: 128, totalLengthCm: 75, sleeveLengthCm: 65 },
  },
  jacket: {
    XS:  { shoulderCm: 43, chestCm: 102, totalLengthCm: 66, sleeveLengthCm: 60 },
    S:   { shoulderCm: 45, chestCm: 106, totalLengthCm: 68, sleeveLengthCm: 61 },
    M:   { shoulderCm: 47, chestCm: 110, totalLengthCm: 70, sleeveLengthCm: 62 },
    L:   { shoulderCm: 49, chestCm: 114, totalLengthCm: 72, sleeveLengthCm: 63 },
    XL:  { shoulderCm: 51, chestCm: 118, totalLengthCm: 74, sleeveLengthCm: 64 },
    XXL: { shoulderCm: 53, chestCm: 122, totalLengthCm: 76, sleeveLengthCm: 65 },
  },
  regular_pants: {
    XS:  { waistCm: 70,  hipCm: 92,  inseamCm: 76, thighCm: 54 },
    S:   { waistCm: 74,  hipCm: 96,  inseamCm: 77, thighCm: 56 },
    M:   { waistCm: 78,  hipCm: 100, inseamCm: 78, thighCm: 58 },
    L:   { waistCm: 82,  hipCm: 104, inseamCm: 79, thighCm: 60 },
    XL:  { waistCm: 86,  hipCm: 108, inseamCm: 80, thighCm: 62 },
    XXL: { waistCm: 90,  hipCm: 112, inseamCm: 81, thighCm: 64 },
  },
  wide_pants: {
    XS:  { waistCm: 72,  hipCm: 100, inseamCm: 76, thighCm: 64 },
    S:   { waistCm: 76,  hipCm: 104, inseamCm: 77, thighCm: 66 },
    M:   { waistCm: 80,  hipCm: 108, inseamCm: 78, thighCm: 68 },
    L:   { waistCm: 84,  hipCm: 112, inseamCm: 79, thighCm: 70 },
    XL:  { waistCm: 88,  hipCm: 116, inseamCm: 80, thighCm: 72 },
    XXL: { waistCm: 92,  hipCm: 120, inseamCm: 81, thighCm: 74 },
  },
  skirt: {
    XS:  { waistCm: 64, hipCm: 88,  totalLengthCm: 50 },
    S:   { waistCm: 68, hipCm: 92,  totalLengthCm: 52 },
    M:   { waistCm: 72, hipCm: 96,  totalLengthCm: 54 },
    L:   { waistCm: 76, hipCm: 100, totalLengthCm: 56 },
    XL:  { waistCm: 80, hipCm: 104, totalLengthCm: 58 },
    XXL: { waistCm: 84, hipCm: 108, totalLengthCm: 60 },
  },
  dress: {
    XS:  { shoulderCm: 36, chestCm: 84,  waistCm: 66, totalLengthCm: 92 },
    S:   { shoulderCm: 37, chestCm: 88,  waistCm: 70, totalLengthCm: 94 },
    M:   { shoulderCm: 38, chestCm: 92,  waistCm: 74, totalLengthCm: 96 },
    L:   { shoulderCm: 39, chestCm: 96,  waistCm: 78, totalLengthCm: 98 },
    XL:  { shoulderCm: 40, chestCm: 100, waistCm: 82, totalLengthCm: 100 },
    XXL: { shoulderCm: 41, chestCm: 104, waistCm: 86, totalLengthCm: 102 },
  },
};

const ALPHA_TO_INDEX: Record<string, number> = {
  XS: 0, S: 1, M: 2, L: 3, XL: 4, XXL: 5, "2XL": 5, XXXL: 5, "3XL": 5,
};

/** Maps merchant category + product name into a fallback bucket. */
export function pickFallbackCategory(input: {
  category?: string | null;
  productName?: string | null;
}): FallbackCategory {
  const c = (input.category || "").toLowerCase();
  const n = (input.productName || "").toLowerCase();
  const hay = `${c} ${n}`;
  if (/(dress|gown|jumpsuit)/.test(hay)) return "dress";
  if (/(skirt)/.test(hay)) return "skirt";
  if (/(wide|baggy|loose|relax)/.test(hay) && /(pant|trouser|jean|short)/.test(hay)) return "wide_pants";
  if (/(pant|trouser|jean|short|legging|chino|slack)/.test(hay)) return "regular_pants";
  if (/(hood)/.test(hay)) return "hoodie";
  if (/(jacket|coat|blazer|outer|parka|puffer)/.test(hay)) return "jacket";
  if (/(oversize|baggy|boxy|relaxed fit)/.test(hay)) return "oversized_shirt";
  return "regular_shirt";
}

/** Normalizes any size label into the closest standard size. */
export function normalizeToStandardSize(raw: string): StandardSize | null {
  const u = (raw || "").trim().toUpperCase();
  if (!u) return null;
  if (u in ALPHA_TO_INDEX) return SIZE_ORDER[ALPHA_TO_INDEX[u]] as StandardSize;

  // Numeric size — map to nearest letter via common ranges.
  const n = parseFloat(u);
  if (Number.isFinite(n)) {
    if (n <= 26 || n <= 1)  return "XS";
    if (n <= 28 || n <= 3)  return "S";
    if (n <= 30 || n <= 5)  return "M";
    if (n <= 32 || n <= 7)  return "L";
    if (n <= 34 || n <= 9)  return "XL";
    return "XXL";
  }
  return null;
}

/**
 * Returns the fallback measurement set for a (category, size). Always returns
 * a value (defaults to "M" if size unrecognised) so the engine can compute a
 * region table even when DB has nothing — but the caller MUST mark the
 * resolved size as `source: "fallback"` and `confidence: "low"`.
 */
export function getFallbackMeasurements(input: {
  category?: string | null;
  productName?: string | null;
  selectedSize: string;
}): { category: FallbackCategory; size: StandardSize; measurements: Measurement } {
  const category = pickFallbackCategory(input);
  const size = normalizeToStandardSize(input.selectedSize) ?? "M";
  const measurements = FALLBACK_CHARTS[category][size];
  return { category, size, measurements };
}

/** Size grading deltas used to estimate from a NEIGHBOR known size (cm). */
export interface GradingDeltas {
  shoulderCm?: number;
  chestCm?: number;
  waistCm?: number;
  hipCm?: number;
  sleeveLengthCm?: number;
  totalLengthCm?: number;
  thighCm?: number;
  inseamCm?: number;
}

/** Per-step grading (XS→S, S→M, M→L …). Conservative industry medians. */
const GRADING_PER_STEP_TOP: GradingDeltas = {
  shoulderCm: 1.2,
  chestCm: 4,
  waistCm: 4,
  sleeveLengthCm: 1,
  totalLengthCm: 2,
};

const GRADING_PER_STEP_BOTTOM: GradingDeltas = {
  waistCm: 4,
  hipCm: 4,
  thighCm: 2,
  inseamCm: 0.7,
};

/**
 * Estimates measurements for the requested size by grading from a known
 * neighbour. Used when the DB has a row for "M" but the user picked "L".
 *
 *   targetIndex - sourceIndex = +N (positive = bigger)
 *   measurement_target = measurement_source + per_step_delta * N
 *
 * Fields not present in the source row stay undefined (engine will skip).
 */
export function gradeMeasurementsFromNeighbour(input: {
  source: Measurement;
  sourceSize: string;
  targetSize: string;
  isBottom: boolean;
}): { measurements: Measurement; steps: number } {
  const fromIdx = ALPHA_TO_INDEX[normalizeToStandardSize(input.sourceSize) ?? "M"] ?? 2;
  const toIdx = ALPHA_TO_INDEX[normalizeToStandardSize(input.targetSize) ?? "M"] ?? 2;
  const steps = toIdx - fromIdx;
  if (steps === 0) return { measurements: { ...input.source }, steps: 0 };

  const deltas = input.isBottom ? GRADING_PER_STEP_BOTTOM : GRADING_PER_STEP_TOP;
  const grade = <K extends keyof Measurement>(key: K): number | undefined => {
    const base = input.source[key];
    const d = deltas[key as keyof GradingDeltas];
    if (typeof base !== "number" || typeof d !== "number") return base ?? undefined;
    return Math.round((base + d * steps) * 10) / 10;
  };

  const measurements: Measurement = {
    shoulderCm:      grade("shoulderCm"),
    chestCm:         grade("chestCm"),
    waistCm:         grade("waistCm"),
    hipCm:           grade("hipCm"),
    sleeveLengthCm:  grade("sleeveLengthCm"),
    totalLengthCm:   grade("totalLengthCm"),
    thighCm:         grade("thighCm"),
    inseamCm:        grade("inseamCm"),
    riseCm:          input.source.riseCm,
    stretchFactor:   input.source.stretchFactor,
  };
  return { measurements, steps };
}
